import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGrowthSeries,
  describeGrowthTrend,
  GROWTH_BAND_Z_SCORES
} from "./growthSeries.ts";

const BIRTH_DATE = "2026-01-01";

function record(id, recordDate, values) {
  return {
    head_circumference_cm: null,
    height_cm: null,
    id,
    record_date: recordDate,
    weight_kg: null,
    ...values
  };
}

test("a measurement becomes a point with its WHO percentile", () => {
  const series = buildGrowthSeries({
    birthDate: BIRTH_DATE,
    indicator: "weight",
    records: [record("a", "2026-01-01", { weight_kg: 3.3464 })],
    sex: "male"
  });

  assert.ok(series);
  assert.equal(series.points.length, 1);
  assert.ok(Math.abs(series.points[0].percentile - 50) < 0.01);
  assert.equal(series.points[0].ageDays, 0);
});

test("records without the selected measurement are skipped", () => {
  const series = buildGrowthSeries({
    birthDate: BIRTH_DATE,
    indicator: "weight",
    records: [
      record("a", "2026-01-01", { height_cm: 50 }),
      record("b", "2026-02-01", { weight_kg: 4.5 })
    ],
    sex: "male"
  });

  assert.ok(series);
  assert.equal(series.points.length, 1);
  assert.equal(series.points[0].id, "b");
});

test("no usable measurement yields no chart rather than an empty one", () => {
  assert.equal(
    buildGrowthSeries({
      birthDate: BIRTH_DATE,
      indicator: "weight",
      records: [record("a", "2026-01-01", { height_cm: 50 })],
      sex: "male"
    }),
    null
  );
});

test("points are ordered by age even when entered out of order", () => {
  const series = buildGrowthSeries({
    birthDate: BIRTH_DATE,
    indicator: "weight",
    records: [
      record("late", "2026-04-01", { weight_kg: 6.5 }),
      record("early", "2026-02-01", { weight_kg: 4.5 })
    ],
    sex: "female"
  });

  assert.ok(series);
  assert.deepEqual(
    series.points.map((point) => point.id),
    ["early", "late"]
  );
});

test("every reference band is drawn and the axis contains them all", () => {
  const series = buildGrowthSeries({
    birthDate: BIRTH_DATE,
    indicator: "weight",
    records: [record("a", "2026-03-01", { weight_kg: 5.8 })],
    sex: "male"
  });

  assert.ok(series);
  assert.equal(series.bands.length, GROWTH_BAND_Z_SCORES.length);

  for (const band of series.bands) {
    assert.ok(band.points.length > 1);
    assert.equal(band.points[0].ageDays, series.minAgeDays);
    assert.equal(band.points[band.points.length - 1].ageDays, series.maxAgeDays);

    for (const point of band.points) {
      assert.ok(point.value >= series.minValue && point.value <= series.maxValue);
    }
  }
});

test("a measurement outside the bands still fits inside the axis", () => {
  // A very heavy baby must not be drawn off the top of the chart.
  const series = buildGrowthSeries({
    birthDate: BIRTH_DATE,
    indicator: "weight",
    records: [record("a", "2026-03-01", { weight_kg: 12 })],
    sex: "male"
  });

  assert.ok(series);
  assert.ok(series.maxValue >= 12);
});

test("a baby holding its line reads as steady", () => {
  const trend = describeGrowthTrend([
    { ageDays: 0, id: "a", percentile: 50, recordDate: "", value: 3.3, zScore: 0 },
    { ageDays: 120, id: "b", percentile: 52, recordDate: "", value: 6.5, zScore: 0.05 }
  ]);

  assert.deepEqual(trend?.tone, "steady");
});

test("crossing lines downward is reported as falling", () => {
  const trend = describeGrowthTrend([
    { ageDays: 0, id: "a", percentile: 50, recordDate: "", value: 3.3, zScore: 0 },
    { ageDays: 120, id: "b", percentile: 16, recordDate: "", value: 5.4, zScore: -1 }
  ]);

  assert.equal(trend?.tone, "falling");
  assert.ok(trend.drift < 0);
});

test("a trend needs two measurements far enough apart to mean anything", () => {
  assert.equal(
    describeGrowthTrend([
      { ageDays: 0, id: "a", percentile: 50, recordDate: "", value: 3.3, zScore: 0 }
    ]),
    null
  );

  // Two weighings three days apart say more about the scale than the baby.
  assert.equal(
    describeGrowthTrend([
      { ageDays: 0, id: "a", percentile: 50, recordDate: "", value: 3.3, zScore: 0 },
      { ageDays: 3, id: "b", percentile: 20, recordDate: "", value: 3.0, zScore: -0.9 }
    ]),
    null
  );
});
