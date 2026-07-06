-- ============================================================
-- 0005: Bebeğe Özel Aşı Takibi
-- ============================================================

create table if not exists public.baby_vaccinations (
  id                    uuid primary key default gen_random_uuid(),
  baby_id               uuid not null references public.babies(id) on delete cascade,
  vaccine_schedule_id   uuid not null references public.vaccine_schedule(id) on delete restrict,
  scheduled_date        date not null,
  completed             boolean not null default false,
  completed_date        date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (baby_id, vaccine_schedule_id)
);

comment on table public.baby_vaccinations is
  'Her bebek için kişiselleştirilmiş aşı takibi. Bebek eklendiğinde 0013 migration''daki trigger ile otomatik oluşturulur.';

alter table public.baby_vaccinations enable row level security;

create policy "baby_vaccinations_select_own"
  on public.baby_vaccinations for select
  using (exists (
    select 1 from public.babies b
    where b.id = baby_vaccinations.baby_id and b.parent_id = auth.uid()
  ));

create policy "baby_vaccinations_insert_own"
  on public.baby_vaccinations for insert
  with check (exists (
    select 1 from public.babies b
    where b.id = baby_vaccinations.baby_id and b.parent_id = auth.uid()
  ));

create policy "baby_vaccinations_update_own"
  on public.baby_vaccinations for update
  using (exists (
    select 1 from public.babies b
    where b.id = baby_vaccinations.baby_id and b.parent_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.babies b
    where b.id = baby_vaccinations.baby_id and b.parent_id = auth.uid()
  ));

create trigger set_baby_vaccinations_updated_at
  before update on public.baby_vaccinations
  for each row execute function public.set_updated_at();

create index if not exists idx_baby_vaccinations_baby_id on public.baby_vaccinations(baby_id);
create index if not exists idx_baby_vaccinations_scheduled_date on public.baby_vaccinations(scheduled_date) where completed = false;
