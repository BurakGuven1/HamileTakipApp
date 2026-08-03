-- Premium family coordination across pregnancy and postpartum.
-- Keeps the existing baby-care/night-shift flows intact while adding
-- account-scoped credits, identity-backed tasks and pregnancy handovers.

-- ---------------------------------------------------------------------------
-- Family identity and least-privilege access
-- ---------------------------------------------------------------------------

alter table public.family_members
  add column if not exists display_name text,
  add column if not exists access_scope text;

update public.family_members fm
set
  display_name = coalesce(
    nullif(trim(fm.display_name), ''),
    nullif(trim(owner_profile.father_name), ''),
    'Baba'
  ),
  access_scope = coalesce(nullif(trim(fm.access_scope), ''), 'full_family')
from public.profiles owner_profile
where owner_profile.id = fm.owner_id;

alter table public.family_members
  alter column display_name set default 'Baba',
  alter column display_name set not null,
  alter column access_scope set default 'full_family',
  alter column access_scope set not null;

alter table public.family_members
  drop constraint if exists family_members_role_check,
  drop constraint if exists family_members_access_scope_check,
  drop constraint if exists family_members_role_scope_check,
  drop constraint if exists family_members_display_name_check;

alter table public.family_members
  add constraint family_members_role_check
    check (role in ('father', 'caregiver')),
  add constraint family_members_access_scope_check
    check (access_scope in ('full_family', 'baby_care_only')),
  add constraint family_members_role_scope_check
    check (role <> 'caregiver' or access_scope = 'baby_care_only'),
  add constraint family_members_display_name_check
    check (char_length(trim(display_name)) between 1 and 80);

comment on column public.family_members.display_name is
  'Family-visible name for the linked father or caregiver.';
comment on column public.family_members.access_scope is
  'full_family may access maternal health data; baby_care_only may coordinate explicitly shared tasks/shifts but cannot read maternal health records.';

create or replace function public.can_access_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      auth.uid() = p_profile_id
      or exists (
        select 1
        from public.family_members fm
        where fm.owner_id = p_profile_id
          and fm.member_id = auth.uid()
          and fm.access_scope = 'full_family'
      )
    );
$$;

create or replace function public.can_coordinate_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      auth.uid() = p_profile_id
      or exists (
        select 1
        from public.family_members fm
        where fm.owner_id = p_profile_id
          and fm.member_id = auth.uid()
      )
    );
$$;

create or replace function public.can_access_baby(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.babies b
    where b.id = p_baby_id
      and public.can_coordinate_profile(b.parent_id)
  );
$$;

-- Keep the legacy function name because forum policies already depend on it.
-- Every code-linked family member (father or caregiver) must remain outside the
-- women-only forum, including an account whose active link was later removed.
create or replace function public.is_family_father()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.family_members fm
        where fm.member_id = auth.uid()
          and fm.role in ('father', 'caregiver')
      )
      or exists (
        select 1
        from public.family_code_redemptions redemption
        where redemption.member_id = auth.uid()
      )
    );
$$;

-- A baby-care-only caregiver must never receive the owner's maternal profile
-- through this SECURITY DEFINER convenience function.
create or replace function public.get_active_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = public.get_active_profile_id()
    and public.can_access_profile(p.id);
$$;

revoke all on function public.can_access_profile(uuid) from public, anon;
revoke all on function public.can_coordinate_profile(uuid) from public, anon;
revoke all on function public.can_access_baby(uuid) from public, anon;
revoke all on function public.is_family_father() from public, anon;
revoke all on function public.get_active_profile() from public, anon;
grant execute on function public.can_access_profile(uuid) to authenticated;
grant execute on function public.can_coordinate_profile(uuid) to authenticated;
grant execute on function public.can_access_baby(uuid) to authenticated;
grant execute on function public.is_family_father() to authenticated;
grant execute on function public.get_active_profile() to authenticated;

-- Family-code login must pass through the rate-limited Edge Function. The
-- legacy authenticated RPC could otherwise be called directly and bypass role
-- selection, throttling and caregiver data-scope enforcement.
revoke all on function public.redeem_family_referral_code(text)
  from public, anon, authenticated;

-- The original counter RPC maps linked accounts to the owner profile. Add the
-- maternal-access check explicitly because SECURITY DEFINER bypasses table RLS.
create or replace function public.add_pregnancy_counter_delta(
  p_counter_date date,
  p_kick_delta int default 0,
  p_contraction_delta int default 0
)
returns public.pregnancy_daily_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_is_pregnant boolean;
  v_counter public.pregnancy_daily_counters;
begin
  if auth.uid() is null or v_profile_id is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;
  if not public.can_access_profile(v_profile_id) then
    raise exception 'Gebelik sayaçlarına erişimin yok.' using errcode = '42501';
  end if;
  if coalesce(p_kick_delta, 0) < 0 or coalesce(p_contraction_delta, 0) < 0 then
    raise exception 'Sayaç değeri negatif olamaz.' using errcode = '22023';
  end if;

  select is_pregnant into v_is_pregnant
  from public.profiles
  where id = v_profile_id;
  if not coalesce(v_is_pregnant, false) then
    raise exception 'Bu takip araçları yalnızca hamilelik profillerinde kullanılabilir.' using errcode = '22023';
  end if;

  insert into public.pregnancy_daily_counters (
    profile_id, counter_date, kick_count, contraction_count
  ) values (
    v_profile_id,
    coalesce(p_counter_date, current_date),
    coalesce(p_kick_delta, 0),
    coalesce(p_contraction_delta, 0)
  )
  on conflict (profile_id, counter_date) do update
    set kick_count = public.pregnancy_daily_counters.kick_count + excluded.kick_count,
        contraction_count = public.pregnancy_daily_counters.contraction_count + excluded.contraction_count,
        updated_at = now()
  returning * into v_counter;

  return v_counter;
end;
$$;

revoke all on function public.add_pregnancy_counter_delta(date, int, int)
  from public, anon;
grant execute on function public.add_pregnancy_counter_delta(date, int, int)
  to authenticated;

-- Baby-care-only members still need the baby shell itself. Mutating the baby
-- identity remains limited by the existing can_access_profile policies.
drop policy if exists "babies_select_family" on public.babies;
create policy "babies_select_family"
  on public.babies for select
  using (public.can_coordinate_profile(parent_id));

