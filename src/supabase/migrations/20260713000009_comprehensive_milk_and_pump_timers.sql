-- Premium milk inventory, FIFO usage, feeding-mode personalization and
-- two-sided family-synchronized pumping timers.

alter table public.profiles
  add column if not exists feeding_mode text not null default 'mixed',
  add column if not exists notify_milk_inventory boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_feeding_mode_check'
  ) then
    alter table public.profiles add constraint profiles_feeding_mode_check
      check (feeding_mode in ('breastfeeding', 'pumping', 'mixed', 'formula'));
  end if;
end $$;

create table if not exists public.milk_storage_containers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  sequence_number bigint not null,
  pumped_at timestamptz not null,
  initial_amount_ml numeric(7,1) not null check (initial_amount_ml > 0 and initial_amount_ml <= 5000),
  remaining_amount_ml numeric(7,1) not null check (remaining_amount_ml >= 0 and remaining_amount_ml <= initial_amount_ml),
  storage_location text not null check (storage_location in ('refrigerator', 'freezer', 'thawed')),
  expires_at timestamptz not null,
  thawed_at timestamptz,
  thaw_expires_at timestamptz,
  status text not null default 'available' check (status in ('available', 'consumed', 'discarded', 'expired')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_device_id text,
  created_device_label text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  updated_device_id text,
  updated_device_label text,
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, sequence_number),
  check (expires_at >= pumped_at),
  check ((storage_location = 'thawed') = (thawed_at is not null)),
  check (thaw_expires_at is null or thaw_expires_at >= thawed_at)
);

create index if not exists idx_milk_containers_fifo
  on public.milk_storage_containers (baby_id, expires_at, pumped_at)
  where deleted_at is null and status = 'available' and remaining_amount_ml > 0;

create table if not exists public.milk_storage_events (
  id bigint generated always as identity primary key,
  container_id uuid not null references public.milk_storage_containers(id) on delete restrict,
  baby_id uuid not null references public.babies(id) on delete cascade,
  operation_id uuid not null,
  action text not null check (action in ('stored', 'thawed', 'consumed', 'discarded', 'expired', 'restored')),
  amount_ml numeric(7,1) check (amount_ml is null or amount_ml > 0),
  remaining_after_ml numeric(7,1) not null check (remaining_after_ml >= 0),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  device_id text,
  device_label text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (operation_id, container_id, action)
);

create index if not exists idx_milk_events_baby_time
  on public.milk_storage_events (baby_id, occurred_at desc);

create table if not exists public.milk_inventory_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  action text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.milk_storage_containers enable row level security;
alter table public.milk_storage_events enable row level security;
alter table public.milk_inventory_operations enable row level security;

drop policy if exists "milk_containers_select_premium_family" on public.milk_storage_containers;
create policy "milk_containers_select_premium_family"
  on public.milk_storage_containers for select
  using (deleted_at is null and public.can_access_baby(baby_id) and public.has_active_family_premium(baby_id));

drop policy if exists "milk_events_select_premium_family" on public.milk_storage_events;
create policy "milk_events_select_premium_family"
  on public.milk_storage_events for select
  using (public.can_access_baby(baby_id) and public.has_active_family_premium(baby_id));

revoke all on public.milk_storage_containers, public.milk_storage_events, public.milk_inventory_operations from anon;
revoke insert, update, delete on public.milk_storage_containers, public.milk_storage_events, public.milk_inventory_operations from authenticated;
grant select on public.milk_storage_containers, public.milk_storage_events to authenticated;

