-- Pregnancy health file, post-value credit paywall state and richer paywall attribution.

alter table public.paywall_views
  add column if not exists feature_key text,
  add column if not exists trigger_reason text;

create index if not exists paywall_views_trigger_reason_viewed_at_idx
  on public.paywall_views (trigger_reason, viewed_at desc)
  where trigger_reason is not null;

create table if not exists public.premium_prompt_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null check (char_length(btrim(prompt_key)) between 2 and 100),
  source text not null check (char_length(btrim(source)) between 2 and 100),
  claimed_at timestamptz not null default now(),
  primary key (user_id, prompt_key)
);

alter table public.premium_prompt_states enable row level security;
revoke all on public.premium_prompt_states from public, anon, authenticated;

create or replace function public.claim_premium_prompt(
  p_prompt_key text,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_prompt_key, ''))) not between 2 and 100
     or char_length(btrim(coalesce(p_source, ''))) not between 2 and 100 then
    raise exception 'Geçerli bir istem anahtarı ve kaynak gerekli.' using errcode = '22023';
  end if;

  insert into public.premium_prompt_states (user_id, prompt_key, source)
  values (auth.uid(), btrim(p_prompt_key), btrim(p_source))
  on conflict (user_id, prompt_key) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count = 1;
end;
$$;

revoke all on function public.claim_premium_prompt(text, text) from public, anon;
grant execute on function public.claim_premium_prompt(text, text) to authenticated;

create table if not exists public.pregnancy_health_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('appointment', 'note', 'lab_report')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  occurred_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'document_insight')),
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'lab_report' and source = 'document_insight' and consent_version is not null)
    or (kind in ('appointment', 'note') and source = 'manual' and consent_version is null)
  )
);

create index if not exists pregnancy_health_entries_profile_occurred_idx
  on public.pregnancy_health_entries (profile_id, occurred_at desc);

drop trigger if exists set_pregnancy_health_entries_updated_at
  on public.pregnancy_health_entries;
create trigger set_pregnancy_health_entries_updated_at
  before update on public.pregnancy_health_entries
  for each row execute function public.set_updated_at();

alter table public.pregnancy_health_entries enable row level security;

drop policy if exists "pregnancy_health_entries_select_full_family"
  on public.pregnancy_health_entries;
create policy "pregnancy_health_entries_select_full_family"
  on public.pregnancy_health_entries for select
  using (public.can_access_profile(profile_id));

drop policy if exists "pregnancy_health_entries_insert_manual_full_family"
  on public.pregnancy_health_entries;
create policy "pregnancy_health_entries_insert_manual_full_family"
  on public.pregnancy_health_entries for insert
  with check (
    created_by = auth.uid()
    and kind in ('appointment', 'note')
    and source = 'manual'
    and public.can_access_profile(profile_id)
  );

drop policy if exists "pregnancy_health_entries_update_manual_full_family"
  on public.pregnancy_health_entries;
create policy "pregnancy_health_entries_update_manual_full_family"
  on public.pregnancy_health_entries for update
  using (
    kind in ('appointment', 'note')
    and source = 'manual'
    and public.can_access_profile(profile_id)
  )
  with check (
    kind in ('appointment', 'note')
    and source = 'manual'
    and public.can_access_profile(profile_id)
  );

drop policy if exists "pregnancy_health_entries_delete_full_family"
  on public.pregnancy_health_entries;
create policy "pregnancy_health_entries_delete_full_family"
  on public.pregnancy_health_entries for delete
  using (
    public.can_access_profile(profile_id)
    and (created_by = auth.uid() or profile_id = auth.uid())
  );

revoke all on public.pregnancy_health_entries from anon, authenticated;
grant select, insert, delete on public.pregnancy_health_entries to authenticated;
grant update (title, occurred_at, notes) on public.pregnancy_health_entries to authenticated;

create table if not exists public.pregnancy_health_lab_values (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.pregnancy_health_entries(id) on delete cascade,
  ordinal smallint not null check (ordinal between 1 and 50),
  test_name text not null check (char_length(btrim(test_name)) between 1 and 160),
  result_text text not null check (char_length(btrim(result_text)) between 1 and 120),
  unit text check (unit is null or char_length(unit) <= 60),
  reference_range text check (reference_range is null or char_length(reference_range) <= 160),
  reference_status text not null check (
    reference_status in ('below', 'within', 'above', 'document_marked', 'unclassified')
  ),
  document_marker text not null check (
    document_marker in ('high', 'low', 'normal', 'abnormal', 'none')
  ),
  created_at timestamptz not null default now(),
  unique (entry_id, ordinal)
);

create index if not exists pregnancy_health_lab_values_entry_idx
  on public.pregnancy_health_lab_values (entry_id, ordinal);

alter table public.pregnancy_health_lab_values enable row level security;
drop policy if exists "pregnancy_health_lab_values_select_full_family"
  on public.pregnancy_health_lab_values;
create policy "pregnancy_health_lab_values_select_full_family"
  on public.pregnancy_health_lab_values for select
  using (
    exists (
      select 1
      from public.pregnancy_health_entries entry
      where entry.id = entry_id
        and public.can_access_profile(entry.profile_id)
    )
  );

