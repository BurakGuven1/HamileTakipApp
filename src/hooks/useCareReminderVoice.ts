import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { useEffect } from "react";

export function useCareReminderVoice() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const content = notification.request.content;
        if (content.data?.type !== "sleep_prediction" || !content.title) return;

        Speech.stop();
        Speech.speak(content.title, {
          language: "tr-TR",
          pitch: 1.12,
          rate: 0.92
        });
      }
    );

    return () => {
      subscription.remove();
      Speech.stop();
    };
  }, []);
}