create or replace function public.create_milk_storage_container(
  p_operation_id uuid,
  p_baby_id uuid,
  p_amount_ml numeric,
  p_storage_location text,
  p_pumped_at timestamptz,
  p_expires_at timestamptz default null,
  p_label text default null,
  p_notes text default null,
  p_device_id text default null,
  p_device_label text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.milk_inventory_operations;
  v_container public.milk_storage_containers;
  v_sequence bigint;
  v_expiry timestamptz;
  v_result jsonb;
begin
  if v_user_id is null or not public.has_active_family_premium(p_baby_id) or not public.can_access_baby(p_baby_id) then
    raise exception 'Süt stoğu Premium aile erişimi gerektirir.';
  end if;
  if p_amount_ml is null or p_amount_ml <= 0 or p_amount_ml > 5000 then raise exception 'Geçerli bir ml değeri gir.'; end if;
  if p_storage_location not in ('refrigerator', 'freezer') then raise exception 'Geçerli saklama yeri seç.'; end if;
  if p_pumped_at is null or p_pumped_at > now() + interval '5 minutes' then raise exception 'Geçerli sağım zamanı gir.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing from public.milk_inventory_operations where operation_id = p_operation_id;
  if found then return v_existing.result_payload; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':milk-sequence', 0));

  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.milk_storage_containers where baby_id = p_baby_id;
  v_expiry := coalesce(
    p_expires_at,
    case when p_storage_location = 'refrigerator'
      then p_pumped_at + interval '4 days'
      else p_pumped_at + interval '6 months'
    end
  );
  if v_expiry <= p_pumped_at then raise exception 'Son kullanım zamanı sağım zamanından sonra olmalı.'; end if;

  insert into public.milk_storage_containers (
    baby_id, created_by, label, sequence_number, pumped_at, initial_amount_ml,
    remaining_amount_ml, storage_location, expires_at, notes, created_device_id,
    created_device_label, updated_by, updated_by_name, updated_device_id, updated_device_label
  ) values (
    p_baby_id, v_user_id, coalesce(nullif(trim(p_label), ''), 'S-' || lpad(v_sequence::text, 4, '0')),
    v_sequence, p_pumped_at, p_amount_ml, p_amount_ml, p_storage_location, v_expiry,
    nullif(trim(p_notes), ''), p_device_id, p_device_label, v_user_id,
    p_actor_name, p_device_id, p_device_label
  ) returning * into v_container;

  insert into public.milk_storage_events (
    container_id, baby_id, operation_id, action, amount_ml, remaining_after_ml,
    actor_id, actor_name, device_id, device_label
  ) values (
    v_container.id, p_baby_id, p_operation_id, 'stored', p_amount_ml, p_amount_ml,
    v_user_id, p_actor_name, p_device_id, p_device_label
  );
  v_result := jsonb_build_object('status', 'applied', 'container', to_jsonb(v_container));
  insert into public.milk_inventory_operations values (p_operation_id, v_user_id, p_baby_id, 'stored', v_result, now());
  return v_result;
end;
$$;

