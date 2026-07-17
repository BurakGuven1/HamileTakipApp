import { Platform } from "react-native";

import type { NightShiftLiveActivityProps } from "@/widgets/NightShiftLiveActivity.ios";

export type NightShiftActivityInput = Omit<
  NightShiftLiveActivityProps,
  "startedAtMs" | "plannedEndAtMs" | "status"
> & {
  babyId: string;
  plannedEndAt: string;
  startedAt: string;
};

export async function ensureNightShiftLiveActivity(
  input: NightShiftActivityInput
) {
  if (Platform.OS !== "ios") return;
  try {
    const { default: NightShiftActivity } = await import(
      "@/widgets/NightShiftLiveActivity.ios"
    );
    const props = toProps(input, "active");
    const instances = NightShiftActivity.getInstances();
    if (instances.length === 0) {
      NightShiftActivity.start(
        props,
        `hamiletakip://night-shift?babyId=${encodeURIComponent(input.babyId)}`
      );
      return;
    }
    await Promise.all(instances.map((instance) => instance.update(props)));
  } catch (error) {
    console.warn("Night shift Live Activity could not be started", error);
  }
}

export async function endNightShiftLiveActivity(
  input: NightShiftActivityInput
) {
  if (Platform.OS !== "ios") return;
  try {
    const [{ default: NightShiftActivity }, { after }] = await Promise.all([
      import("@/widgets/NightShiftLiveActivity.ios"),
      import("expo-widgets")
    ]);
    const props = toProps(input, "completed");
    const dismissalDate = new Date(Date.now() + 15 * 60_000);
    await Promise.all(
      NightShiftActivity.getInstances().map((instance) =>
        instance.end(after(dismissalDate), props, new Date())
      )
    );
  } catch (error) {
    console.warn("Night shift Live Activity could not be ended", error);
  }
}

function toProps(
  input: NightShiftActivityInput,
  status: NightShiftLiveActivityProps["status"]
): NightShiftLiveActivityProps {
  return {
    babyName: input.babyName,
    caregiverName: input.caregiverName,
    nextReminderLine: input.nextReminderLine,
    plannedEndAtMs: Date.parse(input.plannedEndAt),
    startedAtMs: Date.parse(input.startedAt),
    status,
    statusLine: input.statusLine
  };
}
