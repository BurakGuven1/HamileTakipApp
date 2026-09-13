import {
  getAgeInDays,
  getGrowthPercentile,
  getMeasurementForZScore,
  type GrowthIndicator,
  type GrowthSex
} from "./percentile";
import { WHO_MAX_AGE_DAYS } from "./whoGrowthStandards";

export type GrowthMeasurementInput = {
  head_circumference_cm: number | null;
  height_cm: number | null;
  id: string;
  record_date: string;
  weight_kg: number | null;
};

export type GrowthPoint = {
  ageDays: number;
  id: string;
  percentile: number;
  recordDate: string;
  value: number;
  zScore: number;
};

export type GrowthBand = {
  points: { ageDays: number; value: number }[];
  zScore: number;
};

export type GrowthSeries = {
  bands: GrowthBand[];
  maxAgeDays: number;
  maxValue: number;
  minAgeDays: number;
  minValue: number;
  points: GrowthPoint[];
};

/**
 * The reference curves a parent recognises from the paper chart in the clinic:
 * the median plus the one and two standard deviation lines, which are the
 * roughly 3rd, 15th, 85th and 97th percentiles.
 */
export const GROWTH_BAND_Z_SCORES = [-2, -1, 0, 1, 2];

const INDICATOR_FIELDS: Record<GrowthIndicator, keyof GrowthMeasurementInput> = {
  weight: "weight_kg",
  length: "height_cm",
  headCircumference: "head_circumference_cm"
};

/** One curve sample per week keeps the SVG path light without visible corners. */
const BAND_STEP_DAYS = 7;

export function buildGrowthSeries({
  birthDate,
  indicator,
  records,
  sex
}: {
  birthDate: string;
  indicator: GrowthIndicator;
  records: GrowthMeasurementInput[];
  sex: GrowthSex;
}): GrowthSeries | null {
  const field = INDICATOR_FIELDS[indicator];

  const points: GrowthPoint[] = [];
  for (const record of records) {
    const rawValue = record[field];
    const value = typeof rawValue === "number" ? rawValue : null;
    if (value === null) continue;

    const ageDays = getAgeInDays(birthDate, record.record_date);
    if (ageDays === null) continue;

    const result = getGrowthPercentile({ ageDays, indicator, measurement: value, sex });
    if (!result) continue;

    points.push({
      ageDays,
      id: record.id,
      percentile: result.percentile,
      recordDate: record.record_date,
      value,
      zScore: result.zScore
    });
  }

  if (points.length === 0) return null;

  points.sort((left, right) => left.ageDays - right.ageDays);

  // The chart always shows from birth, because the shape of the curve early on
  // is most of what makes a single measurement readable.
  const lastAgeDays = points[points.length - 1]!.ageDays;
  const minAgeDays = 0;
  const maxAgeDays = Math.min(
    WHO_MAX_AGE_DAYS,
    // A little headroom to the right so the newest point is never on the edge.
    Math.max(lastAgeDays + Math.max(14, Math.round(lastAgeDays * 0.1)), 60)
  );

  const bands: GrowthBand[] = GROWTH_BAND_Z_SCORES.map((zScore) => ({
    points: sampleBand({ indicator, maxAgeDays, minAgeDays, sex, zScore }),
    zScore
  })).filter((band) => band.points.length > 1);

  const bandValues = bands.flatMap((band) => band.points.map((point) => point.value));
  const pointValues = points.map((point) => point.value);
  const allValues = [...bandValues, ...pointValues];

  return {
    bands,
    maxAgeDays,
    maxValue: Math.max(...allValues),
    minAgeDays,
    minValue: Math.min(...allValues),
    points
  };
}

function sampleBand({
  indicator,
  maxAgeDays,
  minAgeDays,
  sex,
  zScore
}: {
  indicator: GrowthIndicator;
  maxAgeDays: number;
  minAgeDays: number;
  sex: GrowthSex;
  zScore: number;
}) {
  const samples: { ageDays: number; value: number }[] = [];

  for (let ageDays = minAgeDays; ageDays <= maxAgeDays; ageDays += BAND_STEP_DAYS) {
    const value = getMeasurementForZScore({ ageDays, indicator, sex, zScore });
    if (value !== null) samples.push({ ageDays, value });
  }

  const lastSample = samples[samples.length - 1];
  if (lastSample && lastSample.ageDays !== maxAgeDays) {
    const value = getMeasurementForZScore({ ageDays: maxAgeDays, indicator, sex, zScore });
    if (value !== null) samples.push({ ageDays: maxAgeDays, value });
  }

  return samples;
}

/**
 * What the parent actually wants to know is not today's number but whether the
 * child is holding their own line. A drift of more than two thirds of a
 * standard deviation between the oldest and newest measurement is the usual
 * threshold for "worth mentioning at the next visit".
 */
export function describeGrowthTrend(points: GrowthPoint[]) {
  if (points.length < 2) return null;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const drift = last.zScore - first.zScore;
  const spanDays = last.ageDays - first.ageDays;

  if (spanDays < 14) return null;

  if (Math.abs(drift) < 0.67) {
    return {
      drift,
      tone: "steady" as const
    };
  }

  return {
    drift,
    tone: drift > 0 ? ("rising" as const) : ("falling" as const)
  };
}
