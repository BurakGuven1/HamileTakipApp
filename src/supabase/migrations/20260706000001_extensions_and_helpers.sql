-- ============================================================
-- 0001: Extensions & Ortak Yardımcı Fonksiyonlar
-- ============================================================

-- UUID üretimi için (Supabase projelerinde genelde zaten aktiftir)
create extension if not exists "pgcrypto";

-- Zamanlanmış görevler için (aşı hatırlatma cron job'u bu migration setinin
-- sonunda kullanılıyor). Supabase Dashboard > Database > Extensions üzerinden
-- de aktif edilebilir; CLI ile migration olarak da denenebilir.
create extension if not exists "pg_cron" with schema pg_catalog;

-- Edge Function'lara HTTP isteği atabilmek için (cron job içinde kullanılacak)
create extension if not exists "pg_net" with schema extensions;

-- Tüm tablolarda ortak kullanılacak updated_at otomatik güncelleme fonksiyonu
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger fonksiyonu: updated_at kolonunu otomatik olarak now() yapar.';
