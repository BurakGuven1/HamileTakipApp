-- Reliable night-shift handover cards for the other parent.

alter table public.care_reminders
  add column if not exists night_shift_session_id uuid
  references public.night_shift_sessions(id) on delete cascade;

create unique index if not exists care_reminders_shift_handover_unique
  on public.care_reminders (night_shift_session_id, target_user_id)
  where alarm_kind = 'shift_summary' and night_shift_session_id is not null;

create or replace function public.build_night_shift_summary(
  p_baby_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with entries as (
    select * from public.care_journal_entries
    where baby_id = p_baby_id
      and deleted_at is null
      and occurred_at >= p_started_at
      and occurred_at <= p_ended_at
  ), totals as (
    select
      count(*) filter (where entry_type in ('breastfeeding', 'bottle'))::int as feeding_count,
      count(*) filter (where entry_type = 'diaper')::int as diaper_count,
      coalesce(sum(
        case when entry_type = 'sleep' then greatest(
          0,
          extract(epoch from (least(coalesce(ended_at, p_ended_at), p_ended_at) - greatest(occurred_at, p_started_at))) / 60
        ) else 0 end
      ), 0)::int as completed_sleep_minutes
    from entries
  ), latest_state as (
    select
      max(occurred_at) filter (
        where entry_type in ('breastfeeding', 'bottle')
      ) as last_feed_at,
      max(ended_at) filter (
        where entry_type = 'sleep' and ended_at is not null
      ) as last_sleep_ended_at
    from public.care_journal_entries
    where baby_id = p_baby_id
      and deleted_at is null
      and occurred_at <= p_ended_at
  ), active_sleep as (
    select
      coalesce(sum(greatest(
        0,
        extract(epoch from (p_ended_at - greatest(started_at, p_started_at))) / 60
      )), 0)::int as minutes,
      max(started_at) as active_sleep_started_at
    from public.care_active_timers
    where baby_id = p_baby_id
      and timer_type = 'sleep'
      and ended_at is null
      and started_at < p_ended_at
  ), next_reminder as (
    select min(scheduled_for) as next_reminder_at
    from public.care_reminders
    where baby_id = p_baby_id
      and status = 'scheduled'
      and alarm_kind <> 'shift_summary'
      and scheduled_for >= p_ended_at
  )
  select jsonb_build_object(
    'feeding_count', totals.feeding_count,
    'diaper_count', totals.diaper_count,
    'sleep_minutes', totals.completed_sleep_minutes + active_sleep.minutes,
    'last_feed_at', latest_state.last_feed_at,
    'last_sleep_ended_at', latest_state.last_sleep_ended_at,
    'active_sleep_started_at', active_sleep.active_sleep_started_at,
    'next_reminder_at', next_reminder.next_reminder_at,
    'started_at', p_started_at,
    'ended_at', p_ended_at
  )
  from totals
  cross join latest_state
  cross join active_sleep
  cross join next_reminder;
$$;
revoke all on function public.build_night_shift_summary(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.queue_night_shift_handover(
  p_session_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.night_shift_sessions;
  v_baby_name text;
  v_owner_id uuid;
  v_summary jsonb;
  v_body text;
  v_count int := 0;
begin
  select * into v_session
  from public.night_shift_sessions
  where id = p_session_id;

  if not found or v_session.status <> 'completed' then
    return 0;
  end if;

  select name, parent_id into v_baby_name, v_owner_id
  from public.babies
  where id = v_session.baby_id;

  v_summary := coalesce(v_session.summary, '{}'::jsonb);
  v_body := concat_ws(' ',
    case
      when nullif(v_summary ->> 'last_feed_at', '') is not null then
        'Son beslenme ' || to_char(
          (v_summary ->> 'last_feed_at')::timestamptz at time zone 'Europe/Istanbul',
          'HH24:MI'
        ) || '.'
      else 'Henüz beslenme kaydı yok.'
    end,
    case
      when nullif(v_summary ->> 'active_sleep_started_at', '') is not null then
        'Uyku hâlâ sürüyor.'
      when nullif(v_summary ->> 'last_sleep_ended_at', '') is not null then
        'Son uyku ' || to_char(
          (v_summary ->> 'last_sleep_ended_at')::timestamptz at time zone 'Europe/Istanbul',
          'HH24:MI'
        ) || '''da bitti.'
      else 'Devam eden uyku görünmüyor.'
    end,
    case
      when nullif(v_summary ->> 'next_reminder_at', '') is not null then
        'Sıradaki hatırlatma ' || to_char(
          (v_summary ->> 'next_reminder_at')::timestamptz at time zone 'Europe/Istanbul',
          'HH24:MI'
        ) || '.'
      else 'Planlı yeni hatırlatma yok.'
    end
  );

  with recipients as (
    select v_owner_id as user_id
    where v_owner_id <> v_session.caregiver_id
    union
    select fm.member_id
    from public.family_members fm
    where fm.owner_id = v_owner_id
      and fm.member_id <> v_session.caregiver_id
  )
  insert into public.care_reminders (
    baby_id,
    created_by,
    entry_type,
    scheduled_for,
    title,
    body,
    target_user_id,
    alarm_kind,
    status,
    night_shift_session_id
  )
  select
    v_session.baby_id,
    v_session.caregiver_id,
    'sleep',
    now(),
    v_baby_name || ' için gece teslimi',
    v_body,
    recipients.user_id,
    'shift_summary',
    'scheduled',
    v_session.id
  from recipients
  on conflict (night_shift_session_id, target_user_id)
    where alarm_kind = 'shift_summary' and night_shift_session_id is not null
    do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.queue_night_shift_handover(uuid)
  from public, anon, authenticated;

create or replace function public.finish_night_shift(p_session_id uuid)
returns public.night_shift_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.night_shift_sessions;
  v_end timestamptz;
  v_reason text;
begin
  select * into v_session from public.night_shift_sessions
  where id = p_session_id for update;
  if not found or auth.uid() is null or not public.can_access_baby(v_session.baby_id) then
    raise exception 'Vardiya bulunamadı.';
  end if;
  if v_session.status = 'completed' then
    perform public.queue_night_shift_handover(v_session.id);
    return v_session;
  end if;

  v_end := case
    when now() >= v_session.planned_end_at then v_session.planned_end_at
    else now()
  end;
  v_reason := case
    when now() >= v_session.planned_end_at then 'planned'
    else 'manual'
  end;

  update public.night_shift_sessions set
    ended_at = v_end,
    ended_reason = v_reason,
    status = 'completed',
    summary = public.build_night_shift_summary(v_session.baby_id, v_session.started_at, v_end)
  where id = v_session.id
  returning * into v_session;

  perform public.queue_night_shift_handover(v_session.id);
  return v_session;
end;
$$;
revoke all on function public.finish_night_shift(uuid) from public, anon;
grant execute on function public.finish_night_shift(uuid) to authenticated;

create or replace function public.complete_due_night_shifts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.night_shift_sessions;
  v_count int := 0;
begin
  for v_session in
    select * from public.night_shift_sessions
    where status = 'active' and planned_end_at <= now()
    for update skip locked
  loop
    update public.night_shift_sessions set
      ended_at = v_session.planned_end_at,
      ended_reason = 'planned',
      status = 'completed',
      summary = public.build_night_shift_summary(
        v_session.baby_id,
        v_session.started_at,
        v_session.planned_end_at
      )
    where id = v_session.id;

    perform public.queue_night_shift_handover(v_session.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.complete_due_night_shifts()
  from public, anon, authenticated;

comment on function public.queue_night_shift_handover(uuid) is
  'Queues one idempotent context-rich handover push for every family member except the parent who completed the shift.';
