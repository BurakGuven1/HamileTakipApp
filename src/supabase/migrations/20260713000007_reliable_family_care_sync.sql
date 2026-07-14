-- Reliable family care coordination: idempotent writes, offline replay,
-- immutable activity history, soft delete/undo, shared timers and handover.

alter table public.care_journal_entries
  add column if not exists client_operation_id uuid,
  add column if not exists created_device_id text,
  add column if not exists created_device_label text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text,
  add column if not exists updated_device_id text,
  add column if not exists updated_device_label text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_by_name text,
  add column if not exists deleted_device_id text,
  add column if not exists deleted_device_label text,
  add column if not exists version bigint not null default 1,
  add column if not exists temperature_c numeric(4,1),
  add column if not exists temperature_site text;

update public.care_journal_entries
set client_operation_id = gen_random_uuid()
where client_operation_id is null;

alter table public.care_journal_entries
  alter column client_operation_id set default gen_random_uuid(),
  alter column client_operation_id set not null;

create unique index if not exists idx_care_journal_client_operation
  on public.care_journal_entries (client_operation_id);
create index if not exists idx_care_journal_visible_timeline
  on public.care_journal_entries (baby_id, occurred_at desc)
  where deleted_at is null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.care_journal_entries'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%entry_type%'
  loop
    execute format(
      'alter table public.care_journal_entries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.care_journal_entries
  add constraint care_journal_entries_entry_type_check
  check (
    entry_type in (
      'breastfeeding', 'bottle', 'sleep', 'diaper', 'pumping',
      'medicine', 'solid_food', 'temperature'
    )
  ),
  add constraint care_journal_temperature_check
  check (temperature_c is null or temperature_c between 30 and 45),
  add constraint care_journal_temperature_site_check
  check (
    temperature_site is null
    or temperature_site in ('armpit', 'forehead', 'ear', 'oral', 'rectal', 'other')
  ),
  add constraint care_journal_version_check check (version > 0);

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.care_reminders'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%entry_type%'
  loop
    execute format('alter table public.care_reminders drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.care_reminders
  add constraint care_reminders_entry_type_check
  check (
    entry_type in (
      'breastfeeding', 'bottle', 'sleep', 'diaper', 'pumping',
      'medicine', 'solid_food', 'temperature'
    )
  );

-- Previously deployed intelligence functions predate soft deletion. Patch their
-- stored definitions so deleted sleep/medicine entries never affect a forecast
-- or recent-dose warning. The replacement is asserted to avoid silent drift.
do $$
declare
  v_definition text;
  v_needle text := 'and e.entry_type = ''sleep''';
  v_occurrences int;
begin
  select pg_get_functiondef('public.refresh_sleep_prediction(uuid)'::regprocedure)
  into v_definition;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_needle, ''))
  ) / length(v_needle);
  if v_occurrences < 3 then
    raise exception 'refresh_sleep_prediction definition changed; soft-delete filter was not applied safely.';
  end if;
  v_definition := replace(
    v_definition,
    v_needle,
    v_needle || E'\n    and e.deleted_at is null'
  );
  execute v_definition;
end $$;

do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_needle text := 'and e.entry_type = ''medicine''';
begin
  foreach v_signature in array array[
    'public.guard_recent_medicine_dose()'::regprocedure,
    'public.get_recent_medicine_dose(uuid,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    if position(v_needle in v_definition) = 0 then
      raise exception '% definition changed; soft-delete filter was not applied safely.', v_signature;
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      v_needle || E'\n    and e.deleted_at is null'
    );
    execute v_definition;
  end loop;
end $$;

drop trigger if exists refresh_sleep_prediction_after_update
  on public.care_journal_entries;
create trigger refresh_sleep_prediction_after_update
  after update of occurred_at, ended_at, entry_type, sleep_kind, deleted_at
  on public.care_journal_entries
  for each row execute function public.refresh_sleep_prediction_after_change();

-- Direct physical deletes are intentionally disabled. Deletion is a reversible
-- soft-delete operation performed through apply_care_sync_operation.
drop policy if exists "care_journal_select_free_or_premium_family"
  on public.care_journal_entries;
