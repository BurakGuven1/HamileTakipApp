/**
 * App Store Review Guideline 4.5.4:
 *
 *   "Push Notifications ... should not be used for promotions or direct
 *    marketing purposes unless customers have explicitly opted in to receive
 *    them via consent language displayed in your app's UI, and you provide a
 *    method in your app for a user to opt out from receiving such messages."
 *
 * Bu dosya o maddenin TEK doğruluk kaynağıdır. Pazarlama/kampanya push'u
 * gönderen her yol (şu an yalnızca `send-seasonal-premium-campaigns` edge
 * fonksiyonu) buradan geçmek zorundadır. Saf TypeScript'tir: React Native
 * tarafında da, Deno edge runtime'ında da aynı kod çalışır, böylece istemci
 * ile sunucu arasında kural farkı oluşamaz.
 *
 * Kuralın iki ayağı var ve İKİSİ birden aranır:
 *  1. `notify_premium_offers` açıkça true — varsayılanı false (migration
 *     20260810000003) ve yalnızca kullanıcı Ayarlar'daki anahtarı kendisi
 *     açarsa true olur.
 *  2. `premium_offer_consent_at` dolu — anahtar açıldığı anda veritabanı
 *     trigger'ı (migration 20260914000001) tarih damgalar. Bu, "onay ne zaman
 *     alındı" sorusuna reviewer'a ve KVKK/GDPR'a karşı kanıt üretir ve
 *     anahtarı doğrudan SQL ile true'ya çeken bir hatanın pazarlama gönderimi
 *     açmasını engeller.
 */

export type MarketingConsentSnapshot = {
  notify_premium_offers?: boolean | null;
  premium_offer_consent_at?: string | null;
};

/** Ayarlar ekranında gösterilen açık onay metni (4.5.4'ün "consent language"ı). */
export const MARKETING_CONSENT_COPY = {
  label: "Ürün ve kampanya duyuruları",
  description:
    "Anne+ Premium kampanyaları ve yeni özellik duyuruları için bildirim almayı kabul ediyorum. Varsayılan olarak kapalıdır, hatırlatmalarını etkilemez ve istediğin an buradan kapatabilirsin.",
  enabled: "Kampanya bildirimlerine izin verdin. İstediğin an buradan kapatabilirsin.",
  disabled: "Kampanya bildirimi almayacaksın. Kurduğun hatırlatmalar etkilenmez."
} as const;

/**
 * Pazarlama/kampanya push'u gönderilebilir mi? Eksik, null ya da tanınmayan
 * her girdi için `false` döner — belirsizlik durumunda gönderme.
 */
export function isMarketingPushAllowed(
  profile: MarketingConsentSnapshot | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.notify_premium_offers !== true) return false;

  const consentAt = profile.premium_offer_consent_at;
  if (typeof consentAt !== "string" || consentAt.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Date.parse(consentAt));
}

/**
 * Gönderim yolunda son savunma. Filtreler atlanırsa sessizce yanlış bildirim
 * gitmesindense gönderim patlasın.
 */
export function assertMarketingPushAllowed(
  profile: MarketingConsentSnapshot | null | undefined
): void {
  if (!isMarketingPushAllowed(profile)) {
    throw new Error(
      "Pazarlama bildirimi engellendi: açık onay (notify_premium_offers + premium_offer_consent_at) yok. App Store Review Guideline 4.5.4."
    );
  }
}

/**
 * Bir bildirim tipinin pazarlama sayılıp sayılmadığı. `resolveInterruptionLevel`
 * ile birlikte okunur: pazarlama tipleri ASLA Time Sensitive olamaz.
 */
export const MARKETING_NOTIFICATION_TYPES: readonly string[] = [
  "premium_campaign",
  "premium_offer",
  "product_announcement"
];

export function isMarketingNotificationType(
  notificationType: string | null | undefined
): boolean {
  return (
    typeof notificationType === "string" &&
    MARKETING_NOTIFICATION_TYPES.includes(notificationType)
  );
}
