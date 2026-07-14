import * as Notifications from "expo-notifications";

import type { CareEntryType } from "@/api/careJournal";
import { ensureCareReminderChannel } from "@/lib/notifications";

export async function scheduleCareReminderAt(
  entryType: CareEntryType,
  scheduledFor: Date,
  babyName?: string
) {
  if (scheduledFor.getTime() <= Date.now() + 30_000) {
    throw new Error("Alarm saati en az 1 dakika ileride olmalı.");
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Hatırlatıcı için bildirim izni gerekli.");
  }

  await ensureCareReminderChannel();
  const copy = getCareReminderCopy(entryType, babyName);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: "baby_reminder.wav",
      interruptionLevel: "timeSensitive",
      data: {
        screen: "care-journal",
        type: "care_reminder",
        entry: entryType
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledFor,
      channelId: "care-reminders"
    }
  });
}

export async function cancelLocalCareReminder(identifier?: string | null) {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export function getCareReminderCopy(entryType: CareEntryType, babyName?: string) {
  const prefix = babyName?.trim() ? `${babyName.trim()} için ` : "";

  if (entryType === "breastfeeding" || entryType === "bottle") {
    return {
      title: "Hadi anne, karnım acıktı 🍼",
      body: `${prefix}planladığın beslenme hatırlatıcısının zamanı geldi.`
    };
  }
  if (entryType === "sleep") {
    return {
      title: "Anne, uyku zamanımı kontrol eder misin? 🌙",
      body: "Planladığın uyku hatırlatıcısının zamanı geldi."
    };
  }
  if (entryType === "diaper") {
    return {
      title: "Anne, bezimi kontrol eder misin? 👶",
      body: "Planladığın bez kontrolünün zamanı geldi."
    };
  }
  if (entryType === "medicine") {
    return {
      title: "İlaç / vitamin zamanı",
      body: "Yalnızca doktorunun belirlediği planı kontrol et."
    };
  }
  if (entryType === "pumping") {
    return {
      title: "Anne, sağım planını kontrol et 🫶",
      body: "Kurduğun sağım hatırlatıcısının zamanı geldi."
    };
  }
  return {
    title: "Anne, bakım zamanımız geldi 💛",
    body: "Kurduğun bakım hatırlatıcısının zamanı geldi."
  };
}
