import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const notificationType = notification.request.content.data?.type;
    const isSpokenCareAlert =
      notificationType === "care_reminder" ||
      notificationType === "sleep_prediction";
    return {
      // Bakım alarmı ön plandaysa useCareReminderVoice Türkçe metni okur.
      // Diğer bildirimlerde ve arka planda normal/custom ses davranışı korunur.
      shouldPlaySound: !isSpokenCareAlert,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    };
  }
});

export async function registerForPushNotifications() {
  if (Platform.OS === "web") {
    return null;
  }

  await ensureCareReminderChannel();

  const existingPermission = await Notifications.getPermissionsAsync();
  const finalPermission =
    existingPermission.status === "granted"
      ? existingPermission
      : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== "granted") {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function ensureCareReminderChannel() {
  if (Platform.OS !== "android") return;
  await Promise.all([
    Notifications.setNotificationChannelAsync("care-reminders", {
      name: "Bakım alarmları",
      description: "Kullanıcının kurduğu beslenme, uyku, bez ve bakım alarmları.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "baby_reminder.wav",
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#6E8F7C"
    }),
    Notifications.setNotificationChannelAsync("sleep-insights", {
      name: "Uyku tahminleri",
      description: "Kayıt örüntüsüne göre yaklaşan uyku penceresi bildirimleri.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "baby_reminder.wav",
      vibrationPattern: [0, 220, 160, 220],
      lightColor: "#6E8F7C"
    }),
    Notifications.setNotificationChannelAsync("care-safety", {
      name: "İlaç ve vitamin güvenliği",
      description: "Ailede başka bir bakıcı doz kaydettiğinde gelen güvenlik uyarıları.",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      lightColor: "#C98A93"
    }),
    Notifications.setNotificationChannelAsync("development-insights", {
      name: "Gelişim dönemi notları",
      description: "Bebeğin yaşına göre empatik gelişim dönemi hatırlatmaları.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lightColor: "#E3B873"
    }),
    Notifications.setNotificationChannelAsync("milk-inventory", {
      name: "Anne sütü stoğu",
      description: "Yaklaşan süt son kullanım ve çözündürme süresi hatırlatmaları.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 220, 160, 220],
      lightColor: "#6E8F7C"
    })
  ]);
}

export async function savePushTokenForCurrentUser(expoPushToken: string) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const deviceType =
    Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

  const { data, error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        expo_push_token: expoPushToken,
        device_type: deviceType,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,expo_push_token" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function registerAndSavePushToken() {
  const token = await registerForPushNotifications();

  if (!token) {
    return null;
  }

  return savePushTokenForCurrentUser(token);
}
