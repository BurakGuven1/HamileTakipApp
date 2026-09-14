import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { ensureNotificationChannels } from "@/lib/notifications";

import { ensureNotificationCategories } from "./categories";

export type NotificationPermissionState =
  /** İzin verildi, bildirim zamanlanabilir. */
  | "granted"
  /** Henüz sorulmadı; sistem istemi bir kez gösterilebilir. */
  | "undetermined"
  /** Reddedildi; sistem istemi bir daha gösterilmez, Ayarlar'a yönlendir. */
  | "blocked"
  /** Web gibi bildirimi olmayan ortam. */
  | "unsupported";

/**
 * Hangi özellik izin istiyor. Metin, izin isteğinin neden o anda çıktığını
 * kullanıcıya açıklayan ön-izin ekranında kullanılır.
 */
export type NotificationPermissionFeature =
  | "care_reminder"
  | "night_shift_alarm"
  | "vaccine_reminder"
  | "water_reminder"
  | "family_task"
  /** Kurulum sırasındaki ön-izin adımı. */
  | "onboarding";

const RATIONALES: Record<
  NotificationPermissionFeature,
  { title: string; body: string }
> = {
  care_reminder: {
    title: "Hatırlatmayı telefonun söylesin",
    body: "Kurduğun bakım hatırlatması yalnızca bildirim izni açıkken zamanında gelir. Anne+ sana yalnızca kendi kurduğun hatırlatmaları gönderir."
  },
  night_shift_alarm: {
    title: "Gece vardiyası alarmı",
    body: "Vardiya alarmının telefon kilitliyken de çalabilmesi için bildirim izni gerekiyor. Uygulamayı açık tutmana gerek kalmaz."
  },
  vaccine_reminder: {
    title: "Aşı gününü kaçırma",
    body: "Aşı gününden bir gün önce ve aşı günü sabahı tek bir hatırlatma göndeririz. Bunun için bildirim izni gerekiyor."
  },
  water_reminder: {
    title: "Su hatırlatmaları",
    body: "Gün içine yayılan nazik su hatırlatmaları için bildirim izni gerekiyor. İstediğin an kapatabilirsin."
  },
  family_task: {
    title: "Aile görevleri",
    body: "Sana atanan görev ve vardiya değişimlerini görebilmen için bildirim izni gerekiyor."
  },
  onboarding: {
    title: "Bildirimleri ne için kullanıyoruz?",
    body: "Anne+ sana yalnızca kendi kurduğun emzirme, uyku ve bakım hatırlatmalarını, yaklaşan aşı günlerini ve çalışan sayacının durumunu gönderir. İstediğin an Ayarlar > Bildirim tercihleri'nden kapatabilirsin."
  }
};

/**
 * Ön-izin ekranında madde madde gösterilen somut örnekler. Metin gerçeği
 * yansıtmak zorundadır: burada yazan her madde uygulamada gerçekten gönderilen
 * bir bildirim tipidir ve hiçbiri pazarlama değildir. Kampanya bildirimi ayrı,
 * varsayılan kapalı bir onaya bağlıdır (bkz. marketingConsent.ts).
 */
export const ONBOARDING_PERMISSION_BULLETS = [
  "Kurduğun emzirme, uyku ve bez hatırlatmaları",
  "Yaklaşan aşı günleri",
  "Çalışan sayacın kilit ekranındaki durumu"
] as const;

/** Ön-izin adımında "Şimdi değil" denince gösterilen açıklama. */
export const PERMISSION_DEFERRED_COPY =
  "Tamam, şimdi sormuyoruz. İlk hatırlatmanı kurduğunda yeniden soracağız.";

/** Sistem istemi bir kez reddedilmişse gösterilen açıklama. */
export const PERMISSION_BLOCKED_COPY =
  "Bildirim izni kapalı görünüyor. iOS bu izni bir kez sorduğu için yeniden açmak ancak telefon ayarlarından mümkün.";

export function getNotificationPermissionRationale(
  feature: NotificationPermissionFeature
) {
  return RATIONALES[feature];
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === "web") return "unsupported";

  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return "granted";
  // canAskAgain false ⇒ sistem istemi bir daha gösterilmez.
  return permission.canAskAgain ? "undetermined" : "blocked";
}

/**
 * İzni SADECE kullanıcı gerçekten bir hatırlatma kurarken iste. Soğuk açılışta
 * sorulan izin hem düşük oranda kabul edilir hem de App Review'da "bağlamsız
 * istem" olarak not edilir.
 *
 * Çağıran taraf bu fonksiyondan önce `getNotificationPermissionRationale()`
 * metnini kendi ekranında göstermelidir; bu fonksiyon yalnızca sistem istemini
 * yönetir ve sonucu normalize eder.
 */
export async function requestNotificationPermissionForFeature(): Promise<NotificationPermissionState> {
  if (Platform.OS === "web") return "unsupported";

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await afterGrant();
    return "granted";
  }
  if (!current.canAskAgain) return "blocked";

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      // Bakım alarmı gerçekten zaman duyarlı olduğu için Time Sensitive
      // teslimi burada isteniyor. Pazarlama bildirimleri bu seviyeyi
      // KULLANMAZ; bkz. src/features/notifications/scheduling.ts.
      allowProvisional: false
    }
  });

  if (requested.granted) {
    await afterGrant();
    return "granted";
  }

  return requested.canAskAgain ? "undetermined" : "blocked";
}

async function afterGrant() {
  await Promise.all([
    ensureNotificationChannels(),
    ensureNotificationCategories()
  ]);
}

/**
 * İzin reddedilmişse tek doğru yol sistem ayarlarıdır: iOS istemi bir daha
 * göstermez. `openSettings()` iOS'ta doğrudan uygulamanın bildirim sayfasını
 * açar.
 */
export async function openNotificationSettings() {
  if (Platform.OS === "web") return false;
  try {
    await Linking.openSettings();
    return true;
  } catch (error) {
    console.warn("Bildirim ayarları açılamadı", error);
    return false;
  }
}
