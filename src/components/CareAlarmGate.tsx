import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { AlarmClock, BellRing } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cancelCareReminder, snoozeCareReminder } from "@/api/careJournal";
import {
  rescheduleCareAlarmFromNotification
} from "@/features/care-journal/reminders";

const alarmSound = require("../../assets/audio/baby_reminder.wav");

export function CareAlarmGate() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<Notifications.Notification | null>(null);
  const [player] = useState(() => createAudioPlayer(alarmSound));
  const vibrationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRinging = useCallback(() => {
    setActive(null);
    player.pause();
    player.seekTo(0).catch(() => undefined);
    if (vibrationTimer.current) clearInterval(vibrationTimer.current);
    vibrationTimer.current = null;
  }, [player]);

  const startRinging = useCallback((notification: Notifications.Notification) => {
    setActive(notification);
    player.loop = true;
    player.volume = 1;
    player.play();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    if (vibrationTimer.current) clearInterval(vibrationTimer.current);
    vibrationTimer.current = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }, 2200);
  }, [player]);

  const dismiss = useCallback(async (notification: Notifications.Notification | null) => {
    const reminderId = notification?.request.content.data?.reminder_id;
    stopRinging();
    if (typeof reminderId === "string") {
      await cancelCareReminder(reminderId).catch(() => undefined);
    }
  }, [stopRinging]);

  const snooze = useCallback(async (notification: Notifications.Notification | null) => {
    if (!notification) return;
    const data = notification.request.content.data;
    const reminderId = data?.reminder_id;
    const minutes = typeof data?.snooze_minutes === "number" ? data.snooze_minutes : 10;
    const scheduledFor = new Date(Date.now() + minutes * 60_000);
    stopRinging();
    if (typeof reminderId !== "string") return;
    try {
      const localId = await rescheduleCareAlarmFromNotification(notification, scheduledFor);
      await snoozeCareReminder(reminderId, scheduledFor.toISOString(), localId);
    } catch {
      // The user already silenced the alarm; a failed network sync must not restart it.
    }
  }, [stopRinging]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === "care_alarm") {
        startRinging(notification);
      }
    });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type !== "care_alarm") return;
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        startRinging(response.notification);
      }
    });
    return () => {
      received.remove();
      responded.remove();
      stopRinging();
      player.remove();
    };
  }, [dismiss, player, snooze, startRinging, stopRinging]);

  const content = active?.request.content;
  const snoozeMinutes = typeof content?.data?.snooze_minutes === "number"
    ? content.data.snooze_minutes
    : 10;

  return (
    <Modal visible={Boolean(active)} animationType="fade" transparent statusBarTranslucent>
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, 24), paddingTop: Math.max(insets.top, 24) }]}>
        <View style={styles.ring}>
          <BellRing color="#F3C884" size={54} strokeWidth={1.8} />
        </View>
        <Text style={styles.eyebrow}>ANNE+ ALARM</Text>
        <Text style={styles.title}>{content?.title ?? "Bakım zamanı"}</Text>
        <Text style={styles.body}>{content?.body ?? "Kurduğun bakım alarmının zamanı geldi."}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => void snooze(active)} style={styles.snoozeButton}>
            <AlarmClock color="#DDE9E1" size={24} />
            <Text style={styles.snoozeText}>{snoozeMinutes} dk ertele</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void dismiss(active)} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Alarmı kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 14, marginTop: 44, width: "100%" },
  backdrop: { alignItems: "center", backgroundColor: "#08110F", flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  body: { color: "#A9BBB4", fontSize: 17, lineHeight: 25, marginTop: 14, textAlign: "center" },
  dismissButton: { alignItems: "center", backgroundColor: "#D9A2A2", borderRadius: 22, minHeight: 62, justifyContent: "center" },
  dismissText: { color: "#241313", fontSize: 18, fontWeight: "800" },
  eyebrow: { color: "#8EAAA0", fontSize: 12, fontWeight: "800", letterSpacing: 2.2, marginTop: 28 },
  ring: { alignItems: "center", backgroundColor: "#172822", borderColor: "#365148", borderRadius: 48, borderWidth: 1, height: 96, justifyContent: "center", width: 96 },
  snoozeButton: { alignItems: "center", backgroundColor: "#20362F", borderColor: "#38584D", borderRadius: 22, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 62, justifyContent: "center" },
  snoozeText: { color: "#E7F0EC", fontSize: 18, fontWeight: "800" },
  title: { color: "#F1F4F2", fontSize: 31, fontWeight: "800", lineHeight: 38, marginTop: 10, textAlign: "center" }
});