-- Server-only throttle storage for the family-code Edge Function. key_hash is
-- expected to be a one-way hash of the caller/rate-limit key, never a raw IP.
create table if not exists public.family_code_login_attempts (
  key_hash text primary key check (char_length(key_hash) between 32 and 256),
  window_started_at timestamptz not null default now(),
  attempt_count int not null default 0 check (attempt_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.family_code_login_attempts enable row level security;
revoke all on public.family_code_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.family_code_login_attempts to service_role;

drop trigger if exists set_family_code_login_attempts_updated_at
  on public.family_code_login_attempts;
create trigger set_family_code_login_attempts_updated_at
  before update on public.family_code_login_attempts
  for each row execute function public.set_updated_at();

create index if not exists family_code_login_attempts_blocked_idx
  on public.family_code_login_attempts (blocked_until)
  where blocked_until is not null;

comment on table public.family_code_login_attempts is
  'Service-role-only rolling-window counters used to rate-limit family-code authentication attempts.';

create or replace function public.consume_family_code_login_attempt(
  p_key_hash text,
  p_window_seconds int default 900,
  p_max_attempts int default 10,
  p_block_seconds int default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.family_code_login_attempts;
  v_retry_after int := 0;
begin
  if char_length(coalesce(p_key_hash, '')) not between 32 and 256
     or p_window_seconds not between 60 and 86400
     or p_max_attempts not between 1 and 100
     or p_block_seconds not between 60 and 86400 then
    raise exception 'Geçersiz hız sınırı parametresi.' using errcode = '22023';
  end if;

  insert into public.family_code_login_attempts (
    key_hash,
    window_started_at,
    attempt_count,
    blocked_until,
    updated_at
  ) values (
    p_key_hash,
    v_now,
    1,
    null,
    v_now
  )
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.family_code_login_attempts.blocked_until > v_now
        then public.family_code_login_attempts.window_started_at
      when v_now - public.family_code_login_attempts.window_started_at
           >= p_window_seconds * interval '1 second'
        then v_now
      else public.family_code_login_attempts.window_started_at
    end,
    attempt_count = case
      when public.family_code_login_attempts.blocked_until > v_now
        then public.family_code_login_attempts.attempt_count
      when v_now - public.family_code_login_attempts.window_started_at
           >= p_window_seconds * interval '1 second'
        then 1
      else public.family_code_login_attempts.attempt_count + 1
    end,
    blocked_until = case
      when public.family_code_login_attempts.blocked_until > v_now
        then public.family_code_login_attempts.blocked_until
      when (
        case
          when v_now - public.family_code_login_attempts.window_started_at
               >= p_window_seconds * interval '1 second'
            then 1
          else public.family_code_login_attempts.attempt_count + 1
        end
      ) > p_max_attempts
        then v_now + p_block_seconds * interval '1 second'
      else null
    end,
    updated_at = v_now
  returning * into v_row;

  if v_row.blocked_until > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_row.blocked_until - v_now)))::int
    );
  end if;

  return jsonb_build_object(
    'allowed', v_row.blocked_until is null or v_row.blocked_until <= v_now,
    'retry_after_seconds', v_retry_after
  );
end;
$$;

revoke all on function public.consume_family_code_login_attempt(text, int, int, int)
  from public, anon, authenticated;
grant execute on function public.consume_family_code_login_attempt(text, int, int, int)
  to service_role;

-- ---------------------------------------------------------------------------
-- Household Premium: an active owner subscription covers the linked member.
-- The legacy fixed family trial remains a fallback when no owner subscription
-- is currently active.
-- ---------------------------------------------------------------------------

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
  ), family_access as (
    select s.expires_at, s.is_lifetime
    from public.family_members fm
    join public.subscriptions s on s.user_id = fm.owner_id
    where fm.member_id = auth.uid()
      and s.status in ('active', 'grace_period')
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
    order by fm.created_at asc
    limit 1
  ), legacy_trial as (
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
      or exists (select 1 from family_access)
      or exists (select 1 from legacy_trial),
    case
      when exists (select 1 from own_access) then 'own'
      when exists (select 1 from family_access) then 'family'
      when exists (select 1 from legacy_trial) then 'family_trial'
      else 'none'
    end,
    case
      when exists (select 1 from own_access)
        then (select oa.expires_at from own_access oa limit 1)
      when exists (select 1 from family_access)
        then (select fa.expires_at from family_access fa limit 1)
      else (select lt.expires_at from legacy_trial lt limit 1)
    end,
    case
      when exists (select 1 from own_access)
        then coalesce((select oa.is_lifetime from own_access oa limit 1), false)
      when exists (select 1 from family_access)
        then coalesce((select fa.is_lifetime from family_access fa limit 1), false)
      else false
    end,
    (select lt.starts_at from legacy_trial lt limit 1),
    (select lt.expires_at from legacy_trial lt limit 1);
$$;

revoke all on function public.get_effective_premium_access() from public, anon;
grant execute on function public.get_effective_premium_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Account-scoped, idempotent three-use family feature allowance
-- ---------------------------------------------------------------------------

create table if not exists public.family_feature_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  feature_key text not null check (char_length(trim(feature_key)) between 2 and 80),
  life_stage text not null check (life_stage in ('pregnancy', 'postpartum')),
  operation_id uuid not null,
  state text not null default 'reserved'
    check (state in ('reserved', 'committed', 'released')),
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, operation_id),
  check ((state = 'committed') = (committed_at is not null)),
  check ((state = 'released') = (released_at is not null))
);

alter table public.family_feature_credit_ledger enable row level security;
revoke all on public.family_feature_credit_ledger from public, anon, authenticated;

drop trigger if exists set_family_feature_credit_ledger_updated_at
  on public.family_feature_credit_ledger;
create trigger set_family_feature_credit_ledger_updated_at
  before update on public.family_feature_credit_ledger
  for each row execute function public.set_updated_at();

create index if not exists family_feature_credit_owner_state_idx
  on public.family_feature_credit_ledger (owner_id, state);
create index if not exists family_feature_credit_stale_reservation_idx
  on public.family_feature_credit_ledger (owner_id, reserved_at)
  where state = 'reserved';

comment on table public.family_feature_credit_ledger is
  'Server-only idempotent reservations for the three shared free family-feature uses per owner account. Pending reservations expire after 15 minutes.';

