import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOnDeviceDocumentResult,
  compareWithDocumentRange,
  detectSensitiveFieldTypes,
  parseMeasurementLine
} from "./documentRules.ts";

const PREGNANT = { pregnancyStatus: "pregnant", trimester: 2, pregnancyWeek: 20 };
const NOT_PREGNANT = { pregnancyStatus: "not_pregnant", trimester: null, pregnancyWeek: null };
const EARLY_PREGNANCY = { pregnancyStatus: "pregnant", trimester: 1, pregnancyWeek: 6 };

function page(lines) {
  return {
    pageNumber: 0,
    fullText: lines.join("\n"),
    lines: lines.map((text, index) => ({ text, confidence: 0.95, x: 0, y: index }))
  };
}

test("a value is only classified against the range the document printed", () => {
  assert.equal(compareWithDocumentRange("12,4", "11,5-15,5", "none").status, "within");
  assert.equal(compareWithDocumentRange("9,4", "11,5-15,5", "none").status, "below");
  assert.equal(compareWithDocumentRange("16,4", "11,5-15,5", "none").status, "above");
});

test("boundary values belong to the range, not outside it", () => {
  assert.equal(compareWithDocumentRange("11,5", "11,5-15,5", "none").status, "within");
  assert.equal(compareWithDocumentRange("15,5", "11,5-15,5", "none").status, "within");
});

test("a result with no readable range is left unclassified", () => {
  const comparison = compareWithDocumentRange("12,4", "", "none");
  assert.equal(comparison.status, "unclassified");
  assert.match(comparison.explanation, /referans aralığı görünmüyor/);
});

test("several contextual ranges defer to the laboratory's own marker", () => {
  // Choosing one of "Gebe: ...; Gebe değil: ..." automatically would be a guess
  // about the reader, so the lab's own flag is reported instead.
  const comparison = compareWithDocumentRange("2,9", "Gebe: 0,1-2,5; Gebe değil: 0,4-4,0", "high");
  assert.equal(comparison.status, "document_marked");
});

test("identifying fields are detected so they can be reported as masked", () => {
  const detected = detectSensitiveFieldTypes([
    "Hasta Adı: Ayşe Y.",
    "T.C. Kimlik No: 12345678901",
    "Telefon: 0532 111 22 33"
  ]);
  assert.ok(detected.includes("name"));
  assert.ok(detected.includes("tc_identity"));
  assert.ok(detected.includes("phone"));
});

test("a line carrying an identifier is never parsed as a measurement", () => {
  assert.equal(parseMeasurementLine("T.C. Kimlik No: 12345678901", 1), null);
  assert.equal(parseMeasurementLine("Hasta No: 4471", 1), null);
});

test("an unknown test is read but never explained", () => {
  const result = buildOnDeviceDocumentResult(
    [page(["Hemoglobin 12,4 g/dL 11,5-15,5", "Zaphod Faktörü 7,2 mg/dL 1-9"])],
    NOT_PREGNANT
  );
  const unknown = result.values.find((value) => /zaphod/i.test(value.testName));
  assert.equal(unknown, undefined, "an unrecognised test name is not treated as a lab value at all");
});

test("a pregnant reader gets no interpretation without a pregnancy-aware range", () => {
  const result = buildOnDeviceDocumentResult([page(["TSH 3,8 mIU/L YÜKSEK"])], PREGNANT);
  const tsh = result.values.find((value) => /tsh/i.test(value.testName));
  assert.ok(tsh);
  assert.equal(tsh.trimesterSensitive, true);
  assert.equal(tsh.interpretability, "not_interpretable");
  assert.equal(tsh.plainLanguage.possibleMeaning, "");
});

test("every shown interpretation carries a source", () => {
  const result = buildOnDeviceDocumentResult(
    [page(["Hemoglobin 12,4 g/dL 11,5-15,5", "ALT 22 U/L 0-35", "CRP 2 mg/L 0-5"])],
    PREGNANT
  );
  assert.ok(result.values.length > 0);
  for (const value of result.values) {
    if (value.interpretability !== "explained") continue;
    assert.ok(value.plainLanguage.sourceLabel.length > 0, `${value.testName} has no source label`);
    assert.match(value.plainLanguage.sourceUrl, /^https:\/\//);
    assert.ok(value.plainLanguage.possibleMeaning.length > 0);
  }
});

test("a suppressed value still shows its number and the document's own comparison", () => {
  const result = buildOnDeviceDocumentResult([page(["TSH 3,8 mIU/L YÜKSEK"])], PREGNANT);
  const tsh = result.values.find((value) => /tsh/i.test(value.testName));
  assert.equal(tsh.result, "3,8");
  assert.ok(tsh.referenceExplanation.length > 0);
  assert.ok(tsh.notInterpretableReason.length > 0);
});

test("a markedly low hemoglobin reaches the result as a red flag", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 6,2 g/dL 11,5-15,5"])], PREGNANT);
  assert.equal(result.redFlags.length, 1);
  assert.equal(result.redFlags[0].id, "hemoglobin");
  assert.ok(result.doctorQuestions.some((question) => /bugün ayrıca değerlendirilmeli/.test(question)));
});

