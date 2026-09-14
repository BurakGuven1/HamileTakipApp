import type {
  DocumentInterpretationContext,
  DocumentRedFlag,
  DocumentRedFlagSeverity
} from "@/features/document-insight/types";

/**
 * Blood pressure and temperature are the two numbers a pregnant reader is most
 * often told to "keep an eye on" and has nowhere to put. This module is the
 * logic half of that: parsing what she types, deciding what — if anything — is
 * worth saying about it, and summarising the history.
 *
 * Everything here follows the same rules as the lab reader:
 *
 * - thresholds come from published guidelines and carry their source in a
 *   comment, so a clinician can audit them,
 * - severities are graded rather than binary,
 * - nothing names a condition. A cuff reading and a thermometer cannot
 *   diagnose anything, and the wording never pretends otherwise,
 * - a reading that cannot be parsed with certainty is rejected, not guessed.
 *
 * These numbers do not come from a laboratory report, so every flag they raise
 * is tagged `manual_measurement` and the UI labels it as the reader's own
 * measurement rather than a lab finding.
 */

export type VitalSignReading = {
  /** ISO timestamp of when the measurement was taken. */
  measuredAt: string;
  systolic: number | null;
  diastolic: number | null;
  temperatureCelsius: number | null;
  note: string | null;
};

export type VitalSignDraft = {
  measuredAt: Date;
  systolic: string;
  diastolic: string;
  temperature: string;
  note?: string;
};

export type VitalSignValidation =
  | { ok: true; reading: VitalSignReading }
  | { ok: false; message: string };

/**
 * Plausibility bounds, not clinical limits. Their only job is to catch a typo
 * (a systolic of "1400", a temperature of "380") before it becomes a warning.
 */
const LIMITS = {
  systolic: { min: 60, max: 260 },
  diastolic: { min: 30, max: 180 },
  temperature: { min: 33, max: 43 }
} as const;

const SOURCE = {
  acogHypertensive: {
    label: "ACOG — Gestational Hypertension and Preeclampsia (Practice Bulletin 222)",
    url: "https://www.aafp.org/afp/2019/1115/p649"
  },
  acogFever: {
    label: "ACOG — Intrapartum Management of Intraamniotic Infection",
    url: "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/08/intrapartum-management-of-intraamniotic-infection"
  }
} as const;

const ACTION: Record<DocumentRedFlagSeverity, string> = {
  urgent:
    "Bu ölçümü bugün içinde bir sağlık kuruluşunda değerlendirtmen isteniyor. Bu ekran tanı koymaz ve aciliyet değerlendirmesi yapmaz; kendini kötü hissediyorsan beklemeden başvur.",
  today: "Bu ölçümü bugün doktorunla paylaş. Bu ekran tanı koymaz ve aciliyet değerlendirmesi yapmaz.",
  soon: "Bu ölçümü ilk görüşmende doktoruna göster. Bu ekran tanı koymaz ve aciliyet değerlendirmesi yapmaz."
};

/**
 * A single temperature has nowhere to live in `pregnancy_visit_measurements`,
 * which carries blood pressure, pulse and fetal measurements but no thermometer
 * column. Rather than lose the reading, it is written into the row's free-text
 * note in one fixed shape and read back out of it. The prefix is deliberately
 * something a person would also be happy to read in the timeline.
 *
 * If a temperature column is ever added, `parseTemperatureNote` is the only
 * place that has to change.
 */
const TEMPERATURE_NOTE_PREFIX = "Ateş";
const TEMPERATURE_NOTE = /^Ateş:\s*(\d{2}(?:[.,]\d)?)\s*°C(?:\s*·\s*(.*))?$/;

export function encodeVitalSignNote(temperatureCelsius: number | null, note: string | null) {
  const trimmed = note?.trim() || "";
  if (temperatureCelsius === null) return trimmed || null;
  const stamped = `${TEMPERATURE_NOTE_PREFIX}: ${formatTemperature(temperatureCelsius)} °C`;
  return trimmed ? `${stamped} · ${trimmed}` : stamped;
}