create or replace function public.get_family_feature_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_is_premium boolean := false;
  v_committed int := 0;
  v_reserved int := 0;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;

  v_is_premium := public.has_effective_premium_access();

  select
    count(*) filter (where state = 'committed')::int,
    count(*) filter (
      where state = 'reserved'
        and reserved_at > now() - interval '15 minutes'
    )::int
  into v_committed, v_reserved
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id;

  return jsonb_build_object(
    'allowed', v_is_premium or (v_committed + v_reserved < 3),
    'is_premium', v_is_premium,
    'limit', 3,
    'used', v_committed,
    'reserved', v_reserved,
    'remaining', case when v_is_premium then null else greatest(0, 3 - v_committed - v_reserved) end,
    'reason', case when not v_is_premium and v_committed + v_reserved >= 3 then 'premium_required' else null end
  );
end;
$$;

create or replace function public.reserve_family_feature_credit(
  p_feature_key text,
  p_operation_id uuid,
  p_life_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_actor_id uuid := auth.uid();
  v_is_premium boolean := false;
  v_active_count int := 0;
  v_existing public.family_feature_credit_ledger;
  v_reservation public.family_feature_credit_ledger;
begin
  if v_actor_id is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_feature_key, ''))) not between 2 and 80 then
    raise exception 'Geçerli bir özellik anahtarı gerekli.' using errcode = '22023';
  end if;
  if p_life_stage not in ('pregnancy', 'postpartum') then
    raise exception 'Yaşam dönemi geçersiz.' using errcode = '22023';
  end if;
  -- The reservation layer protects the shared account allowance. Individual
  -- domain RPCs remain responsible for any maternal-health authorization.

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':family-feature-credit', 0));
  v_is_premium := public.has_effective_premium_access();

  -- A crashed or background-killed client must not lock one of the three free
  -- uses forever. Cleanup is serialized with every reservation for the owner.
  update public.family_feature_credit_ledger
  set
    state = 'released',
    committed_at = null,
    released_at = now()
  where owner_id = v_owner_id
    and state = 'reserved'
    and reserved_at <= now() - interval '15 minutes';

  if v_is_premium then
    return jsonb_build_object(
      'allowed', true,
      'is_premium', true,
      'remaining', null,
      'reason', null,
      'reservation_id', null
    );
  end if;

  select * into v_existing
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id and operation_id = p_operation_id
  for update;

  if found then
    if v_existing.feature_key <> trim(p_feature_key)
       or v_existing.life_stage <> p_life_stage then
      return jsonb_build_object(
        'allowed', false,
        'is_premium', false,
        'remaining', greatest(0, 3 - (
          select count(*) from public.family_feature_credit_ledger
          where owner_id = v_owner_id and state in ('reserved', 'committed')
        )),
        'reason', 'operation_conflict',
        'reservation_id', v_existing.id
      );
    end if;

    if v_existing.state in ('reserved', 'committed') then
      select count(*)::int into v_active_count
      from public.family_feature_credit_ledger
      where owner_id = v_owner_id and state in ('reserved', 'committed');
      return jsonb_build_object(
        'allowed', true,
        'is_premium', false,
        'remaining', greatest(0, 3 - v_active_count),
        'reason', null,
        'reservation_id', v_existing.id
      );
    end if;
  end if;

  select count(*)::int into v_active_count
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id and state in ('reserved', 'committed');

  if v_active_count >= 3 then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', false,
      'remaining', 0,
      'reason', 'premium_required',
      'reservation_id', null
    );
  end if;

  if v_existing.id is not null then
    update public.family_feature_credit_ledger
    set
      actor_id = v_actor_id,
      feature_key = trim(p_feature_key),
      life_stage = p_life_stage,
      state = 'reserved',
      reserved_at = now(),
      committed_at = null,
      released_at = null
    where id = v_existing.id
    returning * into v_reservation;
  else
    insert into public.family_feature_credit_ledger (
      owner_id, actor_id, feature_key, life_stage, operation_id
    ) values (
      v_owner_id, v_actor_id, trim(p_feature_key), p_life_stage, p_operation_id
    )
    returning * into v_reservation;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'is_premium', false,
    'remaining', greatest(0, 2 - v_active_count),
    'reason', null,
    'reservation_id', v_reservation.id
  );
end;
$$;

create or replace function public.commit_family_feature_credit(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_row public.family_feature_credit_ledger;
  v_count int := 0;
  v_is_premium boolean := false;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':family-feature-credit', 0));
  v_is_premium := public.has_effective_premium_access();

  select * into v_row
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id and operation_id = p_operation_id
  for update;

  if not found then
    select count(*)::int into v_count
    from public.family_feature_credit_ledger
    where owner_id = v_owner_id
      and (
        state = 'committed'
        or (state = 'reserved' and reserved_at > now() - interval '15 minutes')
      );

    return jsonb_build_object(
      'allowed', v_is_premium,
      'is_premium', v_is_premium,
      'remaining', case when v_is_premium then null else greatest(0, 3 - v_count) end,
      'reason', case when v_is_premium then null else 'reservation_not_found' end,
      'reservation_id', null
    );
  end if;

  if v_row.state = 'released' then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', v_is_premium,
      'remaining', null,
      'reason', case
        when v_row.reserved_at <= now() - interval '15 minutes'
          then 'reservation_expired'
        else 'reservation_released'
      end,
      'reservation_id', v_row.id
    );
  end if;

  if v_row.state = 'reserved'
     and v_row.reserved_at <= now() - interval '15 minutes' then
    update public.family_feature_credit_ledger
    set
      state = 'released',
      committed_at = null,
      released_at = now()
    where id = v_row.id;

    return jsonb_build_object(
      'allowed', false,
      'is_premium', v_is_premium,
      'remaining', case when v_is_premium then null else greatest(0, 3 - (
        select count(*)
        from public.family_feature_credit_ledger credit
        where credit.owner_id = v_owner_id
          and (
            credit.state = 'committed'
            or (
              credit.state = 'reserved'
              and credit.reserved_at > now() - interval '15 minutes'
            )
          )
      )) end,
      'reason', 'reservation_expired',
      'reservation_id', v_row.id
    );
  end if;

  if v_row.state = 'reserved' then
    update public.family_feature_credit_ledger
    set state = 'committed', committed_at = now(), released_at = null
    where id = v_row.id;
  end if;

  select count(*)::int into v_count
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id
    and (
      state = 'committed'
      or (state = 'reserved' and reserved_at > now() - interval '15 minutes')
    );

  return jsonb_build_object(
    'allowed', true,
    'is_premium', false,
    'remaining', greatest(0, 3 - v_count),
    'reason', null,
    'reservation_id', v_row.id
  );
