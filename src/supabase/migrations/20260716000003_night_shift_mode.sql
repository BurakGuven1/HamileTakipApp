-- One-parent night shifts, targeted app alarms and server-generated morning summaries.

create table if not exists public.night_shift_sessions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  caregiver_name text not null check (char_length(trim(caregiver_name)) between 1 and 80),
  started_at timestamptz not null default now(),
  planned_end_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text check (ended_reason is null or ended_reason in ('manual', 'planned', 'handed_over')),
  status text not null default 'active' check (status in ('active', 'completed')),
  summary jsonb,
  summary_notification_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end_at > started_at),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists night_shift_one_active_per_baby
  on public.night_shift_sessions (baby_id) where status = 'active';
create index if not exists night_shift_baby_started_idx
  on public.night_shift_sessions (baby_id, started_at desc);
create index if not exists night_shift_due_idx
  on public.night_shift_sessions (planned_end_at) where status = 'active';

alter table public.night_shift_sessions enable row level security;
drop policy if exists "night_shift_select_family" on public.night_shift_sessions;
create policy "night_shift_select_family" on public.night_shift_sessions for select
  using (public.can_access_baby(baby_id));
revoke all on public.night_shift_sessions from anon;
grant select on public.night_shift_sessions to authenticated;

drop trigger if exists set_night_shift_updated_at on public.night_shift_sessions;
create trigger set_night_shift_updated_at
  before update on public.night_shift_sessions
  for each row execute function public.set_updated_at();

alter table public.care_reminders
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists alarm_kind text not null default 'standard',
  add column if not exists snooze_minutes int not null default 10;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'care_reminders_alarm_kind_check'
      and conrelid = 'public.care_reminders'::regclass
  ) then
    alter table public.care_reminders add constraint care_reminders_alarm_kind_check
      check (alarm_kind in ('standard', 'night_shift', 'shift_summary'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'care_reminders_snooze_minutes_check'
      and conrelid = 'public.care_reminders'::regclass
  ) then
    alter table public.care_reminders add constraint care_reminders_snooze_minutes_check
      check (snooze_minutes between 1 and 60);
  end if;
end $$;

create index if not exists care_reminders_target_due_idx
  on public.care_reminders (target_user_id, scheduled_for)
  where status = 'scheduled' and target_user_id is not null;

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
  ), active_sleep as (
    select coalesce(sum(greatest(
      0,
      extract(epoch from (p_ended_at - greatest(started_at, p_started_at))) / 60
    )), 0)::int as minutes
    from public.care_active_timers
    where baby_id = p_baby_id
      and timer_type = 'sleep'
      and ended_at is null
      and started_at < p_ended_at
  )
  select jsonb_build_object(
    'feeding_count', totals.feeding_count,
    'diaper_count', totals.diaper_count,
    'sleep_minutes', totals.completed_sleep_minutes + active_sleep.minutes,
    'started_at', p_started_at,
    'ended_at', p_ended_at
  )
  from totals cross join active_sleep;
$$;
revoke all on function public.build_night_shift_summary(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.start_night_shift(
  p_baby_id uuid,
  p_caregiver_name text,
  p_planned_end_at timestamptz,
  p_summary_notification_id text
)
returns public.night_shift_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.night_shift_sessions;
  v_session public.night_shift_sessions;
  v_now timestamptz := now();
begin
  if v_user_id is null or not public.can_access_baby(p_baby_id) then
    raise exception 'Bu bebek için vardiya başlatma yetkin yok.';
  end if;
  if nullif(trim(p_caregiver_name), '') is null then
    raise exception 'Vardiyadaki ebeveyn adı gerekli.';
  end if;
  if p_planned_end_at <= v_now + interval '5 minutes' or p_planned_end_at > v_now + interval '16 hours' then
    raise exception 'Vardiya bitişi 5 dakika ile 16 saat arasında olmalı.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':night-shift', 0));
  select * into v_existing from public.night_shift_sessions
  where baby_id = p_baby_id and status = 'active'
  for update;

  if found and v_existing.caregiver_id = v_user_id then
    update public.night_shift_sessions
      set planned_end_at = p_planned_end_at,
          caregiver_name = trim(p_caregiver_name),
          summary_notification_id = p_summary_notification_id
      where id = v_existing.id returning * into v_session;
    return v_session;
  elsif found then
    raise exception '% şu anda vardiyada. Önce vardiyayı devralmalısın.', v_existing.caregiver_name;
  end if;

  insert into public.night_shift_sessions (
    baby_id, caregiver_id, caregiver_name, planned_end_at, summary_notification_id
  ) values (
    p_baby_id, v_user_id, trim(p_caregiver_name), p_planned_end_at, p_summary_notification_id
  ) returning * into v_session;
  return v_session;
end;
$$;
revoke all on function public.start_night_shift(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.start_night_shift(uuid, text, timestamptz, text) to authenticated;

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
  if v_session.status = 'completed' then return v_session; end if;
  v_end := case when now() >= v_session.planned_end_at then v_session.planned_end_at else now() end;
  v_reason := case when now() >= v_session.planned_end_at then 'planned' else 'manual' end;

  update public.night_shift_sessions set
    ended_at = v_end,
    ended_reason = v_reason,
    status = 'completed',
    summary = public.build_night_shift_summary(v_session.baby_id, v_session.started_at, v_end)
  where id = v_session.id returning * into v_session;
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
  v_count int;
begin
  update public.night_shift_sessions s set
    ended_at = s.planned_end_at,
    ended_reason = 'planned',
    status = 'completed',
    summary = public.build_night_shift_summary(s.baby_id, s.started_at, s.planned_end_at)
  where s.status = 'active' and s.planned_end_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.complete_due_night_shifts() from public, anon, authenticated;

do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'complete-night-shifts-every-five-minutes'
  loop perform cron.unschedule(v_job_id); end loop;
  perform cron.schedule(
    'complete-night-shifts-every-five-minutes',
    '*/5 * * * *',
    'select public.complete_due_night_shifts();'
  );
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'night_shift_sessions'
  ) then
    alter publication supabase_realtime add table public.night_shift_sessions;
  end if;
end $$;

comment on table public.night_shift_sessions is
  'A single active overnight caregiver per baby with an immutable server-computed morning summary.';