export function parseTemperatureNote(note: string | null | undefined) {
  const match = (note ?? "").trim().match(TEMPERATURE_NOTE);
  if (!match?.[1]) return { temperatureCelsius: null, note: note?.trim() || null };
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value < LIMITS.temperature.min || value > LIMITS.temperature.max) {
    return { temperatureCelsius: null, note: note?.trim() || null };
  }
  return { temperatureCelsius: value, note: match[2]?.trim() || null };
}

/**
 * Both halves of a blood pressure or nothing: a lone systolic cannot be
 * compared against a guideline written as a pair.
 */
export function validateVitalSignDraft(draft: VitalSignDraft): VitalSignValidation {
  const systolic = parseVitalNumber(draft.systolic);
  const diastolic = parseVitalNumber(draft.diastolic);
  const temperature = parseVitalNumber(draft.temperature);

  if (systolic === "invalid" || diastolic === "invalid" || temperature === "invalid") {
    return { ok: false, message: "Ölçümü yalnızca sayı olarak gir (örneğin 118 veya 37,4)." };
  }
  if ((systolic === null) !== (diastolic === null)) {
    return { ok: false, message: "Tansiyon için büyük ve küçük değeri birlikte gir." };
  }
  if (systolic === null && temperature === null) {
    return { ok: false, message: "En az bir ölçüm gir: tansiyon veya ateş." };
  }
  if (systolic !== null && !withinLimits(systolic, LIMITS.systolic)) {
    return { ok: false, message: `Büyük tansiyon ${LIMITS.systolic.min}–${LIMITS.systolic.max} arasında olmalı.` };
  }
  if (diastolic !== null && !withinLimits(diastolic, LIMITS.diastolic)) {
    return { ok: false, message: `Küçük tansiyon ${LIMITS.diastolic.min}–${LIMITS.diastolic.max} arasında olmalı.` };
  }
  if (systolic !== null && diastolic !== null && diastolic >= systolic) {
    return { ok: false, message: "Küçük tansiyon, büyük tansiyondan düşük olmalı. Değerleri kontrol et." };
  }
  if (temperature !== null && !withinLimits(temperature, LIMITS.temperature)) {
    return { ok: false, message: `Ateş ${LIMITS.temperature.min}–${LIMITS.temperature.max} °C arasında olmalı.` };
  }
  if (Number.isNaN(draft.measuredAt.getTime())) {
    return { ok: false, message: "Ölçüm zamanı okunamadı." };
  }
  // A measurement in the future is a date-picker slip, not a reading.
  if (draft.measuredAt.getTime() > Date.now() + 60_000) {
    return { ok: false, message: "Ölçüm zamanı gelecekte olamaz." };
  }
  const note = draft.note?.trim() || null;
  if (note && note.length > 500) {
    return { ok: false, message: "Not en fazla 500 karakter olabilir." };
  }

  return {
    ok: true,
    reading: {
      measuredAt: draft.measuredAt.toISOString(),
      systolic,
      diastolic,
      temperatureCelsius: temperature,
      note
    }
  };
}

/**
 * Thresholds, with their sources:
 *
 * - **160/110 mmHg** — ACOG Practice Bulletin 222 calls this the severe range:
 *   "hypertension is considered severe when blood pressure is at least 160 mm Hg
 *   systolic or at least 110 mm Hg diastolic", and severe-range readings are
 *   managed the same way as preeclampsia with severe features. Hence `urgent`.
 * - **140/90 mmHg** — the same bulletin defines gestational hypertension as a
 *   systolic of 140-159 or a diastolic of 90-109 on two occasions at least four
 *   hours apart after 20 weeks. A single home reading cannot satisfy the "two
 *   occasions" part, which is precisely why this is worded as "have it checked
 *   today" and not as a finding.
 * - **38.0 °C** — ACOG's intraamniotic infection criteria treat an oral
 *   temperature of 38.0-38.9 °C as fever when it persists on a repeat 30 minutes
 *   later, and **39.0 °C** as fever on a single reading. The app mirrors that
 *   split: 38.0 asks for a same-day conversation, 39.0 asks for same-day
 *   in-person assessment.
 */
