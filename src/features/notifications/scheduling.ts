import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ensureNotificationCategories } from "./categories";
import { resolveInterruptionLevel } from "./interruption";

// Time Sensitive kuralı saf `./interruption` modülünde yaşar; buradan yalnızca
// yeniden dışa aktarılır ki mevcut çağrı noktaları değişmesin.
export { resolveInterruptionLevel } from "./interruption";

/**
 * iOS bir uygulama için en fazla 64 BEKLEYEN yerel bildirim tutar. Sınır
 * aşıldığında iOS hata vermez: en uzak tarihli olanları sessizce atar. Bu
 * yüzden planlama "rolling" yapılır — yalnızca yakın ufuk zamanlanır, geri
 * kalanı uygulama her açıldığında yeniden doldurulur.
 */
export const IOS_PENDING_NOTIFICATION_LIMIT = 64;

/**
 * Sınırın tamamını doldurmuyoruz: kullanıcı her an elle bir bakım alarmı
 * kurabilir ve o alarmın kesinlikle yer bulması gerekir.
 */
export const PENDING_NOTIFICATION_BUDGET = 56;

/** Rolling planlamada ileriye doğru zamanlanan en uzun süre. */
export const ROLLING_HORIZON_DAYS = 30;

export async function getPendingNotificationCount() {
  if (Platform.OS === "web") return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}

/**
 * `needed` kadar yeni bildirim için yer açar. Yer yoksa EN UZAK tarihli tek
 * seferlik bildirimler iptal edilir — onlar zaten rolling planlamanın bir
 * sonraki turunda yeniden kurulacak olanlardır. Tekrarlayan (günlük/haftalık)
 * tetikleyiciler hiçbir zaman budanmaz; onlar tek slot tutar ve sonsuza kadar
 * çalışır.
 *
 * @returns Açılabilen slot sayısı.
 */
export async function ensureSchedulingHeadroom(needed: number) {
  if (Platform.OS === "web" || needed <= 0) return needed;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const overflow = pending.length + needed - PENDING_NOTIFICATION_BUDGET;
  if (overflow <= 0) return needed;

  const prunable = pending
    .map((request) => ({
      identifier: request.identifier,
      date: oneOffTriggerDate(request.trigger)
    }))
    .filter(
      (entry): entry is { identifier: string; date: number } =>
        entry.date !== null
    )
    .sort((a, b) => b.date - a.date)
    .slice(0, overflow);

  await Promise.all(
    prunable.map((entry) =>
      Notifications.cancelScheduledNotificationAsync(entry.identifier).catch(
        () => undefined
      )
    )
  );

  return Math.max(0, needed - (overflow - prunable.length));
}

/**
 * Tek giriş noktası: kategori kaydı, bütçe kontrolü ve doğru interruption
 * level'ı bir arada uygular. Bütçe açılamazsa bildirim zamanlanmaz ve `null`
 * döner; sessizce düşen bir bildirim yerine çağıran tarafın bunu bilmesi
 * gerekir.
 */
export async function scheduleManagedNotification(
  request: Notifications.NotificationRequestInput
) {
  if (Platform.OS === "web") return null;

  await ensureNotificationCategories();
  const granted = await ensureSchedulingHeadroom(1);
  if (granted < 1) return null;

  const notificationType =
    typeof request.content.data?.type === "string"
      ? request.content.data.type
      : null;

  return Notifications.scheduleNotificationAsync({
    ...request,
    content: {
      ...request.content,
      interruptionLevel:
        request.content.interruptionLevel ??
        resolveInterruptionLevel(notificationType)
    }
  });
}

/**
 * Rolling planlama: aynı `groupKey`'e ait eski bildirimleri iptal edip
 * ufuk içindeki tarihleri yeniden kurar. Uygulama her öne geldiğinde
 * çağrılabilir; aynı sonucu üretir (idempotent).
 */
export async function rescheduleNotificationSeries({
  groupKey,
  occurrences,
  build
}: {
  groupKey: string;
  occurrences: Date[];
  build: (date: Date) => Notifications.NotificationContentInput;
}) {
  if (Platform.OS === "web") return [];

  await cancelNotificationSeries(groupKey);

  const horizon = Date.now() + ROLLING_HORIZON_DAYS * 86_400_000;
  const upcoming = occurrences
    .filter((date) => {
      const time = date.getTime();
      return Number.isFinite(time) && time > Date.now() + 60_000 && time <= horizon;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  const identifiers: string[] = [];
  for (const date of upcoming) {
    const content = build(date);
    const identifier = await scheduleManagedNotification({
      content: {
        ...content,
        data: { ...content.data, notification_group: groupKey }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date
      }
    });
    // Bütçe doldu: kalanlar bir sonraki açılışta kurulacak.
    if (!identifier) break;
    identifiers.push(identifier);
  }

  return identifiers;
}

export async function cancelNotificationSeries(groupKey: string) {
  if (Platform.OS === "web") return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter(
        (request) =>
          request.content.data?.notification_group === groupKey
      )
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(
          request.identifier
        ).catch(() => undefined)
      )
  );
}

function oneOffTriggerDate(
  trigger: Notifications.NotificationTrigger | null
): number | null {
  if (!trigger) return null;
  // expo-notifications'ın birleşim tipi her varyantta `type`/`value` taşımaz,
  // bu yüzden daraltma alan kontrolüyle yapılır.
  const candidate = trigger as { type?: string; value?: unknown };
  if (candidate.type !== Notifications.SchedulableTriggerInputTypes.DATE) {
    // Takvim/aralık tetikleyicileri tekrar eder; tek slot tutarlar ve budanmaz.
    return null;
  }
  const value = candidate.value;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return null;
}
