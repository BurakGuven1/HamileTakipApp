import * as Notifications from "expo-notifications";

import type { CareEntryType } from "@/api/careJournal";
import { ensureCareReminderChannel } from "@/lib/notifications";

export const CARE_ALARM_CATEGORY = "CARE_ALARM";
export const CARE_ALARM_SNOOZE_ACTION = "CARE_ALARM_SNOOZE";
export const CARE_ALARM_DISMISS_ACTION = "CARE_ALARM_DISMISS";

type NightShiftAlarmInput = {
  babyId: string;
  babyName: string;
  entryType: CareEntryType;
  reminderId: string;
  scheduledFor: Date;
  snoozeMinutes: number;
  title?: string;
};

async function ensureAlarmPermission() {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true }
      });
  if (!permission.granted) {
    throw new Error("Alarm kurmak için bildirim izni gerekli.");
  }
  await ensureCareReminderChannel();
  await Notifications.setNotificationCategoryAsync(CARE_ALARM_CATEGORY, [
    {
      identifier: CARE_ALARM_SNOOZE_ACTION,
      buttonTitle: "Ertele"
    },
    {
      identifier: CARE_ALARM_DISMISS_ACTION,
      buttonTitle: "Kapat",
      options: { isDestructive: true }
    }
  ]);
}

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

export async function scheduleNightShiftAlarm({
  babyId,
  babyName,
  entryType,
  reminderId,
  scheduledFor,
  snoozeMinutes,
  title
}: NightShiftAlarmInput) {
  if (scheduledFor.getTime() <= Date.now() + 30_000) {
    throw new Error("Alarm saati en az 1 dakika ileride olmalı.");
  }
  await ensureAlarmPermission();
  const copy = getCareReminderCopy(entryType, babyName);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: title?.trim() || copy.title,
      body: copy.body,
      sound: "baby_reminder.wav",
      interruptionLevel: "timeSensitive",
      categoryIdentifier: CARE_ALARM_CATEGORY,
      data: {
        screen: "night-shift",
        type: "care_alarm",
        entry: entryType,
        baby_id: babyId,
        reminder_id: reminderId,
        snooze_minutes: snoozeMinutes
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledFor,
      channelId: "care-reminders"
    }
  });
}

export async function rescheduleCareAlarmFromNotification(
  notification: Notifications.Notification,
  scheduledFor: Date
) {
  const data = notification.request.content.data;
  const entry = data?.entry;
  if (typeof data?.baby_id !== "string" || typeof data?.reminder_id !== "string") {
    throw new Error("Alarm bilgisi eksik.");
  }
  return scheduleNightShiftAlarm({
    babyId: data.baby_id,
    babyName: "Bebeğin",
    entryType: isCareAlarmEntry(entry) ? entry : "sleep",
    reminderId: data.reminder_id,
    scheduledFor,
    snoozeMinutes: typeof data.snooze_minutes === "number" ? data.snooze_minutes : 10,
    title: notification.request.content.title ?? undefined
  });
}

function isCareAlarmEntry(value: unknown): value is CareEntryType {
  return typeof value === "string" && [
    "breastfeeding", "bottle", "sleep", "diaper", "pumping", "medicine",
    "solid_food", "temperature"
  ].includes(value);
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