export function evaluateVitalSigns(
  reading: VitalSignReading,
  context: DocumentInterpretationContext
): DocumentRedFlag[] {
  const flags: DocumentRedFlag[] = [];
  const pregnant = context.pregnancyStatus !== "not_pregnant";

  if (reading.systolic !== null && reading.diastolic !== null) {
    const severe = reading.systolic >= 160 || reading.diastolic >= 110;
    const raised = reading.systolic >= 140 || reading.diastolic >= 90;
    if (severe || raised) {
      const severity: DocumentRedFlagSeverity = severe ? "urgent" : "today";
      flags.push({
        id: severe ? "blood_pressure_severe_range" : "blood_pressure_high",
        testName: "Tansiyon",
        observation: severe
          ? `Ölçümün ${reading.systolic}/${reading.diastolic} mmHg. Bu, gebelik takibinde ayrıca ve aynı gün değerlendirilen aralıkta (160/110 mmHg ve üzeri) görünüyor.`
          : `Ölçümün ${reading.systolic}/${reading.diastolic} mmHg. Bu, gebelikte ayrıca izlenen sınırın (140/90 mmHg) üstünde görünüyor. Tek bir ev ölçümü tek başına bir sonuç göstermez; rehberler en az iki ayrı ölçüme bakar.`,
        action: ACTION[severity],
        severity,
        source: "manual_measurement",
        sourceLabel: SOURCE.acogHypertensive.label,
        sourceUrl: SOURCE.acogHypertensive.url
      });
    }
  }

  if (reading.temperatureCelsius !== null && reading.temperatureCelsius >= 38) {
    const high = reading.temperatureCelsius >= 39;
    const severity: DocumentRedFlagSeverity = high ? "urgent" : "today";
    flags.push({
      id: high ? "fever_high" : "fever",
      testName: "Ateş",
      observation: high
        ? `Ateşin ${formatTemperature(reading.temperatureCelsius)} °C. Rehberler tek bir ölçümde 39 °C ve üzerini ateş olarak kabul eder.`
        : `Ateşin ${formatTemperature(reading.temperatureCelsius)} °C. Rehberler 38 °C ve üzerini ateş olarak kabul eder${pregnant ? "; gebelikte ateş ayrıca değerlendirilir" : ""}.`,
      action: ACTION[severity],
      severity,
      source: "manual_measurement",
      sourceLabel: SOURCE.acogFever.label,
      sourceUrl: SOURCE.acogFever.url
    });
  }

  return flags;
}

export type VitalSignTrend = {
  /** Most recent reading that carried the measurement at all. */
  latest: number | null;
  previous: number | null;
  direction: "up" | "down" | "flat" | null;
  /** How many readings in the list carried this measurement. */
  count: number;
};

/**
 * Deliberately arithmetic only. A direction arrow says the number moved, never
 * that the movement is good or bad — that reading belongs to the doctor.
 */
export function buildVitalSignTrend(
  readings: VitalSignReading[],
  pick: (reading: VitalSignReading) => number | null
): VitalSignTrend {
  const values = sortByMeasuredAt(readings)
    .map(pick)
    .filter((value): value is number => value !== null);
  const latest = values.at(0) ?? null;
  const previous = values.at(1) ?? null;
  if (latest === null || previous === null) {
    return { latest, previous, direction: null, count: values.length };
  }
  // A hair's-breadth difference is measurement noise, not a trend.
  const delta = latest - previous;
  const direction = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  return { latest, previous, direction, count: values.length };
}

/** Newest first. */
export function sortByMeasuredAt(readings: VitalSignReading[]) {
  return [...readings].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
}

export function formatTemperature(value: number) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function formatVitalSignDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** `null` for an empty field, `"invalid"` for anything that is not a number. */
function parseVitalNumber(text: string | undefined): number | null | "invalid" {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(trimmed)) return "invalid";
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : "invalid";
}

function withinLimits(value: number, limits: { min: number; max: number }) {
  return value >= limits.min && value <= limits.max;
}
