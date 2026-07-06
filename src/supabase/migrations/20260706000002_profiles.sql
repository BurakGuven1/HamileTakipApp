-- ============================================================
-- 0002: Kullanıcı Profilleri
-- ============================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  forum_nickname    text unique,             -- forumda görünen anonim isim
  avatar_url        text,
  is_pregnant       boolean not null default false,
  due_date          date,                    -- tahmini doğum tarihi (hamile ise)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Her auth.users kaydına karşılık gelen genişletilmiş kullanıcı profili.';
comment on column public.profiles.forum_nickname is 'Forumda gerçek isim yerine gösterilen anonim takma isim. Benzersizdir.';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Yeni kullanıcı kaydolduğunda otomatik profil oluşturma
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, forum_nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'Anne' || upper(substr(replace(new.id::text, '-', ''), 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'auth.users tablosuna yeni kayıt eklendiğinde otomatik olarak profiles satırı oluşturur ve rastgele bir forum_nickname atar. Kullanıcı bunu daha sonra değiştirebilir.';
