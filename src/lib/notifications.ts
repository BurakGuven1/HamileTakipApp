import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
