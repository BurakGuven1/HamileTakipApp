import assert from "node:assert/strict";
import test from "node:test";

import {
  combineHypertensionAndProteinuria,
  detectDocumentRedFlags
} from "./redFlags.ts";

const PREGNANT = { pregnancyStatus: "pregnant", trimester: 3, pregnancyWeek: 30 };
const SECOND_TRIMESTER = { pregnancyStatus: "pregnant", trimester: 2, pregnancyWeek: 20 };
const NOT_PREGNANT = { pregnancyStatus: "not_pregnant", trimester: null, pregnancyWeek: null };

function value(testName, result, unit, overrides = {}) {
  return {
    testName,
    result,
    unit,
    referenceRange: "",
    documentMarker: "none",
    confidence: "high",
    pageNumber: 1,
    referenceStatus: "unclassified",
    referenceExplanation: "",
    interpretability: "explained",
    notInterpretableReason: "",
    contextNote: "",
    trimesterSensitive: false,
    plainLanguage: {
      whatItIs: "",
      resultSummary: "",
      possibleMeaning: "",
      symptomContext: [],
      clinicianContext: "",
      sourceLabel: "",
      sourceUrl: ""
    },
    ...overrides
  };
}

test("a markedly low hemoglobin raises a same-day red flag", () => {
  const flags = detectDocumentRedFlags([value("Hemoglobin", "6,4", "g/dL")], PREGNANT);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].id, "hemoglobin");
  assert.equal(flags[0].severity, "today");
  assert.equal(flags[0].source, "lab_document");
  assert.match(flags[0].action, /bugün doktorunla paylaş/);
  assert.match(flags[0].sourceUrl, /^https:\/\//);
});

test("every red flag carries a source", () => {
  const flags = detectDocumentRedFlags(
    [
      value("Hemoglobin", "6,4", "g/dL"),
      value("ALT", "180", "U/L"),
      value("Glukoz", "240", "mg/dL")
    ],
    PREGNANT
  );
  assert.equal(flags.length, 3);
  for (const flag of flags) {
    assert.ok(flag.sourceLabel.length > 0);
    assert.match(flag.sourceUrl, /^https:\/\//);
  }
});


test("hemoglobin is graded rather than silent until severe anaemia", () => {
  // WHO 2024: anaemia in pregnancy below 11,0 g/dL (10,5 in the 2nd trimester);
  // moderate 7,0-9,9; severe below 7,0. Waiting for 7,0 was far too late.
  const severity = (hb, context = PREGNANT) =>
    detectDocumentRedFlags([value("Hemoglobin", hb, "g/dL")], context)[0]?.severity ?? null;
  assert.equal(severity("6,4"), "today");
  assert.equal(severity("8,6"), "today");
  assert.equal(severity("10,4"), "soon");
  assert.equal(severity("11,2"), null);
});

test("the second trimester uses its own lower anaemia cut-off", () => {
  // Plasma volume expansion dilutes haemoglobin most in mid-pregnancy, so the
  // guideline line moves to 10,5 g/dL and the app must not alarm above it.
  assert.deepEqual(detectDocumentRedFlags([value("Hemoglobin", "10,7", "g/dL")], SECOND_TRIMESTER), []);
  const third = detectDocumentRedFlags([value("Hemoglobin", "10,7", "g/dL")], PREGNANT);
  assert.equal(third.length, 1);
  assert.equal(third[0].severity, "soon");
});

test("a gently raised liver enzyme is noted, a doubled one is escalated", () => {
  // ACOG's severe-feature criterion is transaminases above twice the upper
  // limit of normal, taken here as 70 U/L against a 35-40 U/L lab limit.
  const severity = (result) =>
    detectDocumentRedFlags([value("ALT", result, "U/L")], PREGNANT)[0]?.severity ?? null;
  assert.equal(severity("32"), null);
  assert.equal(severity("48"), "soon");
  assert.equal(severity("120"), "today");
});

test("glucose follows the ADA hypoglycaemia levels", () => {
  const severity = (result) =>
    detectDocumentRedFlags([value("Glukoz", result, "mg/dL")], PREGNANT)[0]?.severity ?? null;
  assert.equal(severity("48"), "today");
  assert.equal(severity("64"), "soon");
  assert.equal(severity("92"), null);
  // No "soon" tier above normal on purpose: an ordinary post-meal sample would
  // otherwise fire on almost every report.
  assert.equal(severity("140"), null);
  assert.equal(severity("240"), "today");
});

test("a common benign gestational thrombocytopenia is worded as such", () => {
  const mild = detectDocumentRedFlags([value("Trombosit", "128", "10^3/uL")], PREGNANT);
  assert.equal(mild.length, 1);
  assert.equal(mild[0].severity, "soon");
  assert.match(mild[0].observation, /sik goruluir|sık görülür/);
  assert.equal(detectDocumentRedFlags([value("Trombosit", "82", "10^3/uL")], PREGNANT)[0].severity, "today");
});

test("more severe findings are listed before milder ones", () => {
  const flags = detectDocumentRedFlags(
    [value("Hemoglobin", "10,6", "g/dL"), value("Glukoz", "240", "mg/dL")],
    PREGNANT
  );
  assert.deepEqual(flags.map((flag) => flag.severity), ["today", "soon"]);
});

test("proteinuria is reported as needing the blood pressure beside it", () => {
  const flags = detectDocumentRedFlags([value("Idrarda Protein", "+2", "")], PREGNANT);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].severity, "today");
  assert.match(flags[0].observation, /tansiyon/);
  // Naming a condition from a urine strip alone is exactly what must not happen.
  assert.doesNotMatch(flags[0].observation, /preeklampsi|tanı|teşhis|tedavi/i);
  assert.match(flags[0].action, /tanı koymaz/);
});

