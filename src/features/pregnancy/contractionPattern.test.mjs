import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateLaborPattern,
  formatDuration,
  summarizeContractions
} from "./contractionPattern.ts";

const NOW = Date.parse("2026-09-13T12:00:00.000Z");
const MINUTE = 60_000;

/** Builds a run of contractions ending `now`, spaced `intervalMin` apart. */
function pattern({ count, durationSec, intervalMin, jitterMin = 0, now = NOW }) {
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const fromEnd = count - 1 - index;
    const jitter = jitterMin === 0 ? 0 : (index % 2 === 0 ? jitterMin : -jitterMin);
    const startedTime = now - fromEnd * intervalMin * MINUTE + jitter * MINUTE;
    entries.push({
      endedAt: new Date(startedTime + durationSec * 1000).toISOString(),
      id: `c${index}`,
      startedAt: new Date(startedTime).toISOString()
    });
  }
  return entries;
}

test("an empty timer summarizes to nothing rather than zeroes that look real", () => {
  const summary = summarizeContractions([], NOW);
  assert.equal(summary.count, 0);
  assert.equal(summary.averageIntervalSec, null);
  assert.equal(summary.averageDurationSec, null);
  assert.equal(summary.isRegular, false);
});

test("interval is measured start to start", () => {
  const summary = summarizeContractions(
    pattern({ count: 5, durationSec: 60, intervalMin: 5 }),
    NOW
  );

  assert.equal(summary.count, 5);
  assert.ok(Math.abs(summary.averageIntervalSec - 300) < 1);
  assert.ok(Math.abs(summary.averageDurationSec - 60) < 1);
});

test("contractions older than the analysis window are ignored", () => {
  const old = pattern({ count: 5, durationSec: 60, intervalMin: 5, now: NOW - 120 * MINUTE });
  const recent = pattern({ count: 4, durationSec: 60, intervalMin: 5 });

  const summary = summarizeContractions([...old, ...recent], NOW);
  assert.equal(summary.count, 4);
});

test("a running contraction with no end time still counts", () => {
  const summary = summarizeContractions(
    [
      { endedAt: null, id: "running", startedAt: new Date(NOW - MINUTE).toISOString() }
    ],
    NOW
  );

  assert.equal(summary.count, 1);
  assert.equal(summary.averageDurationSec, null);
});

test("too few contractions is reported as still collecting", () => {
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 2, durationSec: 60, intervalMin: 5 }),
    now: NOW
  });

  assert.equal(assessment.status, "collecting");
});

test("the 5-1-1 pattern says it is time to go", () => {
  // Twelve contractions, five minutes apart, a minute long: a full hour of 5-1-1.
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 12, durationSec: 62, intervalMin: 5 }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.equal(assessment.status, "call_now");
  assert.match(assessment.headline, /Hastaneye/);
});

test("short contractions do not trigger the rule on frequency alone", () => {
  // Five minutes apart but only 25 seconds long is not the 5-1-1 pattern.
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 12, durationSec: 25, intervalMin: 5 }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.notEqual(assessment.status, "call_now");
});

test("a pattern that has not lasted an hour is not yet the rule", () => {
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 5, durationSec: 65, intervalMin: 5 }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.notEqual(assessment.status, "call_now");
});

test("irregular contractions read as early labor, not as the rule", () => {
  const assessment = evaluateLaborPattern({
    contractions: pattern({
      count: 12,
      durationSec: 65,
      intervalMin: 5,
      jitterMin: 3
    }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.equal(assessment.status, "early");
});

test("a regular pattern ten minutes apart is worth watching", () => {
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 7, durationSec: 45, intervalMin: 9 }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.equal(assessment.status, "monitor");
});

test("before 37 weeks a regular pattern calls now without waiting for 5-1-1", () => {
  // Six regular contractions in an hour, well short of the 5-1-1 rule.
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 7, durationSec: 40, intervalMin: 8 }),
    gestationalWeek: 32,
    now: NOW
  });

  assert.equal(assessment.status, "call_now");
  assert.match(assessment.detail, /Erken doğum/);
});

test("at term the same pattern is only worth watching", () => {
  const preterm = evaluateLaborPattern({
    contractions: pattern({ count: 7, durationSec: 40, intervalMin: 8 }),
    gestationalWeek: 32,
    now: NOW
  });
  const term = evaluateLaborPattern({
    contractions: pattern({ count: 7, durationSec: 40, intervalMin: 8 }),
    gestationalWeek: 39,
    now: NOW
  });

  assert.equal(preterm.status, "call_now");
  assert.equal(term.status, "monitor");
});

test("an unknown gestational week never invents preterm urgency", () => {
  const assessment = evaluateLaborPattern({
    contractions: pattern({ count: 7, durationSec: 40, intervalMin: 8 }),
    gestationalWeek: null,
    now: NOW
  });

  assert.equal(assessment.status, "monitor");
});

test("durations are written the way a labouring woman can read them", () => {
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(45), "45 sn");
  assert.equal(formatDuration(60), "1 dk 00 sn");
  assert.equal(formatDuration(95), "1 dk 35 sn");
});
