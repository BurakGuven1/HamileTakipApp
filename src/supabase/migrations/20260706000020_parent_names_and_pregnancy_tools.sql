-- ============================================================
-- 0020: Parent names and pregnancy-only tracking tools
-- ============================================================

alter table public.profiles
  add column if not exists mother_name text not null default '',
  add column if not exists father_name text not null default '';

update public.profiles
set
  mother_name = coalesce(nullif(trim(mother_name), ''), nullif(trim(display_name), ''), ''),
  father_name = coalesce(nullif(trim(father_name), ''), '');

comment on column public.profiles.mother_name is
  'Mother name used for personalized in-app copy and notifications.';
comment on column public.profiles.father_name is
  'Father name used for personalized in-app copy and notifications.';

create table if not exists public.pregnancy_weight_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  record_date date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg >= 30 and weight_kg <= 250),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, record_date)
);

comment on table public.pregnancy_weight_records is
  'Date-based pregnancy weight records for the active family profile.';

create table if not exists public.pregnancy_daily_counters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  counter_date date not null default current_date,
  kick_count int not null default 0 check (kick_count >= 0),
  contraction_count int not null default 0 check (contraction_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, counter_date)
);

comment on table public.pregnancy_daily_counters is
  'Daily kick and contraction counters for pregnant profiles.';

drop trigger if exists set_pregnancy_weight_records_updated_at on public.pregnancy_weight_records;
create trigger set_pregnancy_weight_records_updated_at
  before update on public.pregnancy_weight_records
  for each row execute function public.set_updated_at();

drop trigger if exists set_pregnancy_daily_counters_updated_at on public.pregnancy_daily_counters;
create trigger set_pregnancy_daily_counters_updated_at
  before update on public.pregnancy_daily_counters
  for each row execute function public.set_updated_at();

alter table public.pregnancy_weight_records enable row level security;
alter table public.pregnancy_daily_counters enable row level security;

drop policy if exists "pregnancy_weight_records_all_family" on public.pregnancy_weight_records;
create policy "pregnancy_weight_records_all_family"
  on public.pregnancy_weight_records for all
  using (public.can_access_profile(profile_id))
  with check (public.can_access_profile(profile_id));

drop policy if exists "pregnancy_daily_counters_all_family" on public.pregnancy_daily_counters;
create policy "pregnancy_daily_counters_all_family"
  on public.pregnancy_daily_counters for all
  using (public.can_access_profile(profile_id))
  with check (public.can_access_profile(profile_id));

create or replace function public.add_pregnancy_counter_delta(
  p_counter_date date,
  p_kick_delta int default 0,
  p_contraction_delta int default 0
)
returns public.pregnancy_daily_counters
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_is_pregnant boolean;
  v_counter public.pregnancy_daily_counters;
begin
  if v_profile_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  if coalesce(p_kick_delta, 0) < 0 or coalesce(p_contraction_delta, 0) < 0 then
    raise exception 'Sayaç değeri negatif olamaz.';
  end if;

  select is_pregnant into v_is_pregnant
  from public.profiles
  where id = v_profile_id;

  if not coalesce(v_is_pregnant, false) then
    raise exception 'Bu takip araçları yalnızca hamilelik profillerinde kullanılabilir.';
  end if;

  insert into public.pregnancy_daily_counters (
    profile_id,
    counter_date,
    kick_count,
    contraction_count
  )
  values (
    v_profile_id,
    coalesce(p_counter_date, current_date),
    coalesce(p_kick_delta, 0),
    coalesce(p_contraction_delta, 0)
  )
  on conflict (profile_id, counter_date) do update
    set
      kick_count = public.pregnancy_daily_counters.kick_count + excluded.kick_count,
      contraction_count = public.pregnancy_daily_counters.contraction_count + excluded.contraction_count,
      updated_at = now()
  returning * into v_counter;

  return v_counter;
end;
$$;

grant select, insert, update, delete on public.pregnancy_weight_records to authenticated;
grant select, insert, update, delete on public.pregnancy_daily_counters to authenticated;
grant execute on function public.add_pregnancy_counter_delta(date, int, int) to authenticated;
