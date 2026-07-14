-- ============================================================
-- 0019: Profile theme preference
-- ============================================================

alter table public.profiles
  add column if not exists theme_preference text not null default 'sage';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference in ('sage', 'rose', 'blue', 'pink', 'lavender'));
  end if;
end $$;

comment on column public.profiles.theme_preference is
  'Stores the user-selected app theme color preference.';
