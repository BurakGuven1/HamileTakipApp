-- A single handover screen must never hide a second active timer. Serialize all
-- timer types per baby, not separately per type.

drop index if exists public.idx_care_active_timer_per_baby_type;
create unique index if not exists idx_care_active_timer_per_baby
  on public.care_active_timers (baby_id)
  where ended_at is null;

do $$
declare
  v_definition text;
  v_lock_needle text := 'p_baby_id::text || '':'' || p_timer_type';
  v_query_needle text := 'where baby_id = p_baby_id and timer_type = p_timer_type and ended_at is null';
begin
  select pg_get_functiondef(
    'public.start_shared_care_timer(uuid,uuid,uuid,text,text,text,text,text,text)'::regprocedure
  ) into v_definition;
  if position(v_lock_needle in v_definition) = 0
    or position(v_query_needle in v_definition) = 0
  then
    raise exception 'start_shared_care_timer definition changed; single-timer patch aborted.';
  end if;
  v_definition := replace(
    v_definition,
    v_lock_needle,
    'p_baby_id::text || '':timer'''
  );
  v_definition := replace(
    v_definition,
    v_query_needle,
    'where baby_id = p_baby_id and ended_at is null'
  );
  execute v_definition;
end $$;

comment on index public.idx_care_active_timer_per_baby is
  'Prevents concurrent devices from creating more than one active timer for a baby.';
