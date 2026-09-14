import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInterpretationGuard,
  GENERIC_SOURCE_URL,
  hasCitableSource,
  isPregnancySensitiveTest
} from "./interpretationGuard.ts";

const PREGNANT = { pregnancyStatus: "pregnant", trimester: 2, pregnancyWeek: 20 };
const NOT_PREGNANT = { pregnancyStatus: "not_pregnant", trimester: null, pregnancyWeek: null };
const UNKNOWN = { pregnancyStatus: "unknown", trimester: null, pregnancyWeek: null };

function makeValue(overrides = {}) {
  const { plainLanguage: plainLanguageOverrides, ...rest } = overrides;
  return {
    testName: "Hemoglobin",
    result: "11,8",
    unit: "g/dL",
    referenceRange: "11,5-15,5",
    documentMarker: "none",
    confidence: "high",
    pageNumber: 1,
    referenceStatus: "within",
    referenceExplanation: "",
    interpretability: "explained",
    notInterpretableReason: "",
    contextNote: "",
    trimesterSensitive: false,
    plainLanguage: {
      whatItIs: "Alyuvarların oksijen taşıyan proteinidir.",
      resultSummary: "Aralığın içinde görünüyor.",
      possibleMeaning: "Belgedeki aralık içinde görünüyor.",
      symptomContext: ["Yorgunluk"],
      clinicianContext: "Diğer değerlerle birlikte değerlendirilir.",
      sourceLabel: "MedlinePlus — Hemoglobin Test",
      sourceUrl: "https://medlineplus.gov/lab-tests/hemoglobin-test/",
      ...(plainLanguageOverrides ?? {})
    },
    ...rest
  };
}

test("a value compared against the document's own range stays explained", () => {
  // ALT does not shift with pregnancy, so the lab's own comparison stands.
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "ALT",
      unit: "U/L",
      referenceRange: "0-35",
      plainLanguage: { sourceLabel: "MedlinePlus — ALT", sourceUrl: "https://medlineplus.gov/lab-tests/alt-blood-test/" }
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "explained");
  assert.equal(guarded.notInterpretableReason, "");
  assert.equal(guarded.contextNote, "");
  assert.ok(guarded.plainLanguage.possibleMeaning);
});

test("a pregnancy-shifted test compared against a general adult range is contextual", () => {
  // Previously this was shown as a full interpretation, which silently applied
  // non-pregnant thresholds to a pregnant reader.
  const guarded = applyInterpretationGuard(makeValue(), PREGNANT);
  assert.equal(guarded.interpretability, "contextual");
  assert.equal(guarded.notInterpretableReason, "");
  assert.match(guarded.contextNote, /gebe olmayan yetişkinler için/);
  // The comparison and the definition survive; the meaning sentences do not.
  assert.ok(guarded.plainLanguage.whatItIs);
  assert.ok(guarded.plainLanguage.resultSummary);
  assert.equal(guarded.plainLanguage.possibleMeaning, "");
  assert.deepEqual(guarded.plainLanguage.symptomContext, []);
});

test("thyroid results are contextualised rather than hidden", () => {
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "TSH",
      unit: "uIU/mL",
      result: "3,4",
      referenceRange: "0,55-4,78",
      plainLanguage: { sourceLabel: "MedlinePlus — TSH", sourceUrl: "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/" }
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "contextual");
  assert.ok(guarded.plainLanguage.resultSummary);
});

test("hCG never earns a verdict during pregnancy even with a printed range", () => {
  // What is clinically meaningful is the change over roughly 48 hours, not the
  // level, so a single value is contextualised and never called good or bad.
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "Beta hCG",
      unit: "mIU/mL",
      result: "48000",
      referenceRange: "0-5",
      referenceStatus: "above",
      plainLanguage: { sourceLabel: "ACOG", sourceUrl: "https://www.acog.org/" }
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "contextual");
  assert.match(guarded.contextNote, /tek ölçüm tek başına yorumlanamaz/);
  assert.equal(guarded.plainLanguage.possibleMeaning, "");
});