test("a negative or unreadable urine protein says nothing at all", () => {
  assert.deepEqual(detectDocumentRedFlags([value("Idrarda Protein", "Negatif", "")], PREGNANT), []);
  assert.deepEqual(detectDocumentRedFlags([value("Idrarda Protein", "belirsiz", "")], PREGNANT), []);
});

test("a raised blood pressure and proteinuria together become one higher warning", () => {
  const combined = combineHypertensionAndProteinuria([
    flag("blood_pressure_high", "today", "manual_measurement"),
    flag("proteinuria_1_plus", "soon", "lab_document")
  ]);
  assert.equal(combined.length, 1);
  assert.equal(combined[0].id, "blood_pressure_with_proteinuria");
  assert.equal(combined[0].severity, "urgent");
  assert.doesNotMatch(combined[0].observation, /preeklampsi|tanı|teşhis|tedavi/i);
  assert.match(combined[0].action, /tanı koymaz/);
});

test("either finding alone is left as its own separate card", () => {
  const only = [flag("proteinuria_1_plus", "soon", "lab_document")];
  assert.deepEqual(combineHypertensionAndProteinuria(only), only);
});

test("every severity level uses non-diagnostic, non-urgency-verdict wording", () => {
  const flags = detectDocumentRedFlags(
    [value("Hemoglobin", "6,1", "g/dL"), value("Trombosit", "128", "10^3/uL")],
    PREGNANT
  );
  assert.ok(flags.length >= 2);
  for (const item of flags) {
    assert.match(item.action, /aciliyet/);
  }
});

function flag(id, severity, source) {
  return {
    id,
    testName: "Test",
    observation: "x",
    action: "y",
    severity,
    source,
    sourceLabel: "Kaynak",
    sourceUrl: "https://example.org/"
  };
}

test("a value just inside the mildest tier does not raise a flag", () => {
  // The boundary belongs to the doctor, not to an attention-grabbing card.
  assert.deepEqual(detectDocumentRedFlags([value("Hemoglobin", "11", "g/dL")], PREGNANT), []);
  assert.deepEqual(detectDocumentRedFlags([value("Hemoglobin", "11,1", "g/dL")], PREGNANT), []);
  assert.equal(detectDocumentRedFlags([value("Hemoglobin", "10,99", "g/dL")], PREGNANT).length, 1);
});

test("a threshold at-or-above boundary fires exactly at the boundary", () => {
  assert.equal(detectDocumentRedFlags([value("ALT", "40", "U/L")], PREGNANT).length, 1);
  assert.equal(detectDocumentRedFlags([value("ALT", "39,9", "U/L")], PREGNANT).length, 0);
});

test("a mismatched unit never fires a threshold written for another unit", () => {
  // 118 g/L is a perfectly ordinary hemoglobin; read as g/dL it would be absurd.
  assert.deepEqual(detectDocumentRedFlags([value("Hemoglobin", "6,4", "g/L")], PREGNANT), []);
  assert.deepEqual(detectDocumentRedFlags([value("Hemoglobin", "6,4", "")], PREGNANT), []);
});

test("an unreliable OCR line cannot raise an alarm", () => {
  assert.deepEqual(
    detectDocumentRedFlags([value("Hemoglobin", "6,4", "g/dL", { confidence: "low" })], PREGNANT),
    []
  );
});

test("a bounded result such as \"<5\" is not treated as an exact number", () => {
  assert.deepEqual(detectDocumentRedFlags([value("Glukoz", "<50", "mg/dL")], PREGNANT), []);
});

test("pregnancy-only rules stay silent outside pregnancy", () => {
  const pregnancyOnly = [
    value("Kreatinin", "1,3", "mg/dL"),
    value("Trombosit", "80", "10^3/uL")
  ];
  assert.equal(detectDocumentRedFlags(pregnancyOnly, PREGNANT).length, 2);
  assert.deepEqual(detectDocumentRedFlags(pregnancyOnly, NOT_PREGNANT), []);
});

test("the same rule is reported once even across repeated pages", () => {
  const flags = detectDocumentRedFlags(
    [value("Hemoglobin", "6,4", "g/dL"), value("Hemoglobin", "6,2", "g/dL", { pageNumber: 2 })],
    PREGNANT
  );
  assert.equal(flags.length, 1);
});

test("an ordinary report raises nothing at all", () => {
  assert.deepEqual(
    detectDocumentRedFlags(
      [
        value("Hemoglobin", "12,4", "g/dL"),
        value("Trombosit", "240", "10^3/uL"),
        value("Glukoz", "88", "mg/dL"),
        value("ALT", "18", "U/L"),
        value("CRP", "3", "mg/L")
      ],
      PREGNANT
    ),
    []
  );
});

test("no red flag text claims a diagnosis", () => {
  const flags = detectDocumentRedFlags(
    [value("Hemoglobin", "6,4", "g/dL"), value("CRP", "140", "mg/L"), value("Kreatinin", "1,4", "mg/dL")],
    PREGNANT
  );
  assert.ok(flags.length >= 3);
  for (const flag of flags) {
    const text = `${flag.observation} ${flag.action}`;
    assert.doesNotMatch(text, /teşhis|tanı|tedavi|hastalığı?n var|acil servise/i);
  }
});
