export type ContractionEntry = {
  endedAt: string | null;
  id: string;
  startedAt: string;
};

export type ContractionSummary = {
  averageDurationSec: number | null;
  averageIntervalSec: number | null;
  count: number;
  isRegular: boolean;
  spanMinutes: number;
};

export type LaborPatternStatus = "collecting" | "early" | "monitor" | "call_now";

export type LaborPatternAssessment = {
  detail: string;
  headline: string;
  status: LaborPatternStatus;
  summary: ContractionSummary;
};

const MINUTE_MS = 60_000;

/**
 * The 5-1-1 rule as it is given in antenatal classes: contractions five minutes
 * apart, each lasting about a minute, holding that pattern for a full hour.
 * These are the thresholds, in one place, so the copy and the logic cannot
 * drift apart.
 */
export const LABOR_RULE = {
  intervalSec: 5 * 60,
  durationSec: 60,
  sustainedMinutes: 60
} as const;

/** Before 37 weeks the same pattern means something different and more urgent. */
export const PRETERM_WEEK_THRESHOLD = 37;
export const PRETERM_CONTRACTIONS_PER_HOUR = 6;

const ANALYSIS_WINDOW_MINUTES = 60;
const MONITOR_INTERVAL_SEC = 10 * 60;
const MONITOR_SUSTAINED_MINUTES = 30;
// A pattern is "regular" when the gaps do not swing wildly. Practice contractions
// are typically irregular, which is the main thing distinguishing them.
const REGULARITY_TOLERANCE = 0.35;
const MIN_CONTRACTIONS_FOR_PATTERN = 4;

export function summarizeContractions(
  contractions: ContractionEntry[],
  now = Date.now(),
  windowMinutes = ANALYSIS_WINDOW_MINUTES
): ContractionSummary {
  const windowStart = now - windowMinutes * MINUTE_MS;

  const recent = contractions
    .map((entry) => ({
      ...entry,
      startedTime: Date.parse(entry.startedAt),
      endedTime: entry.endedAt ? Date.parse(entry.endedAt) : null
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.startedTime) &&
        entry.startedTime >= windowStart &&
        entry.startedTime <= now
    )
    .sort((left, right) => left.startedTime - right.startedTime);

  if (recent.length === 0) {
    return {
      averageDurationSec: null,
      averageIntervalSec: null,
      count: 0,
      isRegular: false,
      spanMinutes: 0
    };
  }

  const durations = recent
    .filter((entry) => entry.endedTime !== null && entry.endedTime > entry.startedTime)
    .map((entry) => (entry.endedTime! - entry.startedTime) / 1000);

  // Interval is start-to-start, which is how contraction frequency is defined.
  const intervals: number[] = [];
  for (let index = 1; index < recent.length; index += 1) {
    intervals.push((recent[index]!.startedTime - recent[index - 1]!.startedTime) / 1000);
  }

  const first = recent[0]!;
  const last = recent[recent.length - 1]!;

  return {
    averageDurationSec: durations.length > 0 ? average(durations) : null,
    averageIntervalSec: intervals.length > 0 ? average(intervals) : null,
    count: recent.length,
    isRegular: isRegular(intervals),
    spanMinutes: (last.startedTime - first.startedTime) / MINUTE_MS
  };
}

export function evaluateLaborPattern({
  contractions,
  gestationalWeek,
  now = Date.now()
}: {
  contractions: ContractionEntry[];
  gestationalWeek?: number | null;
  now?: number;
}): LaborPatternAssessment {
  const summary = summarizeContractions(contractions, now);

  if (summary.count < MIN_CONTRACTIONS_FOR_PATTERN) {
    return {
      detail:
        "Bir örüntü görebilmek için birkaç kasılma daha gerekli. Her kasılmanın başında başlat, bittiğinde bitir.",
      headline: "Kayıt sürüyor",
      status: "collecting",
      summary
    };
  }

  const isPreterm =
    typeof gestationalWeek === "number" && gestationalWeek < PRETERM_WEEK_THRESHOLD;

  // Before 37 weeks regular contractions are a reason to call now, without
  // waiting for the full 5-1-1 pattern to establish itself.
  if (isPreterm && summary.count >= PRETERM_CONTRACTIONS_PER_HOUR && summary.isRegular) {
    return {
      detail: `${gestationalWeek}. haftadasın ve son bir saatte ${summary.count} düzenli kasılma var. Erken doğum eylemi olabilir; 5-1-1 kuralını bekleme, şimdi ara.`,
      headline: "Şimdi hekimini ara",
      status: "call_now",
      summary
    };
  }

  if (
    summary.averageIntervalSec !== null &&
    summary.averageIntervalSec <= LABOR_RULE.intervalSec &&
    summary.averageDurationSec !== null &&
    summary.averageDurationSec >= LABOR_RULE.durationSec &&
    summary.spanMinutes >= LABOR_RULE.sustainedMinutes - 5 &&
    summary.isRegular
  ) {
    return {
      detail:
        "Kasılmalar yaklaşık 5 dakikada bir, birer dakika sürüyor ve bir saattir bu düzende. 5-1-1 kuralı karşılandı.",
      headline: "Hastaneye gitme vakti",
      status: "call_now",
      summary
    };
  }

  if (
    summary.averageIntervalSec !== null &&
    summary.averageIntervalSec <= MONITOR_INTERVAL_SEC &&
    summary.spanMinutes >= MONITOR_SUSTAINED_MINUTES &&
    summary.isRegular
  ) {
    return {
      detail: `Kasılmalar ortalama ${formatMinutes(summary.averageIntervalSec)} arayla ve düzenli. Hazırlığını yap, kaydı sürdür.`,
      headline: "Yaklaşıyor",
      status: "monitor",
      summary
    };
  }

  return {
    detail:
      "Kasılmalar henüz düzensiz. Bu aşamada dinlenmek, su içmek ve pozisyon değiştirmek yardımcı olur.",
    headline: "Henüz düzenli değil",
    status: "early",
    summary
  };
}

/**
 * Signs that matter no matter what the timer says. A contraction pattern is
 * never the reason to ignore these.
 */
export const CONTRACTION_RED_FLAGS = [
  "Suyunun gelmesi (özellikle rengi yeşil veya kahverengiyse)",
  "Herhangi bir miktarda kanama",
  "Bebeğinin hareketlerinde belirgin azalma",
  "Geçmeyen şiddetli baş ağrısı, görme bulanıklığı veya üst karın ağrısı",
  "Ateş, titreme veya kötü kokulu akıntı"
] as const;

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isRegular(intervals: number[]) {
  if (intervals.length < MIN_CONTRACTIONS_FOR_PATTERN - 1) return false;

  const mean = average(intervals);
  if (mean <= 0) return false;

  const spread = Math.sqrt(
    average(intervals.map((interval) => (interval - mean) ** 2))
  );

  return spread / mean <= REGULARITY_TOLERANCE;
}

export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";

  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  if (minutes === 0) return `${remainder} sn`;
  return `${minutes} dk ${String(remainder).padStart(2, "0")} sn`;
}

function formatMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} dakika`;
}
