create or replace function public.ensure_daily_experience_for_profile(p_profile_id uuid)
returns public.daily_experience_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.current_turkey_date();
  v_stage text;
  v_slot integer := extract(isodow from v_today)::integer - 1;
  v_focus_tags text[] := array[]::text[];
  v_content public.daily_experience_content;
  v_assignment public.daily_experience_assignments;
begin
  if p_profile_id is null then
    raise exception 'profile_required' using errcode = '22023';
  end if;

  select case when p.is_pregnant then 'pregnancy' else 'postpartum' end
  into v_stage
  from public.profiles p
  where p.id = p_profile_id and p.onboarding_completed;

  if v_stage is null then return null; end if;

  select coalesce(w.focus_tags, array[]::text[])
  into v_focus_tags
  from public.weekly_checkins w
  where w.profile_id = p_profile_id
    and w.life_stage = v_stage
  order by w.week_key desc
  limit 1;

  select * into v_assignment
  from public.daily_experience_assignments
  where profile_id = p_profile_id and experience_date = v_today;
  if found then return v_assignment; end if;

  select c.* into v_content
  from public.daily_experience_content c
  where c.life_stage = v_stage
    and c.active
    and (
      (c.focus_tag is null and c.day_slot = v_slot)
      or c.focus_tag = any(coalesce(v_focus_tags, array[]::text[]))
    )
    and not exists (
      select 1 from public.daily_experience_assignments recent
      where recent.profile_id = p_profile_id
        and recent.content_key = c.content_key
        and recent.experience_date >= v_today - 14
    )
  order by
    case when c.focus_tag = any(coalesce(v_focus_tags, array[]::text[])) then 0 else 1 end,
    hashtextextended(p_profile_id::text || v_today::text || c.content_key, 0)
  limit 1;

  if v_content.content_key is null then
    select c.* into v_content
    from public.daily_experience_content c
    where c.life_stage = v_stage and c.day_slot = v_slot and c.active
    order by c.content_key
    limit 1;
  end if;

  insert into public.daily_experience_assignments (
    profile_id, experience_date, life_stage, content_key, payload
  ) values (
    p_profile_id,
    v_today,
    v_stage,
    v_content.content_key,
    jsonb_build_object(
      'title', v_content.title,
      'body', v_content.body,
      'action_label', v_content.action_label,
      'destination', v_content.destination,
      'stage_fact', v_content.stage_fact,
      'premium_title', v_content.premium_title,
      'premium_body', v_content.premium_body
    )
  )
  on conflict (profile_id, experience_date) do update
    set profile_id = excluded.profile_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.ensure_daily_experience_for_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_daily_experience_for_profile(uuid)
  to service_role;
