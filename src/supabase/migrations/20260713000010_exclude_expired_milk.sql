-- Expired milk remains in the permanent audit archive but must never be
-- suggested, counted as usable stock or consumed by FIFO.

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

  update public.milk_storage_containers set status = 'expired', version = version + 1, updated_at = now()
  where baby_id = p_baby_id and status = 'available' and deleted_at is null
    and remaining_amount_ml > 0 and expires_at <= now();

  for v_container in
    select * from public.milk_storage_containers c
    where c.baby_id = p_baby_id and c.deleted_at is null and c.status = 'available'
      and c.remaining_amount_ml > 0 and c.expires_at > now()
      and (p_container_id is null or c.id = p_container_id)
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
  if v_needed > 0 then raise exception 'Kullanılabilir stokta yeterli süt yok. Kullanılabilir: % ml.', v_used; end if;
  v_result := jsonb_build_object('status', 'applied', 'used_ml', v_used);
  insert into public.milk_inventory_operations values (p_operation_id, v_user_id, p_baby_id, 'consumed', v_result, now());
  return v_result;
end;
$$;

create or replace function public.get_milk_inventory_summary(p_baby_id uuid)
returns jsonb
language plpgsql
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
  update public.milk_storage_containers set status = 'expired', version = version + 1, updated_at = now()
  where baby_id = p_baby_id and status = 'available' and deleted_at is null
    and remaining_amount_ml > 0 and expires_at <= now();
  select coalesce(sum(remaining_amount_ml), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'refrigerator'), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'freezer'), 0),
    coalesce(sum(remaining_amount_ml) filter (where storage_location = 'thawed'), 0)
  into v_total, v_fridge, v_freezer, v_thawed
  from public.milk_storage_containers
  where baby_id = p_baby_id and deleted_at is null and status = 'available'
    and remaining_amount_ml > 0 and expires_at > now();
  select coalesce(sum(amount_ml), 0) into v_consumed_7d
  from public.milk_storage_events
  where baby_id = p_baby_id and action = 'consumed' and occurred_at >= now() - interval '7 days';
  select * into v_next from public.milk_storage_containers
  where baby_id = p_baby_id and deleted_at is null and status = 'available'
    and remaining_amount_ml > 0 and expires_at > now()
  order by case when storage_location = 'thawed' then 0 else 1 end, expires_at, pumped_at limit 1;
  return jsonb_build_object(
    'total_ml', v_total, 'refrigerator_ml', v_fridge, 'freezer_ml', v_freezer,
    'thawed_ml', v_thawed, 'daily_average_ml', round(v_consumed_7d / 7.0, 1),
    'estimated_days', case when v_consumed_7d > 0 then round(v_total / (v_consumed_7d / 7.0), 1) else null end,
    'expiring_within_24h', (select count(*) from public.milk_storage_containers where baby_id = p_baby_id and status = 'available' and deleted_at is null and expires_at > now() and expires_at <= now() + interval '24 hours'),
    'use_next', case when v_next.id is null then null else to_jsonb(v_next) end
  );
end;
$$;

revoke all on function public.consume_milk_stock(uuid,uuid,numeric,uuid,text,text,text) from public;
revoke all on function public.get_milk_inventory_summary(uuid) from public;
grant execute on function public.consume_milk_stock(uuid,uuid,numeric,uuid,text,text,text) to authenticated;
grant execute on function public.get_milk_inventory_summary(uuid) to authenticated;
