alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('auto', 'sage', 'rose', 'blue', 'pink', 'lavender', 'dark'));

comment on column public.profiles.theme_preference is
  'Uygulama vurgu rengi ve görünüm tercihi; dark yalnızca açık kullanıcı seçimiyle etkinleşir.';
