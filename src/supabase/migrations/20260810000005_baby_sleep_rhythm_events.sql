-- Canonical sleep/wake transitions for the postpartum Sleep Rhythm feature.

create table if not exists public.baby_sleep_events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_type text not null check (event_type in ('sleep', 'wake')),
  occurred_at timestamptz not null,
  timezone_offset_minutes integer not null check (timezone_offset_minutes between -840 and 840),
  source text not null default 'manual' check (source in ('quick', 'manual', 'care_journal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, occurred_at)
);

create index if not exists baby_sleep_events_baby_occurred_idx
  on public.baby_sleep_events (baby_id, occurred_at desc);

drop trigger if exists set_baby_sleep_events_updated_at on public.baby_sleep_events;
create trigger set_baby_sleep_events_updated_at
  before update on public.baby_sleep_events
  for each row execute function public.set_updated_at();

alter table public.baby_sleep_events enable row level security;

drop policy if exists "baby_sleep_events_select_family" on public.baby_sleep_events;
create policy "baby_sleep_events_select_family"
  on public.baby_sleep_events for select
  using (public.can_access_baby(baby_id));

revoke all on public.baby_sleep_events from anon, authenticated;
grant select on public.baby_sleep_events to authenticated;

create or replace function public.create_baby_sleep_event(
  p_baby_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_timezone_offset_minutes integer,
  p_source text default 'manual'
)
returns public.baby_sleep_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_type text;
  v_next_type text;
  v_event public.baby_sleep_events;
begin
  if auth.uid() is null or not public.can_access_baby(p_baby_id) then
    raise exception 'Bu bebek için uyku kaydı ekleme yetkin yok.' using errcode = '42501';
  end if;
  if p_event_type not in ('sleep', 'wake') then
    raise exception 'Uyku durumu geçersiz.' using errcode = '22023';
  end if;
  if p_source not in ('quick', 'manual') then
    raise exception 'Kayıt kaynağı geçersiz.' using errcode = '22023';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '30 seconds' then
    raise exception 'Gelecekte bir uyku kaydı oluşturamazsın.' using errcode = '22023';
  end if;
  if p_timezone_offset_minutes not between -840 and 840 then
    raise exception 'Saat dilimi bilgisi geçersiz.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_baby_id::text, 0));

  select event_type into v_previous_type
  from public.baby_sleep_events
  where baby_id = p_baby_id and occurred_at < p_occurred_at
  order by occurred_at desc
  limit 1;

  select event_type into v_next_type
  from public.baby_sleep_events
  where baby_id = p_baby_id and occurred_at > p_occurred_at
  order by occurred_at asc
  limit 1;

  if v_previous_type = p_event_type or v_next_type = p_event_type then
    raise exception 'Uyudu ve Uyandı kayıtları sırayla ilerlemeli.' using errcode = '23514';
  end if;

  insert into public.baby_sleep_events (
    baby_id, created_by, event_type, occurred_at, timezone_offset_minutes, source
  ) values (
    p_baby_id, auth.uid(), p_event_type, p_occurred_at,
    p_timezone_offset_minutes, p_source
  )
  returning * into v_event;

  return v_event;
exception
  when unique_violation then
    raise exception 'Bu saatte zaten bir uyku kaydı var.' using errcode = '23505';
end;
$$;

create or replace function public.update_baby_sleep_event(
  p_event_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_timezone_offset_minutes integer
)
returns public.baby_sleep_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.baby_sleep_events;
  v_previous_type text;
  v_next_type text;
  v_event public.baby_sleep_events;
begin
  select * into v_existing
  from public.baby_sleep_events
  where id = p_event_id;

  if not found or auth.uid() is null or not public.can_access_baby(v_existing.baby_id) then
    raise exception 'Uyku kaydı bulunamadı.' using errcode = '42501';
  end if;
  if p_event_type not in ('sleep', 'wake') then
    raise exception 'Uyku durumu geçersiz.' using errcode = '22023';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '30 seconds' then
    raise exception 'Gelecekte bir uyku kaydı oluşturamazsın.' using errcode = '22023';
  end if;
  if p_timezone_offset_minutes not between -840 and 840 then
    raise exception 'Saat dilimi bilgisi geçersiz.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_existing.baby_id::text, 0));

  select event_type into v_previous_type
  from public.baby_sleep_events
  where baby_id = v_existing.baby_id
    and id <> p_event_id
    and occurred_at < p_occurred_at
  order by occurred_at desc
  limit 1;

  select event_type into v_next_type
  from public.baby_sleep_events
  where baby_id = v_existing.baby_id
    and id <> p_event_id
    and occurred_at > p_occurred_at
  order by occurred_at asc
  limit 1;

  if v_previous_type = p_event_type or v_next_type = p_event_type then
    raise exception 'Uyudu ve Uyandı kayıtları sırayla ilerlemeli.' using errcode = '23514';
  end if;

  update public.baby_sleep_events
  set event_type = p_event_type,
      occurred_at = p_occurred_at,
      timezone_offset_minutes = p_timezone_offset_minutes,
      source = 'manual'
  where id = p_event_id
  returning * into v_event;

  return v_event;
exception
  when unique_violation then
    raise exception 'Bu saatte zaten bir uyku kaydı var.' using errcode = '23505';
end;
$$;

create or replace function public.delete_baby_sleep_event(p_event_id uuid)
returns public.baby_sleep_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.baby_sleep_events;
begin
  select * into v_event
  from public.baby_sleep_events
  where id = p_event_id;

  if not found or auth.uid() is null or not public.can_access_baby(v_event.baby_id) then
    raise exception 'Uyku kaydı bulunamadı.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_event.baby_id::text, 0));
  delete from public.baby_sleep_events where id = p_event_id;
  return v_event;
end;
$$;

revoke all on function public.create_baby_sleep_event(uuid, text, timestamptz, integer, text)
  from public, anon;
revoke all on function public.update_baby_sleep_event(uuid, text, timestamptz, integer)
  from public, anon;
revoke all on function public.delete_baby_sleep_event(uuid)
  from public, anon;
grant execute on function public.create_baby_sleep_event(uuid, text, timestamptz, integer, text)
  to authenticated;
grant execute on function public.update_baby_sleep_event(uuid, text, timestamptz, integer)
  to authenticated;
grant execute on function public.delete_baby_sleep_event(uuid)
  to authenticated;

-- Preserve useful, already recorded intervals without copying duplicate transitions.
with candidates as (
  select baby_id, created_by, 'sleep'::text as event_type, occurred_at,
    extract(timezone from occurred_at)::integer / -60 as timezone_offset_minutes
  from public.care_journal_entries
  where entry_type = 'sleep'
  union all
  select baby_id, created_by, 'wake'::text, ended_at,
    extract(timezone from ended_at)::integer / -60
  from public.care_journal_entries
  where entry_type = 'sleep' and ended_at is not null
), per_moment as (
  select distinct on (baby_id, occurred_at)
    baby_id, created_by, event_type, occurred_at, timezone_offset_minutes
  from candidates
  where occurred_at is not null
  order by baby_id, occurred_at, event_type desc
), sequenced as (
  select *, lag(event_type) over (partition by baby_id order by occurred_at) as previous_type
  from per_moment
)
insert into public.baby_sleep_events (
  baby_id, created_by, event_type, occurred_at, timezone_offset_minutes, source
)
select baby_id, created_by, event_type, occurred_at,
  greatest(-840, least(840, timezone_offset_minutes)), 'care_journal'
from sequenced
where previous_type is distinct from event_type
on conflict (baby_id, occurred_at) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'baby_sleep_events'
  ) then
    alter publication supabase_realtime add table public.baby_sleep_events;
  end if;
end;
$$;

comment on table public.baby_sleep_events is
  'Canonical chronological sleep/wake transitions. Sleep sessions and predictions are derived, never stored as competing interval data.';
