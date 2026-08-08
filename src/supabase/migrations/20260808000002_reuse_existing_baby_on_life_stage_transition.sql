-- Keep life-stage toggles attached to the same child record.
-- A new child is created only when the profile has no existing child yet.

drop function if exists public.complete_pregnancy_with_birth(text, date, text, text);

create or replace function public.complete_pregnancy_with_birth(
  p_baby_name text,
  p_birth_date date,
  p_gender text default 'belirtilmemis',
  p_feeding_mode text default 'mixed',
  p_baby_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_baby public.babies;
  v_profile_id uuid;
  v_baby_name text := btrim(coalesce(p_baby_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '28000';
  end if;

  v_profile_id := public.get_active_profile_id();

  if v_profile_id is null or v_profile_id <> auth.uid() then
    raise exception 'Bu geçişi yalnızca profil sahibi tamamlayabilir.' using errcode = '42501';
  end if;

  if char_length(v_baby_name) < 1 or char_length(v_baby_name) > 80 then
    raise exception 'Bebek adı 1-80 karakter arasında olmalı.' using errcode = '22023';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'Doğum tarihi bugün veya daha önce olmalı.' using errcode = '22023';
  end if;

  if p_gender not in ('kiz', 'erkek', 'belirtilmemis') then
    raise exception 'Bebek cinsiyeti geçersiz.' using errcode = '22023';
  end if;

  if p_feeding_mode not in ('breastfeeding', 'pumping', 'mixed', 'formula') then
    raise exception 'Beslenme tercihi geçersiz.' using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles
   where id = v_profile_id
   for update;

  if not found then
    raise exception 'Profil bulunamadı.' using errcode = 'P0002';
  end if;

  if p_baby_id is not null then
    select *
      into v_baby
      from public.babies
     where id = p_baby_id
       and parent_id = v_profile_id
     for update;

    if not found then
      raise exception 'Güncellenecek çocuk profili bulunamadı.' using errcode = 'P0002';
    end if;
  else
    -- Older clients do not send a baby id. Reuse the app's primary child instead
    -- of creating a duplicate when the user toggles life stages repeatedly.
    select *
      into v_baby
      from public.babies
     where parent_id = v_profile_id
     order by created_at asc, id asc
     limit 1
     for update;
  end if;

  if v_baby.id is null then
    insert into public.babies (parent_id, name, birth_date, gender)
    values (v_profile_id, v_baby_name, p_birth_date, p_gender)
    returning * into v_baby;
  else
    update public.babies
       set name = v_baby_name,
           birth_date = p_birth_date,
           gender = p_gender,
           updated_at = now()
     where id = v_baby.id
    returning * into v_baby;

    -- Preserve completion/history fields while keeping due dates aligned with
    -- the corrected birth date. Missing schedule rows are restored as well.
    insert into public.baby_vaccinations (
      baby_id,
      vaccine_schedule_id,
      scheduled_date
    )
    select
      v_baby.id,
      schedule.id,
      (v_baby.birth_date + (schedule.recommended_age_days || ' days')::interval)::date
    from public.vaccine_schedule as schedule
    on conflict (baby_id, vaccine_schedule_id) do update
      set scheduled_date = excluded.scheduled_date,
          updated_at = now();
  end if;

  update public.profiles
     set is_pregnant = false,
         feeding_mode = p_feeding_mode,
         notify_weekly_pregnancy_updates = false,
         updated_at = now()
   where id = v_profile_id
  returning * into v_profile;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'baby', to_jsonb(v_baby)
  );
end;
$$;

revoke all on function public.complete_pregnancy_with_birth(text, date, text, text, uuid)
  from public;
grant execute on function public.complete_pregnancy_with_birth(text, date, text, text, uuid)
  to authenticated;

comment on function public.complete_pregnancy_with_birth(text, date, text, text, uuid) is
  'Moves the owner profile to postpartum while reusing the selected child record; creates a child only when none exists.';
