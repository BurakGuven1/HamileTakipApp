export type CareTimerType = "breastfeeding" | "pumping" | "sleep";
export type CareBreastSide = "both" | "left" | "right" | null;
export type CareSleepKind = "day" | "night" | null;

const TITLES: Record<CareTimerType, string> = {
  breastfeeding: "Emzirme",
  pumping: "Sağım",
  sleep: "Uyku"
};

const SIDE_LABELS: Record<"both" | "left" | "right", string> = {
  both: "Her iki meme",
  left: "Sol meme",
  right: "Sağ meme"
};

export function getCareTimerTitle(timerType: CareTimerType) {
  return TITLES[timerType];
}

/**
 * The second line on the Lock Screen. At 3am the one thing a mother cannot
 * reconstruct from memory is which side she started on, so that is what it
 * says whenever it applies.
 */
export function getCareTimerSideLine({
  breastSide,
  sleepKind,
  timerType
}: {
  breastSide: CareBreastSide;
  sleepKind: CareSleepKind;
  timerType: CareTimerType;
}) {
  if (timerType === "sleep") {
    return sleepKind === "night" ? "Gece uykusu" : "Gündüz uykusu";
  }

  if (breastSide && breastSide in SIDE_LABELS) {
    return SIDE_LABELS[breastSide as keyof typeof SIDE_LABELS];
  }

  return TITLES[timerType];
}

/**
 * Shown for the few minutes the finished activity stays on screen, so the
 * parent can see what was recorded without unlocking the phone.
 */
export function getCareTimerSummaryLine({
  breastSide,
  durationMs,
  sleepKind,
  timerType
}: {
  breastSide: CareBreastSide;
  durationMs: number;
  sleepKind: CareSleepKind;
  timerType: CareTimerType;
}) {
  const duration = formatCareDuration(durationMs);
  const context = getCareTimerSideLine({ breastSide, sleepKind, timerType });

  return `${context} · ${duration}`;
}

export function formatCareDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));

  if (totalMinutes < 60) return `${totalMinutes} dk`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
}