end;
$$;

create or replace function public.release_family_feature_credit(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_row public.family_feature_credit_ledger;
  v_count int := 0;
  v_is_premium boolean := false;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':family-feature-credit', 0));
  v_is_premium := public.has_effective_premium_access();

  select * into v_row
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id and operation_id = p_operation_id
  for update;

  if not found then
    select count(*)::int into v_count
    from public.family_feature_credit_ledger
    where owner_id = v_owner_id
      and (
        state = 'committed'
        or (state = 'reserved' and reserved_at > now() - interval '15 minutes')
      );

    return jsonb_build_object(
      'allowed', v_is_premium,
      'is_premium', v_is_premium,
      'remaining', case when v_is_premium then null else greatest(0, 3 - v_count) end,
      'reason', case when v_is_premium then null else 'reservation_not_found' end,
      'reservation_id', null
    );
  end if;

  if v_row.state = 'committed' then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', false,
      'remaining', null,
      'reason', 'already_committed',
      'reservation_id', v_row.id
    );
  end if;

  if v_row.state = 'reserved' then
    update public.family_feature_credit_ledger
    set state = 'released', released_at = now(), committed_at = null
    where id = v_row.id;
  end if;

  select count(*)::int into v_count
  from public.family_feature_credit_ledger
  where owner_id = v_owner_id
    and (
      state = 'committed'
      or (state = 'reserved' and reserved_at > now() - interval '15 minutes')
    );

  return jsonb_build_object(
    'allowed', true,
    'is_premium', false,
    'remaining', greatest(0, 3 - v_count),
    'reason', null,
    'reservation_id', v_row.id
  );
end;
$$;

revoke all on function public.get_family_feature_access() from public, anon;
revoke all on function public.reserve_family_feature_credit(text, uuid, text) from public, anon;
revoke all on function public.commit_family_feature_credit(uuid) from public, anon;
revoke all on function public.release_family_feature_credit(uuid) from public, anon;
grant execute on function public.get_family_feature_access() to authenticated;
grant execute on function public.reserve_family_feature_credit(text, uuid, text) to authenticated;
grant execute on function public.commit_family_feature_credit(uuid) to authenticated;
grant execute on function public.release_family_feature_credit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Identity-backed tasks shared by pregnancy and postpartum
-- ---------------------------------------------------------------------------

alter table public.care_tasks
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists life_stage text,
  add column if not exists preset_key text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists client_operation_id uuid;

update public.care_tasks task
set
  profile_id = baby.parent_id,
  life_stage = coalesce(task.life_stage, 'postpartum')
from public.babies baby
where baby.id = task.baby_id
  and (task.profile_id is null or task.life_stage is null);

alter table public.care_tasks
  alter column profile_id set not null,
  alter column life_stage set default 'postpartum',
  alter column life_stage set not null,
  alter column baby_id drop not null;

alter table public.care_tasks
  drop constraint if exists care_tasks_life_stage_check,
  drop constraint if exists care_tasks_subject_check,
  drop constraint if exists care_tasks_preset_key_check,
  drop constraint if exists care_tasks_notes_check;

alter table public.care_tasks
  add constraint care_tasks_life_stage_check
    check (life_stage in ('pregnancy', 'postpartum')),
  add constraint care_tasks_subject_check
    check (
      (life_stage = 'pregnancy' and baby_id is null)
      or (life_stage = 'postpartum' and baby_id is not null)
    ),
  add constraint care_tasks_preset_key_check
    check (preset_key is null or char_length(trim(preset_key)) between 1 and 80),
  add constraint care_tasks_notes_check
    check (notes is null or char_length(notes) <= 500);

create unique index if not exists care_tasks_profile_operation_unique
  on public.care_tasks (profile_id, client_operation_id)
  where client_operation_id is not null;
create index if not exists care_tasks_profile_stage_due_idx
  on public.care_tasks (profile_id, life_stage, due_at)
  where completed_at is null;
create index if not exists care_tasks_baby_open_idx
  on public.care_tasks (baby_id, due_at)
  where baby_id is not null and completed_at is null;

drop trigger if exists set_care_tasks_updated_at on public.care_tasks;
create trigger set_care_tasks_updated_at
  before update on public.care_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.care_task_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.care_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_snapshot text not null check (role_snapshot in ('mother', 'father', 'caregiver')),
  display_name_snapshot text not null
    check (char_length(trim(display_name_snapshot)) between 1 and 80),
  alarm_at timestamptz,
  alarm_generation int not null default 1 check (alarm_generation >= 1),
  alarm_status text not null default 'none'
    check (alarm_status in ('none', 'scheduled', 'sent', 'snoozed', 'dismissed', 'cancelled')),
  alarm_sent_at timestamptz,
  alarm_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id),
  check (
    (alarm_at is null and alarm_status = 'none')
    or (alarm_at is not null and alarm_status <> 'none')
  )
);

alter table public.care_task_assignments enable row level security;

drop trigger if exists set_care_task_assignments_updated_at
  on public.care_task_assignments;
create trigger set_care_task_assignments_updated_at
  before update on public.care_task_assignments
  for each row execute function public.set_updated_at();

create index if not exists care_task_assignments_due_idx
  on public.care_task_assignments (alarm_at, id)
  where alarm_status in ('scheduled', 'snoozed');
create index if not exists care_task_assignments_user_due_idx
  on public.care_task_assignments (user_id, alarm_at)
  where alarm_status in ('scheduled', 'snoozed');
create index if not exists care_task_assignments_profile_idx
  on public.care_task_assignments (profile_id, task_id);

-- Backfill old text-only tasks to the linked member when the old label clearly
-- matches; otherwise keep them safely assigned to the owner.
insert into public.care_task_assignments (
  profile_id,
  task_id,
  user_id,
  role_snapshot,
  display_name_snapshot
)
select
  task.profile_id,
  task.id,
  case
    when fm.member_id is not null
      and task.assigned_to_name is not null
      and lower(trim(task.assigned_to_name)) in (
        lower(trim(fm.display_name)),
        lower(trim(coalesce(owner_profile.father_name, ''))),
        'baba',
        'bakıcı'
      )
      then fm.member_id
    else task.profile_id
  end,
  case
    when fm.member_id is not null
      and task.assigned_to_name is not null
      and lower(trim(task.assigned_to_name)) in (
        lower(trim(fm.display_name)),
        lower(trim(coalesce(owner_profile.father_name, ''))),
        'baba',
        'bakıcı'
      )
      then fm.role
    else 'mother'
  end,
  case
    when fm.member_id is not null
      and task.assigned_to_name is not null
      and lower(trim(task.assigned_to_name)) in (
        lower(trim(fm.display_name)),
        lower(trim(coalesce(owner_profile.father_name, ''))),
        'baba',
        'bakıcı'
      )
      then fm.display_name
    else coalesce(
      nullif(trim(owner_profile.mother_name), ''),
      nullif(trim(owner_profile.display_name), ''),
      'Anne'
    )
  end
