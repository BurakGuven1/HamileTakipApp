-- ============================================================
-- 0014: T.C. Sağlık Bakanlığı Aşı Takvimi — Seed Data
-- ============================================================
-- KAYNAK: T.C. Sağlık Bakanlığı Genişletilmiş Bağışıklama Programı
-- (asi.saglik.gov.tr) ve 2025 güncellemesi (Hepatit B bileşeni artık
-- 2-4-6. ay dozlarında altılı karma aşı - DaBT-İPA-Hib-HepB - içinde
-- uygulanmaktadır; doğumda ayrıca tekli Hepatit B dozu yapılır).
--
-- *** ÖNEMLİ / PRODUCTION UYARISI ***
-- Bu veri Temmuz 2026 itibarıyla halka açık kaynaklardan derlenmiştir.
-- Aşı takvimleri Sağlık Bakanlığı tarafından zaman zaman güncellenir.
-- Uygulamayı canlıya almadan önce MUTLAKA asi.saglik.gov.tr üzerindeki
-- güncel resmi genelge ile bu tabloyu karşılaştırıp doğrulayın. Bu tablo
-- tıbbi tavsiye değildir, sadece hatırlatma/takip amaçlıdır; uygulama
-- içinde de bu ibareye yer verilmesi önerilir.

insert into public.vaccine_schedule
  (vaccine_name, vaccine_code, recommended_age_days, dose_number, description, sort_order)
values
  ('Hepatit B (1. doz)', 'HEPB-1', 0, 1,
    'Doğumda (hastanede) uygulanır.', 1),

  ('BCG - Verem Aşısı', 'BCG-1', 60, 1,
    '2. ayın sonunda uygulanır.', 2),
  ('Altılı Karma (DaBT-İPA-Hib-HepB) - 1. doz', 'HEXA-1', 60, 1,
    'Difteri, Boğmaca, Tetanos, Polio, Hib, Hepatit B''yi içeren karma aşı. 2. ayın sonunda uygulanır.', 3),
  ('Konjuge Pnömokok Aşısı (KPA) - 1. doz', 'KPA-1', 60, 1,
    '2. ayın sonunda uygulanır.', 4),

  ('Altılı Karma (DaBT-İPA-Hib-HepB) - 2. doz', 'HEXA-2', 120, 2,
    '4. ayın sonunda uygulanır.', 5),
  ('Konjuge Pnömokok Aşısı (KPA) - 2. doz', 'KPA-2', 120, 2,
    '4. ayın sonunda uygulanır.', 6),

  ('Altılı Karma (DaBT-İPA-Hib-HepB) - 3. doz', 'HEXA-3', 180, 3,
    '6. ayın sonunda uygulanır.', 7),
  ('Oral Polio Aşısı (OPA) - 1. doz', 'OPA-1', 180, 1,
    '6. ayın sonunda uygulanır.', 8),

  ('KKK (Kızamık-Kızamıkçık-Kabakulak) Ek Doz', 'KKK-EK', 270, 1,
    '9. ayın sonunda salgın riskine karşı ek doz uygulanır.', 9),

  ('Konjuge Pnömokok Aşısı (KPA) - Pekiştirme', 'KPA-R', 360, 3,
    '12. ayın sonunda pekiştirme dozu.', 10),
  ('KKK (Kızamık-Kızamıkçık-Kabakulak) - 1. doz', 'KKK-1', 360, 1,
    '12. ayın sonunda uygulanır (9 aylık ek dozdan farklı, asıl 1. doz).', 11),
  ('Suçiçeği Aşısı', 'VAR-1', 360, 1,
    '12. ayın sonunda uygulanır.', 12),

  ('Altılı Karma (DaBT-İPA-Hib-HepB) - Pekiştirme', 'HEXA-R', 540, 4,
    '18. ayın sonunda pekiştirme (rapel) dozu.', 13),
  ('Oral Polio Aşısı (OPA) - 2. doz', 'OPA-2', 540, 2,
    '18. ayın sonunda uygulanır.', 14),
  ('Hepatit A - 1. doz', 'HEPA-1', 540, 1,
    '18. ayın sonunda uygulanır.', 15),

  ('Hepatit A - 2. doz', 'HEPA-2', 720, 2,
    '24. ayın sonunda uygulanır.', 16),

  ('KKK (Kızamık-Kızamıkçık-Kabakulak) - 2. doz', 'KKK-2', 1460, 2,
    '48. ayda (4 yaş) uygulanır.', 17),
  ('DaBT-İPA Pekiştirme', 'DABT-IPA-R', 1460, 1,
    '48. ayda (4 yaş) uygulanır.', 18),

  ('Td (Erişkin Tipi Difteri-Tetanos) Pekiştirme', 'TD-R', 4745, 1,
    '13 yaşına girince (ilkokul 8. sınıf döneminde) uygulanır.', 19)
on conflict do nothing;
