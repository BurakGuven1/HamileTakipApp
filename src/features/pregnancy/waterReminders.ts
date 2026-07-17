import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ensureNotificationChannels } from "@/lib/notifications";

const ENABLED_KEY = "water-reminders-enabled-v1";
const IDENTIFIERS_KEY = "water-reminder-identifiers-v1";

export const WATER_REMINDER_TIMES = [
  { hour: 9, minute: 30, label: "09:30" },
  { hour: 12, minute: 30, label: "12:30" },
  { hour: 15, minute: 30, label: "15:30" },
  { hour: 18, minute: 30, label: "18:30" }
] as const;

const reminderCopies = [
  {
    title: "Güne suyla devam 💧",
    body: "Küçük yudumlarla bir bardak su içmek için nazik bir mola."
  },
  {
    title: "Öğle su molası 💧",
    body: "Suyu gün içine yaymak, bir anda çok içmekten daha rahat olabilir."
  },
  {
    title: "Bir bardak su zamanı 💧",
    body: "Susamayı beklemeden birkaç yudum su içmeyi hatırla."
  },
  {
    title: "Akşamdan önce su molası 💧",
    body: "Günün kalanına bir bardak su eklemek ister misin?"
  }
] as const;

export const WATER_REMINDER_TIME_LABEL = WATER_REMINDER_TIMES.map(
  (item) => item.label
).join(" · ");

export async function getWaterRemindersEnabled() {
  if (Platform.OS === "web") return false;
  return (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
}

export async function setWaterRemindersEnabled(enabled: boolean) {
  if (!enabled) {
    await cancelWaterReminders();
    return false;
  }

  if (Platform.OS === "web") {
    throw new Error("Su hatırlatmaları yalnızca mobil uygulamada kullanılabilir.");
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true }
      });

  if (!permission.granted) {
    throw new Error(
      "Su hatırlatmalarını açmak için telefon ayarlarından bildirim izni vermelisiniz."
    );
  }

  await ensureNotificationChannels();
  await cancelScheduledWaterNotifications();

  const identifiers: string[] = [];
  try {
    for (let index = 0; index < WATER_REMINDER_TIMES.length; index += 1) {
      const time = WATER_REMINDER_TIMES[index];
      const copy = reminderCopies[index];
      if (!time || !copy) continue;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.title,
          body: copy.body,
          sound: "default",
          data: {
            screen: "pregnancy-nutrition",
            type: "water_reminder"
          }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
          channelId: "hydration-reminders"
        }
      });
      identifiers.push(identifier);
    }

    await AsyncStorage.multiSet([
      [IDENTIFIERS_KEY, JSON.stringify(identifiers)],
      [ENABLED_KEY, "true"]
    ]);
    return true;
  } catch (error) {
    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier).catch(
          () => undefined
        )
      )
    );
    throw error;
  }
}

export async function cancelWaterReminders() {
  await cancelScheduledWaterNotifications();
  await AsyncStorage.multiSet([
    [IDENTIFIERS_KEY, "[]"],
    [ENABLED_KEY, "false"]
  ]);
}

async function cancelScheduledWaterNotifications() {
  const rawIdentifiers = await AsyncStorage.getItem(IDENTIFIERS_KEY);
  const identifiers = parseIdentifiers(rawIdentifiers);
  await Promise.all(
    identifiers.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(
        () => undefined
      )
    )
  );
}

function parseIdentifiers(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
