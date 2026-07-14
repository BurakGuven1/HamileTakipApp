-- ============================================================
-- 0023: Auto theme preference for gender-aware accent colors
-- ============================================================

alter table public.profiles
  alter column theme_preference set default 'auto';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('auto', 'sage', 'rose', 'blue', 'pink', 'lavender'));

update public.profiles
set theme_preference = 'auto'
where theme_preference = 'sage';

comment on column public.profiles.theme_preference is
  'Stores the user-selected app theme color preference. auto resolves the accent from the latest baby gender.';
