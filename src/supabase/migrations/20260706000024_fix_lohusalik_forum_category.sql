-- ============================================================
-- 0024: Fix forum category Turkish spelling
-- ============================================================

update public.forum_categories
set name = 'Doğum Sonrası & Lohusalık'
where name = 'Doğum Sonrası & Loğusalık';
