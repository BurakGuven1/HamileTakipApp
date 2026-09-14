import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVitalSignTrend,
  encodeVitalSignNote,
  evaluateVitalSigns,
  parseTemperatureNote,
  validateVitalSignDraft
} from "./vitalSigns.ts";

const PREGNANT = { pregnancyStatus: "pregnant", trimester: 3, pregnancyWeek: 32 };
const NOT_PREGNANT = { pregnancyStatus: "not_pregnant", trimester: null, pregnancyWeek: null };

function draft(overrides = {}) {
  return {
    measuredAt: new Date(Date.now() - 60_000),
    systolic: "118",
    diastolic: "74",
    temperature: "",
    ...overrides
  };
}

function reading(overrides = {}) {
  return {
    measuredAt: "2026-09-01T09:00:00.000Z",
    systolic: null,
    diastolic: null,
    temperatureCelsius: null,
    note: null,
    ...overrides
  };
}

test("a valid entry becomes a reading", () => {
  const result = validateVitalSignDraft(draft({ temperature: "37,1" }));
  assert.equal(result.ok, true);
  assert.equal(result.reading.systolic, 118);
  assert.equal(result.reading.diastolic, 74);
  assert.equal(result.reading.temperatureCelsius, 37.1);
});

test("half a blood pressure is refused", () => {
  // A lone systolic cannot be compared against a guideline written as a pair.
  const result = validateVitalSignDraft(draft({ diastolic: "" }));
  assert.equal(result.ok, false);
  assert.match(result.message, /birlikte gir/);
});

test("a temperature on its own is a complete entry", () => {
  const result = validateVitalSignDraft(draft({ systolic: "", diastolic: "", temperature: "38,4" }));
  assert.equal(result.ok, true);
  assert.equal(result.reading.systolic, null);
  assert.equal(result.reading.temperatureCelsius, 38.4);
});

test("an empty entry and a non-numeric entry are both rejected", () => {
  assert.equal(validateVitalSignDraft(draft({ systolic: "", diastolic: "", temperature: "" })).ok, false);
  assert.equal(validateVitalSignDraft(draft({ systolic: "yüz on sekiz" })).ok, false);
  assert.equal(validateVitalSignDraft(draft({ temperature: "otuz sekiz" })).ok, false);
});

test("an implausible number is caught before it can become a warning", () => {
  // A typed "1400" must never be read as a severe-range systolic.
  assert.equal(validateVitalSignDraft(draft({ systolic: "1400", diastolic: "90" })).ok, false);
  assert.equal(validateVitalSignDraft(draft({ systolic: "", diastolic: "", temperature: "380" })).ok, false);
  assert.equal(validateVitalSignDraft(draft({ systolic: "90", diastolic: "120" })).ok, false);
});

test("a measurement dated in the future is a picker slip, not a reading", () => {
  const future = new Date(Date.now() + 48 * 60 * 60_000);
  assert.equal(validateVitalSignDraft(draft({ measuredAt: future })).ok, false);
});

test("an ordinary blood pressure says nothing at all", () => {
  assert.deepEqual(evaluateVitalSigns(reading({ systolic: 118, diastolic: 74 }), PREGNANT), []);
  assert.deepEqual(evaluateVitalSigns(reading({ temperatureCelsius: 37.2 }), PREGNANT), []);
});

test("140/90 asks for a conversation today, 160/110 for same-day assessment", () => {
  // ACOG Practice Bulletin 222: gestational hypertension 140-159 / 90-109;
  // severe range at or above 160 / 110.
  const severity = (systolic, diastolic) =>
    evaluateVitalSigns(reading({ systolic, diastolic }), PREGNANT)[0]?.severity ?? null;
  assert.equal(severity(138, 88), null);
  assert.equal(severity(142, 88), "today");
  assert.equal(severity(130, 92), "today");
  assert.equal(severity(162, 95), "urgent");
  assert.equal(severity(150, 112), "urgent");
});

test("a raised single reading says plainly that one reading is not enough", () => {
  const [flag] = evaluateVitalSigns(reading({ systolic: 144, diastolic: 92 }), PREGNANT);
  assert.match(flag.observation, /iki ayrı ölçüme/);
});

