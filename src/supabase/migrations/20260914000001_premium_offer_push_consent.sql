-- ============================================================
-- App Store Review Guideline 4.5.4 — pazarlama push'u için açık onay
-- ============================================================
-- 4.5.4: "Push Notifications should not be used for promotions or direct
-- marketing purposes unless customers have explicitly opted in to receive them
-- via consent language displayed in your app's UI, and you provide a method in
-- your app for a user to opt out from receiving such messages."
--
-- `notify_premium_offers` zaten varsayılan olarak false (migration
-- 20260810000003). Burada eklenen `premium_offer_consent_at`, onayın NE ZAMAN
-- verildiğini kanıtlar ve gönderim yolunda ikinci bir koşul haline gelir:
-- edge fonksiyonu yalnızca "anahtar true VE damga dolu" profillere gönderir.
-- Böylece bayrağı doğrudan SQL'le true'ya çeken bir veri düzeltmesi, yanlışlıkla
-- pazarlama gönderimi açamaz.
--
-- Aynı desen e-posta tarafında 20260821000004 ile kurulmuştu; push tarafı da
-- artık onunla simetrik.

alter table public.profiles
  add column if not exists premium_offer_consent_at timestamptz;

comment on column public.profiles.notify_premium_offers is
  'Explicit, default-off opt-in for promotional/marketing push notifications (App Store Review Guideline 4.5.4). Never set this outside an explicit user action in the app UI.';

comment on column public.profiles.premium_offer_consent_at is
  'Timestamp of the explicit in-app opt-in for marketing push. Cleared when the user opts out. Campaign delivery requires BOTH notify_premium_offers = true and this column being non-null.';

create or replace function public.capture_premium_offer_consent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.notify_premium_offers and not coalesce(old.notify_premium_offers, false) then
    new.premium_offer_consent_at := now();
  elsif not new.notify_premium_offers then
    new.premium_offer_consent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_premium_offer_consent_on_profile on public.profiles;
create trigger capture_premium_offer_consent_on_profile
before update of notify_premium_offers on public.profiles
for each row execute function public.capture_premium_offer_consent();

-- Geriye dönük düzeltme: bu migration'dan önce anahtarı açmış kullanıcılar
-- gerçekten uygulama arayüzünden onay verdiler (tek yazma yolu Ayarlar
-- ekranıydı), ama damgaları yok. Damgayı geriye dönük uydurmak yerine
-- onaylarını GEÇERLİ sayıp damgayı şimdiye kuruyoruz; aksi halde mevcut
-- opt-in'ler sessizce iptal olurdu.
update public.profiles
set premium_offer_consent_at = coalesce(premium_offer_consent_at, now())
where notify_premium_offers;

-- Bayrak açıkken damganın boş kalamayacağını veritabanı seviyesinde garanti et.
alter table public.profiles
  drop constraint if exists profiles_premium_offer_consent_required;
alter table public.profiles
  add constraint profiles_premium_offer_consent_required
  check (not notify_premium_offers or premium_offer_consent_at is not null)
  not valid;

-- Mevcut satırlar yukarıdaki update ile zaten uyumlu.
alter table public.profiles
  validate constraint profiles_premium_offer_consent_required;

create index if not exists idx_profiles_premium_offer_consent
  on public.profiles (premium_offer_consent_at)
  where notify_premium_offers;
