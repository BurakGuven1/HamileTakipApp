-- Complete the pregnancy-to-postpartum transition atomically.
-- The baby insert also triggers the existing vaccination schedule generator.

create or replace function public.complete_pregnancy_with_birth(
  p_baby_name text,
  p_birth_date date,
  p_gender text default 'belirtilmemis',
  p_feeding_mode text default 'mixed'
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

  -- A family member may read the active profile, but only the mother/profile owner
  -- can complete a pregnancy and create the birth record.
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

  insert into public.babies (parent_id, name, birth_date, gender)
  values (v_profile_id, v_baby_name, p_birth_date, p_gender)
  returning * into v_baby;

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

revoke all on function public.complete_pregnancy_with_birth(text, date, text, text) from public;
grant execute on function public.complete_pregnancy_with_birth(text, date, text, text) to authenticated;

comment on function public.complete_pregnancy_with_birth(text, date, text, text) is
  'Atomically creates the newborn profile and moves the owner profile into the postpartum experience.';
