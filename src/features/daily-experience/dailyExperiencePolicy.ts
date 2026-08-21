export const DAILY_DESTINATIONS = [
  "home",
  "pregnancy-exercise",
  "pregnancy-nutrition",
  "pregnancy-timeline",
  "doctor-visit",
  "family-planner",
  "care-journal",
  "sleep-rhythm",
  "gallery"
] as const;

export type DailyDestination = (typeof DAILY_DESTINATIONS)[number];

export function getWeeklyCardState(input: {
  dismissed: boolean;
  needsCheckin: boolean;
}) {
  if (!input.needsCheckin) return "hidden" as const;
  return input.dismissed ? "collapsed" as const : "expanded" as const;
}

export function getDailyCtaMode(input: {
  isPremium: boolean;
  premiumRequired: boolean;
}) {
  if (!input.premiumRequired) return "destination" as const;
  return input.isPremium ? "premium_detail" as const : "paywall" as const;
}

export function isDailyDestination(value: unknown): value is DailyDestination {
  return typeof value === "string"
    && (DAILY_DESTINATIONS as readonly string[]).includes(value);
}

export function getDailyDestinationPath(destination: DailyDestination) {
  return destination === "home" ? "/home" : `/${destination}` as const;
}
