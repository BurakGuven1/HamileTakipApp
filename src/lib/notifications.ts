import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

const easProjectId =
  Constants.easConfig?.projectId ??
  (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const notificationType = notification.request.content.data?.type;
    const isWaterReminder = notificationType === "water_reminder";
    const isForegroundManagedAlert =
      notificationType === "care_reminder" ||
      notificationType === "sleep_prediction" ||
      notificationType === "care_alarm";

    return {
      // Bakım alarmı ön plandaysa useCareReminderVoice Türkçe metni okur.
      // Diğer bildirimlerde normal ses ve görünür banner davranışı korunur.
      shouldPlaySound: !isForegroundManagedAlert,
      shouldSetBadge: !isWaterReminder,
      shouldShowBanner: true,
      shouldShowList: true
    };
  }
});

export type PushRegistrationStatus =
  | "registered"
  | "denied"
  | "unavailable";

export async function registerForPushNotifications(
  requestPermission = true
) {
  if (Platform.OS === "web") {
    return null;
  }

  await ensureNotificationChannels();

  const existingPermission = await Notifications.getPermissionsAsync();
  const finalPermission =
    existingPermission.status === "granted" || !requestPermission
      ? existingPermission
      : await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true
          }
        });

  if (finalPermission.status !== "granted") {
    return null;
  }

  if (!easProjectId) {
    throw new Error(
      "EAS projectId bulunamadı; Expo push token üretilemedi."
    );
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: easProjectId
  });

  return token.data;
}

export async function getPushRegistrationStatus(): Promise<PushRegistrationStatus> {
  if (Platform.OS === "web") return "unavailable";

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return "denied";

  return "registered";
}

export async function ensureNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync("care-reminders", {
      name: "Bakım alarmları",
      description:
        "Beslenme, uyku, bez ve bakım için kurduğunuz zamanlı alarmlar.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "baby_reminder.wav",
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#6E8F7C"
    }),
    Notifications.setNotificationChannelAsync("shift-summaries", {
      name: "Gece vardiyası özetleri",
      description: "Vardiya bittiğinde diğer ebeveyne gönderilen otomatik teslim özeti.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lightColor: "#6E8F7C"
    }),
    Notifications.setNotificationChannelAsync("vaccines", {
      name: "Aşı hatırlatmaları",
      description:
        "Bebek ve gebelik aşılarının önceki gün ve uygulama günü hatırlatmaları.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 280, 160, 280],
      lightColor: "#C98A93"
    }),
    Notifications.setNotificationChannelAsync("daily-support", {
      name: "Günlük destek",
      description:
        "Gebelik haftanıza veya doğum sonrası döneminize uygun nazik öneriler.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lightColor: "#E3B873"
    }),
    Notifications.setNotificationChannelAsync("hydration-reminders", {
      name: "Su hatırlatmaları",
      description:
        "Kullanıcı tarafından açılan, gün içine yayılan nazik su içme hatırlatmaları.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lightColor: "#6B96C7"
    }),
    Notifications.setNotificationChannelAsync("sleep-insights", {
      name: "Uyku tahminleri",
      description:
        "Kayıt örüntüsüne göre yaklaşan uyku penceresi bildirimleri.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "baby_reminder.wav",
      vibrationPattern: [0, 220, 160, 220],
      lightColor: "#6E8F7C"
    }),
    Notifications.setNotificationChannelAsync("care-safety", {
      name: "İlaç ve vitamin güvenliği",
      description:
        "Ailede başka bir bakıcı doz kaydettiğinde gelen güvenlik uyarıları.",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      lightColor: "#C98A93"
    }),
    Notifications.setNotificationChannelAsync("development-insights", {
      name: "Gelişim dönemi notları",
      description:
        "Bebeğin yaşına göre empatik gelişim dönemi hatırlatmaları.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lightColor: "#E3B873"
    }),
    Notifications.setNotificationChannelAsync("milk-inventory", {
      name: "Anne sütü stoğu",
      description:
        "Yaklaşan süt son kullanım ve çözdürme süresi hatırlatmaları.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 220, 160, 220],
      lightColor: "#6E8F7C"
    })
  ]);
}

// Bakım hatırlatıcılarının mevcut çağrı noktaları için geriye uyumlu ad.
export const ensureCareReminderChannel = ensureNotificationChannels;

export async function savePushTokenForCurrentUser(expoPushToken: string) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const deviceType =
    Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

  // expo_push_token cihaz/uygulama kurulumu için benzersizdir. Aynı telefonda
  // hesap değişirse token yeni kullanıcıya taşınır ve eski hesaba push gitmez.
  const { data, error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        expo_push_token: expoPushToken,
        device_type: deviceType,
        project_id: easProjectId ?? null,
        enabled: true,
        disabled_at: null,
        last_error: null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "expo_push_token" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function registerAndSavePushToken(requestPermission = true) {
  const token = await registerForPushNotifications(requestPermission);
  if (!token) return null;
  return savePushTokenForCurrentUser(token);
}

export async function unregisterPushTokenForCurrentUser() {
  if (Platform.OS === "web") return;

  const token = await registerForPushNotifications(false).catch(() => null);
  if (!token) return;

  const { error } = await supabase
    .from("push_tokens")
    .update({
      enabled: false,
      disabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("expo_push_token", token);

  if (error) throw error;
}

export function clearAppNotificationBadge() {
  if (Platform.OS === "web" || AppState.currentState !== "active") return;
  Notifications.setBadgeCountAsync(0).catch(() => undefined);
}
