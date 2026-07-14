-- Once eligibility is established at father link (or when the owner later
-- purchases Premium), keep the promised one-calendar-month window fixed.

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
