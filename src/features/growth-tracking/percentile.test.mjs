import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPercentile,
  getAgeInDays,
  getGrowthPercentile,
  getMeasurementForZScore,
  lmsToZScore,
  toGrowthSex,
  zScoreToPercentile
} from "./percentile.ts";

test("the median of the standard is the 50th percentile", () => {
  // WHO weight-for-age, boys, day 0: L=0.3487 M=3.3464 S=0.14602.
  const result = getGrowthPercentile({
    ageDays: 0,
    indicator: "weight",
    measurement: 3.3464,
    sex: "male"
  });

  assert.ok(result);
  assert.ok(Math.abs(result.zScore) < 1e-9);
  assert.ok(Math.abs(result.percentile - 50) < 1e-6);
});

test("z-scores map to the textbook percentiles", () => {
  assert.ok(Math.abs(zScoreToPercentile(0) - 50) < 1e-6);
  assert.ok(Math.abs(zScoreToPercentile(-1) - 15.8655) < 0.001);
  assert.ok(Math.abs(zScoreToPercentile(1) - 84.1345) < 0.001);
  assert.ok(Math.abs(zScoreToPercentile(-2) - 2.275) < 0.001);
  assert.ok(Math.abs(zScoreToPercentile(1.96) - 97.5) < 0.01);
});

test("percentile and measurement are inverses of each other", () => {
  for (const ageDays of [0, 45, 180, 400, 730, 731, 1200, 1826]) {
    for (const zScore of [-3, -1.5, 0, 1.5, 3]) {
      const measurement = getMeasurementForZScore({
        ageDays,
        indicator: "weight",
        sex: "female",
        zScore
      });
      assert.ok(measurement, `no measurement at day ${ageDays}`);

      const result = getGrowthPercentile({
        ageDays,
        indicator: "weight",
        measurement,
        sex: "female"
      });
      assert.ok(result);
      assert.ok(
        Math.abs(result.zScore - zScore) < 1e-6,
        `round trip failed at day ${ageDays}, z ${zScore}`
      );
    }
  }
});

test("a WHO reference value lands on its published percentile", () => {
  // WHO weight-for-age boys, 12 months: the published median is 9.6 kg and
  // -2 SD is 7.7 kg.
  const median = getGrowthPercentile({
    ageDays: 365,
    indicator: "weight",
    measurement: 9.6,
    sex: "male"
  });
  assert.ok(median);
  assert.ok(
    Math.abs(median.percentile - 50) < 2,
    `expected about the median, got ${median.percentile}`
  );

  const low = getGrowthPercentile({
    ageDays: 365,
    indicator: "weight",
    measurement: 7.7,
    sex: "male"
  });
  assert.ok(low);
  assert.ok(
    Math.abs(low.zScore + 2) < 0.1,
    `expected about -2 SD, got ${low.zScore}`
  );
});

test("the length to height switch is not smeared across ages", () => {
  // WHO switches from recumbent length to standing height at day 731, and the
  // median drops by definition. Both sides must still read as the median.
  const lastLengthDay = getGrowthPercentile({
    ageDays: 730,
    indicator: "length",
    measurement: 87.8018,
    sex: "male"
  });
  const firstHeightDay = getGrowthPercentile({
    ageDays: 731,
    indicator: "length",
    measurement: 87.1303,
    sex: "male"
  });

  assert.ok(lastLengthDay && firstHeightDay);
  assert.ok(Math.abs(lastLengthDay.percentile - 50) < 0.5);
  assert.ok(Math.abs(firstHeightDay.percentile - 50) < 0.5);
});

test("ages outside the WHO standard return nothing", () => {
  assert.equal(
    getGrowthPercentile({
      ageDays: -1,
      indicator: "weight",
      measurement: 3.3,
      sex: "male"
    }),
    null
  );
  assert.equal(
    getGrowthPercentile({
      ageDays: 1827,
      indicator: "weight",
      measurement: 18,
      sex: "male"
    }),
    null
  );
});

test("impossible measurements return nothing instead of a number", () => {
  assert.equal(lmsToZScore([0.3487, 3.3464, 0.14602], 0), null);
  assert.equal(lmsToZScore([0.3487, 3.3464, 0.14602], -2), null);
});

test("age in days counts calendar days from birth", () => {
  assert.equal(getAgeInDays("2026-01-01", "2026-01-01"), 0);
  assert.equal(getAgeInDays("2026-01-01", "2026-02-01"), 31);
  assert.equal(getAgeInDays("2026-01-01", "2026-01-01T22:00:00Z"), 0);
  assert.equal(getAgeInDays("not-a-date", "2026-01-01"), null);
});

test("only a recorded sex selects a WHO curve", () => {
  assert.equal(toGrowthSex("kiz"), "female");
  assert.equal(toGrowthSex("erkek"), "male");
  assert.equal(toGrowthSex("belirtilmemis"), null);
  assert.equal(toGrowthSex(null), null);
});

test("the extremes are reported as bands, not false precision", () => {
  assert.equal(formatPercentile(0.4), "<%1");
  assert.equal(formatPercentile(99.6), ">%99");
  assert.equal(formatPercentile(50), "%50");
  assert.equal(formatPercentile(3.4), "%3");
});
