import type { DocumentInsightValue } from "./types.ts";

/**
 * A number next to a printed range ("13,4 — Referans: 11-15") asks the reader to
 * do the comparison in their head. The bar does it for them: the normal band is
 * drawn, and the marker sits where the result actually falls. It is only ever
 * drawn from the range the *document itself* printed, so it cannot claim a
 * position we did not measure.
 */

export type RangeBarModel = {
  /** 0..1 where the normal band starts / ends inside the drawn track. */
  bandStart: number;
  bandEnd: number;
  /** 0..1 position of the user's own result inside the drawn track. */
  markerPosition: number;
  /** True when the result sits at the very edge of the track (clamped). */
  clamped: boolean;
  lowLabel: string;
  highLabel: string;
};

type Bounds = { min: number | null; max: number | null };

export function parseReferenceBounds(referenceRange: string): Bounds | null {
  const range = referenceRange.trim();
  if (!range) return null;
  // Multiple contextual ranges ("Gebe: ...; Gebe değil: ...") were never
  // resolved to one band, so drawing any band would be a guess.
  if (range.includes(";")) return null;

  const between = range.match(/(?:^|:\s*)(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|ile)\s*(-?\d+(?:[.,]\d+)?)(?:\s|$)/i);
  if (between) {
    const min = toNumber(between[1]);
    const max = toNumber(between[2]);
    if (min !== null && max !== null && max > min) return { min, max };
    return null;
  }

  const limit = range.match(/(?:^|:\s*)(<=|>=|≤|≥|<|>)\s*(-?\d+(?:[.,]\d+)?)(?:\s|$)/);
  if (limit) {
    const boundary = toNumber(limit[2]);
    if (boundary === null) return null;
    return limit[1] === "<" || limit[1] === "<=" || limit[1] === "≤"
      ? { min: null, max: boundary }
      : { min: boundary, max: null };
  }

  return null;
}

export function buildRangeBarModel(value: Pick<DocumentInsightValue, "result" | "referenceRange" | "referenceStatus">): RangeBarModel | null {
  // Only a comparison we actually performed may be drawn.
  if (value.referenceStatus !== "below" && value.referenceStatus !== "within" && value.referenceStatus !== "above") {
    return null;
  }
  const bounds = parseReferenceBounds(value.referenceRange);
  if (!bounds) return null;
  const result = toNumber(value.result);
  if (result === null) return null;

  const min = bounds.min ?? Math.min(result, bounds.max ?? result) - spanFallback(bounds);
  const max = bounds.max ?? Math.max(result, bounds.min ?? result) + spanFallback(bounds);
  if (!(max > min)) return null;

  // A quarter-band of padding on each side keeps an in-range marker away from
  // the track edge, so "just inside" never reads as "just outside".
  const padding = (max - min) * 0.25;
  const trackMin = min - padding;
  const trackMax = max + padding;
  const span = trackMax - trackMin;

  const rawPosition = (result - trackMin) / span;
  const markerPosition = clamp(rawPosition);

  return {
    bandStart: clamp((min - trackMin) / span),
    bandEnd: clamp((max - trackMin) / span),
    markerPosition,
    clamped: rawPosition !== markerPosition,
    lowLabel: bounds.min === null ? "" : formatNumber(bounds.min),
    highLabel: bounds.max === null ? "" : formatNumber(bounds.max)
  };
}

function spanFallback(bounds: Bounds) {
  const anchor = Math.abs(bounds.min ?? bounds.max ?? 1);
  return Math.max(anchor * 0.5, 1);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function toNumber(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.trim().match(/^[<>≤≥~]?\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match?.[1]) return null;
  const raw = match[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}\.\d{3}$/.test(raw)
      ? raw.replace(".", "")
      : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