create or replace function public.thaw_milk_storage_container(
  p_operation_id uuid,
  p_container_id uuid,
  p_thawed_at timestamptz default now(),
  p_device_id text default null,
  p_device_label text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.milk_inventory_operations;
  v_container public.milk_storage_containers;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing from public.milk_inventory_operations where operation_id = p_operation_id;
  if found then return v_existing.result_payload; end if;
  select * into v_container from public.milk_storage_containers where id = p_container_id for update;
  if not found or not public.can_access_baby(v_container.baby_id) or not public.has_active_family_premium(v_container.baby_id) then
    raise exception 'Süt kabı bulunamadı.';
  end if;
  if v_container.status <> 'available' or v_container.remaining_amount_ml <= 0 then raise exception 'Bu süt artık kullanılabilir değil.'; end if;
  if v_container.storage_location <> 'freezer' then raise exception 'Yalnızca dondurucudaki süt çözdürülebilir.'; end if;

  update public.milk_storage_containers set
    storage_location = 'thawed', thawed_at = p_thawed_at,
    thaw_expires_at = p_thawed_at + interval '24 hours',
    expires_at = least(expires_at, p_thawed_at + interval '24 hours'),
    updated_by = v_user_id, updated_by_name = p_actor_name,
    updated_device_id = p_device_id, updated_device_label = p_device_label,
    version = version + 1, updated_at = now()
  where id = p_container_id returning * into v_container;
  insert into public.milk_storage_events (
    container_id, baby_id, operation_id, action, remaining_after_ml, actor_id,
    actor_name, device_id, device_label
  ) values (
    v_container.id, v_container.baby_id, p_operation_id, 'thawed',
    v_container.remaining_amount_ml, v_user_id, p_actor_name, p_device_id, p_device_label
  );
  v_result := jsonb_build_object('status', 'applied', 'container', to_jsonb(v_container));
  insert into public.milk_inventory_operations values (p_operation_id, v_user_id, v_container.baby_id, 'thawed', v_result, now());
  return v_result;
end;
$$;

create or replace function public.consume_milk_stock(
  p_operation_id uuid,
  p_baby_id uuid,
  p_amount_ml numeric,
  p_container_id uuid default null,
  p_device_id text default null,
  p_device_label text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.milk_inventory_operations;
  v_container public.milk_storage_containers;
  v_needed numeric := p_amount_ml;
  v_take numeric;
  v_used numeric := 0;
  v_result jsonb;
begin
  if v_user_id is null or not public.can_access_baby(p_baby_id) or not public.has_active_family_premium(p_baby_id) then
    raise exception 'Süt stoğu Premium aile erişimi gerektirir.';
  end if;
  if p_amount_ml is null or p_amount_ml <= 0 then raise exception 'Geçerli bir ml değeri gir.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing from public.milk_inventory_operations where operation_id = p_operation_id;
  if found then return v_existing.result_payload; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':milk-consume', 0));

  for v_container in
    select * from public.milk_storage_containers c
    where c.baby_id = p_baby_id and c.deleted_at is null and c.status = 'available'
      and c.remaining_amount_ml > 0 and (p_container_id is null or c.id = p_container_id)
    order by case when c.storage_location = 'thawed' then 0 else 1 end,
      c.expires_at asc, c.pumped_at asc
    for update
  loop
    exit when v_needed <= 0;
    v_take := least(v_container.remaining_amount_ml, v_needed);
    update public.milk_storage_containers set
      remaining_amount_ml = remaining_amount_ml - v_take,
      status = case when remaining_amount_ml - v_take <= 0 then 'consumed' else status end,
      updated_by = v_user_id, updated_by_name = p_actor_name,
      updated_device_id = p_device_id, updated_device_label = p_device_label,
      version = version + 1, updated_at = now()
    where id = v_container.id returning * into v_container;
    insert into public.milk_storage_events (
      container_id, baby_id, operation_id, action, amount_ml, remaining_after_ml,
      actor_id, actor_name, device_id, device_label
    ) values (
      v_container.id, p_baby_id, p_operation_id, 'consumed', v_take,
      v_container.remaining_amount_ml, v_user_id, p_actor_name, p_device_id, p_device_label
    );
    v_needed := v_needed - v_take;
    v_used := v_used + v_take;
  end loop;
  if v_needed > 0 then raise exception 'Stokta yeterli süt yok. Kullanılabilir: % ml.', v_used; end if;
  v_result := jsonb_build_object('status', 'applied', 'used_ml', v_used);
  insert into public.milk_inventory_operations values (p_operation_id, v_user_id, p_baby_id, 'consumed', v_result, now());
  return v_result;
end;
$$;

