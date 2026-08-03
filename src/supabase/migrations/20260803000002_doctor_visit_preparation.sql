-- Doctor-visit preparation for pregnancy, baby care and the postpartum mother.
-- The snapshot deliberately returns recorded facts only; it does not diagnose,
-- interpret measurements or calculate growth percentiles.

create table if not exists public.doctor_visit_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  baby_id uuid references public.babies(id) on delete cascade,
  subject text not null check (subject in ('pregnancy', 'baby', 'postpartum_mother')),
  item_type text not null check (item_type in ('question', 'symptom', 'medication', 'note')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  details text check (details is null or char_length(details) <= 1200),
  severity smallint check (severity is null or severity between 1 and 5),
  started_at timestamptz,
  resolved_at timestamptz,
  answer text check (answer is null or char_length(answer) <= 1200),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (item_type = 'symptom' or severity is null),
  check (resolved_at is null or resolved_at >= coalesce(started_at, created_at))
);

comment on table public.doctor_visit_items is
  'User-entered questions, symptoms, medicines and notes prepared for a doctor visit.';
comment on column public.doctor_visit_items.severity is
  'Optional user-entered 1-5 symptom severity. It is not a clinical interpretation.';

create table if not exists public.pregnancy_visit_measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  measured_at timestamptz not null default now(),
  source text not null default 'self' check (source in ('self', 'health_team')),
  systolic_bp smallint check (systolic_bp is null or systolic_bp between 40 and 300),
  diastolic_bp smallint check (diastolic_bp is null or diastolic_bp between 20 and 200),
  pulse_bpm smallint check (pulse_bpm is null or pulse_bpm between 20 and 250),
  fundal_height_cm numeric(5,1) check (fundal_height_cm is null or fundal_height_cm between 1 and 80),
  fetal_heart_rate_bpm smallint check (fetal_heart_rate_bpm is null or fetal_heart_rate_bpm between 30 and 260),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((systolic_bp is null) = (diastolic_bp is null)),
  check (
    systolic_bp is not null
    or pulse_bpm is not null
    or fundal_height_cm is not null
    or fetal_heart_rate_bpm is not null
  )
);

comment on table public.pregnancy_visit_measurements is
  'Measurements explicitly entered by the user or copied from a health-team measurement; no device inference or clinical interpretation.';
comment on column public.pregnancy_visit_measurements.source is
  'A provenance label selected by the user; health_team means copied from a health-team measurement, not independently verified by Anne+.';

create index if not exists doctor_visit_items_profile_subject_created_idx
  on public.doctor_visit_items (profile_id, subject, created_at desc);
create index if not exists doctor_visit_items_baby_subject_created_idx
  on public.doctor_visit_items (baby_id, subject, created_at desc)
  where baby_id is not null;
create index if not exists pregnancy_visit_measurements_profile_measured_idx
  on public.pregnancy_visit_measurements (profile_id, measured_at desc);

create or replace function public.validate_doctor_visit_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_baby_parent_id uuid;
begin
  if tg_op = 'UPDATE' then
    -- Shared family edits may change content, never its ownership/provenance.
    new.profile_id := old.profile_id;
    new.subject := old.subject;
    new.baby_id := old.baby_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.title := trim(new.title);
  new.details := nullif(trim(new.details), '');
  new.answer := nullif(trim(new.answer), '');

  if new.subject = 'pregnancy' then
    if new.baby_id is not null then
      raise exception 'Hamilelik notu bir bebek profiline bağlanamaz.';
    end if;
  else
    if new.baby_id is null then
      raise exception 'Bebek ve doğum sonrası anne notlarında bebek seçimi gerekir.';
    end if;

    select b.parent_id into v_baby_parent_id
    from public.babies b
    where b.id = new.baby_id;

    if v_baby_parent_id is null or v_baby_parent_id <> new.profile_id then
      raise exception 'Bebek bu aile profiline ait değil.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.preserve_pregnancy_measurement_provenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.profile_id := old.profile_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists validate_doctor_visit_item_scope_trigger on public.doctor_visit_items;
