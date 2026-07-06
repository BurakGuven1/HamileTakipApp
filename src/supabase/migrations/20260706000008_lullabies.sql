-- ============================================================
-- 0008: Ninni Kütüphanesi
-- ============================================================
-- Statik içerik: admin/service_role tarafından yönetilir. Kullanıcılar
-- sadece aktif ninnileri listeleyebilir.

create table if not exists public.lullabies (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  duration_minutes  int not null check (duration_minutes in (15, 30, 60)),
  storage_path      text not null,   -- 'lullabies' bucket'ındaki dosya yolu
  cover_image_url   text,
  category          text,            -- örn: 'Klasik', 'Doğa Sesleri', 'Enstrümantal'
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

comment on table public.lullabies is 'Ninni/uyku sesi kütüphanesi. İçerik admin tarafından yüklenir.';

alter table public.lullabies enable row level security;

create policy "lullabies_select_active"
  on public.lullabies for select
  using (is_active = true);

create index if not exists idx_lullabies_duration on public.lullabies(duration_minutes) where is_active = true;
