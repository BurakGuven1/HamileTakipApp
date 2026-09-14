import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getLiveActivityEnabled } from "@/features/notifications/liveActivityPreference";

import type { NightShiftLiveActivityProps } from "@/widgets/NightShiftLiveActivity.ios";

export type NightShiftActivityInput = Omit<
  NightShiftLiveActivityProps,
  "startedAtMs" | "plannedEndAtMs" | "status"
> & {
  babyId: string;
  plannedEndAt: string;
  startedAt: string;
};

/** Bkz. careTimerLiveActivity.ts — aynı 8 saatlik ActivityKit ömrü. */
const MAX_ACTIVITY_AGE_MS = 8 * 60 * 60 * 1000;
const ACTIVE_SHIFT_KEY = "night-shift-live-activity-v1";

export async function ensureNightShiftLiveActivity(
  input: NightShiftActivityInput
) {
  if (Platform.OS !== "ios") return;
  // Bkz. careTimerLiveActivity.ts — aynı kullanıcı tercihi.
  if (!(await getLiveActivityEnabled())) return;
  try {
    const { default: NightShiftActivity } = await import(
      "@/widgets/NightShiftLiveActivity.ios"
    );
    const props = toProps(input, "active");
    const instances = NightShiftActivity.getInstances();

    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(input)).catch(
      () => undefined
    );
    registerNightShiftFinishListener();

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
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY).catch(() => undefined);
    await Promise.all(
      NightShiftActivity.getInstances().map((instance) =>
        instance.end(after(dismissalDate), props, new Date())
      )
    );
  } catch (error) {
    console.warn("Night shift Live Activity could not be ended", error);
  }
}

/**
 * Uygulama öne geldiğinde asılı kalmış vardiya kartını kapatır. Vardiya
 * sunucuda planlanan saatte kendiliğinden kapanabildiği için (finish_night_shift
 * RPC'si getNightShiftState içinde çağrılır) bu cihaz haberi hiç almamış
 * olabilir.
 */
export async function reconcileNightShiftLiveActivity() {
  if (Platform.OS !== "ios") return;

  try {
    const { default: NightShiftActivity } = await import(
      "@/widgets/NightShiftLiveActivity.ios"
    );
    if (NightShiftActivity.getInstances().length === 0) {
      await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY).catch(() => undefined);
      return;
    }

    registerNightShiftFinishListener();

    const input = await readActiveShiftInput();
    if (!input) {
      await dismissAllImmediately();
      return;
    }

    const startedTime = Date.parse(input.startedAt);
    if (
      !Number.isFinite(startedTime) ||
      Date.now() - startedTime > MAX_ACTIVITY_AGE_MS
    ) {
      await dismissAllImmediately();
      return;
    }

    const { getNightShiftState } = await import("@/api/careJournal");
    const shift = await getNightShiftState(input.babyId).catch(() => null);
    // Çevrimdışıyken karta dokunma.
    if (!shift) return;
    if (shift.status !== "active") {
      await endNightShiftLiveActivity(input);
    }
  } catch (error) {
    console.warn("Night shift Live Activity could not be reconciled", error);
  }
}

/**
 * Bkz. careTimerLiveActivity.ts — tercih kapatıldığında kartı kaldırır.
 */
export async function dismissNightShiftLiveActivities() {
  if (Platform.OS !== "ios") return;
  await dismissAllImmediately().catch(() => undefined);
}

async function dismissAllImmediately() {
  const { default: NightShiftActivity } = await import(
    "@/widgets/NightShiftLiveActivity.ios"
  );
  await Promise.all(
    NightShiftActivity.getInstances().map((instance) =>
      instance.end("immediate").catch(() => undefined)
    )
  );
  await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY).catch(() => undefined);
}

async function readActiveShiftInput(): Promise<NightShiftActivityInput | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NightShiftActivityInput;
    return typeof parsed?.babyId === "string" &&
      typeof parsed?.startedAt === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

let finishListenerRegistered = false;

export function registerNightShiftFinishListener() {
  if (Platform.OS !== "ios" || finishListenerRegistered) return;
  finishListenerRegistered = true;

  void (async () => {
    try {
      const [{ addUserInteractionListener }, { NIGHT_SHIFT_FINISH_TARGET }] =
        await Promise.all([
          import("expo-widgets"),
          import("@/widgets/NightShiftLiveActivity.ios")
        ]);

      addUserInteractionListener((event) => {
        if (event.target !== NIGHT_SHIFT_FINISH_TARGET) return;
        void finishRunningNightShift();
      });
    } catch (error) {
      finishListenerRegistered = false;
      console.warn(
        "Night shift Live Activity action listener could not be added",
        error
      );
    }
  })();
}

async function finishRunningNightShift() {
  try {
    const input = await readActiveShiftInput();
    if (!input) return;

    const { finishNightShift, getNightShiftState } = await import(
      "@/api/careJournal"
    );
    const shift = await getNightShiftState(input.babyId);
    if (shift?.status === "active" && typeof shift.id === "string") {
      await finishNightShift(shift.id);
    }
    await endNightShiftLiveActivity(input);
  } catch (error) {
    console.warn("Night shift could not be finished from Live Activity", error);
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
