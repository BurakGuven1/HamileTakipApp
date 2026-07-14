-- Care intelligence: personalized sleep timing, multi-caregiver medicine
-- safety, and evidence-conscious developmental period notifications.

alter table public.profiles
  add column if not exists notify_sleep_predictions boolean not null default true,
  add column if not exists notify_medicine_safety boolean not null default true,
  add column if not exists notify_development_periods boolean not null default true;

comment on column public.profiles.notify_sleep_predictions is
  'Family preference for personalized sleep-window push notifications.';
comment on column public.profiles.notify_medicine_safety is
  'Family preference for multi-caregiver medicine dose safety alerts.';
comment on column public.profiles.notify_development_periods is
  'Family preference for age-based developmental period notes.';

create table if not exists public.care_intelligence_notifications (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid,
  exclude_user_id uuid,
  kind text not null check (
    kind in ('sleep_prediction', 'medicine_safety', 'development_period')
  ),
  source_key text not null unique,
  scheduled_for timestamptz not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 400),
  payload jsonb not null default '{}'::jsonb,
  requires_premium boolean not null default true,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_care_intelligence_notifications_due
  on public.care_intelligence_notifications (scheduled_for)
  where status = 'scheduled';
create index if not exists idx_care_intelligence_notifications_baby_kind
  on public.care_intelligence_notifications (baby_id, kind, status);

drop trigger if exists set_care_intelligence_notifications_updated_at
  on public.care_intelligence_notifications;
create trigger set_care_intelligence_notifications_updated_at
  before update on public.care_intelligence_notifications
  for each row execute function public.set_updated_at();

alter table public.care_intelligence_notifications enable row level security;
revoke all on public.care_intelligence_notifications from anon, authenticated;

comment on table public.care_intelligence_notifications is
  'Server-owned queue for sleep, medicine safety, and developmental period family push notifications.';

