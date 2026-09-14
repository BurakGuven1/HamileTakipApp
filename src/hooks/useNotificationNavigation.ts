import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { cancelCareReminder, snoozeCareReminder } from "@/api/careJournal";
import { reconcileCareTimerLiveActivity } from "@/features/care-journal/careTimerLiveActivity";
import { reconcileNightShiftLiveActivity } from "@/features/care-journal/nightShiftLiveActivity";
import {
  CARE_ALARM_DISMISS_ACTION,
  CARE_ALARM_SNOOZE_ACTION,
  rescheduleCareAlarmFromNotification
} from "@/features/care-journal/reminders";
import {
  ensureNotificationCategories,
  FEEDING_SNOOZE_MINUTES,
  NOTIFICATION_ACTIONS
} from "@/features/notifications/categories";
import { trackEvent } from "@/lib/analytics";

/**
 * Bildirim eylemleri ve kilit ekranı kartlarının bakımı, uygulama ağacının
 * kökünde bir kez kurulmalıdır. Bu hook AppProviders içinde mount edildiği
 * için hem bildirim yanıtlarının hem de Live Activity uzlaştırmasının doğal
 * yeri burasıdır; ayrı bir ekranın bunları hatırlaması gerekmez.
 */
export function useNotificationNavigation() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Kategoriler bildirimden ÖNCE kayıtlı olmalı: iOS zaten teslim edilmiş
    // bir bildirime sonradan düğme eklemez.
    void ensureNotificationCategories();

    function reconcileLiveActivities() {
      void reconcileCareTimerLiveActivity();
      void reconcileNightShiftLiveActivity();
    }

    reconcileLiveActivities();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcileLiveActivities();
    });

    return () => subscription.remove();
  }, []);

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
      // "Emzirme zamanı" bildirimi: 10 dk ertele. Uygulamayı öne getirmeden
      // yalnızca yeni bir tarih tetikleyicisi kurulur.
      if (response.actionIdentifier === NOTIFICATION_ACTIONS.feedingSnooze) {
        const content = response.notification.request.content;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: content.title ?? "Beslenme vakti",
            body: content.body ?? "Ertelediğin beslenme hatırlatması.",
            sound: content.sound ?? "baby_reminder.wav",
            interruptionLevel: "timeSensitive",
            categoryIdentifier: content.categoryIdentifier ?? undefined,
            data: { ...data, snoozed_from: Date.now() }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(Date.now() + FEEDING_SNOOZE_MINUTES * 60_000),
            channelId: "care-reminders"
          }
        }).catch(() => undefined);
        return;
      }

      // "Başlat" ve aşı eylemleri uygulamayı öne getirir; aşağıdaki derin
      // bağlantı akışının aynısını kullanırlar, yalnızca hedef ekranın
      // parametresi eylemin niyetini taşır.
      const isForegroundAction =
        response.actionIdentifier === NOTIFICATION_ACTIONS.feedingStart ||
        response.actionIdentifier === NOTIFICATION_ACTIONS.vaccineDetail ||
        response.actionIdentifier === NOTIFICATION_ACTIONS.vaccineDone;

      if (
        response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
        !isForegroundAction
      ) {
        return;
      }

      if (response.actionIdentifier === NOTIFICATION_ACTIONS.feedingStart) {
        router.push({
          pathname: "/care-journal",
          params: {
            entry: typeof data?.entry === "string" ? data.entry : "breastfeeding",
            // Bakım günlüğü ekranı bu parametreyi okumuyorsa bile bağlantı
            // doğru sekmeyi açar; ekran desteklediğinde sayaç doğrudan başlar.
            autostart: "1"
          }
        });
        return;
      }

      if (
        response.actionIdentifier === NOTIFICATION_ACTIONS.vaccineDetail ||
        response.actionIdentifier === NOTIFICATION_ACTIONS.vaccineDone
      ) {
        router.push("/vaccines");
        return;
      }


      void trackEvent("notification_opened", {
        campaign_key:
          typeof data?.campaign_key === "string" ? data.campaign_key : null,
        destination:
          typeof data?.screen === "string" ? data.screen : "unknown",
        notification_type:
          typeof data?.type === "string" ? data.type : "unknown"
      });

      if (data?.screen === "paywall") {
        router.push({
          pathname: "/paywall",
          params: {
            source:
              data.type === "premium_campaign"
                ? "seasonal_notification"
                : "notification"
          }
        });
      } else if (data?.screen === "article" && typeof data.slug === "string") {
        router.push({ pathname: "/articles/[slug]", params: { slug: data.slug } });
      } else if (data?.screen === "baby-vaccines") {
        router.push("/vaccines");
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
      } else if (data?.screen === "family-planner") {
        router.push({
          pathname: "/family-planner",
          params:
            typeof data.task_id === "string"
              ? { taskId: data.task_id }
              : undefined
        });
      } else if (data?.screen === "doctor-visit") {
        router.push({
          pathname: "/doctor-visit",
          params: {
            babyId: typeof data.baby_id === "string" ? data.baby_id : undefined,
            subject: typeof data.subject === "string" ? data.subject : undefined
          }
        });
      } else if (data?.screen === "pregnancy-nutrition") {
        router.push("/pregnancy-nutrition");
      } else if (data?.screen === "pregnancy-health-file") {
        router.push("/pregnancy-health-file");
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