drop policy if exists "care_journal_update_premium_family"
  on public.care_journal_entries;
drop policy if exists "care_journal_delete_premium_family"
  on public.care_journal_entries;

create policy "care_journal_select_free_or_premium_family"
  on public.care_journal_entries for select
  using (
    deleted_at is null
    and public.can_access_baby(baby_id)
    and (
      public.has_active_family_premium(baby_id)
      or (
        public.is_first_family_baby(baby_id)
        and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature')
        and occurred_at >= now() - interval '24 hours'
      )
    )
  );

create policy "care_journal_update_premium_family"
  on public.care_journal_entries for update
  using (
    deleted_at is null
    and (
      public.has_active_family_premium(baby_id)
      or (
        public.is_first_family_baby(baby_id)
        and created_by = auth.uid()
        and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature')
        and occurred_at >= now() - interval '24 hours'
      )
    )
  )
  with check (deleted_at is null and public.can_access_baby(baby_id));

revoke delete on public.care_journal_entries from authenticated;

create table if not exists public.care_sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 120),
  device_label text check (device_label is null or char_length(device_label) <= 80),
  action text not null check (
    action in ('create', 'update', 'delete', 'restore', 'undo', 'start_timer', 'stop_timer', 'take_over')
  ),
  entity_type text not null check (entity_type in ('entry', 'timer', 'handover')),
  entity_id uuid,
  status text not null check (status in ('applied', 'conflict', 'already_applied')),
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz not null default now()
);

create index if not exists idx_care_sync_operations_user_created
  on public.care_sync_operations (user_id, created_at desc);
alter table public.care_sync_operations enable row level security;
revoke all on public.care_sync_operations from anon, authenticated;

