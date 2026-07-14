-- Shared birth bag and birth plan checklist for the active family profile.

create table if not exists public.birth_preparation_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bag', 'plan')),
  category text not null check (char_length(trim(category)) between 2 and 40),
  template_key text,
  title text not null check (char_length(trim(title)) between 2 and 140),
  description text,
  is_custom boolean not null default false,
  is_completed boolean not null default false,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamptz,
  created_by uuid not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_completed and completed_at is not null and completed_by is not null)
    or
    (not is_completed and completed_at is null and completed_by is null)
  )
);

create unique index if not exists idx_birth_preparation_default_item
  on public.birth_preparation_items (profile_id, template_key)
  where template_key is not null;

create index if not exists idx_birth_preparation_profile_kind_order
  on public.birth_preparation_items (profile_id, kind, sort_order, created_at);

comment on table public.birth_preparation_items is
  'Shared birth bag and birth plan checklist items for mother and linked father.';

drop trigger if exists set_birth_preparation_items_updated_at
  on public.birth_preparation_items;
create trigger set_birth_preparation_items_updated_at
  before update on public.birth_preparation_items
  for each row execute function public.set_updated_at();

alter table public.birth_preparation_items enable row level security;

drop policy if exists "birth_preparation_items_select_family"
  on public.birth_preparation_items;
create policy "birth_preparation_items_select_family"
  on public.birth_preparation_items for select
  using (public.can_access_profile(profile_id));

drop policy if exists "birth_preparation_items_insert_family_custom"
  on public.birth_preparation_items;
create policy "birth_preparation_items_insert_family_custom"
  on public.birth_preparation_items for insert
  with check (
    public.can_access_profile(profile_id)
    and created_by = auth.uid()
    and is_custom = true
    and template_key is null
    and is_completed = false
  );

drop policy if exists "birth_preparation_items_delete_family_custom"
  on public.birth_preparation_items;
create policy "birth_preparation_items_delete_family_custom"
  on public.birth_preparation_items for delete
  using (
    public.can_access_profile(profile_id)
    and is_custom = true
  );

grant select, insert, delete on public.birth_preparation_items to authenticated;
revoke update on public.birth_preparation_items from authenticated, anon;
revoke all on public.birth_preparation_items from anon;