test("fever follows the 38 / 39 degree split", () => {
  // ACOG: 38,0-38,9 °C is fever when it persists on a repeat; 39,0 °C is fever
  // on a single reading.
  const severity = (temperatureCelsius) =>
    evaluateVitalSigns(reading({ temperatureCelsius }), PREGNANT)[0]?.severity ?? null;
  assert.equal(severity(37.9), null);
  assert.equal(severity(38), "today");
  assert.equal(severity(38.6), "today");
  assert.equal(severity(39.1), "urgent");
});

test("manual measurements are tagged as the reader's own, not as a lab finding", () => {
  const flags = evaluateVitalSigns(reading({ systolic: 165, diastolic: 112, temperatureCelsius: 38.5 }), PREGNANT);
  assert.equal(flags.length, 2);
  for (const flag of flags) {
    assert.equal(flag.source, "manual_measurement");
    assert.match(flag.sourceUrl, /^https:\/\//);
    assert.ok(flag.sourceLabel.length > 0);
  }
});

test("no vital sign wording claims a diagnosis", () => {
  const flags = [
    ...evaluateVitalSigns(reading({ systolic: 168, diastolic: 114 }), PREGNANT),
    ...evaluateVitalSigns(reading({ temperatureCelsius: 39.4 }), NOT_PREGNANT)
  ];
  assert.ok(flags.length >= 2);
  for (const flag of flags) {
    assert.doesNotMatch(flag.observation, /preeklampsi|teşhis|tedavi|hastalığın var/i);
    assert.match(flag.action, /tanı koymaz/);
    assert.match(flag.action, /aciliyet değerlendirmesi yapmaz/);
  }
});

test("a temperature survives a round trip through the note field", () => {
  // There is no temperature column, so the note carries it in one fixed shape.
  const encoded = encodeVitalSignNote(38.4, "Akşam ölçtüm");
  const decoded = parseTemperatureNote(encoded);
  assert.equal(decoded.temperatureCelsius, 38.4);
  assert.equal(decoded.note, "Akşam ölçtüm");

  const withoutNote = parseTemperatureNote(encodeVitalSignNote(37, null));
  assert.equal(withoutNote.temperatureCelsius, 37);
  assert.equal(withoutNote.note, null);
});

test("a free-text note that is not a temperature is left untouched", () => {
  assert.deepEqual(parseTemperatureNote("Doktor kontrolünde ölçüldü"), {
    temperatureCelsius: null,
    note: "Doktor kontrolünde ölçüldü"
  });
  assert.equal(parseTemperatureNote(null).temperatureCelsius, null);
  // An out-of-range number in the note must not be resurrected as a reading.
  assert.equal(parseTemperatureNote("Ateş: 99 °C").temperatureCelsius, null);
});

test("the trend reports movement without judging it", () => {
  const readings = [
    reading({ measuredAt: "2026-09-03T08:00:00.000Z", systolic: 132, diastolic: 84 }),
    reading({ measuredAt: "2026-09-01T08:00:00.000Z", systolic: 120, diastolic: 78 }),
    reading({ measuredAt: "2026-09-02T08:00:00.000Z", systolic: 126, diastolic: 80 })
  ];
  const trend = buildVitalSignTrend(readings, (item) => item.systolic);
  assert.equal(trend.latest, 132);
  assert.equal(trend.previous, 126);
  assert.equal(trend.direction, "up");
  assert.equal(trend.count, 3);
});

test("a single reading has no direction to report", () => {
  const trend = buildVitalSignTrend([reading({ systolic: 120, diastolic: 78 })], (item) => item.systolic);
  assert.equal(trend.direction, null);
  assert.equal(trend.previous, null);
});

test("readings missing a measurement are skipped rather than counted as zero", () => {
  const trend = buildVitalSignTrend(
    [
      reading({ measuredAt: "2026-09-02T08:00:00.000Z", temperatureCelsius: 37.4 }),
      reading({ measuredAt: "2026-09-01T08:00:00.000Z", systolic: 120, diastolic: 78 })
    ],
    (item) => item.temperatureCelsius
  );
  assert.equal(trend.count, 1);
  assert.equal(trend.latest, 37.4);
  assert.equal(trend.direction, null);
});
