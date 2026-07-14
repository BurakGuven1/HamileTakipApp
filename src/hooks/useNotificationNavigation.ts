import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

export function useNotificationNavigation() {
  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data;

      if (data?.screen === "paywall") {
        router.push("/paywall");
      } else if (data?.screen === "care-journal") {
        router.push({
          pathname: "/care-journal",
          params: typeof data.entry === "string" ? { entry: data.entry } : undefined
        });
      }
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleResponse(response);
          Notifications.clearLastNotificationResponseAsync().catch(
            () => undefined
          );
        }
      })
      .catch(() => undefined);

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => subscription.remove();
  }, []);
}
