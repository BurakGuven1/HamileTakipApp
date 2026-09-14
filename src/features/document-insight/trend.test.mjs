import assert from "node:assert/strict";
import test from "node:test";

import { collectPreviousLabValues, findValueTrend } from "./trend.ts";

const NOW = Date.parse("2026-09-14T09:00:00.000Z");

function previous(overrides = {}) {
  return {
    occurredAt: "2026-08-01T09:00:00.000Z",
    referenceRange: "11,5-15,5",
    result: "11,2",
    testName: "Hemoglobin",
    unit: "g/dL",
    ...overrides
  };
}

test("saved lab values are flattened newest first", () => {
  const collected = collectPreviousLabValues([
    {
      occurredAt: "2026-06-01T09:00:00.000Z",
      labValues: [{ test_name: "Hemoglobin", result_text: "10,8", unit: "g/dL", reference_range: null }]
    },
    {
      occurredAt: "2026-08-01T09:00:00.000Z",
      labValues: [{ test_name: "Hemoglobin", result_text: "11,2", unit: "g/dL", reference_range: null }]
    }
  ]);
  assert.equal(collected.length, 2);
  assert.equal(collected[0].result, "11,2");
});

test("the most recent earlier result is the one compared against", () => {
  const trend = findValueTrend(
    { testName: "Hemoglobin", result: "12,0", unit: "g/dL" },
    [previous(), previous({ occurredAt: "2026-06-01T09:00:00.000Z", result: "9,0" })],
    NOW
  );
  assert.equal(trend.previousResult, "11,2");
  assert.equal(trend.direction, "up");
  assert.equal(trend.difference, "+0,8");
});

test("a falling value is reported as falling, without a verdict", () => {
  const trend = findValueTrend(
    { testName: "Hemoglobin", result: "10,2", unit: "g/dL" },
    [previous()],
    NOW
  );
  assert.equal(trend.direction, "down");
  assert.equal(trend.difference, "−1");
});

test("an identical value reports no difference", () => {
  const trend = findValueTrend(
    { testName: "Hemoglobin", result: "11,2", unit: "g/dL" },
    [previous()],
    NOW
  );
  assert.equal(trend.direction, "same");
  assert.equal(trend.difference, "");
});

test("a different unit is never compared", () => {
  // 112 g/L and 11,2 g/dL are the same value; subtracting them is nonsense.
  assert.equal(
    findValueTrend({ testName: "Hemoglobin", result: "112", unit: "g/L" }, [previous()], NOW),
    null
  );
});

test("a different test is never compared", () => {
  assert.equal(
    findValueTrend({ testName: "Ferritin", result: "20", unit: "g/dL" }, [previous()], NOW),
    null
  );
});

test("a test name matches regardless of casing and spacing", () => {
  assert.ok(
    findValueTrend(
      { testName: "  hemoglobin ", result: "12,0", unit: "g/dL" },
      [previous()],
      NOW
    )
  );
});

test("with no history there is no trend to show", () => {
  assert.equal(findValueTrend({ testName: "Hemoglobin", result: "12,0", unit: "g/dL" }, [], NOW), null);
});
