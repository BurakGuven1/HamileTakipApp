import type { PregnancyHealthTimelineItem } from "@/api/pregnancyHealthFile";

import type { DocumentInsightValue } from "./types.ts";

/**
 * A single number says little; the same number three weeks apart says a lot.
 * Values the user previously saved into Sağlık Dosyam are matched by test name
 * and unit, and the comparison is reported as a plain difference — never as an
 * improvement, a worsening, or a verdict of any kind.
 */

export type ValueTrend = {
  previousResult: string;
  previousUnit: string;
  previousDate: string;
  direction: "up" | "down" | "same";
  /** Signed difference, formatted for display. Empty when not computable. */
  difference: string;
};

export type PreviousLabValue = {
  occurredAt: string;
  referenceRange: string | null;
  result: string;
  testName: string;
  unit: string | null;
};

export function collectPreviousLabValues(
  timeline: PregnancyHealthTimelineItem[]
): PreviousLabValue[] {
  return timeline
    .flatMap((item) =>
      item.labValues.map((labValue) => ({
        occurredAt: item.occurredAt,
        referenceRange: labValue.reference_range,
        result: labValue.result_text,
        testName: labValue.test_name,
        unit: labValue.unit
      }))
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export function findValueTrend(
  value: Pick<DocumentInsightValue, "testName" | "result" | "unit">,
  previous: PreviousLabValue[],
  now = Date.now()
): ValueTrend | null {
  const match = previous.find(
    (candidate) =>
      normalize(candidate.testName) === normalize(value.testName)
      // Comparing mg/dL against mmol/L would invent a trend that is not there.
      && normalize(candidate.unit ?? "") === normalize(value.unit)
      && Date.parse(candidate.occurredAt) <= now
  );
  if (!match) return null;

  const current = toNumber(value.result);
  const earlier = toNumber(match.result);
  const direction = current !== null && earlier !== null
    ? current > earlier ? "up" as const : current < earlier ? "down" as const : "same" as const
    : "same" as const;

  return {
    previousResult: match.result,
    previousUnit: match.unit ?? "",
    previousDate: match.occurredAt,
    direction,
    difference:
      current !== null && earlier !== null && current !== earlier
        ? `${current > earlier ? "+" : "−"}${formatNumber(Math.abs(current - earlier))}`
        : ""
  };
}

export function formatTrendDate(isoDate: string) {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(time));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function toNumber(text: string): number | null {
  const match = text.trim().match(/^[<>≤≥~]?\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}
