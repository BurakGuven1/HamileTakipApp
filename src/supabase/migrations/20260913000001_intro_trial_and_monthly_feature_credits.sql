-- Intro premium trial and per-feature monthly family credits.
--
-- Two funnel changes ship together because they split one job that the old
-- lifetime three-credit pool was doing badly.
--
-- 1. Habit-forming features (sleep prediction, care history, medicine log,
--    insights) were fully locked, so nobody ever felt what Premium does for a
--    normal day. A seven day intro trial opens the whole product once, at the
--    only moment the parent is deciding whether this app is part of their
--    routine.
-- 2. Heavy one-shot features (document insight, doctor report, task alarm,
--    support handover) shared a single pool of three uses that never renewed.
--    A parent who tried document insight three times never saw the doctor
--    report at all, and a parent who spent the pool had no reason to return.
--    Credits are now allocated per feature and renew every calendar month.

-- ---------------------------------------------------------------------------
-- Seven day intro premium trial
-- ---------------------------------------------------------------------------

create table if not exists public.intro_premium_trials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);

alter table public.intro_premium_trials enable row level security;
revoke all on public.intro_premium_trials from public, anon, authenticated;

drop trigger if exists set_intro_premium_trials_updated_at
  on public.intro_premium_trials;
create trigger set_intro_premium_trials_updated_at
  before update on public.intro_premium_trials
  for each row execute function public.set_updated_at();

create index if not exists intro_premium_trials_expires_idx
  on public.intro_premium_trials (expires_at);

comment on table public.intro_premium_trials is
  'Server-only seven day full-access trial granted once per profile at signup. Read through get_effective_premium_access; never written by clients.';

create or replace function public.intro_premium_trial_duration()
returns interval
language sql
immutable
as $$
  select interval '7 days';
$$;

-- New profiles start the trial the moment the account exists, so the window
-- lines up with the first week of real use rather than with a later opt-in.
create or replace function public.start_intro_premium_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.intro_premium_trials (profile_id, started_at, expires_at)
  values (
    new.id,
    now(),
    now() + public.intro_premium_trial_duration()
  )
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists start_intro_premium_trial_on_profile_insert
  on public.profiles;
create trigger start_intro_premium_trial_on_profile_insert
  after insert on public.profiles
  for each row execute function public.start_intro_premium_trial();

-- Everyone who signed up before this migration never had the chance to see
-- the locked features, so the backfill starts their window now instead of
-- backdating it to their signup date.
insert into public.intro_premium_trials (profile_id, started_at, expires_at)
select p.id, now(), now() + public.intro_premium_trial_duration()
from public.profiles p
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- Effective premium access now includes the intro trial
-- ---------------------------------------------------------------------------

-- The return type gains two columns, so the function is replaced rather than
-- redefined in place. Callers such as has_effective_premium_access() are plain
-- SQL wrappers and carry no recorded dependency on this signature.
drop function if exists public.get_effective_premium_access();

create function public.get_effective_premium_access()
returns table (
  is_premium boolean,
  access_source text,
  access_expires_at timestamptz,
  is_lifetime boolean,
  family_trial_started_at timestamptz,
  family_trial_expires_at timestamptz,
  intro_trial_started_at timestamptz,
  intro_trial_expires_at timestamptz
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
  ), intro_trial as (
    select t.started_at, t.expires_at
    from public.intro_premium_trials t
    where t.profile_id = auth.uid()
      and t.expires_at > now()
    limit 1
  )
  select
    exists (select 1 from own_access)
      or exists (select 1 from family_access)
      or exists (select 1 from legacy_trial)
      or exists (select 1 from intro_trial),
    -- The intro trial is checked last so it never masks a paid entitlement in
    -- analytics or in the Meta/RevenueCat purchase classification.
    case
      when exists (select 1 from own_access) then 'own'
      when exists (select 1 from family_access) then 'family'
      when exists (select 1 from legacy_trial) then 'family_trial'
      when exists (select 1 from intro_trial) then 'intro_trial'
      else 'none'
    end,
    case
      when exists (select 1 from own_access)
        then (select oa.expires_at from own_access oa limit 1)
      when exists (select 1 from family_access)
        then (select fa.expires_at from family_access fa limit 1)
      when exists (select 1 from legacy_trial)
        then (select lt.expires_at from legacy_trial lt limit 1)
      else (select it.expires_at from intro_trial it limit 1)
    end,
    case
      when exists (select 1 from own_access)
        then coalesce((select oa.is_lifetime from own_access oa limit 1), false)
      when exists (select 1 from family_access)
        then coalesce((select fa.is_lifetime from family_access fa limit 1), false)
      else false
    end,
    (select lt.starts_at from legacy_trial lt limit 1),
    (select lt.expires_at from legacy_trial lt limit 1),
    (select it.started_at from intro_trial it limit 1),
    (select it.expires_at from intro_trial it limit 1);
