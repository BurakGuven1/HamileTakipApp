-- Align Premium presentation with server-enforced access and restore the
-- weekly pregnancy notification schedule.

alter table public.profiles
  add column if not exists notify_premium_offers boolean not null default false;

comment on column public.profiles.notify_premium_offers is
  'Explicit, default-off consent for occasional Anne+ Premium promotional push notifications.';

create or replace function public.get_baby_gallery_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := public.get_active_profile_id();
  v_is_premium boolean := false;
  v_used int := 0;
begin
  if auth.uid() is null or v_owner_id is null
     or not public.can_coordinate_profile(v_owner_id) then
    raise exception 'Galeri erişimi bulunamadı.' using errcode = '42501';
  end if;

  v_is_premium := public.has_effective_premium_access();

  select count(*)::int
    into v_used
  from public.baby_photos photo
  join public.babies baby on baby.id = photo.baby_id
  where baby.parent_id = v_owner_id;

  return jsonb_build_object(
    'allowed', v_is_premium or v_used < 5,
    'is_premium', v_is_premium,
    'limit', 5,
    'used', v_used,
    'remaining', case when v_is_premium then null else greatest(0, 5 - v_used) end
  );
end;
$$;

create or replace function public.can_add_baby_photo(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_baby(p_baby_id)
    and coalesce((public.get_baby_gallery_access() ->> 'allowed')::boolean, false);
$$;

revoke all on function public.get_baby_gallery_access() from public, anon;
revoke all on function public.can_add_baby_photo(uuid) from public, anon;
grant execute on function public.get_baby_gallery_access() to authenticated;
grant execute on function public.can_add_baby_photo(uuid) to authenticated;

drop policy if exists "baby_photos_all_family" on public.baby_photos;
drop policy if exists "baby_photos_select_family" on public.baby_photos;
drop policy if exists "baby_photos_insert_family" on public.baby_photos;
drop policy if exists "baby_photos_insert_metered_family" on public.baby_photos;
drop policy if exists "baby_photos_update_family" on public.baby_photos;
drop policy if exists "baby_photos_delete_family" on public.baby_photos;

create policy "baby_photos_select_family"
  on public.baby_photos for select
  using (public.can_access_baby(baby_id));

create policy "baby_photos_insert_metered_family"
  on public.baby_photos for insert
  with check (public.can_add_baby_photo(baby_id));

create policy "baby_photos_update_family"
  on public.baby_photos for update
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

create policy "baby_photos_delete_family"
  on public.baby_photos for delete
  using (public.can_access_baby(baby_id));

drop policy if exists "baby_photos_insert_family" on storage.objects;
drop policy if exists "baby_photos_insert_metered_family" on storage.objects;
create policy "baby_photos_insert_metered_family"
  on storage.objects for insert
  with check (
    bucket_id = 'baby-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_access_baby_path((storage.foldername(name))[2])
    and (
      storage.filename(name) like 'home-cover-%'
      or public.can_add_baby_photo(((storage.foldername(name))[2])::uuid)
    )
  );

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid from cron.job where jobname = 'weekly-pregnancy-update-reliable'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'weekly-pregnancy-update-reliable',
      '15,35 8 * * 1',
      $cron$
        select net.http_post(
          url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-weekly-pregnancy-update',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-notification-dispatch-secret', (
              select dispatch_secret
              from public.notification_dispatch_config
              where singleton = true
            )
          ),
          body := '{}'::jsonb
        );
      $cron$
    );

    for v_job_id in
      select jobid from cron.job where jobname = 'seasonal-premium-campaigns-consented'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'seasonal-premium-campaigns-consented',
      '5 9 * * *',
      $cron$
        select net.http_post(
          url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-seasonal-premium-campaigns',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-notification-dispatch-secret', (
              select dispatch_secret
              from public.notification_dispatch_config
              where singleton = true
            )
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  end if;
end;
$$;
