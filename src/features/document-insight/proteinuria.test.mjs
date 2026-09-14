import assert from "node:assert/strict";
import test from "node:test";

import { parseProteinuria } from "./proteinuria.ts";

test("an explicit negative is read as no protein found", () => {
  for (const result of ["Negatif", "NEGATİF", "negative", "Yok", "(-)", "Saptanmadı"]) {
    const reading = parseProteinuria(result);
    assert.ok(reading, result);
    assert.equal(reading.detected, false, result);
    assert.equal(reading.rank, 0, result);
  }
});

test("a trace result sits below +1 on the ladder", () => {
  for (const result of ["Eser", "eser miktarda", "Trace", "İz", "+/-"]) {
    const reading = parseProteinuria(result);
    assert.ok(reading, result);
    assert.equal(reading.level, "trace", result);
    assert.equal(reading.detected, true, result);
    assert.ok(reading.rank < 1, result);
  }
});

test("every way a lab writes a dipstick grade is read the same", () => {
  const grade = (result) => parseProteinuria(result)?.rank ?? null;
  assert.equal(grade("+1"), 1);
  assert.equal(grade("1+"), 1);
  assert.equal(grade("+"), 1);
  assert.equal(grade("++"), 2);
  assert.equal(grade("+2"), 2);
  assert.equal(grade("(++)"), 2);
  assert.equal(grade("+++"), 3);
  assert.equal(grade("++++"), 4);
});

test("an ungraded positive is never ranked above +1", () => {
  // The report said protein was found, not how much. Inventing a severity it
  // never claimed is exactly the failure mode this parser exists to avoid.
  const reading = parseProteinuria("Pozitif");
  assert.equal(reading.level, "positive_unspecified");
  assert.equal(reading.rank, 1);
  assert.equal(reading.detected, true);
});

test("a quantitative mg/dL value is only read when the unit says mg/dL", () => {
  const withUnit = parseProteinuria("45", "mg/dL");
  assert.equal(withUnit.milligramsPerDeciliter, 45);
  assert.equal(withUnit.detected, true);
  // The same digits could be mg/24h, mg/L or a protein/creatinine ratio.
  assert.equal(parseProteinuria("45", ""), null);
  assert.equal(parseProteinuria("45", "mg/L"), null);
});

test("a quantitative value below the dipstick detection point is not raised", () => {
  const low = parseProteinuria("8", "mg/dL");
  assert.equal(low.detected, false);
  assert.equal(low.rank, 0);
});

test("a bounded quantitative result carries no exact value", () => {
  assert.equal(parseProteinuria("<15", "mg/dL"), null);
  assert.equal(parseProteinuria(">300", "mg/dL"), null);
});

test("an unrecognised format is refused rather than guessed", () => {
  // Silently reading an unknown string as "negative" is the dangerous
  // direction to be wrong in, so null is the only acceptable answer.
  for (const result of ["belirsiz", "yorum yok", "??", "5 üzeri", "", "   ", "sonuç bekleniyor"]) {
    assert.equal(parseProteinuria(result), null, JSON.stringify(result));
  }
});

test("the displayed value echoes what the report actually said", () => {
  assert.equal(parseProteinuria("+2").displayValue, "+2");
  assert.equal(parseProteinuria("Negatif").displayValue, "negatif");
  assert.equal(parseProteinuria("Eser").displayValue, "eser miktarda");
  assert.match(parseProteinuria("45", "mg/dL").displayValue, /45 mg\/dL/);
});