create or replace function public.discard_milk_storage_container(
  p_operation_id uuid,
  p_container_id uuid,
  p_device_id text default null,
  p_device_label text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_container public.milk_storage_containers;
  v_existing public.milk_inventory_operations;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing from public.milk_inventory_operations where operation_id = p_operation_id;
  if found then return v_existing.result_payload; end if;
  select * into v_container from public.milk_storage_containers where id = p_container_id for update;
  if not found or not public.can_access_baby(v_container.baby_id) or not public.has_active_family_premium(v_container.baby_id) then raise exception 'Süt kabı bulunamadı.'; end if;
  update public.milk_storage_containers set status = 'discarded', updated_by = v_user_id,
    updated_by_name = p_actor_name, updated_device_id = p_device_id,
    updated_device_label = p_device_label, version = version + 1, updated_at = now()
  where id = p_container_id returning * into v_container;
  insert into public.milk_storage_events (
    container_id, baby_id, operation_id, action, amount_ml, remaining_after_ml,
    actor_id, actor_name, device_id, device_label
  ) values (
    v_container.id, v_container.baby_id, p_operation_id, 'discarded',
    v_container.remaining_amount_ml, v_container.remaining_amount_ml,
    v_user_id, p_actor_name, p_device_id, p_device_label
  );
  v_result := jsonb_build_object('status', 'applied', 'container', to_jsonb(v_container));
  insert into public.milk_inventory_operations values (p_operation_id, v_user_id, v_container.baby_id, 'discarded', v_result, now());
  return v_result;
end;
$$;

create or replace function public.get_milk_inventory_summary(p_baby_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_fridge numeric;
  v_freezer numeric;
  v_thawed numeric;
  v_consumed_7d numeric;
  v_next public.milk_storage_containers;
begin
  if auth.uid() is null or not public.can_access_baby(p_baby_id) or not public.has_active_family_premium(p_baby_id) then
    raise exception 'Süt stoğu Premium aile erişimi gerektirir.';
  end if;
  select coalesce(sum(remaining_amount_ml), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'refrigerator'), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'freezer'), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'thawed'), 0)
  into v_total, v_fridge, v_freezer, v_thawed
  from public.milk_storage_containers
  where baby_id = p_baby_id and deleted_at is null and status = 'available' and remaining_amount_ml > 0;
  select coalesce(sum(amount_ml), 0) into v_consumed_7d
  from public.milk_storage_events
  where baby_id = p_baby_id and action = 'consumed' and occurred_at >= now() - interval '7 days';
  select * into v_next from public.milk_storage_containers
  where baby_id = p_baby_id and deleted_at is null and status = 'available' and remaining_amount_ml > 0
  order by case when storage_location = 'thawed' then 0 else 1 end, expires_at, pumped_at limit 1;
  return jsonb_build_object(
    'total_ml', v_total, 'refrigerator_ml', v_fridge, 'freezer_ml', v_freezer,
    'thawed_ml', v_thawed, 'daily_average_ml', round(v_consumed_7d / 7.0, 1),
    'estimated_days', case when v_consumed_7d > 0 then round(v_total / (v_consumed_7d / 7.0), 1) else null end,
    'expiring_within_24h', (select count(*) from public.milk_storage_containers where baby_id = p_baby_id and status = 'available' and deleted_at is null and expires_at <= now() + interval '24 hours'),
    'use_next', case when v_next.id is null then null else to_jsonb(v_next) end
  );
end;
$$;

do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.care_intelligence_notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop execute format('alter table public.care_intelligence_notifications drop constraint %I', c); end loop;
end $$;
alter table public.care_intelligence_notifications add constraint care_intelligence_notifications_kind_check
  check (kind in ('sleep_prediction', 'medicine_safety', 'development_period', 'milk_expiry'));

create or replace function public.queue_milk_expiry_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.care_intelligence_notifications set status = 'cancelled'
  where source_key = 'milk-expiry:' || new.id::text and status = 'scheduled';
  if new.deleted_at is null and new.status = 'available' and new.remaining_amount_ml > 0 then
    insert into public.care_intelligence_notifications (
      baby_id, created_by, kind, source_key, scheduled_for, title, body, payload, requires_premium, status
    ) values (
      new.baby_id, new.created_by, 'milk_expiry', 'milk-expiry:' || new.id::text,
      greatest(now() + interval '1 minute', new.expires_at - interval '24 hours'),
      'Süt stoğunu kontrol et',
      new.label || ' etiketli ' || trim(to_char(new.remaining_amount_ml, 'FM9999990D0')) || ' ml sütün kullanım süresi yaklaşıyor.',
      jsonb_build_object('container_id', new.id, 'expires_at', new.expires_at), true, 'scheduled'
    ) on conflict (source_key) do update set
      scheduled_for = excluded.scheduled_for, body = excluded.body, payload = excluded.payload,
      status = 'scheduled', sent_at = null, updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists queue_milk_expiry_after_change on public.milk_storage_containers;
create trigger queue_milk_expiry_after_change after insert or update of expires_at, remaining_amount_ml, status, deleted_at
  on public.milk_storage_containers for each row execute function public.queue_milk_expiry_notification();

-- Allow two concurrent pumping timers (one per breast) while preserving one
-- exclusive sleep/breastfeeding timer for the baby.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.care_active_timers'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%timer_type%'
  loop execute format('alter table public.care_active_timers drop constraint %I', c); end loop;
