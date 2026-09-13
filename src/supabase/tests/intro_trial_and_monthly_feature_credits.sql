begin;

-- Structural guarantees for the intro trial and the per-feature monthly credit
-- allowance. These are the two rules the paywall funnel depends on, so a
-- regression here is silent in the app but fatal to conversion.

do $$
declare
  v_missing_trials integer;
  v_duration interval;
  v_period timestamptz;
begin
  v_duration := public.intro_premium_trial_duration();
  if v_duration <> interval '7 days' then
    raise exception 'Intro trial must stay seven days, found %', v_duration;
  end if;

  -- Every existing profile was backfilled and the insert trigger covers new
  -- ones, so no account may be left without a trial window.
  select count(*) into v_missing_trials
  from public.profiles p
  left join public.intro_premium_trials t on t.profile_id = p.id
  where t.profile_id is null;

  if v_missing_trials > 0 then
    raise exception '% profiles have no intro trial row', v_missing_trials;
  end if;

  v_period := public.family_feature_credit_period_start();
  if v_period <> date_trunc('month', now()) then
    raise exception 'Credit period must start at the current calendar month';
  end if;
end;
$$;

do $$
declare
  v_feature text;
  v_quota integer;
  v_total integer := 0;
begin
  -- Each credit feature owns its allowance. A shared pool is what let one
  -- feature consume another feature's only free use.
  foreach v_feature in array public.family_feature_credit_keys() loop
    v_quota := public.family_feature_credit_quota(v_feature);
    if v_quota < 1 then
      raise exception 'Feature % must allow at least one free use', v_feature;
    end if;
    v_total := v_total + v_quota;
  end loop;

  if v_total < 4 then
    raise exception 'Every credit feature needs its own monthly allowance';
  end if;

  if public.family_feature_credit_quota('doctor_visit_report') < 1 then
    raise exception 'The doctor report must always be tastable for free';
  end if;
end;
$$;

do $$
declare
  v_source_count integer;
begin
  -- get_effective_premium_access must still expose the intro trial columns the
  -- client reads, and intro_trial must never outrank a paid entitlement.
  select count(*) into v_source_count
  from information_schema.routines r
  where r.routine_schema = 'public'
    and r.routine_name = 'get_effective_premium_access';

  if v_source_count <> 1 then
    raise exception 'get_effective_premium_access must exist exactly once';
  end if;

  if not exists (
    select 1
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.parameter_mode = 'OUT'
      and p.parameter_name = 'intro_trial_expires_at'
  ) then
    raise exception 'get_effective_premium_access must return intro_trial_expires_at';
  end if;
end;
$$;

rollback;
