import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Profile } from "@/api/profiles";

export type LifeStage = "pregnancy" | "motherhood";

export const lifeStageContent: Record<
  LifeStage,
  {
    label: string;
    shortDescription: string;
    features: readonly string[];
  }
> = {
  pregnancy: {
    label: "Hamilelik",
    shortDescription: "Hafta hafta gelişim, gebelik araçları ve doğuma hazırlık",
    features: ["Haftalık gebelik akışı", "Tekme, su ve ölçüm takibi", "Doğuma hazırlık"]
  },
  motherhood: {
    label: "Annelik",
    shortDescription: "Bebek bakımı, beslenme, uyku, büyüme ve aile koordinasyonu",
    features: ["Bakım ve beslenme günlüğü", "Büyüme ve gelişim takibi", "Uyku ve aile koordinasyonu"]
  }
};

export function getLifeStage(profile?: Pick<Profile, "is_pregnant"> | null): LifeStage {
  return profile?.is_pregnant ? "pregnancy" : "motherhood";
}

export function isLifeStage(profile: Pick<Profile, "is_pregnant"> | null | undefined, stage: LifeStage) {
  return getLifeStage(profile) === stage;
}

export async function suspendLocalCareNotifications() {
  if (Platform.OS === "web") return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const careNotifications = scheduled.filter((notification) => {
    const type = notification.content.data?.type;
    return type === "care_alarm" || type === "care_reminder";
  });

  await Promise.all(
    careNotifications.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier)
    )
  );
}