test("a pregnant reader now gets a contextualised hemogram instead of a blank", () => {
  // The lab printed a general adult range. The comparison survives, labelled;
  // the sentences that would assign meaning to it do not.
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 10,8 g/dL 11,5-15,5"])], PREGNANT);
  const [value] = result.values;
  assert.equal(value.interpretability, "contextual");
  assert.equal(value.referenceStatus, "below");
  assert.match(value.contextNote, /gebe olmayan yetişkinler için/);
  assert.equal(value.plainLanguage.possibleMeaning, "");
  assert.deepEqual(value.plainLanguage.symptomContext, []);
  assert.ok(value.plainLanguage.whatItIs);
  assert.equal(value.notInterpretableReason, "");
});

test("the same value is fully explained for a reader who is not pregnant", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 10,8 g/dL 11,5-15,5"])], NOT_PREGNANT);
  assert.equal(result.values[0].interpretability, "explained");
  assert.ok(result.values[0].plainLanguage.possibleMeaning);
});

test("a pregnancy-specific range printed by the lab earns the full interpretation", () => {
  const result = buildOnDeviceDocumentResult(
    [page(["Hemoglobin 10,8 g/dL Gebelik 2. trimester: 10,5-14,0"])],
    PREGNANT
  );
  assert.equal(result.values[0].interpretability, "explained");
  assert.equal(result.values[0].contextNote, "");
});

test("HbA1c is still refused outright rather than contextualised", () => {
  const result = buildOnDeviceDocumentResult([page(["HbA1c 5,9 % 4,0-5,6"])], PREGNANT);
  assert.equal(result.values[0].interpretability, "not_interpretable");
  assert.equal(result.values[0].contextNote, "");
  assert.match(result.values[0].notInterpretableReason, /gebelik dışı yetişkinler/);
});

test("a single hCG value in pregnancy is never called high or low", () => {
  const result = buildOnDeviceDocumentResult([page(["Beta hCG 48000 mIU/mL 0-5"])], EARLY_PREGNANCY);
  const [value] = result.values;
  assert.equal(value.interpretability, "contextual");
  assert.equal(value.plainLanguage.possibleMeaning, "");
  assert.match(value.contextNote, /tek ölçüm tek başına yorumlanamaz/);
});

test("the non-pregnant hCG cut-offs still apply outside pregnancy", () => {
  const result = buildOnDeviceDocumentResult([page(["Beta hCG 2 mIU/mL 0-5"])], NOT_PREGNANT);
  assert.equal(result.values[0].interpretability, "explained");
  assert.match(result.values[0].plainLanguage.possibleMeaning, /gebelik olmayan aralıkla uyumludur/);
});

test("a contextualised value still produces a question for the doctor", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 10,8 g/dL 11,5-15,5"])], PREGNANT);
  assert.ok(result.doctorQuestions.some((question) => /referans aralığı nedir/.test(question)));
});

test("every value carries exactly one of a context note or a refusal reason", () => {
  const result = buildOnDeviceDocumentResult(
    [page(["Hemoglobin 10,8 g/dL 11,5-15,5", "HbA1c 5,9 % 4,0-5,6", "ALT 22 U/L 0-35"])],
    PREGNANT
  );
  assert.ok(result.values.length >= 3);
  for (const value of result.values) {
    assert.ok(!(value.contextNote && value.notInterpretableReason), value.testName);
    if (value.interpretability === "contextual") assert.ok(value.contextNote, value.testName);
    if (value.interpretability === "not_interpretable") assert.ok(value.notInterpretableReason, value.testName);
    if (value.interpretability === "explained") {
      assert.equal(value.contextNote, "");
      assert.equal(value.notInterpretableReason, "");
    }
  }
});

test("an ordinary report produces no red flags", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 12,4 g/dL 11,5-15,5"])], PREGNANT);
  assert.deepEqual(result.redFlags, []);
});

test("the safety notice states plainly that this is not medical advice", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 12,4 g/dL 11,5-15,5"])], PREGNANT);
  assert.match(result.safetyNotice, /tıbbi tavsiye değildir/);
  assert.match(result.safetyNotice, /doktoruna başvur/);
});

test("no produced copy promises a diagnosis", () => {
  const result = buildOnDeviceDocumentResult(
    [page(["Hemoglobin 9,1 g/dL 11,5-15,5", "ALT 22 U/L 0-35"])],
    NOT_PREGNANT
  );
  const allCopy = [
    result.safetyNotice,
    ...result.doctorQuestions,
    ...result.values.flatMap((value) => [
      value.referenceExplanation,
      value.notInterpretableReason,
      value.plainLanguage.possibleMeaning,
      value.plainLanguage.resultSummary
    ])
  ].join(" ");
  assert.doesNotMatch(allCopy, /teşhis koy|tanı koyar|tedavi öner/i);
});

test("the analysis promises nothing is stored and reports the context it used", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 12,4 g/dL 11,5-15,5"])], PREGNANT);
  assert.equal(result.privacy.processedOnDevice, true);
  assert.equal(result.privacy.originalStored, false);
  assert.equal(result.privacy.sentToOpenAI, false);
  assert.deepEqual(result.context, PREGNANT);
});

test("an unknown pregnancy status is the default rather than an assumption", () => {
  const result = buildOnDeviceDocumentResult([page(["Hemoglobin 12,4 g/dL 11,5-15,5"])]);
  assert.equal(result.context.pregnancyStatus, "unknown");
});
