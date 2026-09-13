const DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors public.intro_premium_trial_duration() in the database. */
export const INTRO_TRIAL_DAYS = 7;

export type IntroTrialTransition = "started" | "ended" | null;

/**
 * Trial copy always speaks in whole days ("3 gün kaldı"), so a window that ends
 * later today still counts as one remaining day rather than zero.
 */
export function getIntroTrialDaysRemaining(
  expiresAt: string | null,
  now = Date.now()
) {
  if (!expiresAt) return 0;

  const expiresTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTime) || expiresTime <= now) return 0;

  return Math.max(1, Math.ceil((expiresTime - now) / DAY_MS));
}

/**
 * The trial is the only premium source that expires on its own while the app is
 * installed, so both edges are worth an event: `started` anchors the cohort and
 * `ended` marks the moment the paywall becomes the real decision point. An
 * account that never had a trial must stay silent rather than report an end.
 */
export function resolveIntroTrialTransition(
  previouslyActive: boolean | undefined,
  isActive: boolean
): IntroTrialTransition {
  if (isActive && previouslyActive !== true) return "started";
  if (!isActive && previouslyActive === true) return "ended";
  return null;
}