from public.care_tasks task
join public.profiles owner_profile on owner_profile.id = task.profile_id
left join public.family_members fm on fm.owner_id = task.profile_id
on conflict (task_id, user_id) do nothing;

drop policy if exists "care_tasks_premium_family" on public.care_tasks;
drop policy if exists "care_tasks_select_family" on public.care_tasks;
create policy "care_tasks_select_family"
  on public.care_tasks for select
  using (public.can_coordinate_profile(profile_id));

drop policy if exists "care_task_assignments_select_family"
  on public.care_task_assignments;
create policy "care_task_assignments_select_family"
  on public.care_task_assignments for select
  using (public.can_coordinate_profile(profile_id));

revoke insert, update, delete on public.care_tasks from authenticated, anon;
revoke all on public.care_task_assignments from public, anon, authenticated;
grant select on public.care_tasks, public.care_task_assignments to authenticated;

comment on table public.care_tasks is
  'Family tasks spanning pregnancy and postpartum; mutations are restricted to atomic coordination RPCs.';
comment on table public.care_task_assignments is
  'One identity-backed assignee and independent alarm lifecycle per selected family participant.';

create or replace function public.get_family_task_payload(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(task) || jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(assignment) order by assignment.created_at, assignment.id)
      from public.care_task_assignments assignment
      where assignment.task_id = task.id
    ), '[]'::jsonb)
  )
  from public.care_tasks task
  where task.id = p_task_id;
$$;
revoke all on function public.get_family_task_payload(uuid)
  from public, anon, authenticated;

