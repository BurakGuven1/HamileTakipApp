-- A father linked with a family code receives one calendar month of Premium
-- access when the mother/owner has an active Premium subscription. The grant
-- is anchored to the family owner so signing in again cannot restart it.

create table if not exists public.family_premium_trials (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  activated_by uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

comment on table public.family_premium_trials is
  'One-time Premium sharing window started by the first father link while the family owner is Premium.';

alter table public.family_premium_trials enable row level security;
revoke all on table public.family_premium_trials from anon, authenticated;

create or replace function public.has_active_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'grace_period')
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.has_active_subscription(uuid) from public;

create or replace function public.start_family_premium_trial_if_eligible(
  p_owner_id uuid,
  p_member_id uuid,
  p_starts_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_id is null or p_member_id is null then
    return;
  end if;

  if not public.has_active_subscription(p_owner_id) then
    return;
  end if;

  insert into public.family_premium_trials (
    owner_id,
    activated_by,
    starts_at,
    expires_at
  )
  values (
    p_owner_id,
    p_member_id,
    p_starts_at,
    p_starts_at + interval '1 month'
  )
  on conflict (owner_id) do nothing;
end;
$$;

revoke all on function public.start_family_premium_trial_if_eligible(uuid, uuid, timestamptz) from public;

create or replace function public.start_family_premium_trial_on_member_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.start_family_premium_trial_if_eligible(
    new.owner_id,
    new.member_id,
    now()
  );
  return new;
end;
$$;

drop trigger if exists start_family_premium_trial_on_member_link on public.family_members;
create trigger start_family_premium_trial_on_member_link
  after insert on public.family_members
  for each row execute function public.start_family_premium_trial_on_member_link();

create or replace function public.start_family_premium_trial_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  if not public.has_active_subscription(new.user_id) then
    return new;
  end if;

  select fm.member_id
    into v_member_id
  from public.family_members fm
  where fm.owner_id = new.user_id
  order by fm.created_at asc
  limit 1;

  if v_member_id is not null then
    perform public.start_family_premium_trial_if_eligible(
      new.user_id,
      v_member_id,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists start_family_premium_trial_on_subscription on public.subscriptions;
create trigger start_family_premium_trial_on_subscription
  after insert or update of status, expires_at, is_lifetime
  on public.subscriptions
  for each row execute function public.start_family_premium_trial_on_subscription();

-- Preserve the real first-link date for families that were already connected
-- before this migration. An old link may therefore already be expired.
insert into public.family_premium_trials (
  owner_id,
  activated_by,
  starts_at,
  expires_at
)
select distinct on (fm.owner_id)
  fm.owner_id,
  fm.member_id,
  fm.created_at,
  fm.created_at + interval '1 month'
from public.family_members fm
where public.has_active_subscription(fm.owner_id)
order by fm.owner_id, fm.created_at asc
on conflict (owner_id) do nothing;

create or replace function public.get_effective_premium_access()
returns table (
  is_premium boolean,
  access_source text,
  access_expires_at timestamptz,
  is_lifetime boolean,
  family_trial_started_at timestamptz,
  family_trial_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with own_access as (
    select s.expires_at, s.is_lifetime
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status in ('active', 'grace_period')
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
    limit 1
  ),
  shared_access as (
    select t.starts_at, t.expires_at
    from public.family_members fm
    join public.family_premium_trials t on t.owner_id = fm.owner_id
    where fm.member_id = auth.uid()
      and t.expires_at > now()
      and public.has_active_subscription(fm.owner_id)
    order by fm.created_at asc
    limit 1
  )
  select
    exists (select 1 from own_access)
      or exists (select 1 from shared_access) as is_premium,
    case
      when exists (select 1 from own_access) then 'own'
      when exists (select 1 from shared_access) then 'family_trial'
      else 'none'
    end as access_source,
    case
      when exists (select 1 from own_access)
        then (select oa.expires_at from own_access oa limit 1)
      else (select sa.expires_at from shared_access sa limit 1)
    end as access_expires_at,
    coalesce((select oa.is_lifetime from own_access oa limit 1), false) as is_lifetime,
    (select sa.starts_at from shared_access sa limit 1) as family_trial_started_at,
    (select sa.expires_at from shared_access sa limit 1) as family_trial_expires_at;
$$;

revoke all on function public.get_effective_premium_access() from public;
grant execute on function public.get_effective_premium_access() to authenticated;

create or replace function public.has_effective_premium_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.is_premium from public.get_effective_premium_access() e limit 1),
    false
  );
$$;

revoke all on function public.has_effective_premium_access() from public;
grant execute on function public.has_effective_premium_access() to authenticated;

-- Care journal RLS must evaluate the current caregiver's effective access.
-- The previous implementation checked only the mother's subscription and
-- therefore shared Premium forever with every family member.
create or replace function public.has_active_family_premium(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_baby(p_baby_id)
    and public.has_effective_premium_access();
$$;

revoke all on function public.has_active_family_premium(uuid) from public;
grant execute on function public.has_active_family_premium(uuid) to authenticated;

create or replace function public.has_active_profile_premium(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_profile(p_profile_id)
    and public.has_effective_premium_access();
$$;

revoke all on function public.has_active_profile_premium(uuid) from public;
grant execute on function public.has_active_profile_premium(uuid) to authenticated;