end $$;
alter table public.care_active_timers add constraint care_active_timers_timer_type_check
  check (timer_type in ('breastfeeding', 'sleep', 'pumping'));
drop index if exists public.idx_care_active_timer_per_baby;
drop index if exists public.idx_care_active_timer_per_baby_type;
create unique index if not exists idx_care_active_non_pumping_timer
  on public.care_active_timers (baby_id) where ended_at is null and timer_type <> 'pumping';
create unique index if not exists idx_care_active_pumping_side
  on public.care_active_timers (baby_id, breast_side) where ended_at is null and timer_type = 'pumping';

create or replace function public.start_shared_care_timer(
  p_operation_id uuid, p_timer_id uuid, p_baby_id uuid, p_timer_type text,
  p_breast_side text, p_sleep_kind text, p_device_id text,
  p_device_label text, p_actor_name text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_existing_op public.care_sync_operations;
  v_timer public.care_active_timers; v_conflict public.care_active_timers; v_result jsonb;
begin
  if v_user_id is null or p_timer_type not in ('breastfeeding','sleep','pumping') or not public.care_entry_write_allowed(p_baby_id, p_timer_type) then raise exception 'Bu zamanlayıcı için erişimin yok.'; end if;
  if p_timer_type = 'pumping' and p_breast_side not in ('left','right') then raise exception 'Sağım için sağ veya sol tarafı seç.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select * into v_existing_op from public.care_sync_operations where operation_id = p_operation_id;
  if found then return v_existing_op.result_payload; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text || ':timer', 0));
  select * into v_timer from public.care_active_timers where baby_id = p_baby_id and ended_at is null
    and ((p_timer_type = 'pumping' and timer_type = 'pumping' and breast_side = p_breast_side)
      or (p_timer_type <> 'pumping' and timer_type <> 'pumping')) limit 1;
  if found then
    v_result := jsonb_build_object('status','already_active','timer',to_jsonb(v_timer));
    insert into public.care_sync_operations (operation_id,user_id,device_id,device_label,action,entity_type,entity_id,status,request_payload,result_payload)
    values (p_operation_id,v_user_id,p_device_id,p_device_label,'start_timer','timer',v_timer.id,'already_applied','{}',v_result);
    return v_result;
  end if;
  select * into v_conflict from public.care_active_timers where baby_id = p_baby_id and ended_at is null
    and ((p_timer_type = 'pumping' and timer_type <> 'pumping') or (p_timer_type <> 'pumping' and timer_type = 'pumping')) limit 1;
  if found then raise exception 'Başka türde aktif bir aile zamanlayıcısı var.'; end if;
  insert into public.care_active_timers (id,baby_id,timer_type,breast_side,sleep_kind,started_by,started_by_name,started_device_id,started_device_label)
  values (p_timer_id,p_baby_id,p_timer_type,case when p_timer_type in ('breastfeeding','pumping') then p_breast_side end,case when p_timer_type='sleep' then p_sleep_kind end,v_user_id,p_actor_name,p_device_id,p_device_label)
  returning * into v_timer;
  v_result := jsonb_build_object('status','applied','timer',to_jsonb(v_timer));
  insert into public.care_sync_operations (operation_id,user_id,device_id,device_label,action,entity_type,entity_id,status,request_payload,result_payload)
  values (p_operation_id,v_user_id,p_device_id,p_device_label,'start_timer','timer',v_timer.id,'applied','{}',v_result);
  return v_result;
end $$;

