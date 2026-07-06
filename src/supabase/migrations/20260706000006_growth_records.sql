-- ============================================================
-- 0006: Büyüme Takibi (Kilo / Boy / Baş Çevresi)
-- ============================================================

create table if not exists public.growth_records (
  id                       uuid primary key default gen_random_uuid(),
  baby_id                  uuid not null references public.babies(id) on delete cascade,
  record_date              date not null default current_date,
  weight_kg                numeric(5,2),
  height_cm                numeric(5,2),
  head_circumference_cm    numeric(5,2),
  notes                    text,
  created_at               timestamptz not null default now()
);

comment on table public.growth_records is 'Bebeğin zaman içindeki kilo/boy/baş çevresi ölçüm geçmişi.';

alter table public.growth_records enable row level security;

create policy "growth_records_all_own"
  on public.growth_records for all
  using (exists (
    select 1 from public.babies b
    where b.id = growth_records.baby_id and b.parent_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.babies b
    where b.id = growth_records.baby_id and b.parent_id = auth.uid()
  ));

create index if not exists idx_growth_records_baby_date on public.growth_records(baby_id, record_date);