$$;

revoke all on function public.get_effective_premium_access() from public, anon;
grant execute on function public.get_effective_premium_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Per-feature, monthly renewing family credits
-- ---------------------------------------------------------------------------

-- Each credit feature gets its own allowance. Under the old shared pool a
-- parent who spent three tries on document insight never saw the doctor
-- report, which is the feature most likely to sell a subscription.
create or replace function public.family_feature_credit_quota(p_feature_key text)
returns int
language sql
immutable
as $$
  select case trim(coalesce(p_feature_key, ''))
    when 'document_insight' then 2
    when 'doctor_visit_report' then 1
    when 'family_task_alarm' then 2
    when 'pregnancy_support_handover' then 1
    else 1
  end;
$$;

create or replace function public.family_feature_credit_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'document_insight',
    'doctor_visit_report',
    'family_task_alarm',
    'pregnancy_support_handover'
  ];
$$;

-- Credits renew on calendar month boundaries. A free account keeps a reason to
-- come back instead of hitting a wall that never moves again.
create or replace function public.family_feature_credit_period_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('month', now());
$$;

create or replace function public.count_family_feature_credits(
  p_owner_id uuid,
  p_feature_key text default null
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.family_feature_credit_ledger credit
  where credit.owner_id = p_owner_id
    and (p_feature_key is null or credit.feature_key = trim(p_feature_key))
    and (
      (credit.state = 'committed'
        and credit.committed_at >= public.family_feature_credit_period_start())
      or (credit.state = 'reserved'
        and credit.reserved_at > now() - interval '15 minutes')
    );
$$;

revoke all on function public.count_family_feature_credits(uuid, text)
  from public, anon, authenticated;

-- The no-argument form keeps working for the existing in-database callers and
-- now also reports the per-feature breakdown the paywall needs.
drop function if exists public.get_family_feature_access();

create function public.get_family_feature_access(p_feature_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_is_premium boolean := false;
  v_key text := nullif(trim(coalesce(p_feature_key, '')), '');
  v_feature text;
  v_quota int;
  v_used int;
  v_total_quota int := 0;
  v_total_used int := 0;
  v_features jsonb := '{}'::jsonb;
  v_any_remaining boolean := false;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Bu aile hesabına erişimin yok.' using errcode = '42501';
  end if;

  v_is_premium := public.has_effective_premium_access();

  foreach v_feature in array public.family_feature_credit_keys() loop
    v_quota := public.family_feature_credit_quota(v_feature);
    v_used := public.count_family_feature_credits(v_owner_id, v_feature);
    v_total_quota := v_total_quota + v_quota;
    v_total_used := v_total_used + v_used;
    if v_quota - v_used > 0 then
      v_any_remaining := true;
    end if;

    v_features := v_features || jsonb_build_object(
      v_feature,
      jsonb_build_object(
        'limit', v_quota,
        'used', least(v_used, v_quota),
        'remaining', greatest(0, v_quota - v_used)
      )
    );
  end loop;

  if v_key is not null then
    v_quota := public.family_feature_credit_quota(v_key);
    v_used := public.count_family_feature_credits(v_owner_id, v_key);
  else
    v_quota := v_total_quota;
    v_used := v_total_used;
  end if;

  return jsonb_build_object(
    'allowed', v_is_premium or (
      case when v_key is null then v_any_remaining else v_quota - v_used > 0 end
    ),
    'is_premium', v_is_premium,
    'feature_key', v_key,
    'limit', v_quota,
    'used', least(v_used, v_quota),
    'reserved', 0,
    'remaining', case when v_is_premium then null else greatest(0, v_quota - v_used) end,
    'features', v_features,
    'period_start', public.family_feature_credit_period_start(),
    'period_end', public.family_feature_credit_period_start() + interval '1 month',
    'reason', case
      when v_is_premium then null
      when v_key is null and not v_any_remaining then 'premium_required'
      when v_key is not null and v_quota - v_used <= 0 then 'premium_required'
      else null
    end
  );
end;
$$;

revoke all on function public.get_family_feature_access(text) from public, anon;
grant execute on function public.get_family_feature_access(text) to authenticated;

-- Reservation, commit and release now count against the calling feature's own
-- monthly allowance rather than one shared lifetime pool.
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
  v_key text := trim(coalesce(p_feature_key, ''));
  v_quota int;
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
  if char_length(v_key) not between 2 and 80 then
    raise exception 'Geçerli bir özellik anahtarı gerekli.' using errcode = '22023';
  end if;
  if p_life_stage not in ('pregnancy', 'postpartum') then
    raise exception 'Yaşam dönemi geçersiz.' using errcode = '22023';
  end if;
  -- The reservation layer protects the shared account allowance. Individual
  -- domain RPCs remain responsible for any maternal-health authorization.

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':family-feature-credit', 0));
  v_is_premium := public.has_effective_premium_access();
  v_quota := public.family_feature_credit_quota(v_key);

  -- A crashed or background-killed client must not lock one of the free uses
  -- forever. Cleanup is serialized with every reservation for the owner.
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
      'feature_key', v_key,
      'limit', v_quota,
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
    if v_existing.feature_key <> v_key
       or v_existing.life_stage <> p_life_stage then
      return jsonb_build_object(
        'allowed', false,
        'is_premium', false,
        'feature_key', v_key,
        'limit', v_quota,
        'remaining', greatest(
          0, v_quota - public.count_family_feature_credits(v_owner_id, v_key)
        ),
        'reason', 'operation_conflict',
        'reservation_id', v_existing.id
      );
    end if;

    if v_existing.state in ('reserved', 'committed') then
      return jsonb_build_object(
        'allowed', true,
        'is_premium', false,
        'feature_key', v_key,
        'limit', v_quota,
        'remaining', greatest(
          0, v_quota - public.count_family_feature_credits(v_owner_id, v_key)
        ),
        'reason', null,
        'reservation_id', v_existing.id
      );
    end if;
  end if;

  v_active_count := public.count_family_feature_credits(v_owner_id, v_key);

  if v_active_count >= v_quota then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', false,
      'feature_key', v_key,
      'limit', v_quota,
      'remaining', 0,
      'reason', 'premium_required',
      'reservation_id', null
    );
  end if;

  if v_existing.id is not null then
    update public.family_feature_credit_ledger
    set
      actor_id = v_actor_id,
      feature_key = v_key,
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
      v_owner_id, v_actor_id, v_key, p_life_stage, p_operation_id
    )
    returning * into v_reservation;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'is_premium', false,
    'feature_key', v_key,
    'limit', v_quota,
    'remaining', greatest(0, v_quota - v_active_count - 1),
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
  v_quota int;
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
    return jsonb_build_object(
      'allowed', v_is_premium,
      'is_premium', v_is_premium,
      'feature_key', null,
      'remaining', null,
      'reason', case when v_is_premium then null else 'reservation_not_found' end,
      'reservation_id', null
    );
  end if;

  v_quota := public.family_feature_credit_quota(v_row.feature_key);

  if v_row.state = 'released' then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', v_is_premium,
      'feature_key', v_row.feature_key,
      'limit', v_quota,
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
      'feature_key', v_row.feature_key,
      'limit', v_quota,
      'remaining', case
        when v_is_premium then null
        else greatest(
          0,
          v_quota - public.count_family_feature_credits(v_owner_id, v_row.feature_key)
        )
      end,
      'reason', 'reservation_expired',
      'reservation_id', v_row.id
    );
  end if;

  if v_row.state = 'reserved' then
    update public.family_feature_credit_ledger
    set state = 'committed', committed_at = now(), released_at = null
    where id = v_row.id;
  end if;

  v_count := public.count_family_feature_credits(v_owner_id, v_row.feature_key);

  return jsonb_build_object(
    'allowed', true,
    'is_premium', v_is_premium,
    'feature_key', v_row.feature_key,
    'limit', v_quota,
    'remaining', case when v_is_premium then null else greatest(0, v_quota - v_count) end,
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
  v_quota int;
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
    return jsonb_build_object(
      'allowed', v_is_premium,
      'is_premium', v_is_premium,
      'feature_key', null,
      'remaining', null,
      'reason', case when v_is_premium then null else 'reservation_not_found' end,
      'reservation_id', null
    );
  end if;

  v_quota := public.family_feature_credit_quota(v_row.feature_key);

  if v_row.state = 'committed' then
    return jsonb_build_object(
      'allowed', false,
      'is_premium', v_is_premium,
      'feature_key', v_row.feature_key,
      'limit', v_quota,
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

  v_count := public.count_family_feature_credits(v_owner_id, v_row.feature_key);

  return jsonb_build_object(
    'allowed', true,
    'is_premium', v_is_premium,
    'feature_key', v_row.feature_key,
    'limit', v_quota,
    'remaining', case when v_is_premium then null else greatest(0, v_quota - v_count) end,
    'reason', null,
    'reservation_id', v_row.id
  );
end;
$$;

comment on function public.get_family_feature_access(text) is
  'Per-feature monthly free allowance for the active family account. Called with no argument it returns the aggregate plus a per-feature breakdown.';
comment on function public.family_feature_credit_quota(text) is
  'Monthly free-use allowance per credit feature. Heavy one-shot features are allocated separately so that spending one feature allowance cannot hide another feature behind the paywall.';