create table if not exists public.sleep_predictions (
  baby_id uuid primary key references public.babies(id) on delete cascade,
  status text not null check (status in ('insufficient', 'active', 'expired')),
  last_sleep_entry_id uuid references public.care_journal_entries(id) on delete set null,
  last_wake_at timestamptz,
  predicted_sleep_at timestamptz,
  window_start timestamptz,
  window_end timestamptz,
  notify_at timestamptz,
  sample_count int not null default 0 check (sample_count >= 0),
  confidence_score int check (
    confidence_score is null or confidence_score between 0 and 100
  ),
  predicted_wake_minutes int check (
    predicted_wake_minutes is null or predicted_wake_minutes > 0
  ),
  algorithm_version text not null default 'robust-wake-window-v1',
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_sleep_predictions_updated_at
  on public.sleep_predictions;
create trigger set_sleep_predictions_updated_at
  before update on public.sleep_predictions
  for each row execute function public.set_updated_at();

alter table public.sleep_predictions enable row level security;

drop policy if exists "sleep_predictions_select_premium_family"
  on public.sleep_predictions;
create policy "sleep_predictions_select_premium_family"
  on public.sleep_predictions for select
  using (
    public.can_access_baby(baby_id)
    and public.has_active_family_premium(baby_id)
  );

revoke all on public.sleep_predictions from anon;
revoke insert, update, delete on public.sleep_predictions from authenticated;
grant select on public.sleep_predictions to authenticated;

comment on table public.sleep_predictions is
  'Personalized next-sleep estimate derived from completed family sleep logs; never a medical recommendation.';

create or replace function public.refresh_sleep_prediction(p_baby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_sleep_count int := 0;
  v_latest_entry_id uuid;
  v_latest_end timestamptz;
  v_latest_kind text;
  v_latest_band text;
  v_age_months int := 0;
  v_min_minutes int := 20;
  v_max_minutes int := 1080;
  v_all_windows numeric[];
  v_kind_windows numeric[];
  v_exact_windows numeric[];
  v_selected_windows numeric[];
  v_sample_count int := 0;
  v_recent_start int := 1;
  v_overall_median numeric;
  v_recent_median numeric;
  v_mad numeric;
  v_target_minutes int;
  v_half_window_minutes int;
  v_confidence int;
  v_predicted_at timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_notify_at timestamptz;
  v_baby_name text;
  v_created_by uuid;
  v_status text;
begin
  select b.name, b.parent_id,
    greatest(
      0,
      (
        extract(year from age(current_date, b.birth_date)) * 12
        + extract(month from age(current_date, b.birth_date))
      )::int
    )
  into v_baby_name, v_created_by, v_age_months
  from public.babies b
  where b.id = p_baby_id;

  if v_baby_name is null then
    delete from public.sleep_predictions where baby_id = p_baby_id;
    return;
  end if;

  select e.id, e.ended_at, e.sleep_kind
  into v_latest_entry_id, v_latest_end, v_latest_kind
  from public.care_journal_entries e
  where e.baby_id = p_baby_id
    and e.entry_type = 'sleep'
    and e.ended_at is not null
    and e.ended_at > e.occurred_at + interval '5 minutes'
    and e.ended_at <= e.occurred_at + interval '16 hours'
  order by e.occurred_at desc
  limit 1;

  select count(*)::int
  into v_valid_sleep_count
  from public.care_journal_entries e
  where e.baby_id = p_baby_id
    and e.entry_type = 'sleep'
    and e.ended_at is not null
    and e.ended_at > e.occurred_at + interval '5 minutes'
    and e.ended_at <= e.occurred_at + interval '16 hours'
    and e.occurred_at >= now() - interval '21 days';

  update public.care_intelligence_notifications
  set status = 'cancelled'
  where baby_id = p_baby_id
    and kind = 'sleep_prediction'
    and status = 'scheduled';

  if v_latest_entry_id is null or v_valid_sleep_count < 7 then
    insert into public.sleep_predictions (
      baby_id,
      status,
      last_sleep_entry_id,
      last_wake_at,
      predicted_sleep_at,
      window_start,
      window_end,
      notify_at,
      sample_count,
      confidence_score,
      predicted_wake_minutes,
      calculated_at
    )
    values (
      p_baby_id,
      'insufficient',
      v_latest_entry_id,
      v_latest_end,
      null,
      null,
      null,
      null,
      v_valid_sleep_count,
      null,
      null,
      now()
    )
    on conflict (baby_id) do update set
      status = excluded.status,
      last_sleep_entry_id = excluded.last_sleep_entry_id,
      last_wake_at = excluded.last_wake_at,
      predicted_sleep_at = null,
      window_start = null,
      window_end = null,
      notify_at = null,
      sample_count = excluded.sample_count,
      confidence_score = null,
      predicted_wake_minutes = null,
      calculated_at = now();
    return;
  end if;

  v_latest_band := case
    when extract(hour from v_latest_end at time zone 'Europe/Istanbul') < 5 then 'night'
    when extract(hour from v_latest_end at time zone 'Europe/Istanbul') < 12 then 'morning'
    when extract(hour from v_latest_end at time zone 'Europe/Istanbul') < 17 then 'afternoon'
    when extract(hour from v_latest_end at time zone 'Europe/Istanbul') < 22 then 'evening'
    else 'night'
  end;

  if v_age_months < 2 then
    v_min_minutes := 20; v_max_minutes := 300;
  elsif v_age_months < 4 then
    v_min_minutes := 30; v_max_minutes := 360;
  elsif v_age_months < 6 then
    v_min_minutes := 40; v_max_minutes := 480;
  elsif v_age_months < 12 then
    v_min_minutes := 50; v_max_minutes := 600;
  elsif v_age_months < 24 then
    v_min_minutes := 75; v_max_minutes := 900;
  else
    v_min_minutes := 90; v_max_minutes := 1080;
  end if;

  with recent_sleep as (
    select source.*
    from (
      select e.id, e.occurred_at, e.ended_at, e.sleep_kind
      from public.care_journal_entries e
      where e.baby_id = p_baby_id
        and e.entry_type = 'sleep'
        and e.ended_at is not null
        and e.ended_at > e.occurred_at + interval '5 minutes'
        and e.ended_at <= e.occurred_at + interval '16 hours'
        and e.occurred_at >= now() - interval '21 days'
      order by e.occurred_at desc
      limit 40
    ) source
    order by source.occurred_at asc
  ), transitions as (
    select
      occurred_at as next_sleep_at,
      lag(ended_at) over (order by occurred_at) as previous_wake_at,
      lag(sleep_kind) over (order by occurred_at) as previous_sleep_kind
    from recent_sleep
  ), wake_windows as (
    select
      next_sleep_at,
      previous_sleep_kind,
      case
        when extract(hour from previous_wake_at at time zone 'Europe/Istanbul') < 5 then 'night'
        when extract(hour from previous_wake_at at time zone 'Europe/Istanbul') < 12 then 'morning'
        when extract(hour from previous_wake_at at time zone 'Europe/Istanbul') < 17 then 'afternoon'
        when extract(hour from previous_wake_at at time zone 'Europe/Istanbul') < 22 then 'evening'
        else 'night'
      end as wake_band,
      extract(epoch from (next_sleep_at - previous_wake_at)) / 60.0 as wake_minutes
    from transitions
    where previous_wake_at is not null
      and next_sleep_at > previous_wake_at
  )
  select
    array_agg(wake_minutes order by next_sleep_at)
      filter (where wake_minutes between v_min_minutes and v_max_minutes),
    array_agg(wake_minutes order by next_sleep_at)
      filter (
        where wake_minutes between v_min_minutes and v_max_minutes
          and previous_sleep_kind is not distinct from v_latest_kind
      ),
    array_agg(wake_minutes order by next_sleep_at)
      filter (
        where wake_minutes between v_min_minutes and v_max_minutes
          and previous_sleep_kind is not distinct from v_latest_kind
          and wake_band = v_latest_band
      )
  into v_all_windows, v_kind_windows, v_exact_windows
  from wake_windows;

  if coalesce(cardinality(v_exact_windows), 0) >= 4 then
    v_selected_windows := v_exact_windows;
  elsif coalesce(cardinality(v_kind_windows), 0) >= 5 then
    v_selected_windows := v_kind_windows;
  else
    v_selected_windows := v_all_windows;
  end if;

  v_sample_count := coalesce(cardinality(v_selected_windows), 0);

  if v_sample_count < 4 then
    insert into public.sleep_predictions (
      baby_id, status, last_sleep_entry_id, last_wake_at, sample_count, calculated_at
    ) values (
      p_baby_id, 'insufficient', v_latest_entry_id, v_latest_end,
      v_valid_sleep_count, now()
    )
    on conflict (baby_id) do update set
      status = 'insufficient',
      last_sleep_entry_id = excluded.last_sleep_entry_id,
      last_wake_at = excluded.last_wake_at,
      predicted_sleep_at = null,
      window_start = null,
      window_end = null,
      notify_at = null,
      sample_count = excluded.sample_count,
      confidence_score = null,
      predicted_wake_minutes = null,
      calculated_at = now();
    return;
  end if;

  select percentile_cont(0.5) within group (order by value)
  into v_overall_median
  from unnest(v_selected_windows) as value;

  v_recent_start := greatest(1, v_sample_count - 4);
  select percentile_cont(0.5) within group (order by value)
  into v_recent_median
  from unnest(v_selected_windows[v_recent_start:v_sample_count]) as value;

  select percentile_cont(0.5) within group (order by abs(value - v_overall_median))
  into v_mad
  from unnest(v_selected_windows) as value;

  v_target_minutes := round(
    0.65 * coalesce(v_recent_median, v_overall_median)
    + 0.35 * v_overall_median
  )::int;
  v_target_minutes := least(v_max_minutes, greatest(v_min_minutes, v_target_minutes));
  v_half_window_minutes := round(
    greatest(15, least(60, 10 + 1.4826 * coalesce(v_mad, 0)))
  )::int;
  v_confidence := least(
    92,
    greatest(
      45,
      45
      + least(25, greatest(0, v_sample_count - 4) * 4)
      + round(
          22 * (
            1 - least(
              1,
              coalesce(v_mad, 0) / greatest(v_overall_median * 0.35, 1)
            )
          )
        )::int
    )
  );

  v_predicted_at := v_latest_end + make_interval(mins => v_target_minutes);
  v_window_start := v_predicted_at - make_interval(mins => v_half_window_minutes);
  v_window_end := v_predicted_at + make_interval(mins => v_half_window_minutes);
  v_notify_at := v_predicted_at - interval '20 minutes';
  v_status := case when v_window_end < now() then 'expired' else 'active' end;

  insert into public.sleep_predictions (
    baby_id,
    status,
    last_sleep_entry_id,
    last_wake_at,
    predicted_sleep_at,
    window_start,
    window_end,
    notify_at,
    sample_count,
    confidence_score,
    predicted_wake_minutes,
    calculated_at
  ) values (
    p_baby_id,
    v_status,
    v_latest_entry_id,
    v_latest_end,
    v_predicted_at,
    v_window_start,
    v_window_end,
    v_notify_at,
    v_sample_count,
    v_confidence,
    v_target_minutes,
    now()
  )
  on conflict (baby_id) do update set
    status = excluded.status,
    last_sleep_entry_id = excluded.last_sleep_entry_id,
    last_wake_at = excluded.last_wake_at,
    predicted_sleep_at = excluded.predicted_sleep_at,
    window_start = excluded.window_start,
    window_end = excluded.window_end,
    notify_at = excluded.notify_at,
    sample_count = excluded.sample_count,
    confidence_score = excluded.confidence_score,
    predicted_wake_minutes = excluded.predicted_wake_minutes,
    algorithm_version = excluded.algorithm_version,
    calculated_at = now();

  if v_status = 'active' then
    insert into public.care_intelligence_notifications (
      baby_id,
      created_by,
      kind,
      source_key,
      scheduled_for,
      title,
      body,
      payload,
      requires_premium
    ) values (
      p_baby_id,
      v_created_by,
      'sleep_prediction',
      'sleep:' || p_baby_id::text || ':' || v_latest_entry_id::text,
      greatest(now(), v_notify_at),
      v_baby_name || ' için uyku penceresi yaklaşıyor',
      'Kayıt örüntüsüne göre yaklaşık 20 dakika içinde uyku zamanı yaklaşabilir. Uyku işaretlerini de gözlemleyin.',
      jsonb_build_object(
        'entry', 'sleep',
        'predicted_sleep_at', v_predicted_at,
        'window_start', v_window_start,
        'window_end', v_window_end,
        'confidence_score', v_confidence
      ),
      true
    )
    on conflict (source_key) do update set
      scheduled_for = excluded.scheduled_for,
      title = excluded.title,
      body = excluded.body,
      payload = excluded.payload,
      status = case
        when public.care_intelligence_notifications.status = 'sent' then 'sent'
        else 'scheduled'
      end,
      sent_at = case
        when public.care_intelligence_notifications.status = 'sent'
          then public.care_intelligence_notifications.sent_at
        else null
      end;
  end if;
end;
$$;

revoke all on function public.refresh_sleep_prediction(uuid)
  from public, anon, authenticated;

create or replace function public.refresh_sleep_prediction_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.entry_type = 'sleep' then
      perform public.refresh_sleep_prediction(old.baby_id);
    end if;
    return old;
  end if;

  if new.entry_type = 'sleep' or (tg_op = 'UPDATE' and old.entry_type = 'sleep') then
    perform public.refresh_sleep_prediction(new.baby_id);
  end if;
  return new;
end;
$$;

revoke all on function public.refresh_sleep_prediction_after_change()
  from public, anon, authenticated;

drop trigger if exists refresh_sleep_prediction_after_insert
  on public.care_journal_entries;
create trigger refresh_sleep_prediction_after_insert
  after insert on public.care_journal_entries
  for each row execute function public.refresh_sleep_prediction_after_change();

drop trigger if exists refresh_sleep_prediction_after_update
  on public.care_journal_entries;
create trigger refresh_sleep_prediction_after_update
  after update of occurred_at, ended_at, entry_type, sleep_kind
  on public.care_journal_entries
  for each row execute function public.refresh_sleep_prediction_after_change();

drop trigger if exists refresh_sleep_prediction_after_delete
  on public.care_journal_entries;
create trigger refresh_sleep_prediction_after_delete
  after delete on public.care_journal_entries
  for each row execute function public.refresh_sleep_prediction_after_change();

-- Medicine safety: a recent same-name record requires explicit confirmation.
-- This is a coordination warning, not a dosing recommendation.
create or replace function public.guard_recent_medicine_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name_key text;
  v_window interval;
  v_recent public.care_journal_entries;
begin
  if new.entry_type <> 'medicine' then
    return new;
  end if;

  if nullif(trim(new.medicine_name), '') is null then
    raise exception 'İlaç veya vitamin adı gerekli.';
  end if;

  v_name_key := regexp_replace(lower(trim(new.medicine_name)), '[^[:alnum:]]+', '', 'g');
  v_window := case
    when position('vitamin' in v_name_key) > 0 or v_name_key in ('d3', 'dvitamini')
      then interval '20 hours'
    else interval '6 hours'
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(new.baby_id::text || ':' || v_name_key, 0)
  );

  if current_setting('app.allow_recent_medicine_override', true) = 'true' then
    return new;
  end if;

  select e.* into v_recent
  from public.care_journal_entries e
  where e.baby_id = new.baby_id
    and e.entry_type = 'medicine'
    and regexp_replace(lower(trim(e.medicine_name)), '[^[:alnum:]]+', '', 'g') = v_name_key
    and e.occurred_at >= new.occurred_at - v_window
    and e.occurred_at <= new.occurred_at + interval '5 minutes'
  order by e.occurred_at desc
  limit 1;

  if v_recent.id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'RECENT_MEDICINE_DOSE',
      detail = jsonb_build_object(
        'entry_id', v_recent.id,
        'medicine_name', v_recent.medicine_name,
        'medicine_dose', v_recent.medicine_dose,
        'caregiver_name', v_recent.caregiver_name,
        'occurred_at', v_recent.occurred_at
      )::text,
      hint = 'Yeni bir doz vermeden önce diğer bakıcıyla ve ilaç planıyla doğrulayın.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_recent_medicine_dose()
  from public, anon, authenticated;

drop trigger if exists guard_recent_medicine_dose
  on public.care_journal_entries;
create trigger guard_recent_medicine_dose
  before insert on public.care_journal_entries
  for each row
  when (new.entry_type = 'medicine')
  execute function public.guard_recent_medicine_dose();

create or replace function public.create_medicine_care_entry_safely(
  p_baby_id uuid,
  p_medicine_name text,
  p_medicine_dose text,
  p_notes text,
  p_occurred_at timestamptz,
  p_caregiver_name text,
  p_override_recent boolean default false
)
returns public.care_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.care_journal_entries;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.';
  end if;

  if not public.can_access_baby(p_baby_id)
    or not public.has_active_family_premium(p_baby_id) then
    raise exception 'İlaç ve vitamin takibi Premium aile erişimi gerektirir.';
  end if;

  if char_length(trim(coalesce(p_medicine_name, ''))) not between 2 and 120 then
    raise exception 'İlaç veya vitamin adı 2–120 karakter olmalı.';
  end if;

  if char_length(coalesce(p_medicine_dose, '')) > 80
    or char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'Doz veya not alanı çok uzun.';
  end if;

  if coalesce(p_override_recent, false) then
    perform set_config('app.allow_recent_medicine_override', 'true', true);
  end if;

  insert into public.care_journal_entries (
    baby_id,
    created_by,
    caregiver_name,
    entry_type,
    occurred_at,
    medicine_name,
    medicine_dose,
    notes
  ) values (
    p_baby_id,
    auth.uid(),
    nullif(trim(p_caregiver_name), ''),
    'medicine',
    coalesce(p_occurred_at, now()),
    trim(p_medicine_name),
    nullif(trim(p_medicine_dose), ''),
    nullif(trim(p_notes), '')
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.create_medicine_care_entry_safely(
  uuid, text, text, text, timestamptz, text, boolean
) from public, anon;
grant execute on function public.create_medicine_care_entry_safely(
  uuid, text, text, text, timestamptz, text, boolean
) to authenticated;

create or replace function public.get_recent_medicine_dose(
  p_baby_id uuid,
  p_medicine_name text
)
returns table (
  entry_id uuid,
  medicine_name text,
  medicine_dose text,
  caregiver_name text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name_key text;
  v_window interval;
begin
  if not public.can_access_baby(p_baby_id)
    or not public.has_active_family_premium(p_baby_id) then
    return;
  end if;

  v_name_key := regexp_replace(
    lower(trim(coalesce(p_medicine_name, ''))),
    '[^[:alnum:]]+',
    '',
    'g'
  );
  if char_length(v_name_key) < 2 then
    return;
  end if;

  v_window := case
    when position('vitamin' in v_name_key) > 0 or v_name_key in ('d3', 'dvitamini')
      then interval '20 hours'
    else interval '6 hours'
  end;

  return query
  select e.id, e.medicine_name, e.medicine_dose, e.caregiver_name, e.occurred_at
  from public.care_journal_entries e
  where e.baby_id = p_baby_id
    and e.entry_type = 'medicine'
    and regexp_replace(lower(trim(e.medicine_name)), '[^[:alnum:]]+', '', 'g') = v_name_key
    and e.occurred_at >= now() - v_window
  order by e.occurred_at desc
  limit 1;
end;
$$;

revoke all on function public.get_recent_medicine_dose(uuid, text)
  from public, anon;
grant execute on function public.get_recent_medicine_dose(uuid, text)
  to authenticated;

create or replace function public.queue_medicine_safety_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby_name text;
  v_actor_name text;
begin
  if new.entry_type <> 'medicine' then
    return new;
  end if;

  select b.name into v_baby_name
  from public.babies b
  where b.id = new.baby_id;

  v_actor_name := coalesce(nullif(trim(new.caregiver_name), ''), 'Bir bakıcı');

  insert into public.care_intelligence_notifications (
    baby_id,
    created_by,
    exclude_user_id,
    kind,
    source_key,
    scheduled_for,
    title,
    body,
    payload,
    requires_premium
  ) values (
    new.baby_id,
    new.created_by,
    new.created_by,
    'medicine_safety',
    'medicine:' || new.id::text,
    now(),
    coalesce(v_baby_name, 'Bebek') || ' için doz kaydedildi',
    v_actor_name || ' az önce ilaç/vitamin kaydı ekledi. Yeni bir doz vermeden önce aile günlüğünü kontrol edin.',
    jsonb_build_object('entry', 'medicine', 'entry_id', new.id),
    false
  )
  on conflict (source_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_medicine_safety_notification()
  from public, anon, authenticated;

drop trigger if exists queue_medicine_safety_notification
  on public.care_journal_entries;
create trigger queue_medicine_safety_notification
  after insert on public.care_journal_entries
  for each row
  when (new.entry_type = 'medicine')
  execute function public.queue_medicine_safety_notification();

-- Development periods use broad milestone ages, not unvalidated exact "leap"
-- weeks. Copy explicitly avoids claiming that development caused fussiness.
create or replace function public.enqueue_development_period_notifications(
  p_baby_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby public.babies;
  v_months int;
  v_title text;
  v_body text;
  v_scheduled_for timestamptz;
begin
  select * into v_baby from public.babies where id = p_baby_id;
  if v_baby.id is null then
    return;
  end if;

  update public.care_intelligence_notifications
  set status = 'cancelled'
  where baby_id = p_baby_id
    and kind = 'development_period'
    and status = 'scheduled';

  for v_months, v_title, v_body in
    select * from (values
      (2, '2. ay gelişim notu', 'Yeni beceriler belirginleşirken bazı günler daha yoğun geçebilir. Uyku veya huysuzluğun tek bir nedeni olmayabilir; gözlemini kaydet ve kendine de nefes alanı aç.'),
      (4, '4. ay gelişim notu', 'Bebeğin çevreyle etkileşimi hızla değişiyor olabilir. Rutin farklılaştığında bunun her bebekte aynı zamanda olmadığını hatırla; zorlanıyorsanız destek isteyin.'),
      (6, '6. ay gelişim notu', 'Hareket ve keşif arttıkça günlük ritim de değişebilir. Bu dönem geçici dalgalanmalar içerebilir; belirgin veya kalıcı bir endişede sağlık profesyoneline danışın.'),
      (9, '9. ay gelişim notu', 'Yakınlık ihtiyacı ve yeni beceriler bu aylarda değişebilir. Uyku düzensizliğini otomatik olarak bir “atağa” bağlamayın; bebeğinizin işaretlerini izleyin.'),
      (12, '1 yaş gelişim notu', 'Bir yılda çok şey değişti. Yeni beceriler ve rutin değişimleri yorucu olabilir; küçük adımları fark edin ve bakım yükünü ailece paylaşın.'),
      (18, '18. ay gelişim notu', 'Bağımsızlık isteği ile yakınlık ihtiyacı aynı dönemde görülebilir. Zor günler ebeveynlik başarısızlığı değildir; sakin, tutarlı destek yardımcı olabilir.'),
      (24, '2 yaş gelişim notu', 'Dil, hareket ve duygular hızla gelişirken günler daha yoğun hissedilebilir. Her çocuk kendi hızında ilerler; kaygınız varsa çocuk sağlığı uzmanıyla konuşun.')
    ) schedule(months, title, body)
  loop
    v_scheduled_for := (
      (v_baby.birth_date + make_interval(months => v_months))::date
      + time '09:00'
    ) at time zone 'Europe/Istanbul';

    if v_scheduled_for > now() then
      insert into public.care_intelligence_notifications (
        baby_id,
        created_by,
        kind,
        source_key,
        scheduled_for,
        title,
        body,
        payload,
        requires_premium
      ) values (
        v_baby.id,
        v_baby.parent_id,
        'development_period',
        'development:' || v_baby.id::text || ':' || v_months::text || 'm',
        v_scheduled_for,
        v_title,
        v_body,
        jsonb_build_object('age_months', v_months),
        true
      )
      on conflict (source_key) do update set
        scheduled_for = excluded.scheduled_for,
        title = excluded.title,
        body = excluded.body,
        payload = excluded.payload,
        status = case
          when public.care_intelligence_notifications.status = 'sent' then 'sent'
          else 'scheduled'
        end;
    end if;
  end loop;
end;
$$;

revoke all on function public.enqueue_development_period_notifications(uuid)
  from public, anon, authenticated;

create or replace function public.enqueue_development_periods_after_baby_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_development_period_notifications(new.id);
  return new;
end;
$$;

revoke all on function public.enqueue_development_periods_after_baby_change()
  from public, anon, authenticated;

drop trigger if exists enqueue_development_periods_after_baby_insert
  on public.babies;
create trigger enqueue_development_periods_after_baby_insert
  after insert on public.babies
  for each row execute function public.enqueue_development_periods_after_baby_change();

drop trigger if exists enqueue_development_periods_after_birth_date_update
  on public.babies;
create trigger enqueue_development_periods_after_birth_date_update
  after update of birth_date on public.babies
  for each row execute function public.enqueue_development_periods_after_baby_change();

do $$
declare
  v_baby_id uuid;
begin
  for v_baby_id in select id from public.babies loop
    perform public.refresh_sleep_prediction(v_baby_id);
    perform public.enqueue_development_period_notifications(v_baby_id);
  end loop;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.care_journal_entries;
exception
  when duplicate_object then null;
end;
$$;
