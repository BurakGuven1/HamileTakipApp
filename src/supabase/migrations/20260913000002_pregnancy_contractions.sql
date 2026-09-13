-- Real contraction timing.
--
-- pregnancy_daily_counters only ever held a tally of taps, which cannot answer
-- the question a labouring woman actually has: how long are they, how far
-- apart, and has that held for an hour. The 5-1-1 rule needs start and end
-- times per contraction, so they are stored individually.

create table if not exists public.pregnancy_contractions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- The timer is used one-handed, mid-contraction, often on a bad connection.
  -- The client supplies this so a retried tap cannot create a second entry.
  client_operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, client_operation_id),
  check (ended_at is null or ended_at >= started_at)
);

comment on table public.pregnancy_contractions is
  'Individually timed contractions for a pregnant profile. Start and end times are required to evaluate the 5-1-1 pattern.';

alter table public.pregnancy_contractions enable row level security;

drop trigger if exists set_pregnancy_contractions_updated_at
  on public.pregnancy_contractions;
create trigger set_pregnancy_contractions_updated_at
  before update on public.pregnancy_contractions
  for each row execute function public.set_updated_at();

create index if not exists pregnancy_contractions_profile_started_idx
  on public.pregnancy_contractions (profile_id, started_at desc);

-- Partner and caregiver access follows the same rule as every other pregnancy
-- record: whoever can see the profile can help time the contractions.
drop policy if exists "pregnancy_contractions_all_family" on public.pregnancy_contractions;
create policy "pregnancy_contractions_all_family"
  on public.pregnancy_contractions for all
  using (public.can_access_profile(profile_id))
  with check (public.can_access_profile(profile_id));

create or replace function public.start_pregnancy_contraction(
  p_operation_id uuid,
  p_started_at timestamptz default now()
)
returns public.pregnancy_contractions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_row public.pregnancy_contractions;
begin
  if auth.uid() is null or v_profile_id is null
     or not public.can_access_profile(v_profile_id) then
    raise exception 'Bu profile erişimin yok.' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'İşlem kimliği gerekli.' using errcode = '22023';
  end if;
  if p_started_at > now() + interval '1 minute' then
    raise exception 'Kasılma başlangıcı gelecekte olamaz.' using errcode = '22023';
  end if;

  -- Close anything still running: a contraction left open because the app was
  -- backgrounded must not swallow the next one's interval.
  update public.pregnancy_contractions
  set ended_at = least(p_started_at, now())
  where profile_id = v_profile_id
    and ended_at is null
    and client_operation_id <> p_operation_id;

  insert into public.pregnancy_contractions (
    profile_id, created_by, started_at, client_operation_id
  ) values (
    v_profile_id, auth.uid(), p_started_at, p_operation_id
  )
  on conflict (profile_id, client_operation_id) do update
    set updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.stop_pregnancy_contraction(
  p_operation_id uuid,
  p_ended_at timestamptz default now()
)
returns public.pregnancy_contractions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_row public.pregnancy_contractions;
begin
  if auth.uid() is null or v_profile_id is null
     or not public.can_access_profile(v_profile_id) then
    raise exception 'Bu profile erişimin yok.' using errcode = '42501';
  end if;

  select * into v_row
  from public.pregnancy_contractions
  where profile_id = v_profile_id and client_operation_id = p_operation_id
  for update;

  if not found then
    raise exception 'Kasılma kaydı bulunamadı.' using errcode = 'P0002';
  end if;

  -- Stopping twice is not an error; the first end time stands.
  if v_row.ended_at is not null then
    return v_row;
  end if;

  update public.pregnancy_contractions
  set ended_at = greatest(p_ended_at, v_row.started_at)
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.list_pregnancy_contractions(
  p_since timestamptz default (now() - interval '24 hours')
)
returns setof public.pregnancy_contractions
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.pregnancy_contractions c
  where c.profile_id = public.get_active_profile_id()
    and public.can_access_profile(c.profile_id)
    and c.started_at >= p_since
  order by c.started_at desc;
$$;

create or replace function public.delete_pregnancy_contraction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
begin
  if auth.uid() is null or v_profile_id is null
     or not public.can_access_profile(v_profile_id) then
    raise exception 'Bu profile erişimin yok.' using errcode = '42501';
  end if;

  delete from public.pregnancy_contractions
  where id = p_id and profile_id = v_profile_id;
end;
$$;

revoke all on function public.start_pregnancy_contraction(uuid, timestamptz)
  from public, anon;
revoke all on function public.stop_pregnancy_contraction(uuid, timestamptz)
  from public, anon;
revoke all on function public.list_pregnancy_contractions(timestamptz)
  from public, anon;
revoke all on function public.delete_pregnancy_contraction(uuid) from public, anon;

grant execute on function public.start_pregnancy_contraction(uuid, timestamptz)
  to authenticated;
grant execute on function public.stop_pregnancy_contraction(uuid, timestamptz)
  to authenticated;
grant execute on function public.list_pregnancy_contractions(timestamptz)
  to authenticated;
grant execute on function public.delete_pregnancy_contraction(uuid) to authenticated;