create trigger validate_doctor_visit_item_scope_trigger
  before insert or update on public.doctor_visit_items
  for each row execute function public.validate_doctor_visit_item_scope();

drop trigger if exists preserve_pregnancy_measurement_provenance_trigger on public.pregnancy_visit_measurements;
create trigger preserve_pregnancy_measurement_provenance_trigger
  before update on public.pregnancy_visit_measurements
  for each row execute function public.preserve_pregnancy_measurement_provenance();

drop trigger if exists set_doctor_visit_items_updated_at on public.doctor_visit_items;
create trigger set_doctor_visit_items_updated_at
  before update on public.doctor_visit_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_pregnancy_visit_measurements_updated_at on public.pregnancy_visit_measurements;
create trigger set_pregnancy_visit_measurements_updated_at
  before update on public.pregnancy_visit_measurements
  for each row execute function public.set_updated_at();

alter table public.doctor_visit_items enable row level security;
alter table public.pregnancy_visit_measurements enable row level security;

drop policy if exists "doctor_visit_items_select_scoped" on public.doctor_visit_items;
drop policy if exists "doctor_visit_items_insert_scoped" on public.doctor_visit_items;
drop policy if exists "doctor_visit_items_update_scoped" on public.doctor_visit_items;
drop policy if exists "doctor_visit_items_delete_scoped" on public.doctor_visit_items;

create policy "doctor_visit_items_select_scoped"
  on public.doctor_visit_items for select
  using (
    (subject = 'baby' and public.can_access_baby(baby_id))
    or (subject in ('pregnancy', 'postpartum_mother') and public.can_access_profile(profile_id))
  );

create policy "doctor_visit_items_insert_scoped"
  on public.doctor_visit_items for insert
  with check (
    created_by = auth.uid()
    and (
      (subject = 'baby' and public.can_access_baby(baby_id))
      or (subject in ('pregnancy', 'postpartum_mother') and public.can_access_profile(profile_id))
    )
  );

create policy "doctor_visit_items_update_scoped"
  on public.doctor_visit_items for update
  using (
    (subject = 'baby' and public.can_access_baby(baby_id))
    or (subject in ('pregnancy', 'postpartum_mother') and public.can_access_profile(profile_id))
  )
  with check (
    (subject = 'baby' and public.can_access_baby(baby_id))
    or (subject in ('pregnancy', 'postpartum_mother') and public.can_access_profile(profile_id))
  );

create policy "doctor_visit_items_delete_scoped"
  on public.doctor_visit_items for delete
  using (
    (subject = 'baby' and public.can_access_baby(baby_id))
    or (subject in ('pregnancy', 'postpartum_mother') and public.can_access_profile(profile_id))
  );

drop policy if exists "pregnancy_visit_measurements_select_maternal" on public.pregnancy_visit_measurements;
drop policy if exists "pregnancy_visit_measurements_insert_maternal" on public.pregnancy_visit_measurements;
drop policy if exists "pregnancy_visit_measurements_update_maternal" on public.pregnancy_visit_measurements;
drop policy if exists "pregnancy_visit_measurements_delete_maternal" on public.pregnancy_visit_measurements;

create policy "pregnancy_visit_measurements_select_maternal"
  on public.pregnancy_visit_measurements for select
  using (public.can_access_profile(profile_id));
create policy "pregnancy_visit_measurements_insert_maternal"
  on public.pregnancy_visit_measurements for insert
  with check (created_by = auth.uid() and public.can_access_profile(profile_id));
create policy "pregnancy_visit_measurements_update_maternal"
  on public.pregnancy_visit_measurements for update
  using (public.can_access_profile(profile_id))
  with check (public.can_access_profile(profile_id));
create policy "pregnancy_visit_measurements_delete_maternal"
  on public.pregnancy_visit_measurements for delete
  using (public.can_access_profile(profile_id));

grant select, insert, update, delete on public.doctor_visit_items to authenticated;
grant select, insert, update, delete on public.pregnancy_visit_measurements to authenticated;

