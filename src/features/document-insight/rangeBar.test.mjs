import assert from "node:assert/strict";
import test from "node:test";

import { buildRangeBarModel, parseReferenceBounds } from "./rangeBar.ts";

function value(overrides = {}) {
  return {
    result: "12,4",
    referenceRange: "11,5-15,5",
    referenceStatus: "within",
    ...overrides
  };
}

test("a two-sided range is read as a band", () => {
  assert.deepEqual(parseReferenceBounds("11,5-15,5"), { min: 11.5, max: 15.5 });
  assert.deepEqual(parseReferenceBounds("Referans: 4 - 11"), { min: 4, max: 11 });
});

test("a one-sided limit keeps the open side open", () => {
  assert.deepEqual(parseReferenceBounds("< 130"), { min: null, max: 130 });
  assert.deepEqual(parseReferenceBounds("≥ 40"), { min: 40, max: null });
});

test("several contextual ranges are refused rather than picked from", () => {
  // "Gebe: 0,1-2,5; Gebe değil: 0,4-4,0" has no single correct band.
  assert.equal(parseReferenceBounds("Gebe: 0,1-2,5; Gebe değil: 0,4-4,0"), null);
  assert.equal(parseReferenceBounds(""), null);
  assert.equal(parseReferenceBounds("negatif"), null);
});

test("an inverted range is not drawn", () => {
  assert.equal(parseReferenceBounds("15,5-11,5"), null);
});

test("a marker inside the band sits between the band edges", () => {
  const model = buildRangeBarModel(value());
  assert.ok(model);
  assert.ok(model.markerPosition > model.bandStart);
  assert.ok(model.markerPosition < model.bandEnd);
  assert.equal(model.clamped, false);
  assert.equal(model.lowLabel, "11,5");
  assert.equal(model.highLabel, "15,5");
});

test("a low result sits before the band and a high one after it", () => {
  const low = buildRangeBarModel(value({ result: "9", referenceStatus: "below" }));
  const high = buildRangeBarModel(value({ result: "17", referenceStatus: "above" }));
  assert.ok(low.markerPosition < low.bandStart);
  assert.ok(high.markerPosition > high.bandEnd);
});

test("a far outlier is clamped into the track and says so", () => {
  const model = buildRangeBarModel(value({ result: "400", referenceStatus: "above" }));
  assert.equal(model.markerPosition, 1);
  assert.equal(model.clamped, true);
});

test("no bar is drawn for a comparison the app never performed", () => {
  // A lab marker alone ("YÜKSEK") gives no numeric band to place a marker in.
  assert.equal(buildRangeBarModel(value({ referenceStatus: "document_marked" })), null);
  assert.equal(buildRangeBarModel(value({ referenceStatus: "unclassified" })), null);
});

test("no bar is drawn for a non-numeric result", () => {
  assert.equal(buildRangeBarModel(value({ result: "Pozitif" })), null);
});

test("every produced position stays inside the drawn track", () => {
  for (const result of ["0", "11,5", "15,5", "1000", "-4"]) {
    const model = buildRangeBarModel(value({ result, referenceStatus: "above" }));
    assert.ok(model.markerPosition >= 0 && model.markerPosition <= 1);
    assert.ok(model.bandStart >= 0 && model.bandEnd <= 1);
  }
});
