import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

import { cancelCareReminder, snoozeCareReminder } from "@/api/careJournal";
import {
  CARE_ALARM_DISMISS_ACTION,
  CARE_ALARM_SNOOZE_ACTION,
  rescheduleCareAlarmFromNotification
} from "@/features/care-journal/reminders";

export function useNotificationNavigation() {
  useEffect(() => {
    async function handleResponse(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data;

      if (data?.type === "care_alarm" && response.actionIdentifier === CARE_ALARM_SNOOZE_ACTION) {
        const reminderId = data.reminder_id;
        const minutes = typeof data.snooze_minutes === "number" ? data.snooze_minutes : 10;
        if (typeof reminderId === "string") {
          const scheduledFor = new Date(Date.now() + minutes * 60_000);
          const localId = await rescheduleCareAlarmFromNotification(response.notification, scheduledFor);
          await snoozeCareReminder(reminderId, scheduledFor.toISOString(), localId);
        }
        return;
      }
      if (data?.type === "care_alarm" && response.actionIdentifier === CARE_ALARM_DISMISS_ACTION) {
        if (typeof data.reminder_id === "string") await cancelCareReminder(data.reminder_id);
        return;
      }
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

      if (data?.screen === "paywall") {
        router.push("/paywall");
      } else if (data?.screen === "article" && typeof data.slug === "string") {
        router.push({ pathname: "/articles/[slug]", params: { slug: data.slug } });
      } else if (data?.screen === "baby-vaccines") {
        router.push({ pathname: "/baby", params: { section: "vaccines" } });
      } else if (data?.screen === "home") {
        router.push("/home");
      } else if (data?.screen === "forum") {
        router.push("/forum");
      } else if (data?.screen === "night-shift") {
        router.push({
          pathname: "/night-shift",
          params: typeof data.baby_id === "string" ? { babyId: data.baby_id } : undefined
        });
      } else if (data?.screen === "care-journal") {
        router.push({
          pathname: "/care-journal",
          params: typeof data.entry === "string" ? { entry: data.entry } : undefined
        });
      } else if (data?.screen === "pregnancy-nutrition") {
        router.push("/pregnancy-nutrition");
      }
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          void handleResponse(response);
          Notifications.clearLastNotificationResponseAsync().catch(
            () => undefined
          );
        }
      })
      .catch(() => undefined);

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response).catch(() => undefined);
      });

    return () => subscription.remove();
  }, []);
}
