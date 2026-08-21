begin;

do $$
declare
  v_pregnancy_packs integer;
  v_postpartum_packs integer;
  v_pregnancy_cards integer;
  v_postpartum_cards integer;
begin
  select count(*) into v_pregnancy_packs
  from public.weekly_checkin_question_packs
  where life_stage = 'pregnancy' and active;

  select count(*) into v_postpartum_packs
  from public.weekly_checkin_question_packs
  where life_stage = 'postpartum' and active;

  select count(*) into v_pregnancy_cards
  from public.daily_experience_content
  where life_stage = 'pregnancy' and active;

  select count(*) into v_postpartum_cards
  from public.daily_experience_content
  where life_stage = 'postpartum' and active;

  if v_pregnancy_packs < 8 or v_postpartum_packs < 8 then
    raise exception 'Each life stage needs eight active weekly packs';
  end if;

  if v_pregnancy_cards < 7 or v_postpartum_cards < 7 then
    raise exception 'Each life stage needs at least seven active daily cards';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'weekly_checkins_profile_id_life_stage_week_key_key'
  ) then
    raise exception 'Weekly check-in uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_experience_assignments_profile_id_experience_date_key'
  ) then
    raise exception 'Daily assignment uniqueness is missing';
  end if;

  if has_function_privilege('anon', 'public.get_weekly_checkin_context()', 'execute') then
    raise exception 'Anonymous users must not read weekly context';
  end if;

  if has_function_privilege('anon', 'public.get_today_daily_experience()', 'execute') then
    raise exception 'Anonymous users must not read daily experience';
  end if;
end;
$$;

rollback;