create or replace function public.stop_shared_care_timer_v2(
  p_operation_id uuid, p_timer_id uuid, p_device_id text, p_device_label text,
  p_actor_name text, p_amount_ml numeric default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_existing_op public.care_sync_operations;
  v_timer public.care_active_timers; v_entry public.care_journal_entries;
  v_entry_id uuid := gen_random_uuid(); v_result jsonb;
begin
  if v_user_id is null then raise exception 'Oturum gerekli.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  select * into v_existing_op from public.care_sync_operations where operation_id=p_operation_id;
  if found then return v_existing_op.result_payload; end if;
  select * into v_timer from public.care_active_timers where id=p_timer_id for update;
  if not found or not public.can_access_baby(v_timer.baby_id) then raise exception 'Aktif zamanlayıcı bulunamadı.'; end if;
  if v_timer.ended_at is not null then
    v_result := jsonb_build_object('status','already_completed','timer',to_jsonb(v_timer));
    insert into public.care_sync_operations (operation_id,user_id,device_id,device_label,action,entity_type,entity_id,status,request_payload,result_payload)
    values (p_operation_id,v_user_id,p_device_id,p_device_label,'stop_timer','timer',v_timer.id,'already_applied','{}',v_result);
    return v_result;
  end if;
  if not public.care_entry_write_allowed(v_timer.baby_id,v_timer.timer_type) then raise exception 'Bu zamanlayıcıyı bitirmek için erişimin yok.'; end if;
  if p_amount_ml is not null and p_amount_ml <= 0 then raise exception 'Geçerli bir ml değeri gir.'; end if;
  perform set_config('app.care_operation_id',p_operation_id::text,true);
  perform set_config('app.care_device_id',p_device_id,true);
  perform set_config('app.care_device_label',coalesce(p_device_label,''),true);
  perform set_config('app.care_actor_name',coalesce(p_actor_name,''),true);
  insert into public.care_journal_entries (id,baby_id,created_by,caregiver_name,entry_type,occurred_at,ended_at,amount_ml,breast_side,sleep_kind,client_operation_id,created_device_id,created_device_label,updated_by,updated_by_name,updated_device_id,updated_device_label)
  values (v_entry_id,v_timer.baby_id,v_user_id,p_actor_name,v_timer.timer_type,v_timer.started_at,now(),case when v_timer.timer_type='pumping' then p_amount_ml end,v_timer.breast_side,v_timer.sleep_kind,p_operation_id,p_device_id,p_device_label,v_user_id,p_actor_name,p_device_id,p_device_label)
  returning * into v_entry;
  update public.care_active_timers set ended_at=v_entry.ended_at,ended_by=v_user_id,ended_by_name=p_actor_name,ended_device_id=p_device_id,ended_device_label=p_device_label,journal_entry_id=v_entry.id,updated_at=now()
  where id=v_timer.id returning * into v_timer;
  v_result := jsonb_build_object('status','applied','timer',to_jsonb(v_timer),'entry',to_jsonb(v_entry));
  insert into public.care_sync_operations (operation_id,user_id,device_id,device_label,action,entity_type,entity_id,status,request_payload,result_payload)
  values (p_operation_id,v_user_id,p_device_id,p_device_label,'stop_timer','timer',v_timer.id,'applied',jsonb_build_object('amount_ml',p_amount_ml),v_result);
  return v_result;
end $$;

revoke all on function public.create_milk_storage_container(uuid,uuid,numeric,text,timestamptz,timestamptz,text,text,text,text,text) from public;
revoke all on function public.thaw_milk_storage_container(uuid,uuid,timestamptz,text,text,text) from public;
revoke all on function public.consume_milk_stock(uuid,uuid,numeric,uuid,text,text,text) from public;
revoke all on function public.discard_milk_storage_container(uuid,uuid,text,text,text) from public;
revoke all on function public.get_milk_inventory_summary(uuid) from public;
revoke all on function public.stop_shared_care_timer_v2(uuid,uuid,text,text,text,numeric) from public;
grant execute on function public.create_milk_storage_container(uuid,uuid,numeric,text,timestamptz,timestamptz,text,text,text,text,text) to authenticated;
grant execute on function public.thaw_milk_storage_container(uuid,uuid,timestamptz,text,text,text) to authenticated;
grant execute on function public.consume_milk_stock(uuid,uuid,numeric,uuid,text,text,text) to authenticated;
grant execute on function public.discard_milk_storage_container(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.get_milk_inventory_summary(uuid) to authenticated;
grant execute on function public.stop_shared_care_timer_v2(uuid,uuid,text,text,text,numeric) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='milk_storage_containers') then
    alter publication supabase_realtime add table public.milk_storage_containers;
  end if;
end $$;

comment on table public.milk_storage_containers is 'Permanent bag/container-level milk stock with FIFO and soft archival metadata.';
comment on function public.get_milk_inventory_summary(uuid) is 'Non-clinical FIFO stock summary and observed seven-day consumption estimate.';