create or replace function public.create_family_task(
  p_operation_id uuid,
  p_title text,
  p_life_stage text,
  p_assignee_scope text,
  p_baby_id uuid default null,
  p_due_at timestamptz default null,
  p_alarm_at timestamptz default null,
  p_preset_key text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid := public.get_active_profile_id();
  v_member public.family_members;
  v_owner_name text;
  v_task public.care_tasks;
  v_credit jsonb;
  v_access jsonb;
  v_assigned_name text;
begin
  if v_actor_id is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120 then
    raise exception 'Görev başlığı 1-120 karakter arasında olmalı.' using errcode = '22023';
  end if;
  if p_life_stage not in ('pregnancy', 'postpartum') then
    raise exception 'Yaşam dönemi geçersiz.' using errcode = '22023';
  end if;
  if p_assignee_scope not in ('mother', 'member', 'both') then
    raise exception 'Görevli seçimi geçersiz.' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'Görev notu en fazla 500 karakter olabilir.' using errcode = '22023';
  end if;
  if p_alarm_at is not null and p_alarm_at <= now() + interval '30 seconds' then
    raise exception 'Alarm saati en az bir dakika ileride olmalı.' using errcode = '22023';
  end if;

  if p_life_stage = 'pregnancy' then
    if p_baby_id is not null or not public.can_coordinate_profile(v_owner_id) then
      raise exception 'Gebelik görevi için uygun aile erişimi gerekli.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = v_owner_id and p.is_pregnant = true
    ) then
      raise exception 'Aktif bir gebelik profili bulunamadı.' using errcode = '22023';
    end if;
  else
    if p_baby_id is null or not exists (
      select 1 from public.babies b
      where b.id = p_baby_id and b.parent_id = v_owner_id
        and public.can_access_baby(b.id)
    ) then
      raise exception 'Geçerli bir bebek profili gerekli.' using errcode = '42501';
    end if;
  end if;

  -- Serialize retries of the same client operation. This makes both the free
  -- task path and the alarm-credit path idempotent under double taps/timeouts.
  perform pg_advisory_xact_lock(
    hashtextextended(v_owner_id::text || ':family-task:' || p_operation_id::text, 0)
  );

  select * into v_task
  from public.care_tasks
  where profile_id = v_owner_id and client_operation_id = p_operation_id;

  if found then
    v_access := public.get_family_feature_access();
    return jsonb_build_object(
      'allowed', true,
      'is_premium', coalesce((v_access ->> 'is_premium')::boolean, false),
      'remaining', v_access -> 'remaining',
      'reason', null,
      'task', public.get_family_task_payload(v_task.id)
    );
  end if;

  select * into v_member
  from public.family_members fm
  where fm.owner_id = v_owner_id
  order by fm.created_at asc
  limit 1;

  if p_assignee_scope in ('member', 'both') and v_member.member_id is null then
    raise exception 'Görev atanacak bağlı bir aile üyesi yok.' using errcode = '22023';
  end if;
  select coalesce(
    nullif(trim(p.mother_name), ''),
    nullif(trim(p.display_name), ''),
    'Anne'
  ) into v_owner_name
  from public.profiles p
  where p.id = v_owner_id;

  if p_alarm_at is not null then
    v_credit := public.reserve_family_feature_credit(
      'family_task_alarm', p_operation_id, p_life_stage
    );
    if not coalesce((v_credit ->> 'allowed')::boolean, false) then
      return v_credit || jsonb_build_object('task', null);
    end if;
  else
    v_credit := public.get_family_feature_access();
  end if;

  v_assigned_name := case p_assignee_scope
    when 'mother' then v_owner_name
    when 'member' then v_member.display_name
    else v_owner_name || ' ve ' || v_member.display_name
  end;

  insert into public.care_tasks (
    profile_id,
    baby_id,
    life_stage,
    title,
    due_at,
    assigned_to_name,
    preset_key,
    notes,
    created_by,
    client_operation_id
  ) values (
    v_owner_id,
    p_baby_id,
    p_life_stage,
    trim(p_title),
    p_due_at,
    v_assigned_name,
    nullif(trim(coalesce(p_preset_key, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_actor_id,
    p_operation_id
  )
  returning * into v_task;

  if p_assignee_scope in ('mother', 'both') then
    insert into public.care_task_assignments (
      profile_id, task_id, user_id, role_snapshot, display_name_snapshot,
      alarm_at, alarm_status
    ) values (
      v_owner_id, v_task.id, v_owner_id, 'mother', v_owner_name,
      p_alarm_at, case when p_alarm_at is null then 'none' else 'scheduled' end
    );
  end if;

  if p_assignee_scope in ('member', 'both') then
    insert into public.care_task_assignments (
      profile_id, task_id, user_id, role_snapshot, display_name_snapshot,
      alarm_at, alarm_status
    ) values (
      v_owner_id, v_task.id, v_member.member_id, v_member.role,
      v_member.display_name, p_alarm_at,
      case when p_alarm_at is null then 'none' else 'scheduled' end
    );
  end if;

  if p_alarm_at is not null then
    v_credit := public.commit_family_feature_credit(p_operation_id);
  else
    v_credit := public.get_family_feature_access();
  end if;
  return jsonb_build_object(
    'allowed', true,
    'is_premium', coalesce((v_credit ->> 'is_premium')::boolean, false),
    'remaining', v_credit -> 'remaining',
    'reason', null,
    'task', public.get_family_task_payload(v_task.id)
  );
end;
$$;

create or replace function public.list_family_tasks(
  p_life_stage text,
  p_baby_id uuid default null,
  p_include_completed boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;
  if p_life_stage not in ('pregnancy', 'postpartum') then
    raise exception 'Yaşam dönemi geçersiz.' using errcode = '22023';
  end if;
  if p_life_stage = 'postpartum' and (
    p_baby_id is null or not exists (
      select 1 from public.babies b
      where b.id = p_baby_id and b.parent_id = v_owner_id
    )
  ) then
    raise exception 'Geçerli bir bebek profili gerekli.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(payload order by sort_due, sort_created desc), '[]'::jsonb)
  into v_result
  from (
    select
      public.get_family_task_payload(task.id) as payload,
      coalesce(task.due_at, 'infinity'::timestamptz) as sort_due,
      task.created_at as sort_created
    from public.care_tasks task
    where task.profile_id = v_owner_id
      and task.life_stage = p_life_stage
      and (
        (p_life_stage = 'pregnancy' and task.baby_id is null)
        or (p_life_stage = 'postpartum' and task.baby_id = p_baby_id)
      )
      and (coalesce(p_include_completed, false) or task.completed_at is null)
  ) task_rows;

  return v_result;
end;
$$;

create or replace function public.complete_family_task(
  p_task_id uuid,
  p_completed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.care_tasks;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;

  select * into v_task
  from public.care_tasks
  where id = p_task_id
  for update;

  if not found
     or not public.can_coordinate_profile(v_task.profile_id) then
    raise exception 'Görev bulunamadı veya erişimin yok.' using errcode = '42501';
  end if;

  update public.care_tasks
  set
    completed_at = case when coalesce(p_completed, true) then now() else null end,
    completed_by = case when coalesce(p_completed, true) then auth.uid() else null end
  where id = v_task.id
  returning * into v_task;

  if coalesce(p_completed, true) then
    update public.care_task_assignments
    set
      alarm_status = case when alarm_at is null then 'none' else 'cancelled' end,
      alarm_dismissed_at = case when alarm_at is null then null else now() end
    where task_id = v_task.id
      and alarm_status in ('scheduled', 'snoozed', 'sent');
  end if;

  return public.get_family_task_payload(v_task.id);
end;
$$;

create or replace function public.snooze_family_task_alarm(
  p_assignment_id uuid,
  p_scheduled_for timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.care_task_assignments;
  v_task public.care_tasks;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;
  if p_scheduled_for is null or p_scheduled_for <= now() + interval '30 seconds' then
    raise exception 'Yeni alarm saati en az bir dakika ileride olmalı.' using errcode = '22023';
  end if;

  select assignment, task into v_assignment, v_task
  from public.care_task_assignments assignment
  join public.care_tasks task on task.id = assignment.task_id
  where assignment.id = p_assignment_id
  for update of assignment;

  if v_assignment.id is null
     or v_assignment.user_id <> auth.uid()
     or v_assignment.alarm_at is null
     or v_assignment.alarm_status not in ('scheduled', 'sent', 'snoozed')
     or v_task.completed_at is not null then
    raise exception 'Bu alarmı erteleme yetkin yok.' using errcode = '42501';
  end if;

  update public.care_task_assignments
  set
    alarm_at = p_scheduled_for,
    alarm_generation = alarm_generation + 1,
    alarm_status = 'snoozed',
    alarm_sent_at = null,
    alarm_dismissed_at = null
  where id = v_assignment.id
  returning * into v_assignment;

  return to_jsonb(v_assignment);
end;
$$;

create or replace function public.cancel_family_task_alarm(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.care_task_assignments;
  v_task public.care_tasks;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;

  select assignment, task into v_assignment, v_task
  from public.care_task_assignments assignment
  join public.care_tasks task on task.id = assignment.task_id
  where assignment.id = p_assignment_id
  for update of assignment;

  if v_assignment.id is null
     or not public.can_coordinate_profile(v_task.profile_id)
     or (
       v_assignment.user_id <> auth.uid()
       and v_task.created_by <> auth.uid()
       and v_task.profile_id <> auth.uid()
     ) then
    raise exception 'Bu alarmı iptal etme yetkin yok.' using errcode = '42501';
  end if;

  update public.care_task_assignments
  set
    alarm_status = case when alarm_at is null then 'none' else 'cancelled' end,
    alarm_dismissed_at = case when alarm_at is null then null else now() end
  where id = v_assignment.id
  returning * into v_assignment;

  return to_jsonb(v_assignment);
end;
$$;

revoke all on function public.create_family_task(uuid, text, text, text, uuid, timestamptz, timestamptz, text, text)
  from public, anon;
revoke all on function public.list_family_tasks(text, uuid, boolean)
  from public, anon;
revoke all on function public.complete_family_task(uuid, boolean)
  from public, anon;
revoke all on function public.snooze_family_task_alarm(uuid, timestamptz)
  from public, anon;
revoke all on function public.cancel_family_task_alarm(uuid)
  from public, anon;
grant execute on function public.create_family_task(uuid, text, text, text, uuid, timestamptz, timestamptz, text, text)
  to authenticated;
grant execute on function public.list_family_tasks(text, uuid, boolean)
  to authenticated;
grant execute on function public.complete_family_task(uuid, boolean)
  to authenticated;
grant execute on function public.snooze_family_task_alarm(uuid, timestamptz)
  to authenticated;
grant execute on function public.cancel_family_task_alarm(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Pregnancy support handover. Medical prediction is intentionally excluded;
-- the snapshot only organizes recorded dates, preparation and family tasks.
-- ---------------------------------------------------------------------------

create table if not exists public.pregnancy_support_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  caregiver_name text not null
    check (char_length(trim(caregiver_name)) between 1 and 80),
  caregiver_role text not null
    check (caregiver_role in ('mother', 'father', 'caregiver')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text check (ended_reason is null or ended_reason in ('handed_over', 'manual')),
  device_id text not null check (char_length(trim(device_id)) between 8 and 160),
  device_label text check (device_label is null or char_length(trim(device_label)) <= 80),
  client_operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, client_operation_id),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists pregnancy_support_one_active_per_profile
  on public.pregnancy_support_sessions (profile_id)
  where ended_at is null;
create index if not exists pregnancy_support_profile_started_idx
  on public.pregnancy_support_sessions (profile_id, started_at desc);

alter table public.pregnancy_support_sessions enable row level security;

drop policy if exists "pregnancy_support_select_full_family"
  on public.pregnancy_support_sessions;
drop policy if exists "pregnancy_support_select_family"
  on public.pregnancy_support_sessions;
create policy "pregnancy_support_select_family"
  on public.pregnancy_support_sessions for select
  using (public.can_coordinate_profile(profile_id));

revoke all on public.pregnancy_support_sessions from public, anon, authenticated;
grant select on public.pregnancy_support_sessions to authenticated;

drop trigger if exists set_pregnancy_support_sessions_updated_at
  on public.pregnancy_support_sessions;
create trigger set_pregnancy_support_sessions_updated_at
  before update on public.pregnancy_support_sessions
  for each row execute function public.set_updated_at();

-- Forward declaration used by the takeover RPC below. It is replaced with the
-- complete, access-checked snapshot implementation immediately afterwards.
create or replace function public.get_pregnancy_support_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select null::jsonb;
$$;

create or replace function public.take_over_pregnancy_support(
  p_operation_id uuid,
  p_device_id text,
  p_device_label text default null,
  p_caregiver_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid := public.get_active_profile_id();
  v_member public.family_members;
  v_profile public.profiles;
  v_existing public.pregnancy_support_sessions;
  v_active public.pregnancy_support_sessions;
  v_session public.pregnancy_support_sessions;
  v_name text;
  v_role text;
  v_credit jsonb;
begin
  if v_actor_id is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Gebelik desteğini devralma yetkin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_device_id, ''))) not between 8 and 160 then
    raise exception 'Geçerli bir cihaz kimliği gerekli.' using errcode = '22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_owner_id;
  if not found or not v_profile.is_pregnant then
    raise exception 'Aktif bir gebelik profili bulunamadı.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.pregnancy_support_sessions
  where profile_id = v_owner_id and client_operation_id = p_operation_id;
  if found then
    v_credit := public.get_family_feature_access();
    return jsonb_build_object(
      'allowed', true,
      'is_premium', coalesce((v_credit ->> 'is_premium')::boolean, false),
      'remaining', v_credit -> 'remaining',
      'reason', null,
      'session', to_jsonb(v_existing),
      'snapshot', public.get_pregnancy_support_snapshot()
    );
  end if;

  select * into v_member
  from public.family_members fm
  where fm.owner_id = v_owner_id and fm.member_id = v_actor_id
  limit 1;

  if v_actor_id = v_owner_id then
    v_role := 'mother';
    v_name := coalesce(
      nullif(trim(p_caregiver_name), ''),
      nullif(trim(v_profile.mother_name), ''),
      nullif(trim(v_profile.display_name), ''),
      'Anne'
    );
  else
    if v_member.member_id is null then
      raise exception 'Gebelik desteğini devralma yetkin yok.' using errcode = '42501';
    end if;
    v_role := v_member.role;
    v_name := coalesce(
      nullif(trim(p_caregiver_name), ''),
      nullif(trim(v_member.display_name), ''),
      case when v_member.role = 'caregiver' then 'Bakıcı' else 'Baba' end
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':pregnancy-support', 0));

  select * into v_active
  from public.pregnancy_support_sessions
  where profile_id = v_owner_id and ended_at is null
  for update;

  if found and v_active.caregiver_id = v_actor_id then
    v_credit := public.get_family_feature_access();
    return jsonb_build_object(
      'allowed', true,
      'is_premium', coalesce((v_credit ->> 'is_premium')::boolean, false),
      'remaining', v_credit -> 'remaining',
      'reason', null,
      'session', to_jsonb(v_active),
      'snapshot', public.get_pregnancy_support_snapshot()
    );
  end if;

  v_credit := public.reserve_family_feature_credit(
    'pregnancy_support_handover', p_operation_id, 'pregnancy'
  );
  if not coalesce((v_credit ->> 'allowed')::boolean, false) then
    return v_credit || jsonb_build_object('session', null, 'snapshot', null);
  end if;

  if v_active.id is not null then
    update public.pregnancy_support_sessions
    set ended_at = now(), ended_reason = 'handed_over'
    where id = v_active.id;
  end if;

  insert into public.pregnancy_support_sessions (
    profile_id,
    caregiver_id,
    caregiver_name,
    caregiver_role,
    device_id,
    device_label,
    client_operation_id
  ) values (
    v_owner_id,
    v_actor_id,
    trim(v_name),
    v_role,
    trim(p_device_id),
    nullif(trim(coalesce(p_device_label, '')), ''),
    p_operation_id
  )
  returning * into v_session;

  v_credit := public.commit_family_feature_credit(p_operation_id);
  return jsonb_build_object(
    'allowed', true,
    'is_premium', coalesce((v_credit ->> 'is_premium')::boolean, false),
    'remaining', v_credit -> 'remaining',
    'reason', null,
    'session', to_jsonb(v_session),
    'snapshot', public.get_pregnancy_support_snapshot()
  );
end;
$$;

create or replace function public.get_pregnancy_support_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_profile public.profiles;
  v_week int;
  v_can_access_maternal boolean := false;
  v_result jsonb;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Gebelik desteği özetine erişimin yok.' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_owner_id;
  if not found or not v_profile.is_pregnant then
    raise exception 'Aktif bir gebelik profili bulunamadı.' using errcode = '22023';
  end if;

  v_can_access_maternal := public.can_access_profile(v_owner_id);

  if v_can_access_maternal and v_profile.due_date is not null then
    v_week := greatest(
      1,
      least(
        42,
        floor((280 - (v_profile.due_date - (timezone('Europe/Istanbul', now()))::date)) / 7.0)::int
      )
    );
  end if;

  select jsonb_build_object(
    'profile_id', v_owner_id,
    'pregnancy_week', case when v_can_access_maternal then v_week else null end,
    'due_date', case when v_can_access_maternal then v_profile.due_date else null end,
    'active_session', (
      select to_jsonb(session)
      from public.pregnancy_support_sessions session
      where session.profile_id = v_owner_id and session.ended_at is null
      order by session.started_at desc
      limit 1
    ),
    'next_task', (
      select public.get_family_task_payload(task.id)
      from public.care_tasks task
      where task.profile_id = v_owner_id
        and task.life_stage = 'pregnancy'
        and task.completed_at is null
      order by task.due_at asc nulls last, task.created_at asc
      limit 1
    ),
    'next_alarm', (
      select to_jsonb(assignment)
      from public.care_task_assignments assignment
      join public.care_tasks task on task.id = assignment.task_id
      where task.profile_id = v_owner_id
        and task.life_stage = 'pregnancy'
        and task.completed_at is null
        and assignment.alarm_status in ('scheduled', 'snoozed')
        and assignment.alarm_at > now()
      order by assignment.alarm_at asc
      limit 1
    ),
    'open_task_count', (
      select count(*)
      from public.care_tasks task
      where task.profile_id = v_owner_id
        and task.life_stage = 'pregnancy'
        and task.completed_at is null
    ),
    'birth_preparation_open_count', (
      select count(*)
      from public.birth_preparation_items item
      where item.profile_id = v_owner_id and item.is_completed = false
    ),
    'next_vaccination', case when v_can_access_maternal then (
      select jsonb_build_object(
        'id', vaccine.id,
        'vaccine_name', vaccine.vaccine_name,
        'scheduled_date', vaccine.scheduled_date,
        'recommended_week_start', vaccine.recommended_week_start,
        'recommended_week_end', vaccine.recommended_week_end
      )
      from public.pregnancy_vaccinations vaccine
      where vaccine.profile_id = v_owner_id
        and vaccine.completed = false
        and vaccine.scheduled_date >= (timezone('Europe/Istanbul', now()))::date
      order by vaccine.scheduled_date asc
      limit 1
    ) else null end,
    'last_weight', case when v_can_access_maternal then (
      select jsonb_build_object(
        'record_date', weight.record_date,
        'weight_kg', weight.weight_kg
      )
      from public.pregnancy_weight_records weight
      where weight.profile_id = v_owner_id
      order by weight.record_date desc
      limit 1
    ) else null end,
    'generated_at', now(),
    'medical_prediction', false
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.take_over_pregnancy_support(uuid, text, text, text)
  from public, anon;
revoke all on function public.get_pregnancy_support_snapshot()
  from public, anon;
grant execute on function public.take_over_pregnancy_support(uuid, text, text, text)
  to authenticated;
grant execute on function public.get_pregnancy_support_snapshot()
  to authenticated;

comment on table public.pregnancy_support_sessions is
  'Identity-backed pregnancy support handovers; snapshots organize recorded facts and never make medical predictions.';

-- ---------------------------------------------------------------------------
-- Minimal, role-redacted coordination context
-- ---------------------------------------------------------------------------

create or replace function public.get_family_coordination_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid := public.get_active_profile_id();
  v_profile public.profiles;
  v_member public.family_members;
  v_actor_role text;
  v_actor_scope text;
  v_can_access_maternal boolean;
  v_access jsonb;
begin
  if v_actor_id is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile koordinasyon alanına erişimin yok.' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_owner_id;
  select * into v_member
  from public.family_members fm
  where fm.owner_id = v_owner_id
  order by fm.created_at asc
  limit 1;

  if v_actor_id = v_owner_id then
    v_actor_role := 'mother';
    v_actor_scope := 'full_family';
  else
    v_actor_role := v_member.role;
    v_actor_scope := v_member.access_scope;
  end if;
  v_can_access_maternal := public.can_access_profile(v_owner_id);
  v_access := public.get_family_feature_access();

  return jsonb_build_object(
    'owner_id', v_owner_id,
    'current_user_id', v_actor_id,
    'current_role', v_actor_role,
    'access_scope', v_actor_scope,
    'can_access_maternal', v_can_access_maternal,
    'profile', jsonb_build_object(
      'id', v_owner_id,
      'is_pregnant', v_profile.is_pregnant,
      'due_date', case when v_can_access_maternal then v_profile.due_date else null end
    ),
    'life_stage', case when v_profile.is_pregnant then 'pregnancy' else 'postpartum' end,
    'participants', jsonb_build_array(
      jsonb_build_object(
        'user_id', v_owner_id,
        'role', 'mother',
        'display_name', coalesce(
          nullif(trim(v_profile.mother_name), ''),
          nullif(trim(v_profile.display_name), ''),
          'Anne'
        ),
        'access_scope', 'full_family',
        'notifications_ready', exists (
          select 1 from public.push_tokens token
          where token.user_id = v_owner_id and token.enabled = true
        )
      )
    ) || case
      when v_member.member_id is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'user_id', v_member.member_id,
        'role', v_member.role,
        'display_name', v_member.display_name,
        'access_scope', v_member.access_scope,
        'notifications_ready', exists (
          select 1 from public.push_tokens token
          where token.user_id = v_member.member_id and token.enabled = true
        )
      ))
    end,
    'babies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', baby.id,
        'name', baby.name,
        'birth_date', baby.birth_date
      ) order by baby.birth_date desc, baby.created_at asc)
      from public.babies baby
      where baby.parent_id = v_owner_id
    ), '[]'::jsonb),
    'feature_access', v_access
  );
end;
$$;

revoke all on function public.get_family_coordination_context()
  from public, anon;
grant execute on function public.get_family_coordination_context()
  to authenticated;

-- Realtime is RLS-filtered; profile_id filters keep client subscriptions small.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'care_tasks'
  ) then
    alter publication supabase_realtime add table public.care_tasks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'care_task_assignments'
  ) then
    alter publication supabase_realtime add table public.care_task_assignments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pregnancy_support_sessions'
  ) then
    alter publication supabase_realtime add table public.pregnancy_support_sessions;
  end if;
end;
$$;
