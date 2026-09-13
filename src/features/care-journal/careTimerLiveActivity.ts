import { Platform } from "react-native";

import type { CareTimerLiveActivityProps } from "@/widgets/CareTimerLiveActivity.ios";

import {
  getCareTimerSideLine,
  getCareTimerSummaryLine,
  getCareTimerTitle,
  type CareBreastSide,
  type CareSleepKind,
  type CareTimerType
} from "./careTimerActivityCopy";

export type CareTimerActivityInput = {
  babyId: string;
  babyName: string;
  breastSide: CareBreastSide;
  sleepKind: CareSleepKind;
  startedAt: string;
  timerType: CareTimerType;
};

/** How long the finished card stays on the Lock Screen before dismissing. */
const COMPLETED_DISMISSAL_MINUTES = 8;

/**
 * A feed or a nap is timed one-handed in the dark, and the phone is locked for
 * almost all of it. Putting the running timer on the Lock Screen and in the
 * Dynamic Island is the difference between a tool that fits that moment and
 * one that asks a mother to unlock, find a tab and read a screen.
 *
 * Every failure here is swallowed: the entry itself is already recorded
 * offline-first, and a missing Live Activity must never break logging a feed.
 */
export async function ensureCareTimerLiveActivity(input: CareTimerActivityInput) {
  if (Platform.OS !== "ios") return;

  try {
    const { default: CareTimerActivity } = await import(
      "@/widgets/CareTimerLiveActivity.ios"
    );
    const props = toProps(input, "active");
    const instances = CareTimerActivity.getInstances();

    if (instances.length === 0) {
      // The care journal screen reads no route params of its own, so the link
      // is the bare route rather than one implying a deep link that does nothing.
      CareTimerActivity.start(props, "hamiletakip://care-journal");
      return;
    }

    await Promise.all(instances.map((instance) => instance.update(props)));
  } catch (error) {
    console.warn("Care timer Live Activity could not be started", error);
  }
}

export async function endCareTimerLiveActivity(
  input: CareTimerActivityInput,
  endedAt: string | null
) {
  if (Platform.OS !== "ios") return;

  try {
    const [{ default: CareTimerActivity }, { after }] = await Promise.all([
      import("@/widgets/CareTimerLiveActivity.ios"),
      import("expo-widgets")
    ]);

    const startedTime = Date.parse(input.startedAt);
    const endedTime = endedAt ? Date.parse(endedAt) : Date.now();
    const durationMs =
      Number.isFinite(startedTime) && Number.isFinite(endedTime)
        ? Math.max(0, endedTime - startedTime)
        : 0;

    const props = toProps(input, "completed", durationMs);
    const dismissalDate = new Date(
      Date.now() + COMPLETED_DISMISSAL_MINUTES * 60_000
    );

    await Promise.all(
      CareTimerActivity.getInstances().map((instance) =>
        instance.end(after(dismissalDate), props, new Date())
      )
    );
  } catch (error) {
    console.warn("Care timer Live Activity could not be ended", error);
  }
}

function toProps(
  input: CareTimerActivityInput,
  status: CareTimerLiveActivityProps["status"],
  durationMs = 0
): CareTimerLiveActivityProps {
  const startedAtMs = Date.parse(input.startedAt);

  return {
    babyName: input.babyName,
    sideLine: getCareTimerSideLine({
      breastSide: input.breastSide,
      sleepKind: input.sleepKind,
      timerType: input.timerType
    }),
    startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : Date.now(),
    status,
    summaryLine: getCareTimerSummaryLine({
      breastSide: input.breastSide,
      durationMs,
      sleepKind: input.sleepKind,
      timerType: input.timerType
    }),
    timerType: input.timerType,
    title: getCareTimerTitle(input.timerType)
  };
}
