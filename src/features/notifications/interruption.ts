/**
 * iOS'ta Time Sensitive teslimi Odak (Focus) modunu deler. App Review bunu
 * özellikle kontrol eder: yalnızca kullanıcının kendi kurduğu, kaçırıldığında
 * gerçekten sonucu olan bildirimler bu seviyeyi kullanabilir. Pazarlama,
 * kampanya, içerik önerisi ve "seni özledik" bildirimleri ASLA.
 *
 * Liste burada, saf bir modülde tutulur ki hem uygulama hem test tarafı
 * (expo-notifications'ı yüklemeden) aynı kuralı okuyabilsin.
 */
const TIME_SENSITIVE_TYPES = new Set([
  "care_alarm",
  "care_reminder",
  "sleep_prediction",
  "vaccine_reminder",
  "family_task"
]);

export function resolveInterruptionLevel(
  notificationType: string | null | undefined
): "active" | "timeSensitive" {
  return notificationType && TIME_SENSITIVE_TYPES.has(notificationType)
    ? "timeSensitive"
    : "active";
}

export function isTimeSensitiveNotificationType(
  notificationType: string | null | undefined
): boolean {
  return resolveInterruptionLevel(notificationType) === "timeSensitive";
}
