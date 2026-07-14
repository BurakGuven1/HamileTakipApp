-- ============================================================
-- 0018: Family access codes for father/shared parent access
-- ============================================================

alter table public.profiles
  add column if not exists family_referral_code text;

create unique index if not exists idx_profiles_family_referral_code
  on public.profiles (family_referral_code)
  where family_referral_code is not null;

comment on column public.profiles.family_referral_code is
  'Seven digit family access code. A second parent can redeem it once with their own authenticated account.';

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'father' check (role in ('father')),
  created_at timestamptz not null default now(),
  unique (owner_id, member_id),
  unique (member_id),
  check (owner_id <> member_id)
);

comment on table public.family_members is
  'Links a second authenticated parent account to the owner profile after redeeming the owner family code.';

alter table public.family_members enable row level security;

create or replace function public.generate_family_referral_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := lpad(floor(random() * 10000000)::int::text, 7, '0');
    exit when not exists (
      select 1 from public.profiles where family_referral_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

create or replace function public.ensure_family_referral_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.family_referral_code is null then
    new.family_referral_code := public.generate_family_referral_code();
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_profiles_family_referral_code on public.profiles;
create trigger ensure_profiles_family_referral_code
  before insert on public.profiles
  for each row execute function public.ensure_family_referral_code();

do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select id from public.profiles where family_referral_code is null
  loop
    update public.profiles
      set family_referral_code = public.generate_family_referral_code()
      where id = v_profile_id;
  end loop;
end;
$$;

alter table public.profiles
  alter column family_referral_code set not null;

create or replace function public.get_active_profile_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (
      select fm.owner_id
      from public.family_members fm
      where fm.member_id = auth.uid()
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function public.can_access_profile(p_profile_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    auth.uid() = p_profile_id
    or exists (
      select 1
      from public.family_members fm
      where fm.owner_id = p_profile_id
        and fm.member_id = auth.uid()
    );
$$;

create or replace function public.can_access_baby(p_baby_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.babies b
    where b.id = p_baby_id
      and public.can_access_profile(b.parent_id)
  );
$$;

create or replace function public.can_access_baby_path(p_baby_id text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
begin
  if p_baby_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_access_baby(p_baby_id::uuid);
end;
$$;

create or replace function public.get_active_profile()
returns public.profiles
language sql
security definer set search_path = public
stable
as $$
  select p.*
  from public.profiles p
  where p.id = public.get_active_profile_id();
$$;

create or replace function public.redeem_family_referral_code(p_code text)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_owner_id uuid;
  v_existing_owner_id uuid;
  v_clean_code text;
  v_profile public.profiles;
begin
  if v_member_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  v_clean_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  if length(v_clean_code) <> 7 then
    raise exception 'Aile kodu 7 haneli olmalı.';
  end if;

  select id into v_owner_id
  from public.profiles
  where family_referral_code = v_clean_code;

  if v_owner_id is null then
    raise exception 'Aile kodu bulunamadı.';
  end if;

  if v_owner_id = v_member_id then
    raise exception 'Kendi aile kodunu kullanamazsın.';
  end if;

  select owner_id into v_existing_owner_id
  from public.family_members
  where member_id = v_member_id;

  if v_existing_owner_id is not null and v_existing_owner_id <> v_owner_id then
    raise exception 'Bu hesap zaten başka bir aile profiline bağlı.';
  end if;

  insert into public.family_members (owner_id, member_id, role)
  values (v_owner_id, v_member_id, 'father')
  on conflict (member_id) do nothing;

  select * into v_profile
  from public.profiles
  where id = v_owner_id;

  return v_profile;
end;
$$;

drop policy if exists "family_members_select_related" on public.family_members;
create policy "family_members_select_related"
  on public.family_members for select
  using (auth.uid() = owner_id or auth.uid() = member_id);

drop policy if exists "family_members_delete_related" on public.family_members;
create policy "family_members_delete_related"
  on public.family_members for delete
  using (auth.uid() = owner_id or auth.uid() = member_id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_family"
  on public.profiles for select
  using (public.can_access_profile(id));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_family"
  on public.profiles for update
  using (public.can_access_profile(id))
  with check (public.can_access_profile(id));

drop policy if exists "babies_select_own" on public.babies;
create policy "babies_select_family"
  on public.babies for select
  using (public.can_access_profile(parent_id));

drop policy if exists "babies_insert_own" on public.babies;
create policy "babies_insert_family"
  on public.babies for insert
  with check (public.can_access_profile(parent_id));

drop policy if exists "babies_update_own" on public.babies;
create policy "babies_update_family"
  on public.babies for update
  using (public.can_access_profile(parent_id))
  with check (public.can_access_profile(parent_id));

drop policy if exists "babies_delete_own" on public.babies;
create policy "babies_delete_family"
  on public.babies for delete
  using (public.can_access_profile(parent_id));

drop policy if exists "baby_vaccinations_select_own" on public.baby_vaccinations;
create policy "baby_vaccinations_select_family"
  on public.baby_vaccinations for select
  using (public.can_access_baby(baby_id));

drop policy if exists "baby_vaccinations_insert_own" on public.baby_vaccinations;
create policy "baby_vaccinations_insert_family"
  on public.baby_vaccinations for insert
  with check (public.can_access_baby(baby_id));

drop policy if exists "baby_vaccinations_update_own" on public.baby_vaccinations;
create policy "baby_vaccinations_update_family"
  on public.baby_vaccinations for update
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

drop policy if exists "growth_records_all_own" on public.growth_records;
create policy "growth_records_all_family"
  on public.growth_records for all
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

drop policy if exists "baby_photos_all_own" on public.baby_photos;
create policy "baby_photos_all_family"
  on public.baby_photos for all
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

drop policy if exists "forum_posts_select_visible" on public.forum_posts;
create policy "forum_posts_select_visible"
  on public.forum_posts for select
  using (is_hidden = false or public.can_access_profile(author_id));

drop policy if exists "forum_posts_insert_own" on public.forum_posts;
create policy "forum_posts_insert_family"
  on public.forum_posts for insert
  with check (public.can_access_profile(author_id));

drop policy if exists "forum_posts_update_own" on public.forum_posts;
create policy "forum_posts_update_family"
  on public.forum_posts for update
  using (public.can_access_profile(author_id))
  with check (public.can_access_profile(author_id));

drop policy if exists "forum_posts_delete_own" on public.forum_posts;
create policy "forum_posts_delete_family"
  on public.forum_posts for delete
  using (public.can_access_profile(author_id));

drop policy if exists "forum_comments_select_visible" on public.forum_comments;
create policy "forum_comments_select_visible"
  on public.forum_comments for select
  using (is_hidden = false or public.can_access_profile(author_id));

drop policy if exists "forum_comments_insert_own" on public.forum_comments;
create policy "forum_comments_insert_family"
  on public.forum_comments for insert
  with check (public.can_access_profile(author_id));

drop policy if exists "forum_comments_delete_own" on public.forum_comments;
create policy "forum_comments_delete_family"
  on public.forum_comments for delete
  using (public.can_access_profile(author_id));

drop policy if exists "forum_reports_insert_own" on public.forum_reports;
create policy "forum_reports_insert_family"
  on public.forum_reports for insert
  with check (public.can_access_profile(reporter_id));

drop policy if exists "forum_reports_select_own" on public.forum_reports;
create policy "forum_reports_select_family"
  on public.forum_reports for select
  using (public.can_access_profile(reporter_id));

drop policy if exists "baby_photos_select_own" on storage.objects;
create policy "baby_photos_select_family"
  on storage.objects for select
  using (
    bucket_id = 'baby-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_access_baby_path((storage.foldername(name))[2])
    )
  );

drop policy if exists "baby_photos_insert_own" on storage.objects;
create policy "baby_photos_insert_family"
  on storage.objects for insert
  with check (
    bucket_id = 'baby-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_access_baby_path((storage.foldername(name))[2])
  );

drop policy if exists "baby_photos_delete_own" on storage.objects;
create policy "baby_photos_delete_family"
  on storage.objects for delete
  using (
    bucket_id = 'baby-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_access_baby_path((storage.foldername(name))[2])
    )
  );

create or replace function public.is_nickname_available(nickname text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    length(trim(coalesce(nickname, ''))) >= 3
    and not exists (
      select 1
      from public.profiles
      where lower(forum_nickname) = lower(trim(nickname))
        and id <> public.get_active_profile_id()
    );
$$;

grant select, delete on public.family_members to authenticated;
grant execute on function public.get_active_profile_id() to authenticated;
grant execute on function public.get_active_profile() to authenticated;
grant execute on function public.redeem_family_referral_code(text) to authenticated;
grant execute on function public.can_access_profile(uuid) to authenticated;
grant execute on function public.can_access_baby(uuid) to authenticated;
grant execute on function public.can_access_baby_path(text) to authenticated;