create table if not exists public.care_journal_entry_events (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.care_journal_entries(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  operation_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted', 'restored')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  device_id text,
  device_label text,
  entry_version bigint not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_care_entry_events_baby_occurred
  on public.care_journal_entry_events (baby_id, occurred_at desc);
alter table public.care_journal_entry_events enable row level security;
create policy "care_entry_events_select_family"
  on public.care_journal_entry_events for select
  using (public.can_access_baby(baby_id));
grant select on public.care_journal_entry_events to authenticated;

create or replace function public.prepare_care_entry_sync_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id text := nullif(current_setting('app.care_device_id', true), '');
  v_device_label text := nullif(current_setting('app.care_device_label', true), '');
  v_actor_name text := nullif(current_setting('app.care_actor_name', true), '');
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  new.updated_by_name := coalesce(v_actor_name, new.updated_by_name, old.updated_by_name);
  new.updated_device_id := coalesce(v_device_id, new.updated_device_id, old.updated_device_id);
  new.updated_device_label := coalesce(v_device_label, new.updated_device_label, old.updated_device_label);
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists set_care_journal_entries_updated_at
  on public.care_journal_entries;
drop trigger if exists prepare_care_entry_sync_metadata
  on public.care_journal_entries;
create trigger prepare_care_entry_sync_metadata
  before update on public.care_journal_entries
  for each row execute function public.prepare_care_entry_sync_metadata();

create or replace function public.audit_care_journal_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_operation_id uuid;
  v_actor_id uuid;
  v_actor_name text := nullif(current_setting('app.care_actor_name', true), '');
  v_device_id text := nullif(current_setting('app.care_device_id', true), '');
  v_device_label text := nullif(current_setting('app.care_device_label', true), '');
begin
  begin
    v_operation_id := nullif(current_setting('app.care_operation_id', true), '')::uuid;
  exception when others then
    v_operation_id := null;
  end;

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_actor_id := new.created_by;
    v_actor_name := coalesce(v_actor_name, new.caregiver_name);
    v_device_id := coalesce(v_device_id, new.created_device_id);
    v_device_label := coalesce(v_device_label, new.created_device_label);
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_action := 'deleted';
    v_actor_id := new.deleted_by;
    v_actor_name := coalesce(v_actor_name, new.deleted_by_name);
    v_device_id := coalesce(v_device_id, new.deleted_device_id);
    v_device_label := coalesce(v_device_label, new.deleted_device_label);
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restored';
    v_actor_id := new.updated_by;
  else
    v_action := 'updated';
    v_actor_id := new.updated_by;
  end if;

  insert into public.care_journal_entry_events (
    entry_id, baby_id, operation_id, action, actor_id, actor_name,
    device_id, device_label, entry_version, before_data, after_data
  ) values (
    new.id,
    new.baby_id,
    v_operation_id,
    v_action,
    v_actor_id,
    v_actor_name,
    v_device_id,
    v_device_label,
    new.version,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists audit_care_journal_entry on public.care_journal_entries;
create trigger audit_care_journal_entry
  after insert or update on public.care_journal_entries
  for each row execute function public.audit_care_journal_entry();

create or replace function public.care_entry_write_allowed(
  p_baby_id uuid,
  p_entry_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_baby(p_baby_id)
    and (
      public.has_active_family_premium(p_baby_id)
      or (
        public.is_first_family_baby(p_baby_id)
        and p_entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature')
      )
    );
$$;
revoke all on function public.care_entry_write_allowed(uuid, text) from public;

create or replace function public.apply_care_sync_operation(
  p_operation_id uuid,
  p_device_id text,
  p_device_label text,
  p_action text,
  p_entry_id uuid,
  p_base_version bigint default null,
  p_payload jsonb default '{}'::jsonb,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.care_sync_operations;
  v_entry public.care_journal_entries;
  v_entry_type text;
  v_baby_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Oturum gerekli.'; end if;
  if p_operation_id is null or p_entry_id is null then
    raise exception 'İşlem ve kayıt kimliği gerekli.';
  end if;
  if char_length(coalesce(p_device_id, '')) < 8 then
    raise exception 'Geçerli cihaz kimliği gerekli.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing
  from public.care_sync_operations
  where operation_id = p_operation_id;
  if found then
    if v_existing.user_id <> v_user_id then raise exception 'İşlem kimliği kullanılıyor.'; end if;
    return v_existing.result_payload;
  end if;

  perform set_config('app.care_operation_id', p_operation_id::text, true);
  perform set_config('app.care_device_id', p_device_id, true);
  perform set_config('app.care_device_label', coalesce(p_device_label, ''), true);
  perform set_config('app.care_actor_name', coalesce(p_actor_name, ''), true);
  if coalesce((p_payload->>'override_recent')::boolean, false) then
    perform set_config('app.allow_recent_medicine_override', 'on', true);
  end if;

  if p_action = 'create' then
    v_baby_id := (p_payload->>'baby_id')::uuid;
    v_entry_type := p_payload->>'entry_type';
    if not public.care_entry_write_allowed(v_baby_id, v_entry_type) then
      raise exception 'Bu bakım kaydı için erişimin yok.';
    end if;

    insert into public.care_journal_entries (
      id, baby_id, created_by, caregiver_name, entry_type, occurred_at,
      ended_at, amount_ml, feeding_content, breast_side, diaper_type,
      medicine_name, medicine_dose, food_name, food_amount, is_first_try,
      sleep_kind, notes, client_operation_id, created_device_id,
      created_device_label, updated_by, updated_by_name, updated_device_id,
      updated_device_label, temperature_c, temperature_site
    ) values (
      p_entry_id,
      v_baby_id,
      v_user_id,
      nullif(p_payload->>'caregiver_name', ''),
      v_entry_type,
      coalesce((p_payload->>'occurred_at')::timestamptz, now()),
      nullif(p_payload->>'ended_at', '')::timestamptz,
      nullif(p_payload->>'amount_ml', '')::numeric,
      nullif(p_payload->>'feeding_content', ''),
      nullif(p_payload->>'breast_side', ''),
      nullif(p_payload->>'diaper_type', ''),
      nullif(p_payload->>'medicine_name', ''),
      nullif(p_payload->>'medicine_dose', ''),
      nullif(p_payload->>'food_name', ''),
      nullif(p_payload->>'food_amount', ''),
      coalesce((p_payload->>'is_first_try')::boolean, false),
      nullif(p_payload->>'sleep_kind', ''),
      nullif(p_payload->>'notes', ''),
      p_operation_id,
      p_device_id,
      p_device_label,
      v_user_id,
      p_actor_name,
      p_device_id,
      p_device_label,
      nullif(p_payload->>'temperature_c', '')::numeric,
      nullif(p_payload->>'temperature_site', '')
    ) returning * into v_entry;

  elsif p_action in ('update', 'delete', 'restore') then
    select * into v_entry
    from public.care_journal_entries
    where id = p_entry_id
    for update;
    if not found or not public.can_access_baby(v_entry.baby_id) then
      raise exception 'Bakım kaydı bulunamadı.';
    end if;
    if not public.care_entry_write_allowed(v_entry.baby_id, v_entry.entry_type)
      or (
        not public.has_active_family_premium(v_entry.baby_id)
        and v_entry.created_by <> v_user_id
      )
    then
      raise exception 'Bu bakım kaydını değiştirme yetkin yok.';
    end if;
    if p_base_version is not null and v_entry.version <> p_base_version then
      v_result := jsonb_build_object(
        'status', 'conflict', 'reason', 'version_mismatch',
        'server_entry', to_jsonb(v_entry)
      );
      insert into public.care_sync_operations (
        operation_id, user_id, device_id, device_label, action, entity_type,
        entity_id, status, request_payload, result_payload
      ) values (
        p_operation_id, v_user_id, p_device_id, p_device_label, p_action,
        'entry', p_entry_id, 'conflict', p_payload, v_result
      );
      return v_result;
    end if;

    if p_action = 'delete' then
      if v_entry.deleted_at is null then
        update public.care_journal_entries set
          deleted_at = now(), deleted_by = v_user_id,
          deleted_by_name = p_actor_name, deleted_device_id = p_device_id,
          deleted_device_label = p_device_label
        where id = p_entry_id returning * into v_entry;
      end if;
    elsif p_action = 'restore' then
      if v_entry.deleted_at is null then
        null;
      elsif v_entry.deleted_at < now() - interval '30 seconds' then
        raise exception 'Geri alma süresi doldu.';
      else
        update public.care_journal_entries set
          deleted_at = null, deleted_by = null, deleted_by_name = null,
          deleted_device_id = null, deleted_device_label = null
        where id = p_entry_id returning * into v_entry;
      end if;
    else
      if v_entry.deleted_at is not null then raise exception 'Silinmiş kayıt düzenlenemez.'; end if;
      update public.care_journal_entries set
        caregiver_name = coalesce(p_payload->>'caregiver_name', caregiver_name),
        occurred_at = coalesce((p_payload->>'occurred_at')::timestamptz, occurred_at),
        ended_at = case when p_payload ? 'ended_at' then nullif(p_payload->>'ended_at', '')::timestamptz else ended_at end,
        amount_ml = case when p_payload ? 'amount_ml' then nullif(p_payload->>'amount_ml', '')::numeric else amount_ml end,
        notes = case when p_payload ? 'notes' then nullif(p_payload->>'notes', '') else notes end,
        temperature_c = case when p_payload ? 'temperature_c' then nullif(p_payload->>'temperature_c', '')::numeric else temperature_c end,
        temperature_site = case when p_payload ? 'temperature_site' then nullif(p_payload->>'temperature_site', '') else temperature_site end
      where id = p_entry_id returning * into v_entry;
    end if;
  else
    raise exception 'Geçersiz senkronizasyon işlemi.';
  end if;

  v_result := jsonb_build_object('status', 'applied', 'entry', to_jsonb(v_entry));
  insert into public.care_sync_operations (
    operation_id, user_id, device_id, device_label, action, entity_type,
    entity_id, status, request_payload, result_payload
  ) values (
    p_operation_id, v_user_id, p_device_id, p_device_label, p_action,
    'entry', p_entry_id, 'applied', p_payload, v_result
  );
  return v_result;
end;
$$;
revoke all on function public.apply_care_sync_operation(
  uuid, text, text, text, uuid, bigint, jsonb, text
) from public;
grant execute on function public.apply_care_sync_operation(
  uuid, text, text, text, uuid, bigint, jsonb, text
) to authenticated;

create or replace function public.undo_care_sync_operation(
  p_original_operation_id uuid,
  p_undo_operation_id uuid,
  p_device_id text,
  p_device_label text,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.care_sync_operations;
  v_existing public.care_sync_operations;
  v_entry public.care_journal_entries;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Oturum gerekli.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_undo_operation_id::text, 0));
  select * into v_existing from public.care_sync_operations where operation_id = p_undo_operation_id;
  if found then return v_existing.result_payload; end if;

  select * into v_original
  from public.care_sync_operations
  where operation_id = p_original_operation_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Geri alınacak işlem bulunamadı.'; end if;
  if v_original.processed_at < now() - interval '30 seconds' then
    raise exception 'Geri alma süresi doldu.';
  end if;

  select * into v_entry
  from public.care_journal_entries
  where id = v_original.entity_id
  for update;
  if not found or not public.can_access_baby(v_entry.baby_id) then
    raise exception 'Bakım kaydı bulunamadı.';
  end if;

  perform set_config('app.care_operation_id', p_undo_operation_id::text, true);
  perform set_config('app.care_device_id', p_device_id, true);
  perform set_config('app.care_device_label', coalesce(p_device_label, ''), true);
  perform set_config('app.care_actor_name', coalesce(p_actor_name, ''), true);

  if v_original.action = 'create' and v_entry.deleted_at is null and v_entry.version = 1 then
    update public.care_journal_entries set
      deleted_at = now(), deleted_by = v_user_id,
      deleted_by_name = p_actor_name, deleted_device_id = p_device_id,
      deleted_device_label = p_device_label
    where id = v_entry.id returning * into v_entry;
  elsif v_original.action = 'delete' and v_entry.deleted_at is not null then
    update public.care_journal_entries set
      deleted_at = null, deleted_by = null, deleted_by_name = null,
      deleted_device_id = null, deleted_device_label = null
    where id = v_entry.id returning * into v_entry;
  else
    raise exception 'Bu işlem güvenli biçimde geri alınamıyor.';
  end if;

  v_result := jsonb_build_object('status', 'applied', 'entry', to_jsonb(v_entry));
  insert into public.care_sync_operations (
    operation_id, user_id, device_id, device_label, action, entity_type,
    entity_id, status, request_payload, result_payload
  ) values (
    p_undo_operation_id, v_user_id, p_device_id, p_device_label, 'undo',
    'entry', v_entry.id, 'applied',
    jsonb_build_object('original_operation_id', p_original_operation_id), v_result
  );
  return v_result;
end;
$$;
revoke all on function public.undo_care_sync_operation(uuid, uuid, text, text, text)
  from public;
grant execute on function public.undo_care_sync_operation(uuid, uuid, text, text, text)
  to authenticated;

create table if not exists public.care_active_timers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  timer_type text not null check (timer_type in ('breastfeeding', 'sleep')),
  breast_side text check (breast_side is null or breast_side in ('left', 'right', 'both')),
  sleep_kind text check (sleep_kind is null or sleep_kind in ('day', 'night')),
  started_at timestamptz not null default now(),
  started_by uuid not null references auth.users(id) on delete cascade,
  started_by_name text,
  started_device_id text not null,
  started_device_label text,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  ended_by_name text,
  ended_device_id text,
  ended_device_label text,
  journal_entry_id uuid references public.care_journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists idx_care_active_timer_per_baby_type
  on public.care_active_timers (baby_id, timer_type) where ended_at is null;
create index if not exists idx_care_timers_baby_started
  on public.care_active_timers (baby_id, started_at desc);
alter table public.care_active_timers enable row level security;
create policy "care_active_timers_select_family"
  on public.care_active_timers for select
  using (public.can_access_baby(baby_id));
grant select on public.care_active_timers to authenticated;

create or replace function public.start_shared_care_timer(
  p_operation_id uuid,
  p_timer_id uuid,
  p_baby_id uuid,
  p_timer_type text,
  p_breast_side text,
  p_sleep_kind text,
  p_device_id text,
  p_device_label text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_op public.care_sync_operations;
  v_timer public.care_active_timers;
  v_result jsonb;
begin
  if v_user_id is null or not public.care_entry_write_allowed(p_baby_id, p_timer_type) then
    raise exception 'Bu zamanlayıcı için erişimin yok.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing_op from public.care_sync_operations where operation_id = p_operation_id;
  if found then return v_existing_op.result_payload; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':' || p_timer_type, 0));
  select * into v_timer from public.care_active_timers
  where baby_id = p_baby_id and timer_type = p_timer_type and ended_at is null;
  if found then
    v_result := jsonb_build_object('status', 'already_active', 'timer', to_jsonb(v_timer));
    insert into public.care_sync_operations (
      operation_id, user_id, device_id, device_label, action, entity_type,
      entity_id, status, request_payload, result_payload
    ) values (
      p_operation_id, v_user_id, p_device_id, p_device_label, 'start_timer',
      'timer', v_timer.id, 'already_applied', '{}'::jsonb, v_result
    );
    return v_result;
  end if;

  insert into public.care_active_timers (
    id, baby_id, timer_type, breast_side, sleep_kind, started_by,
    started_by_name, started_device_id, started_device_label
  ) values (
    p_timer_id, p_baby_id, p_timer_type,
    case when p_timer_type = 'breastfeeding' then p_breast_side else null end,
    case when p_timer_type = 'sleep' then p_sleep_kind else null end,
    v_user_id, p_actor_name, p_device_id, p_device_label
  ) returning * into v_timer;
  v_result := jsonb_build_object('status', 'applied', 'timer', to_jsonb(v_timer));
  insert into public.care_sync_operations (
    operation_id, user_id, device_id, device_label, action, entity_type,
    entity_id, status, request_payload, result_payload
  ) values (
    p_operation_id, v_user_id, p_device_id, p_device_label, 'start_timer',
    'timer', v_timer.id, 'applied', '{}'::jsonb, v_result
  );
  return v_result;
end;
$$;
revoke all on function public.start_shared_care_timer(uuid, uuid, uuid, text, text, text, text, text, text)
  from public;
grant execute on function public.start_shared_care_timer(uuid, uuid, uuid, text, text, text, text, text, text)
  to authenticated;

create or replace function public.stop_shared_care_timer(
  p_operation_id uuid,
  p_timer_id uuid,
  p_device_id text,
  p_device_label text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_op public.care_sync_operations;
  v_timer public.care_active_timers;
  v_entry public.care_journal_entries;
  v_entry_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Oturum gerekli.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing_op from public.care_sync_operations where operation_id = p_operation_id;
  if found then return v_existing_op.result_payload; end if;
  select * into v_timer from public.care_active_timers where id = p_timer_id for update;
  if not found or not public.can_access_baby(v_timer.baby_id) then
    raise exception 'Aktif zamanlayıcı bulunamadı.';
  end if;
  if v_timer.ended_at is not null then
    v_result := jsonb_build_object('status', 'already_completed', 'timer', to_jsonb(v_timer));
    insert into public.care_sync_operations (
      operation_id, user_id, device_id, device_label, action, entity_type,
      entity_id, status, request_payload, result_payload
    ) values (
      p_operation_id, v_user_id, p_device_id, p_device_label, 'stop_timer',
      'timer', v_timer.id, 'already_applied', '{}'::jsonb, v_result
    );
    return v_result;
  end if;
  if not public.care_entry_write_allowed(v_timer.baby_id, v_timer.timer_type) then
    raise exception 'Bu zamanlayıcıyı bitirmek için erişimin yok.';
  end if;

  perform set_config('app.care_operation_id', p_operation_id::text, true);
  perform set_config('app.care_device_id', p_device_id, true);
  perform set_config('app.care_device_label', coalesce(p_device_label, ''), true);
  perform set_config('app.care_actor_name', coalesce(p_actor_name, ''), true);
  insert into public.care_journal_entries (
    id, baby_id, created_by, caregiver_name, entry_type, occurred_at, ended_at,
    breast_side, sleep_kind, client_operation_id, created_device_id,
    created_device_label, updated_by, updated_by_name, updated_device_id,
    updated_device_label
  ) values (
    v_entry_id, v_timer.baby_id, v_user_id, p_actor_name, v_timer.timer_type,
    v_timer.started_at, now(), v_timer.breast_side, v_timer.sleep_kind,
    p_operation_id, p_device_id, p_device_label, v_user_id, p_actor_name,
    p_device_id, p_device_label
  ) returning * into v_entry;
  update public.care_active_timers set
    ended_at = v_entry.ended_at, ended_by = v_user_id, ended_by_name = p_actor_name,
    ended_device_id = p_device_id, ended_device_label = p_device_label,
    journal_entry_id = v_entry.id, updated_at = now()
  where id = v_timer.id returning * into v_timer;
  v_result := jsonb_build_object(
    'status', 'applied', 'timer', to_jsonb(v_timer), 'entry', to_jsonb(v_entry)
  );
  insert into public.care_sync_operations (
    operation_id, user_id, device_id, device_label, action, entity_type,
    entity_id, status, request_payload, result_payload
  ) values (
    p_operation_id, v_user_id, p_device_id, p_device_label, 'stop_timer',
    'timer', v_timer.id, 'applied', '{}'::jsonb, v_result
  );
  return v_result;
end;
$$;
revoke all on function public.stop_shared_care_timer(uuid, uuid, text, text, text)
  from public;
grant execute on function public.stop_shared_care_timer(uuid, uuid, text, text, text)
  to authenticated;

create table if not exists public.care_handover_sessions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  caregiver_name text not null check (char_length(caregiver_name) between 1 and 80),
  caregiver_role text not null default 'caregiver',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  device_id text not null,
  device_label text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists idx_care_handover_one_active
  on public.care_handover_sessions (baby_id) where ended_at is null;
create index if not exists idx_care_handover_baby_started
  on public.care_handover_sessions (baby_id, started_at desc);
alter table public.care_handover_sessions enable row level security;
create policy "care_handover_select_family"
  on public.care_handover_sessions for select
  using (public.can_access_baby(baby_id));
grant select on public.care_handover_sessions to authenticated;

create or replace function public.take_over_baby_care(
  p_operation_id uuid,
  p_session_id uuid,
  p_baby_id uuid,
  p_caregiver_name text,
  p_device_id text,
  p_device_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_op public.care_sync_operations;
  v_active public.care_handover_sessions;
  v_session public.care_handover_sessions;
  v_role text := 'caregiver';
  v_result jsonb;
begin
  if v_user_id is null or not public.can_access_baby(p_baby_id) then
    raise exception 'Bu bebeğin bakımını devralma yetkin yok.';
  end if;
  if char_length(trim(coalesce(p_caregiver_name, ''))) < 1 then
    raise exception 'Bakıcı adı gerekli.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing_op from public.care_sync_operations where operation_id = p_operation_id;
  if found then return v_existing_op.result_payload; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':handover', 0));
  select * into v_active from public.care_handover_sessions
  where baby_id = p_baby_id and ended_at is null for update;
  if found and v_active.caregiver_id = v_user_id then
    v_result := jsonb_build_object('status', 'already_active', 'handover', to_jsonb(v_active));
    insert into public.care_sync_operations (
      operation_id, user_id, device_id, device_label, action, entity_type,
      entity_id, status, request_payload, result_payload
    ) values (
      p_operation_id, v_user_id, p_device_id, p_device_label, 'take_over',
      'handover', v_active.id, 'already_applied', '{}'::jsonb, v_result
    );
    return v_result;
  elsif found then
    update public.care_handover_sessions set
      ended_at = now(), ended_reason = 'handed_over'
    where id = v_active.id;
  end if;

  select case
    when b.parent_id = v_user_id then 'mother'
    else coalesce(fm.role, 'caregiver')
  end into v_role
  from public.babies b
  left join public.family_members fm
    on fm.owner_id = b.parent_id and fm.member_id = v_user_id
  where b.id = p_baby_id;

  insert into public.care_handover_sessions (
    id, baby_id, caregiver_id, caregiver_name, caregiver_role,
    device_id, device_label
  ) values (
    p_session_id, p_baby_id, v_user_id, trim(p_caregiver_name), v_role,
    p_device_id, p_device_label
  ) returning * into v_session;
  v_result := jsonb_build_object('status', 'applied', 'handover', to_jsonb(v_session));
  insert into public.care_sync_operations (
    operation_id, user_id, device_id, device_label, action, entity_type,
    entity_id, status, request_payload, result_payload
  ) values (
    p_operation_id, v_user_id, p_device_id, p_device_label, 'take_over',
    'handover', v_session.id, 'applied', '{}'::jsonb, v_result
  );
  return v_result;
end;
$$;
revoke all on function public.take_over_baby_care(uuid, uuid, uuid, text, text, text)
  from public;
grant execute on function public.take_over_baby_care(uuid, uuid, uuid, text, text, text)
  to authenticated;

create or replace function public.get_care_handover_snapshot(p_baby_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_access_baby(p_baby_id) then
    raise exception 'Bu bakım özetine erişimin yok.';
  end if;
  select jsonb_build_object(
    'handover', (
      select to_jsonb(h) from public.care_handover_sessions h
      where h.baby_id = p_baby_id and h.ended_at is null
      order by h.started_at desc limit 1
    ),
    'active_timer', (
      select to_jsonb(t) from public.care_active_timers t
      where t.baby_id = p_baby_id and t.ended_at is null
      order by t.started_at desc limit 1
    ),
    'last_feed', (
      select to_jsonb(e) from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null
        and e.entry_type in ('breastfeeding', 'bottle')
      order by e.occurred_at desc limit 1
    ),
    'last_diaper', (
      select to_jsonb(e) from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null and e.entry_type = 'diaper'
      order by e.occurred_at desc limit 1
    ),
    'last_sleep', (
      select to_jsonb(e) from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null and e.entry_type = 'sleep'
      order by e.occurred_at desc limit 1
    ),
    'last_medicine', (
      select to_jsonb(e) from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null and e.entry_type = 'medicine'
      order by e.occurred_at desc limit 1
    ),
    'last_temperature', (
      select to_jsonb(e) from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null and e.entry_type = 'temperature'
      order by e.occurred_at desc limit 1
    ),
    'vitamin_given_today', exists (
      select 1 from public.care_journal_entries e
      where e.baby_id = p_baby_id and e.deleted_at is null
        and e.entry_type = 'medicine'
        and e.occurred_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'
        and e.medicine_name ~* 'd[[:space:]]*vitamini'
    ),
    'next_medicine_reminder', (
      select to_jsonb(r) from public.care_reminders r
      where r.baby_id = p_baby_id and r.entry_type = 'medicine'
        and r.status = 'scheduled' and r.scheduled_for > now()
      order by r.scheduled_for asc limit 1
    ),
    'active_reminder_count', (
      select count(*) from public.care_reminders r
      where r.baby_id = p_baby_id and r.status = 'scheduled' and r.scheduled_for > now()
    ),
    'open_task_count', (
      select case when public.has_active_family_premium(p_baby_id) then count(*) else 0 end
      from public.care_tasks t where t.baby_id = p_baby_id and t.completed_at is null
    )
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_care_handover_snapshot(uuid) from public;
grant execute on function public.get_care_handover_snapshot(uuid) to authenticated;

-- Realtime tables are added idempotently for family devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'care_active_timers'
  ) then
    alter publication supabase_realtime add table public.care_active_timers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'care_handover_sessions'
  ) then
    alter publication supabase_realtime add table public.care_handover_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'care_journal_entry_events'
  ) then
    alter publication supabase_realtime add table public.care_journal_entry_events;
  end if;
end $$;

comment on table public.care_sync_operations is
  'Server-side idempotency ledger for replaying offline family-care operations exactly once.';
comment on table public.care_journal_entry_events is
  'Immutable actor/device/version history for every care entry change.';
comment on table public.care_active_timers is
  'Shared timers that any authorized family caregiver can observe and finish.';
comment on table public.care_handover_sessions is
  'Atomic family-care handover history; at most one caregiver is active per baby.';