test("a gestational diabetes screening result stays uninterpreted, not contextual", () => {
  // Contextualising this one would still leave the reader with a number she
  // would reasonably read as an answer to a question the test does not answer.
  for (const testName of ["HbA1c", "Oral Glukoz Tolerans Testi", "Gebelik şekeri yükleme"]) {
    const guarded = applyInterpretationGuard(
      makeValue({
        testName,
        unit: "%",
        result: "5,9",
        referenceRange: "4,0-5,6",
        referenceStatus: "above",
        plainLanguage: { sourceLabel: "MedlinePlus", sourceUrl: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/" }
      }),
      PREGNANT
    );
    assert.equal(guarded.interpretability, "not_interpretable", testName);
    assert.equal(guarded.contextNote, "");
  }
});

test("a contextual value never carries a not-interpretable reason and vice versa", () => {
  const contextual = applyInterpretationGuard(makeValue(), PREGNANT);
  const suppressed = applyInterpretationGuard(makeValue({ confidence: "low" }), PREGNANT);
  assert.equal(contextual.notInterpretableReason, "");
  assert.equal(suppressed.contextNote, "");
});

test("a low confidence read is never interpreted", () => {
  // A misread decimal point turns a normal hemoglobin into an alarming one, so
  // an unreliable line gets the number shown and nothing else.
  const guarded = applyInterpretationGuard(makeValue({ confidence: "low" }), PREGNANT);
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.equal(guarded.plainLanguage.possibleMeaning, "");
  assert.deepEqual(guarded.plainLanguage.symptomContext, []);
  assert.match(guarded.notInterpretableReason, /güvenle okunamadı/);
});

test("an interpretation without a citable source is removed entirely", () => {
  const guarded = applyInterpretationGuard(
    makeValue({ plainLanguage: { sourceLabel: "", sourceUrl: "" } }),
    NOT_PREGNANT
  );
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.equal(guarded.plainLanguage.whatItIs, "");
  assert.equal(guarded.plainLanguage.sourceUrl, "");
});

test("an http source is not accepted as a source", () => {
  assert.equal(
    hasCitableSource({ plainLanguage: { sourceLabel: "X", sourceUrl: "http://example.com" } }),
    false
  );
  assert.equal(
    hasCitableSource({ plainLanguage: { sourceLabel: "X", sourceUrl: "https://example.com" } }),
    true
  );
});

test("a test missing from the knowledge list gets no invented meaning", () => {
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "Bilinmeyen Tetkik",
      plainLanguage: { sourceUrl: GENERIC_SOURCE_URL, sourceLabel: "MedlinePlus" }
    }),
    NOT_PREGNANT
  );
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.match(guarded.notInterpretableReason, /sözlüğünde bulunmuyor/);
  assert.equal(guarded.plainLanguage.whatItIs, "");
});

test("a pregnancy-shifted test with only a lab marker is not interpreted while pregnant", () => {
  const guarded = applyInterpretationGuard(
    makeValue({
      referenceStatus: "document_marked",
      documentMarker: "low",
      referenceRange: ""
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.match(guarded.notInterpretableReason, /gebelik dönemine ve haftasına göre değişir/);
});

test("the same value is interpreted for a user who is not pregnant", () => {
  const guarded = applyInterpretationGuard(
    makeValue({ referenceStatus: "document_marked", documentMarker: "low", referenceRange: "" }),
    NOT_PREGNANT
  );
  assert.equal(guarded.interpretability, "explained");
});

test("an unknown pregnancy status is treated as possibly pregnant", () => {
  // Guessing "not pregnant" for a pregnancy app is the wrong way to be wrong.
  const guarded = applyInterpretationGuard(
    makeValue({ referenceStatus: "document_marked", documentMarker: "low", referenceRange: "" }),
    UNKNOWN
  );
  assert.equal(guarded.interpretability, "not_interpretable");
});

test("a pregnancy-specific range printed by the lab restores the interpretation", () => {
  const guarded = applyInterpretationGuard(
    makeValue({
      referenceStatus: "document_marked",
      documentMarker: "low",
      referenceRange: "Gebelik 2. trimester: 10,5-14,0"
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "explained");
});

test("HbA1c thresholds are never applied during pregnancy", () => {
  // The 5.7 / 6.5 cut-offs are non-pregnancy adult screening thresholds and are
  // not used to identify gestational diabetes.
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "HbA1c",
      unit: "%",
      result: "5,9",
      referenceRange: "4,0-5,6",
      referenceStatus: "above",
      plainLanguage: { sourceLabel: "MedlinePlus — HbA1c", sourceUrl: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/" }
    }),
    PREGNANT
  );
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.match(guarded.notInterpretableReason, /gebelik dışı yetişkinler/);
});

test("a value with no range and no marker is left unclassified rather than guessed", () => {
  const guarded = applyInterpretationGuard(
    makeValue({
      testName: "ALT",
      unit: "U/L",
      referenceRange: "",
      referenceStatus: "unclassified",
      documentMarker: "none",
      plainLanguage: { sourceLabel: "MedlinePlus — ALT", sourceUrl: "https://medlineplus.gov/lab-tests/alt-blood-test/" }
    }),
    NOT_PREGNANT
  );
  assert.equal(guarded.interpretability, "not_interpretable");
  assert.match(guarded.notInterpretableReason, /karşılaştırılabilen bir referans aralığı/);
});

test("pregnancy sensitivity is recognised from Turkish and English test names", () => {
  assert.equal(isPregnancySensitiveTest("Hemoglobin (HGB)"), true);
  assert.equal(isPregnancySensitiveTest("TSH"), true);
  assert.equal(isPregnancySensitiveTest("Serbest T4"), true);
  assert.equal(isPregnancySensitiveTest("Trombosit"), true);
  assert.equal(isPregnancySensitiveTest("ALT"), false);
});
