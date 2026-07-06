-- ============================================================
-- 0012: Storage Bucket'ları ve Erişim Politikaları
-- ============================================================
-- Path convention (ÖNEMLİ - client kodu buna uymalı):
--   baby-photos/{auth_user_id}/{baby_id}/{dosya}.webp
--   avatars/{auth_user_id}/{dosya}.webp
--   lullabies/{dosya}.mp3   (admin tarafından yüklenir, kullanıcı path'i yok)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('baby-photos', 'baby-photos', false, 10485760,  array['image/jpeg', 'image/png', 'image/webp']),
  ('lullabies',   'lullabies',   true,  52428800,  array['audio/mpeg', 'audio/aac', 'audio/mp4']),
  ('avatars',     'avatars',     true,  5242880,   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- baby-photos: PRİVATE — sadece dosyanın klasör adı (ilk path segmenti)
-- auth.uid() ile eşleşen kullanıcı erişebilir.
-- ------------------------------------------------------------
create policy "baby_photos_select_own"
  on storage.objects for select
  using (
    bucket_id = 'baby-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "baby_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'baby-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "baby_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'baby-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- lullabies: PUBLIC READ — herkes dinleyebilir, sadece service_role yazabilir
-- (insert/update/delete policy tanımlanmadı, yalnızca service_role erişebilir)
-- ------------------------------------------------------------
create policy "lullabies_select_public"
  on storage.objects for select
  using (bucket_id = 'lullabies');

-- ------------------------------------------------------------
-- avatars: PUBLIC READ, kullanıcı sadece kendi avatarını yükler/siler
-- ------------------------------------------------------------
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
