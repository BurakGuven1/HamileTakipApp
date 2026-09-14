import assert from "node:assert/strict";
import test from "node:test";

import {
  getIntroTrialDaysRemaining,
  INTRO_TRIAL_DAYS,
  resolveIntroTrialTransition
} from "./introTrialPolicy.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-13T09:00:00.000Z");

test("a missing or past trial window has no days left", () => {
  assert.equal(getIntroTrialDaysRemaining(null, NOW), 0);
  assert.equal(getIntroTrialDaysRemaining("not-a-date", NOW), 0);
  assert.equal(
    getIntroTrialDaysRemaining(new Date(NOW - 1).toISOString(), NOW),
    0
  );
});

test("a window ending later today still counts as one day", () => {
  assert.equal(
    getIntroTrialDaysRemaining(new Date(NOW + 60_000).toISOString(), NOW),
    1
  );
});

test("remaining days round up so the countdown never skips a day", () => {
  assert.equal(
    getIntroTrialDaysRemaining(new Date(NOW + DAY_MS * 2.4).toISOString(), NOW),
    3
  );
  assert.equal(
    getIntroTrialDaysRemaining(
      new Date(NOW + DAY_MS * INTRO_TRIAL_DAYS).toISOString(),
      NOW
    ),
    INTRO_TRIAL_DAYS
  );
});

test("the first observation of an active trial reports a start", () => {
  assert.equal(resolveIntroTrialTransition(undefined, true), "started");
  assert.equal(resolveIntroTrialTransition(false, true), "started");
});

test("losing an active trial reports an end exactly once", () => {
  assert.equal(resolveIntroTrialTransition(true, false), "ended");
  assert.equal(resolveIntroTrialTransition(false, false), null);
});

test("an unchanged trial state reports nothing", () => {
  assert.equal(resolveIntroTrialTransition(true, true), null);
});

test("a trial that ends and is later repurchased reports both edges", () => {
  // Funnel reads depend on "had access and let it lapse" being distinguishable
  // from "came back", so a second start after an end must not be swallowed.
  assert.equal(resolveIntroTrialTransition(true, false), "ended");
  assert.equal(resolveIntroTrialTransition(false, true), "started");
});

test("a never-started trial on a fresh install stays silent", () => {
  // Without this the paywall funnel would show an "ended" event for every
  // account that never had a trial at all.
  assert.equal(resolveIntroTrialTransition(undefined, false), null);
});
