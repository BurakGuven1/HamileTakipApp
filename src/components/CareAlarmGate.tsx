import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { AlarmClock, BellRing } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cancelCareReminder, snoozeCareReminder } from "@/api/careJournal";
import {
  getCareAlarmVoiceText,
  rescheduleCareAlarmFromNotification
} from "@/features/care-journal/reminders";
import type { CareEntryType } from "@/api/careJournal";

const alarmSound = require("../../assets/audio/baby_reminder.wav");

export function CareAlarmGate() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<Notifications.Notification | null>(null);
  const [player] = useState(() => createAudioPlayer(alarmSound));
  const vibrationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestId = useRef<string | null>(null);

  const stopRinging = useCallback(() => {
    setActive(null);
    activeRequestId.current = null;
    player.pause();
    player.seekTo(0).catch(() => undefined);
    if (vibrationTimer.current) clearInterval(vibrationTimer.current);
    vibrationTimer.current = null;
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = null;
    Speech.stop();
  }, [player]);

  const startRinging = useCallback((notification: Notifications.Notification) => {
    const requestId = notification.request.identifier;
    activeRequestId.current = requestId;
    setActive(notification);
    player.loop = true;
    player.volume = 1;
    player.play();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    if (vibrationTimer.current) clearInterval(vibrationTimer.current);
    vibrationTimer.current = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }, 2200);
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(() => {
      if (activeRequestId.current !== requestId) return;
      const entry = notification.request.content.data?.entry;
      const voiceText = typeof notification.request.content.data?.voice_text === "string"
        ? notification.request.content.data.voice_text
        : getCareAlarmVoiceText(isCareEntryType(entry) ? entry : "breastfeeding");
      player.pause();
      const resumeAlarm = () => {
        if (activeRequestId.current === requestId) player.play();
      };
      Speech.stop();
      Speech.speak(voiceText, {
        language: "tr-TR",
        pitch: 1.04,
        rate: 0.9,
        onDone: resumeAlarm,
        onError: resumeAlarm,
        onStopped: resumeAlarm
      });
    }, 2600);
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
      if (isAlarmNotification(notification)) {
        startRinging(notification);
      }
    });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isAlarmNotification(response.notification)) return;
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
  const canSnooze = typeof content?.data?.reminder_id === "string";

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
          {canSnooze ? (
            <Pressable accessibilityRole="button" onPress={() => void snooze(active)} style={styles.snoozeButton}>
              <AlarmClock color="#DDE9E1" size={24} />
              <Text style={styles.snoozeText}>{snoozeMinutes} dk ertele</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => void dismiss(active)} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Alarmı kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function isAlarmNotification(notification: Notifications.Notification) {
  const type = notification.request.content.data?.type;
  return type === "care_alarm" || type === "care_reminder";
}

function isCareEntryType(value: unknown): value is CareEntryType {
  return typeof value === "string" && [
    "breastfeeding", "bottle", "sleep", "diaper", "pumping", "medicine",
    "solid_food", "temperature"
  ].includes(value);
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
