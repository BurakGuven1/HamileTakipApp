-- ============================================================
-- Yaş güvencesi: kayıt doğum tarihi + her oturumda 18+ beyanı
-- ============================================================

create table if not exists public.user_age_assurance (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  birth_date          date,
  is_over_18_confirmed boolean not null default true
    check (is_over_18_confirmed),
  assurance_version   text not null,
  last_context        text not null
    check (last_context in ('sign_up', 'sign_in', 'family_code')),
  first_assured_at    timestamptz not null default now(),
  last_assured_at     timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.user_age_assurance is
  'Kullanıcının doğum tarihini ve en son zorunlu 18+ öz beyanını kullanıcı bazında saklar.';
comment on column public.user_age_assurance.birth_date is
  'Yalnızca normal hesap kaydında alınır; aile koduyla bağlanan kullanıcılar için boş olabilir.';

alter table public.user_age_assurance enable row level security;

drop policy if exists "user_age_assurance_select_own"
  on public.user_age_assurance;
create policy "user_age_assurance_select_own"
  on public.user_age_assurance for select
  using (auth.uid() = user_id);

create or replace function public.record_age_assurance(
  p_context text,
  p_is_over_18 boolean,
  p_version text,
  p_birth_date date default null
)
returns public.user_age_assurance
language plpgsql
security definer
set search_path = ''
as $$
declare
  assurance public.user_age_assurance;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.';
  end if;

  if p_context not in ('sign_up', 'sign_in', 'family_code') then
    raise exception 'Geçersiz yaş güvencesi bağlamı.';
  end if;

  if p_is_over_18 is distinct from true then
    raise exception 'Devam etmek için 18 yaşından büyük olunduğu onaylanmalı.';
  end if;

  if nullif(btrim(p_version), '') is null then
    raise exception 'Yaş güvencesi sürümü gerekli.';
  end if;

  if p_context = 'sign_up' and p_birth_date is null then
    raise exception 'Kayıt için doğum tarihi gerekli.';
  end if;

  if p_birth_date is not null
     and p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'Anne+ yalnızca 18 yaş ve üzerindeki kullanıcılar içindir.';
  end if;

  insert into public.user_age_assurance (
    user_id,
    birth_date,
    is_over_18_confirmed,
    assurance_version,
    last_context,
    first_assured_at,
    last_assured_at,
    updated_at
  )
  values (
    auth.uid(),
    p_birth_date,
    true,
    p_version,
    p_context,
    now(),
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    birth_date = coalesce(
      public.user_age_assurance.birth_date,
      excluded.birth_date
    ),
    is_over_18_confirmed = true,
    assurance_version = excluded.assurance_version,
    last_context = excluded.last_context,
    last_assured_at = now(),
    updated_at = now()
  returning * into assurance;

  return assurance;
end;
$$;

revoke all on function public.record_age_assurance(text, boolean, text, date)
  from public;
grant execute on function public.record_age_assurance(text, boolean, text, date)
  to authenticated;

create or replace function public.capture_signup_age_assurance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  birth_date_text text;
  birth_date_value date;
  confirmed boolean;
  assurance_version text;
begin
  -- Aile kodu Edge Function'ı ayrı bir 18+ beyanını giriş ekranında alır.
  if coalesce(new.is_anonymous, false)
     or new.raw_user_meta_data->>'role' = 'father'
     or new.email like 'father-%@family-login.anneplus.local' then
    return new;
  end if;

  birth_date_text := new.raw_user_meta_data->>'birth_date';
  assurance_version := new.raw_user_meta_data->>'age_assurance_version';
  confirmed := coalesce(
    (new.raw_user_meta_data->>'age_over_18_confirmed')::boolean,
    false
  );

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

drop trigger if exists on_auth_user_age_assurance on auth.users;
create trigger on_auth_user_age_assurance
  after insert on auth.users
  for each row execute function public.capture_signup_age_assurance();

comment on function public.capture_signup_age_assurance() is
  'Yeni normal hesaplarda doğum tarihi ve 18+ onayını sunucu tarafında zorunlu kılar ve kaydeder.';