create or replace function public.ensure_birth_preparation_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_user_id uuid := auth.uid();
begin
  if v_profile_id is null or v_user_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  if not public.can_access_profile(v_profile_id) then
    raise exception 'Bu hazırlık listesine erişimin yok.';
  end if;

  insert into public.birth_preparation_items (
    profile_id,
    kind,
    category,
    template_key,
    title,
    description,
    is_custom,
    created_by,
    sort_order
  )
  values
    (v_profile_id, 'bag', 'Anne', 'bag_mother_nightwear', 'Rahat gecelik veya pijama', null, false, v_user_id, 10),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_slippers', 'Terlik ve kaymaz çorap', null, false, v_user_id, 20),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_underwear', 'Rahat iç çamaşırı', null, false, v_user_id, 30),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_hygiene', 'Doğum sonrası hijyen ürünleri', 'Hastanenin sağladıklarını önceden sorabilirsin.', false, v_user_id, 40),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_nursing', 'Emzirme sütyeni ve göğüs pedi', null, false, v_user_id, 50),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_toiletries', 'Kişisel bakım malzemeleri', 'Diş fırçası, toka ve dudak nemlendiricisi gibi küçük ihtiyaçlar.', false, v_user_id, 60),
    (v_profile_id, 'bag', 'Anne', 'bag_mother_home_clothes', 'Eve dönüş kıyafeti', null, false, v_user_id, 70),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_clothes', 'Zıbın ve tulum seti', null, false, v_user_id, 110),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_diapers', 'Yenidoğan bezi ve ıslak pamuk', 'Hastanenin sağladıklarını önceden kontrol et.', false, v_user_id, 120),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_blanket', 'İnce battaniye veya kundak', null, false, v_user_id, 130),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_hat', 'Şapka, çorap ve eldiven', null, false, v_user_id, 140),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_exit', 'Hastane çıkış kıyafeti', null, false, v_user_id, 150),
    (v_profile_id, 'bag', 'Bebek', 'bag_baby_car_seat', 'Oto koltuğu hazır', 'Araca önceden ve üretici talimatına uygun yerleştir.', false, v_user_id, 160),
    (v_profile_id, 'bag', 'Belgeler', 'bag_docs_ids', 'Anne ve refakatçi kimlikleri', null, false, v_user_id, 210),
    (v_profile_id, 'bag', 'Belgeler', 'bag_docs_pregnancy', 'Gebelik takip dosyası ve tetkikler', null, false, v_user_id, 220),
    (v_profile_id, 'bag', 'Belgeler', 'bag_docs_hospital', 'Hastane ve sigorta evrakları', null, false, v_user_id, 230),
    (v_profile_id, 'bag', 'Refakatçi', 'bag_companion_charger', 'Telefon şarjı ve powerbank', null, false, v_user_id, 310),
    (v_profile_id, 'bag', 'Refakatçi', 'bag_companion_clothes', 'Yedek kıyafet ve temel bakım malzemesi', null, false, v_user_id, 320),
    (v_profile_id, 'bag', 'Refakatçi', 'bag_companion_snack', 'Su ve dayanıklı atıştırmalık', 'Hastane kurallarını ve annenin doğum planını dikkate al.', false, v_user_id, 330),
    (v_profile_id, 'bag', 'Refakatçi', 'bag_companion_payment', 'Kart, nakit ve ulaşım planı', null, false, v_user_id, 340),
    (v_profile_id, 'plan', 'Lojistik', 'plan_hospital', 'Doğum yapılacak hastane netleşti', null, false, v_user_id, 410),
    (v_profile_id, 'plan', 'Lojistik', 'plan_route', 'Hastaneye gidiş ve alternatif rota hazır', null, false, v_user_id, 420),
    (v_profile_id, 'plan', 'Lojistik', 'plan_contacts', 'Aranacak kişiler listesi hazır', null, false, v_user_id, 430),
    (v_profile_id, 'plan', 'Lojistik', 'plan_companion', 'Doğum refakatçisi netleşti', null, false, v_user_id, 440),
    (v_profile_id, 'plan', 'Sağlık ekibi', 'plan_when_to_go', 'Hastaneye ne zaman gidileceği konuşuldu', 'Kişisel belirtiler ve hastanenin yönlendirmesi sağlık ekibiyle netleştirilmeli.', false, v_user_id, 510),
    (v_profile_id, 'plan', 'Sağlık ekibi', 'plan_preferences_shared', 'Doğum tercihleri doktor veya ebeyle paylaşıldı', null, false, v_user_id, 520),
    (v_profile_id, 'plan', 'Sağlık ekibi', 'plan_flexibility', 'Beklenmedik durumlarda planın değişebileceği konuşuldu', null, false, v_user_id, 530),
    (v_profile_id, 'plan', 'İlk saatler', 'plan_skin_to_skin', 'Ten tene temas tercihi konuşuldu', 'Tıbben mümkün olan seçenekleri sağlık ekibiyle değerlendirin.', false, v_user_id, 610),
    (v_profile_id, 'plan', 'İlk saatler', 'plan_cord', 'Göbek kordonu tercihi konuşuldu', 'Uygunluk ve zamanlama sağlık ekibinin değerlendirmesine bağlıdır.', false, v_user_id, 620),
    (v_profile_id, 'plan', 'İlk saatler', 'plan_feeding', 'Bebek beslenmesi desteği tercihi konuşuldu', null, false, v_user_id, 630),
    (v_profile_id, 'plan', 'İlk saatler', 'plan_photos', 'Fotoğraf ve ziyaretçi sınırları konuşuldu', null, false, v_user_id, 640),
    (v_profile_id, 'plan', 'Ev düzeni', 'plan_home_support', 'İlk günler için ev desteği planlandı', null, false, v_user_id, 710),
    (v_profile_id, 'plan', 'Ev düzeni', 'plan_pediatrician', 'Bebek doktoru ve ilk kontrol bilgisi hazır', null, false, v_user_id, 720),
    (v_profile_id, 'plan', 'Ev düzeni', 'plan_postpartum_contact', 'Anne için doğum sonrası destek kişisi belirlendi', null, false, v_user_id, 730)
  on conflict (profile_id, template_key)
    where template_key is not null
    do nothing;
end;
$$;

revoke all on function public.ensure_birth_preparation_defaults()
  from public, anon;
grant execute on function public.ensure_birth_preparation_defaults()
  to authenticated;

create or replace function public.set_birth_preparation_item_completed(
  p_item_id uuid,
  p_completed boolean
)
returns public.birth_preparation_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.birth_preparation_items;
  v_profile public.profiles;
  v_caregiver_name text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.';
  end if;

  select * into v_item
  from public.birth_preparation_items
  where id = p_item_id
  for update;

  if v_item.id is null or not public.can_access_profile(v_item.profile_id) then
    raise exception 'Hazırlık maddesi bulunamadı.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_item.profile_id;

  v_caregiver_name := case
    when public.is_family_father()
      then coalesce(nullif(trim(v_profile.father_name), ''), 'Baba')
    else coalesce(nullif(trim(v_profile.mother_name), ''), nullif(trim(v_profile.display_name), ''), 'Anne')
  end;

  update public.birth_preparation_items
  set
    is_completed = coalesce(p_completed, false),
    completed_by = case when coalesce(p_completed, false) then auth.uid() else null end,
    completed_by_name = case when coalesce(p_completed, false) then v_caregiver_name else null end,
    completed_at = case when coalesce(p_completed, false) then now() else null end
  where id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function public.set_birth_preparation_item_completed(uuid, boolean)
  from public, anon;
grant execute on function public.set_birth_preparation_item_completed(uuid, boolean)
  to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.birth_preparation_items;
exception
  when duplicate_object then null;
end;
$$;