revoke all on public.pregnancy_health_lab_values from anon, authenticated;
grant select on public.pregnancy_health_lab_values to authenticated;

create table if not exists public.pregnancy_health_reminders (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.pregnancy_health_entries(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  recipient_scope text not null default 'self' check (recipient_scope in ('self', 'full_family')),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pregnancy_health_reminders_one_scheduled_entry
  on public.pregnancy_health_reminders (entry_id)
  where status = 'scheduled';
create index if not exists pregnancy_health_reminders_due_idx
  on public.pregnancy_health_reminders (scheduled_for)
  where status = 'scheduled';

drop trigger if exists set_pregnancy_health_reminders_updated_at
  on public.pregnancy_health_reminders;
create trigger set_pregnancy_health_reminders_updated_at
  before update on public.pregnancy_health_reminders
  for each row execute function public.set_updated_at();

alter table public.pregnancy_health_reminders enable row level security;
drop policy if exists "pregnancy_health_reminders_select_full_family"
  on public.pregnancy_health_reminders;
create policy "pregnancy_health_reminders_select_full_family"
  on public.pregnancy_health_reminders for select
  using (public.can_access_profile(profile_id));

revoke all on public.pregnancy_health_reminders from anon, authenticated;
grant select on public.pregnancy_health_reminders to authenticated;

create or replace function public.save_pregnancy_health_lab_results(
  p_title text,
  p_recorded_at timestamptz,
  p_values jsonb,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_entry public.pregnancy_health_entries;
begin
  if auth.uid() is null or v_profile_id is null
     or not public.can_access_profile(v_profile_id) then
    raise exception 'Anne sağlık dosyasına erişimin yok.' using errcode = '42501';
  end if;
  if not public.has_effective_premium_access() then
    raise exception 'Bu özellik Anne+ Premium gerektirir.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 140 then
    raise exception 'Geçerli bir kayıt başlığı gerekli.' using errcode = '22023';
  end if;
  if p_recorded_at is null or p_recorded_at > now() + interval '1 day' then
    raise exception 'Kayıt tarihi geçersiz.' using errcode = '22023';
  end if;
  if p_consent_version <> 'health-file-selected-values-v1' then
    raise exception 'Güncel saklama onayı gerekli.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_values) <> 'array'
     or jsonb_array_length(p_values) not between 1 and 50 then
    raise exception '1–50 seçili tahlil değeri gerekli.' using errcode = '22023';
  end if;

  insert into public.pregnancy_health_entries (
    profile_id, created_by, kind, title, occurred_at, source, consent_version
  ) values (
    v_profile_id, auth.uid(), 'lab_report', btrim(p_title), p_recorded_at,
    'document_insight', p_consent_version
  ) returning * into v_entry;

  insert into public.pregnancy_health_lab_values (
    entry_id, ordinal, test_name, result_text, unit, reference_range,
    reference_status, document_marker
  )
  select
    v_entry.id,
    value.ordinality::smallint,
    left(btrim(value.item ->> 'test_name'), 160),
    left(btrim(value.item ->> 'result'), 120),
    nullif(left(btrim(coalesce(value.item ->> 'unit', '')), 60), ''),
    nullif(left(btrim(coalesce(value.item ->> 'reference_range', '')), 160), ''),
    case
      when value.item ->> 'reference_status' in ('below', 'within', 'above', 'document_marked', 'unclassified')
        then value.item ->> 'reference_status'
      else 'unclassified'
    end,
    case
      when value.item ->> 'document_marker' in ('high', 'low', 'normal', 'abnormal', 'none')
        then value.item ->> 'document_marker'
      else 'none'
    end
  from jsonb_array_elements(p_values) with ordinality as value(item, ordinality)
  where char_length(btrim(coalesce(value.item ->> 'test_name', ''))) between 1 and 160
    and char_length(btrim(coalesce(value.item ->> 'result', ''))) between 1 and 120;

  if not exists (
    select 1 from public.pregnancy_health_lab_values lab where lab.entry_id = v_entry.id
  ) then
    raise exception 'Kaydedilebilir bir tahlil değeri bulunamadı.' using errcode = '22023';
  end if;

  return jsonb_build_object('entry_id', v_entry.id, 'saved', true);
end;
$$;

create or replace function public.set_pregnancy_health_reminder(
  p_entry_id uuid,
  p_scheduled_for timestamptz,
  p_recipient_scope text default 'self'
)
returns public.pregnancy_health_reminders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.pregnancy_health_entries;
  v_reminder public.pregnancy_health_reminders;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;
  select * into v_entry
  from public.pregnancy_health_entries
  where id = p_entry_id;
  if not found or not public.can_access_profile(v_entry.profile_id) then
    raise exception 'Sağlık kaydı bulunamadı.' using errcode = '42501';
  end if;
  if not public.has_effective_premium_access() then
    raise exception 'Hatırlatmalar Anne+ Premium gerektirir.' using errcode = '42501';
  end if;
  if v_entry.kind <> 'appointment' then
    raise exception 'Yalnızca randevu kayıtlarına hatırlatma kurulabilir.' using errcode = '22023';
  end if;
  if p_scheduled_for is null or p_scheduled_for <= now() + interval '1 minute' then
    raise exception 'Hatırlatma en az bir dakika ileride olmalı.' using errcode = '22023';
  end if;
  if p_recipient_scope not in ('self', 'full_family') then
    raise exception 'Hatırlatma alıcısı geçersiz.' using errcode = '22023';
  end if;

  update public.pregnancy_health_reminders
  set status = 'cancelled', cancelled_at = now()
  where entry_id = v_entry.id and status = 'scheduled';

  insert into public.pregnancy_health_reminders (
    entry_id, profile_id, created_by, recipient_scope, scheduled_for
  ) values (
    v_entry.id, v_entry.profile_id, auth.uid(), p_recipient_scope, p_scheduled_for
  ) returning * into v_reminder;

  return v_reminder;
end;
$$;

create or replace function public.cancel_pregnancy_health_reminder(p_reminder_id uuid)
returns public.pregnancy_health_reminders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reminder public.pregnancy_health_reminders;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;
  select * into v_reminder
  from public.pregnancy_health_reminders
  where id = p_reminder_id
  for update;
  if not found or not public.can_access_profile(v_reminder.profile_id) then
    raise exception 'Hatırlatma bulunamadı.' using errcode = '42501';
  end if;

  update public.pregnancy_health_reminders
  set status = 'cancelled', cancelled_at = now()
  where id = v_reminder.id
  returning * into v_reminder;
  return v_reminder;
end;
$$;

revoke all on function public.save_pregnancy_health_lab_results(text, timestamptz, jsonb, text)
  from public, anon;
revoke all on function public.set_pregnancy_health_reminder(uuid, timestamptz, text)
  from public, anon;
revoke all on function public.cancel_pregnancy_health_reminder(uuid)
  from public, anon;
grant execute on function public.save_pregnancy_health_lab_results(text, timestamptz, jsonb, text)
  to authenticated;
grant execute on function public.set_pregnancy_health_reminder(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.cancel_pregnancy_health_reminder(uuid)
  to authenticated;

comment on table public.pregnancy_health_entries is
  'Maternal health timeline entries. Original documents, OCR text and identity fields are never stored.';
comment on table public.pregnancy_health_lab_values is
  'Only values explicitly selected by the user from an on-device document analysis.';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pregnancy_health_entries'
  ) then
    alter publication supabase_realtime add table public.pregnancy_health_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pregnancy_health_reminders'
  ) then
    alter publication supabase_realtime add table public.pregnancy_health_reminders;
  end if;
end;
$$;

create or replace function public.get_credit_conversion_funnel(
  p_from timestamptz,
  p_to timestamptz
)
returns table(step_key text, step_order integer, users bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  with exhausted as (
    select ae.user_id, min(ae.occurred_at) as exhausted_at
    from public.analytics_events ae
    where ae.event_name = 'family_credit_exhausted'
      and ae.user_id is not null
      and ae.occurred_at >= p_from
      and ae.occurred_at < p_to
    group by ae.user_id
  ),
  last_credit_paywalls as (
    select exhausted.user_id, min(pv.viewed_at) as viewed_at
    from exhausted
    join public.paywall_views pv
      on pv.user_id = exhausted.user_id
     and pv.trigger_reason = 'last_free_credit_used'
     and pv.viewed_at >= exhausted.exhausted_at
     and pv.viewed_at < least(p_to, exhausted.exhausted_at + interval '1 day')
    group by exhausted.user_id
  ),
  purchase_starts as (
    select paywall.user_id, min(ae.occurred_at) as started_at
    from last_credit_paywalls paywall
    join public.analytics_events ae
      on ae.user_id = paywall.user_id
     and ae.event_name = 'purchase_started'
     and ae.occurred_at >= paywall.viewed_at
     and ae.occurred_at < paywall.viewed_at + interval '2 hours'
    group by paywall.user_id
  ),
  verified_purchases as (
    select distinct paywall.user_id
    from last_credit_paywalls paywall
    where exists (
      select 1
      from public.analytics_effective_verified_purchases(
        paywall.viewed_at,
        paywall.viewed_at + interval '7 days'
      ) purchase
      where purchase.user_id = paywall.user_id
    )
  )
  select 'credit_exhausted', 1, count(*)::bigint from exhausted
  union all select 'last_credit_paywall', 2, count(*)::bigint from last_credit_paywalls
  union all select 'purchase_started', 3, count(*)::bigint from purchase_starts
  union all select 'verified_purchase', 4, count(*)::bigint from verified_purchases
  order by 2;
end;
$$;

revoke all on function public.get_credit_conversion_funnel(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.get_credit_conversion_funnel(timestamptz, timestamptz)
  to authenticated;

comment on function public.get_credit_conversion_funnel(timestamptz, timestamptz) is
  'Strict admin funnel from last shared family credit to verified purchase.';
