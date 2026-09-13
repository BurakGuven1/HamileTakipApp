import AsyncStorage from "@react-native-async-storage/async-storage";

import { trackEvent } from "@/lib/analytics";

import {
  INTRO_TRIAL_DAYS,
  resolveIntroTrialTransition
} from "./introTrialPolicy";

const INTRO_TRIAL_STATE_KEY = "intro-premium-trial-state-v1";

type IntroTrialState = {
  lastActive?: boolean;
  startedTrackedFor?: string;
};

export {
  getIntroTrialDaysRemaining,
  INTRO_TRIAL_DAYS,
  resolveIntroTrialTransition,
  type IntroTrialTransition
} from "./introTrialPolicy";

export async function trackIntroTrialLifecycle({
  expiresAt,
  isActive,
  startedAt
}: {
  expiresAt: string | null;
  isActive: boolean;
  startedAt: string | null;
}) {
  const state = await readIntroTrialState();
  const transition = resolveIntroTrialTransition(state.lastActive, isActive);

  if (!transition) return null;

  // A reinstall or a second device must not re-report the same trial start.
  if (transition === "started" && startedAt && state.startedTrackedFor === startedAt) {
    await writeIntroTrialState({ ...state, lastActive: true });
    return null;
  }

  if (transition === "started") {
    await trackEvent("intro_trial_started", {
      days_total: INTRO_TRIAL_DAYS,
      expires_at: expiresAt
    });
    await writeIntroTrialState({
      lastActive: true,
      startedTrackedFor: startedAt ?? undefined
    });
    return transition;
  }

  await trackEvent("intro_trial_ended", {
    days_total: INTRO_TRIAL_DAYS
  });
  await writeIntroTrialState({ ...state, lastActive: false });
  return transition;
}

async function readIntroTrialState(): Promise<IntroTrialState> {
  try {
    const raw = await AsyncStorage.getItem(INTRO_TRIAL_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as IntroTrialState;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeIntroTrialState(state: IntroTrialState) {
  try {
    await AsyncStorage.setItem(INTRO_TRIAL_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Intro trial state could not be stored", error);
  }
}
