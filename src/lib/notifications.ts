import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerForPushNotifications() {
  if (Platform.OS === "web") {
    return null;
  }

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
