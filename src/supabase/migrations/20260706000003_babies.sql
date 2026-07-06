-- ============================================================
-- 0003: Bebek Profilleri
-- ============================================================

create table if not exists public.babies (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  birth_date   date not null,
  gender       text check (gender in ('kiz', 'erkek', 'belirtilmemis')),
  photo_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.babies is 'Bir ebeveyne (profil) ait bebek/çocuk kayıtları. Bir ebeveynin birden fazla bebeği olabilir (ikiz, kardeş vb.).';

alter table public.babies enable row level security;

create policy "babies_select_own"
  on public.babies for select
  using (auth.uid() = parent_id);

create policy "babies_insert_own"
  on public.babies for insert
  with check (auth.uid() = parent_id);

create policy "babies_update_own"
  on public.babies for update
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "babies_delete_own"
  on public.babies for delete
  using (auth.uid() = parent_id);

create trigger set_babies_updated_at
  before update on public.babies
  for each row execute function public.set_updated_at();

create index if not exists idx_babies_parent_id on public.babies(parent_id);
