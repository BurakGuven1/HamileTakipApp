import {
  WHO_GROWTH_STANDARDS,
  WHO_MAX_AGE_DAYS,
  type WhoLms,
  type WhoLmsTable
} from "./whoGrowthStandards";

export type GrowthIndicator = "weight" | "length" | "headCircumference";
export type GrowthSex = "male" | "female";

export type PercentileResult = {
  ageDays: number;
  indicator: GrowthIndicator;
  percentile: number;
  zScore: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const GROWTH_INDICATOR_LABELS: Record<GrowthIndicator, string> = {
  weight: "Kilo",
  length: "Boy",
  headCircumference: "Baş çevresi"
};

export const GROWTH_INDICATOR_UNITS: Record<GrowthIndicator, string> = {
  weight: "kg",
  length: "cm",
  headCircumference: "cm"
};

/**
 * WHO publishes a separate standard for each sex. "belirtilmemis" babies have
 * no correct curve, so the caller must decide what to show rather than have a
 * default silently picked here.
 */
export function toGrowthSex(
  gender: "kiz" | "erkek" | "belirtilmemis" | null | undefined
): GrowthSex | null {
  if (gender === "kiz") return "female";
  if (gender === "erkek") return "male";
  return null;
}

export function getAgeInDays(birthDate: string, recordDate: string) {
  const birth = Date.parse(`${birthDate.slice(0, 10)}T00:00:00Z`);
  const record = Date.parse(`${recordDate.slice(0, 10)}T00:00:00Z`);

  if (!Number.isFinite(birth) || !Number.isFinite(record)) return null;

  return Math.round((record - birth) / DAY_MS);
}

/**
 * The WHO standard is an LMS distribution: at every age the measurement is
 * normal after a Box-Cox transform with skewness L, median M and coefficient of
 * variation S. This is the same formula the WHO's own software uses.
 */
export function lmsToZScore(
  [l, m, s]: WhoLms,
  measurement: number
): number | null {
  if (!(measurement > 0) || !(m > 0) || !(s > 0)) return null;

  const z = l === 0 ? Math.log(measurement / m) / s : (Math.pow(measurement / m, l) - 1) / (l * s);

  return Number.isFinite(z) ? z : null;
}

export function zScoreToPercentile(z: number) {
  return normalCdf(z) * 100;
}

export function getGrowthPercentile({
  ageDays,
  indicator,
  measurement,
  sex
}: {
  ageDays: number;
  indicator: GrowthIndicator;
  measurement: number;
  sex: GrowthSex;
}): PercentileResult | null {
  // Outside the standard there is no honest answer, so nothing is shown rather
  // than an extrapolated number a parent might act on.
  if (ageDays < 0 || ageDays > WHO_MAX_AGE_DAYS) return null;

  const table = WHO_GROWTH_STANDARDS[indicator][sex];
  const lms = interpolateLms(table, ageDays);
  const z = lmsToZScore(lms, measurement);

  if (z === null) return null;

  return {
    ageDays,
    indicator,
    percentile: zScoreToPercentile(z),
    zScore: z
  };
}

/** The measurement a given percentile corresponds to, for drawing the bands. */
export function getMeasurementForZScore({
  ageDays,
  indicator,
  sex,
  zScore
}: {
  ageDays: number;
  indicator: GrowthIndicator;
  sex: GrowthSex;
  zScore: number;
}) {
  if (ageDays < 0 || ageDays > WHO_MAX_AGE_DAYS) return null;

  const [l, m, s] = interpolateLms(WHO_GROWTH_STANDARDS[indicator][sex], ageDays);
  const value =
    l === 0 ? m * Math.exp(s * zScore) : m * Math.pow(1 + l * s * zScore, 1 / l);

  return Number.isFinite(value) ? value : null;
}

export function formatPercentile(percentile: number) {
  // Below the first and above the 99th the exact number stops being meaningful
  // and starts being alarming, so the extremes are reported as bands.
  if (percentile < 1) return "<%1";
  if (percentile > 99) return ">%99";
  return `%${Math.round(percentile)}`;
}

function interpolateLms(table: WhoLmsTable, ageDays: number): WhoLms {
  const { ages, values } = table;
  const first = values[0]!;
  const lastIndex = ages.length - 1;

  if (ageDays <= ages[0]!) return first;
  if (ageDays >= ages[lastIndex]!) return values[lastIndex]!;

  let high = 1;
  while (ages[high]! < ageDays) high += 1;

  const low = high - 1;
  const lowAge = ages[low]!;
  const lowValues = values[low]!;
  const highValues = values[high]!;
  const ratio = (ageDays - lowAge) / (ages[high]! - lowAge);

  return [
    lowValues[0] + (highValues[0] - lowValues[0]) * ratio,
    lowValues[1] + (highValues[1] - lowValues[1]) * ratio,
    lowValues[2] + (highValues[2] - lowValues[2]) * ratio
  ];
}

/**
 * Abramowitz & Stegun 7.1.26 for erf, accurate to about 1.5e-7 — far tighter
 * than percentiles are ever displayed.
 */
function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-absX * absX);

  return sign * y;
}
