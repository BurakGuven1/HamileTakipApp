/**
 * Urine protein is the one common result that is usually *not* a number. Labs
 * print "Negatif", "Eser", "+1", "++", "(+)", "Pozitif", or a quantitative
 * mg/dL figure, and the same report may switch between them page to page.
 *
 * This parser recognises only formats it can name with certainty. Anything it
 * does not recognise returns `null` — never a guess, and never a default of
 * "negative", because silently reading an unknown string as "no protein" is the
 * dangerous direction to be wrong in.
 *
 * Ranks follow the dipstick ladder so a rule can compare them. ACOG treats a
 * dipstick result of 2+ as meeting the proteinuria criterion, which is rank 2
 * here; trace and 1+ sit below it.
 *
 * Source: MedlinePlus — Protein in Urine
 * https://medlineplus.gov/lab-tests/protein-in-urine/
 */

export type ProteinuriaLevel =
  | "negative"
  | "trace"
  | "1_plus"
  | "2_plus"
  | "3_plus"
  | "4_plus"
  | "positive_unspecified"
  | "quantitative";

export type ProteinuriaReading = {
  level: ProteinuriaLevel;
  /**
   * Dipstick ladder position: negative 0, trace 0.5, +1 … +4 as 1…4. An
   * ungraded "pozitif" is ranked 1, the lowest rank that still means protein
   * was found, so it can never be treated as more severe than it is.
   */
  rank: number;
  /** False only for an explicit negative result. */
  detected: boolean;
  /** Quantitative mg/dL value when the report printed one. */
  milligramsPerDeciliter: number | null;
  /** Human-readable echo of what the report actually said. */
  displayValue: string;
};

/**
 * The dipstick pad turns colour at roughly 15-30 mg/dL, which laboratories
 * report as trace-to-1+. Below that a quantitative result is treated as no
 * protein detected; at or above it, as detected — but the exact mg/dL figure is
 * always carried through so the UI can show the real number rather than a band.
 */
const QUANTITATIVE_DETECTION_MG_DL = 15;
const QUANTITATIVE_ONE_PLUS_MG_DL = 30;

const NEGATIVE = /^(?:negatif|negative|neg|yok|saptanmadi|saptanmadı|bulunmadi|bulunmadı|normal|\(-\)|-)$/;
const TRACE = /^(?:eser|eser\s*miktar(?:da)?|iz|trace|tr|\+\/-|±)$/;
const POSITIVE_UNSPECIFIED = /^(?:pozitif|positive|poz|var|saptandi|saptandı|mevcut|\(\+\)|\+)$/;

export function parseProteinuria(result: string, unit = ""): ProteinuriaReading | null {
  const raw = (result ?? "").trim();
  if (!raw) return null;
  const normalized = normalize(raw);

  if (NEGATIVE.test(normalized)) {
    return reading("negative", 0, false, null, "negatif");
  }
  if (TRACE.test(normalized)) {
    return reading("trace", 0.5, true, null, "eser miktarda");
  }

  const graded = parseDipstickGrade(normalized);
  if (graded !== null) {
    return reading(gradeLevel(graded), graded, true, null, `+${graded}`);
  }

  // "+" on its own, or an ungraded "pozitif", says protein was found but not
  // how much. Ranking it above 1+ would invent a severity the report never
  // claimed.
  if (POSITIVE_UNSPECIFIED.test(normalized)) {
    return reading("positive_unspecified", 1, true, null, "pozitif");
  }

  const quantitative = parseQuantitative(raw, unit);
  if (quantitative !== null) {
    const detected = quantitative >= QUANTITATIVE_DETECTION_MG_DL;
    return reading(
      detected ? "quantitative" : "negative",
      !detected ? 0 : quantitative >= QUANTITATIVE_ONE_PLUS_MG_DL ? 1 : 0.5,
      detected,
      quantitative,
      `${formatNumber(quantitative)} mg/dL`
    );
  }

  // Unrecognised format. Saying nothing is the only safe answer.
  return null;
}

/** "+1", "1+", "++", "(++)", "2 +" — all of the ways a lab writes a grade. */
function parseDipstickGrade(normalized: string): number | null {
  const stripped = normalized.replace(/[()\s]/g, "");
  if (!stripped) return null;

  // A run of two to four plus signs and nothing else.
  const run = stripped.match(/^\++$/);
  if (run && stripped.length >= 2 && stripped.length <= 4) return stripped.length;

  // A digit next to a single plus sign, on either side.
  const digit = stripped.match(/^(?:\+([1-4])|([1-4])\+)$/);
  const value = digit?.[1] ?? digit?.[2];
  if (value) return Number(value);

  return null;
}

/**
 * A bare number is only read as mg/dL when the report actually said mg/dL.
 * Without a unit the same digits could be mg/24h, mg/L or a protein/creatinine
 * ratio, and those do not share thresholds.
 */
function parseQuantitative(raw: string, unit: string): number | null {
  const normalizedUnit = normalize(unit).replace(/\s+/g, "");
  const inlineUnit = /mg\s*\/\s*dl/i.test(raw);
  if (normalizedUnit !== "mg/dl" && !inlineUnit) return null;

  const numeric = raw.replace(/mg\s*\/\s*dl/i, "").trim();
  // A bounded result ("<15") carries no exact value to compare.
  if (/^[<>≤≥~]/.test(numeric)) return null;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(numeric)) return null;

  const value = Number(numeric.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function gradeLevel(grade: number): ProteinuriaLevel {
  return grade === 1 ? "1_plus" : grade === 2 ? "2_plus" : grade === 3 ? "3_plus" : "4_plus";
}

function reading(
  level: ProteinuriaLevel,
  rank: number,
  detected: boolean,
  milligramsPerDeciliter: number | null,
  displayValue: string
): ProteinuriaReading {
  return { level, rank, detected, milligramsPerDeciliter, displayValue };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
