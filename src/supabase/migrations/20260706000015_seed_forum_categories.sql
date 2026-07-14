-- ============================================================
-- 0015: Forum Kategorileri — Seed Data
-- ============================================================

insert into public.forum_categories (name, description, icon, sort_order)
values
  ('Hamilelik', 'Gebelik süreci, belirtiler, doğuma hazırlık hakkında sohbet.', 'heart', 1),
  ('Doğum Sonrası & Lohusalık', 'Doğum sonrası iyileşme, emzirme, uyku düzeni.', 'baby', 2),
  ('Zor Süreçler Desteği', 'Bebek kaybı, düşük, doğum sonrası depresyon gibi hassas konular için güvenli ve yargılamayan bir alan.', 'shield-heart', 3),
  ('Beslenme & Uyku', 'Emzirme, ek gıda, uyku eğitimi ve rutinler.', 'moon', 4),
  ('Genel Sohbet', 'Anneler arası serbest sohbet ve dayanışma.', 'message-circle', 5)
on conflict do nothing;