create or replace function public.get_doctor_visit_snapshot(
  p_subject text,
  p_baby_id uuid default null,
  p_days int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_generated_at timestamptz := now();
  v_today date := (timezone('Europe/Istanbul', now()))::date;
  v_start_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_profile public.profiles%rowtype;
  v_baby public.babies%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_gestation_day int;
begin
  if v_user_id is null then
    raise exception 'Oturum gerekli.' using errcode = '42501';
  end if;

  if p_subject not in ('pregnancy', 'baby', 'postpartum_mother') then
    raise exception 'Geçersiz görüşme konusu.' using errcode = '22023';
  end if;

  if p_days not in (7, 30) then
    raise exception 'Rapor dönemi 7 veya 30 gün olmalıdır.' using errcode = '22023';
  end if;

  v_profile_id := public.get_active_profile_id();
  if v_profile_id is null then
    raise exception 'Aktif aile profili bulunamadı.' using errcode = '42501';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = v_profile_id;

  if not found then
    raise exception 'Profil bulunamadı.' using errcode = 'P0002';
  end if;

  if p_subject in ('pregnancy', 'postpartum_mother')
     and not public.can_access_profile(v_profile_id) then
    raise exception 'Anne sağlık bilgilerine erişim izniniz yok.' using errcode = '42501';
  end if;

  if p_subject in ('baby', 'postpartum_mother') then
    if p_baby_id is null then
      raise exception 'Bu rapor için bebek seçimi gerekir.' using errcode = '22023';
    end if;

    select b.* into v_baby
    from public.babies b
    where b.id = p_baby_id
      and b.parent_id = v_profile_id;

    if not found or not public.can_access_baby(p_baby_id) then
      raise exception 'Bebek profiline erişim izniniz yok.' using errcode = '42501';
    end if;
  end if;

  v_start_date := v_today - (p_days - 1);
  v_start_at := v_start_date::timestamp at time zone 'Europe/Istanbul';
  v_end_at := (v_today + 1)::timestamp at time zone 'Europe/Istanbul';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'item_type', i.item_type,
        'title', i.title,
        'details', i.details,
        'severity', i.severity,
        'started_at', i.started_at,
        'resolved_at', i.resolved_at,
        'answer', i.answer,
        'created_at', i.created_at
      ) order by i.created_at desc
    ),
    '[]'::jsonb
  ) into v_items
  from public.doctor_visit_items i
  where i.profile_id = v_profile_id
    and i.subject = p_subject
    and (
      (p_subject = 'pregnancy' and i.baby_id is null)
      or (p_subject <> 'pregnancy' and i.baby_id = p_baby_id)
    )
    and (i.created_at >= v_start_at or i.resolved_at is null);

  v_payload := jsonb_build_object(
    'subject', p_subject,
    'generated_at', v_generated_at,
    'period', jsonb_build_object(
      'days', p_days,
      'start_date', v_start_date,
      'end_date', v_today,
      'timezone', 'Europe/Istanbul'
    ),
    'profile', case
      -- A baby-only caregiver needs the owning id for shared baby items, but
      -- must not receive maternal pregnancy or wellbeing context.
      when p_subject = 'baby' then jsonb_build_object('id', v_profile.id)
      else jsonb_build_object(
        'id', v_profile.id,
        'display_name', v_profile.display_name,
        'mother_name', v_profile.mother_name,
        'due_date', v_profile.due_date,
        'is_pregnant', v_profile.is_pregnant,
        'feeding_mode', v_profile.feeding_mode
      )
    end,
    'baby', case
      when p_subject = 'pregnancy' then null
      else jsonb_build_object(
        'id', v_baby.id,
        'name', v_baby.name,
        'birth_date', v_baby.birth_date,
        'age_days', greatest(0, v_today - v_baby.birth_date)
      )
    end,
    'items', v_items
  );

  if p_subject = 'pregnancy' then
    if v_profile.due_date is not null then
      v_gestation_day := greatest(1, least(294, 280 - (v_profile.due_date - v_today)));
    end if;

    v_payload := v_payload || jsonb_build_object(
      'pregnancy_age', case
        when v_gestation_day is null then null
        else jsonb_build_object(
          'week', greatest(1, least(42, floor(v_gestation_day / 7.0)::int)),
          'day_of_week', mod(v_gestation_day, 7),
          'gestation_day', v_gestation_day
        )
      end,
      'weight_records', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'record_date', w.record_date,
            'weight_kg', w.weight_kg,
            'notes', w.notes
          ) order by w.record_date desc
        ), '[]'::jsonb)
        from public.pregnancy_weight_records w
        where w.profile_id = v_profile_id
          and w.record_date between v_start_date and v_today
      ),
      'daily_counters', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'counter_date', c.counter_date,
            'kick_count', c.kick_count,
            'contraction_count', c.contraction_count
          ) order by c.counter_date desc
        ), '[]'::jsonb)
        from public.pregnancy_daily_counters c
        where c.profile_id = v_profile_id
          and c.counter_date between v_start_date and v_today
      ),
      'vaccinations', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', pv.id,
            'vaccine_name', pv.vaccine_name,
            'recommended_week_start', pv.recommended_week_start,
            'recommended_week_end', pv.recommended_week_end,
            'scheduled_date', pv.scheduled_date,
            'completed', pv.completed,
            'completed_date', pv.completed_date,
            'notes', pv.notes
          ) order by pv.scheduled_date
        ), '[]'::jsonb)
        from public.pregnancy_vaccinations pv
        where pv.profile_id = v_profile_id
      ),
      'measurements', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'measured_at', m.measured_at,
            'source', m.source,
            'systolic_bp', m.systolic_bp,
            'diastolic_bp', m.diastolic_bp,
            'pulse_bpm', m.pulse_bpm,
            'fundal_height_cm', m.fundal_height_cm,
            'fetal_heart_rate_bpm', m.fetal_heart_rate_bpm,
            'notes', m.notes
          ) order by m.measured_at desc
        ), '[]'::jsonb)
        from public.pregnancy_visit_measurements m
        where m.profile_id = v_profile_id
          and m.measured_at >= v_start_at
          and m.measured_at < v_end_at
      )
    );
  elsif p_subject = 'baby' then
    v_payload := v_payload || jsonb_build_object(
      'care_coverage', (
        select jsonb_build_object(
          'has_records', count(*) > 0,
          'record_count', count(*),
          'recorded_days', count(distinct (timezone('Europe/Istanbul', e.occurred_at))::date),
          'first_record_at', min(e.occurred_at),
          'last_record_at', max(e.occurred_at)
        )
        from public.care_journal_entries e
        where e.baby_id = p_baby_id
          and e.deleted_at is null
          and e.entry_type <> 'pumping'
          and e.occurred_at >= v_start_at
          and e.occurred_at < v_end_at
      ),
      'care_daily', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'record_date', d.record_date,
            'breastfeeding_count', d.breastfeeding_count,
            'bottle_count', d.bottle_count,
            'bottle_amount_ml', d.bottle_amount_ml,
            'sleep_count', d.sleep_count,
            'sleep_minutes', d.sleep_minutes,
            'diaper_count', d.diaper_count,
            'medicine_count', d.medicine_count,
            'solid_food_count', d.solid_food_count,
            'temperature_count', d.temperature_count
          ) order by d.record_date desc
        ), '[]'::jsonb)
        from (
          select
            (timezone('Europe/Istanbul', e.occurred_at))::date as record_date,
            count(*) filter (where e.entry_type = 'breastfeeding') as breastfeeding_count,
            count(*) filter (where e.entry_type = 'bottle') as bottle_count,
            sum(e.amount_ml) filter (where e.entry_type = 'bottle' and e.amount_ml is not null) as bottle_amount_ml,
            count(*) filter (where e.entry_type = 'sleep') as sleep_count,
            round(sum(extract(epoch from (e.ended_at - e.occurred_at)) / 60)
              filter (where e.entry_type = 'sleep' and e.ended_at is not null))::int as sleep_minutes,
            count(*) filter (where e.entry_type = 'diaper') as diaper_count,
            count(*) filter (where e.entry_type = 'medicine') as medicine_count,
            count(*) filter (where e.entry_type = 'solid_food') as solid_food_count,
            count(*) filter (where e.entry_type = 'temperature') as temperature_count
          from public.care_journal_entries e
          where e.baby_id = p_baby_id
            and e.deleted_at is null
            and e.entry_type <> 'pumping'
            and e.occurred_at >= v_start_at
            and e.occurred_at < v_end_at
          group by (timezone('Europe/Istanbul', e.occurred_at))::date
        ) d
      ),
      'temperatures', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'occurred_at', e.occurred_at,
            'temperature_c', e.temperature_c,
            'temperature_site', e.temperature_site,
            'notes', e.notes
          ) order by e.occurred_at desc
        ), '[]'::jsonb)
        from public.care_journal_entries e
        where e.baby_id = p_baby_id
          and e.entry_type = 'temperature'
          and e.deleted_at is null
          and e.occurred_at >= v_start_at
          and e.occurred_at < v_end_at
      ),
      'medicines', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'occurred_at', e.occurred_at,
            'medicine_name', e.medicine_name,
            'medicine_dose', e.medicine_dose,
            'notes', e.notes
          ) order by e.occurred_at desc
        ), '[]'::jsonb)
        from public.care_journal_entries e
        where e.baby_id = p_baby_id
          and e.entry_type = 'medicine'
          and e.deleted_at is null
          and e.occurred_at >= v_start_at
          and e.occurred_at < v_end_at
      ),
      'growth_records', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'record_date', g.record_date,
            'weight_kg', g.weight_kg,
            'height_cm', g.height_cm,
            'head_circumference_cm', g.head_circumference_cm,
            'notes', g.notes
          ) order by g.record_date desc
        ), '[]'::jsonb)
        from (
          select gr.*
          from public.growth_records gr
          where gr.baby_id = p_baby_id
          order by gr.record_date desc
          limit 12
        ) g
      ),
      'vaccinations', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', bv.id,
            'vaccine_name', vs.vaccine_name,
            'dose_number', vs.dose_number,
            'scheduled_date', bv.scheduled_date,
            'completed', bv.completed,
            'completed_date', bv.completed_date,
            'notes', bv.notes
          ) order by bv.scheduled_date
        ), '[]'::jsonb)
        from public.baby_vaccinations bv
        join public.vaccine_schedule vs on vs.id = bv.vaccine_schedule_id
        where bv.baby_id = p_baby_id
      )
    );
  else
    v_payload := v_payload || jsonb_build_object(
      'postpartum_days', greatest(0, v_today - v_baby.birth_date),
      'wellbeing', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'checkin_date', w.checkin_date,
            'mood', w.mood,
            'rest', w.rest,
            'self_care_note', w.self_care_note
          ) order by w.checkin_date desc
        ), '[]'::jsonb)
        from public.mother_wellbeing_checkins w
        where w.profile_id = v_profile_id
          and w.checkin_date between v_start_date and v_today
      ),
      'pumping_summary', (
        select jsonb_build_object(
          'has_records', count(*) > 0,
          'record_count', count(*),
          'total_amount_ml', sum(e.amount_ml) filter (where e.amount_ml is not null),
          'total_duration_minutes', round(sum(extract(epoch from (e.ended_at - e.occurred_at)) / 60)
            filter (where e.ended_at is not null))::int,
          'first_record_at', min(e.occurred_at),
          'last_record_at', max(e.occurred_at)
        )
        from public.care_journal_entries e
        where e.baby_id = p_baby_id
          and e.entry_type = 'pumping'
          and e.deleted_at is null
          and e.occurred_at >= v_start_at
          and e.occurred_at < v_end_at
      )
    );
  end if;

  return v_payload;
end;
$$;

comment on function public.get_doctor_visit_snapshot(text, uuid, int) is
  'Returns a factual, period-bounded doctor-visit snapshot. No diagnoses, interpretations or percentiles are produced.';

revoke all on function public.get_doctor_visit_snapshot(text, uuid, int) from public;
grant execute on function public.get_doctor_visit_snapshot(text, uuid, int) to authenticated;
