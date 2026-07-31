-- Keep the already-published app build compatible with the age-assurance
-- trigger introduced on 2026-07-30. Legacy clients do not send any of the
-- age-assurance metadata fields. New clients send all fields and still pass
-- through the strict server-side validation below.

create or replace function public.capture_signup_age_assurance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  birth_date_text text;
  birth_date_value date;
  confirmed boolean;
  assurance_version text;
begin
  -- Family-code accounts collect their assurance in the dedicated RPC flow.
  if coalesce(new.is_anonymous, false)
     or signup_metadata->>'role' = 'father'
     or new.email like 'father-%@family-login.anneplus.local' then
    return new;
  end if;

  -- Builds published before age assurance existed send none of these keys.
  -- Allow those users to register instead of aborting auth.users insertion.
  -- If a client sends even one assurance key, require and validate the full set.
  if not (
    signup_metadata ? 'birth_date'
    or signup_metadata ? 'age_assurance_version'
    or signup_metadata ? 'age_over_18_confirmed'
  ) then
    return new;
  end if;

  birth_date_text := signup_metadata->>'birth_date';
  assurance_version := signup_metadata->>'age_assurance_version';

  begin
    confirmed := coalesce(
      (signup_metadata->>'age_over_18_confirmed')::boolean,
      false
    );
  exception when invalid_text_representation then
    raise exception 'Geçerli bir 18+ onayı gerekli.';
  end;

  if not confirmed then
    raise exception 'Devam etmek için 18 yaşından büyük olunduğu onaylanmalı.';
  end if;

  if birth_date_text is null
     or birth_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Kayıt için geçerli bir doğum tarihi gerekli.';
  end if;

  begin
    birth_date_value := birth_date_text::date;
  exception when others then
    raise exception 'Kayıt için geçerli bir doğum tarihi gerekli.';
  end;

  if birth_date_value > (current_date - interval '18 years')::date then
    raise exception 'Anne+ yalnızca 18 yaş ve üzerindeki kullanıcılar içindir.';
  end if;

  if nullif(btrim(assurance_version), '') is null then
    raise exception 'Yaş güvencesi sürümü gerekli.';
  end if;

  insert into public.user_age_assurance (
    user_id,
    birth_date,
    is_over_18_confirmed,
    assurance_version,
    last_context
  )
  values (
    new.id,
    birth_date_value,
    true,
    assurance_version,
    'sign_up'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.capture_signup_age_assurance() is
  'Yeni istemcilerde kayıt yaş güvencesini zorunlu doğrular; metadata göndermeyen eski mağaza buildlerini geçici olarak destekler.';
