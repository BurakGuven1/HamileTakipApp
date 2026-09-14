import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Bildirim kategorileri banner üzerinde eylem düğmelerini açar. iOS'ta bir
 * kategori, bildirimi zamanlamadan ÖNCE kayıtlı olmak zorundadır; sonradan
 * kaydedilen kategori zaten teslim edilmiş bildirimlere düğme eklemez.
 * Bu yüzden kayıt uygulama açılışında (useNotificationNavigation) bir kez
 * yapılır ve idempotenttir.
 */
export const NOTIFICATION_CATEGORIES = {
  /** Gece vardiyası alarmı. Kimlik src/features/care-journal/reminders.ts ile aynı olmalı. */
  careAlarm: "CARE_ALARM",
  /** "Emzirme zamanı" tipi planlı bakım hatırlatması. */
  feedingReminder: "FEEDING_REMINDER",
  /** Aşı günü / öncesi hatırlatması. */
  vaccineReminder: "VACCINE_REMINDER"
} as const;

export const NOTIFICATION_ACTIONS = {
  careAlarmSnooze: "CARE_ALARM_SNOOZE",
  careAlarmDismiss: "CARE_ALARM_DISMISS",
  feedingStart: "FEEDING_START",
  feedingSnooze: "FEEDING_SNOOZE_10",
  vaccineDetail: "VACCINE_DETAIL",
  vaccineDone: "VACCINE_DONE"
} as const;

/** "10 dk ertele" eyleminin dakika değeri; tek yerde tutulur. */
export const FEEDING_SNOOZE_MINUTES = 10;

let registration: Promise<void> | null = null;

/**
 * Tüm kategorileri kaydeder. Birden fazla çağrı tek bir işe düşer; hata
 * yutulur çünkü kategori kaydı başarısız olsa bile bildirimin kendisi
 * (düğmesiz olarak) teslim edilmeye devam eder.
 */
export function ensureNotificationCategories() {
  if (Platform.OS === "web") return Promise.resolve();
  if (!registration) {
    registration = registerCategories().catch((error) => {
      // Bir sonraki çağrının yeniden denemesi için hatırayı temizle.
      registration = null;
      console.warn("Bildirim kategorileri kaydedilemedi", error);
    });
  }
  return registration;
}

async function registerCategories() {
  await Promise.all([
    Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORIES.careAlarm,
      [
        {
          identifier: NOTIFICATION_ACTIONS.careAlarmSnooze,
          buttonTitle: "Ertele",
          options: { opensAppToForeground: false }
        },
        {
          identifier: NOTIFICATION_ACTIONS.careAlarmDismiss,
          buttonTitle: "Kapat",
          options: { isDestructive: true, opensAppToForeground: false }
        }
      ]
    ),
    Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORIES.feedingReminder,
      [
        {
          identifier: NOTIFICATION_ACTIONS.feedingStart,
          buttonTitle: "Başlat",
          // Sayaç uygulama içinde başlar; bu eylem uygulamayı öne getirir.
          options: { opensAppToForeground: true }
        },
        {
          identifier: NOTIFICATION_ACTIONS.feedingSnooze,
          buttonTitle: `${FEEDING_SNOOZE_MINUTES} dk ertele`,
          // Ertelemek için ekran açmaya gerek yok: tek ihtiyaç yeni bir
          // zamanlama, bu da arka planda yapılabilir.
          options: { opensAppToForeground: false }
        }
      ]
    ),
    Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORIES.vaccineReminder,
      [
        {
          identifier: NOTIFICATION_ACTIONS.vaccineDetail,
          buttonTitle: "Detay",
          options: { opensAppToForeground: true }
        },
        {
          identifier: NOTIFICATION_ACTIONS.vaccineDone,
          buttonTitle: "Yapıldı",
          options: { opensAppToForeground: true }
        }
      ]
    )
  ]);
}
