-- ============================================================
-- 0004: Resmi Aşı Takvimi (Referans Tablo)
-- ============================================================
-- Bu tablo T.C. Sağlık Bakanlığı Genişletilmiş Bağışıklama Programı'na
-- göre doldurulur (seed dosyasına bakınız: 0014_seed_vaccine_schedule.sql).
-- Kullanıcılar bu tabloyu değiştiremez; sadece okuyabilir. Güncelleme/ekleme
-- işlemleri service_role (admin) tarafından yapılır.

create table if not exists public.vaccine_schedule (
  id                    uuid primary key default gen_random_uuid(),
  vaccine_name          text not null,        -- Örn: "Hepatit B (1. doz)"
  vaccine_code          text,                 -- Örn: "HEPB-1"
  recommended_age_days  int not null,         -- Doğumdan itibaren önerilen gün sayısı
  dose_number           int not null default 1,
  description           text,
  sort_order            int not null default 0
);

comment on table public.vaccine_schedule is
  'T.C. Sağlık Bakanlığı resmi aşı takvimi referans verisi. Ülke geneli tek takvim, kullanıcıya özel değildir.';

alter table public.vaccine_schedule enable row level security;

create policy "vaccine_schedule_select_all"
  on public.vaccine_schedule for select
  using (true);

create index if not exists idx_vaccine_schedule_age on public.vaccine_schedule(recommended_age_days);
