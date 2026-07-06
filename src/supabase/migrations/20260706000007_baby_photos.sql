-- ============================================================
-- 0007: Bebek Fotoğraf Galerisi (Metadata)
-- ============================================================
-- Gerçek dosyalar Supabase Storage'daki 'baby-photos' bucket'ında tutulur
-- (bkz. 0012_storage_buckets.sql). Bu tablo sadece storage_path referansını
-- ve ek metadata'yı (tarih, açıklama) tutar.

create table if not exists public.baby_photos (
  id             uuid primary key default gen_random_uuid(),
  baby_id        uuid not null references public.babies(id) on delete cascade,
  storage_path   text not null,   -- örn: '{user_id}/{baby_id}/2026-07-06-<uuid>.webp'
  taken_at       date default current_date,
  caption        text,
  created_at     timestamptz not null default now()
);

comment on table public.baby_photos is 'Bebek fotoğraflarının Storage referansları ve metadata bilgisi.';

alter table public.baby_photos enable row level security;

create policy "baby_photos_all_own"
  on public.baby_photos for all
  using (exists (
    select 1 from public.babies b
    where b.id = baby_photos.baby_id and b.parent_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.babies b
    where b.id = baby_photos.baby_id and b.parent_id = auth.uid()
  ));

create index if not exists idx_baby_photos_baby_taken_at on public.baby_photos(baby_id, taken_at desc);
