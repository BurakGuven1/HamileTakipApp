import assert from "node:assert/strict";
import test from "node:test";

import {
  getDailyCtaMode,
  getWeeklyCardState,
  isDailyDestination
} from "./dailyExperiencePolicy.ts";

test("weekly check-in expands once and stays hidden after completion", () => {
  assert.equal(
    getWeeklyCardState({ dismissed: false, needsCheckin: true }),
    "expanded"
  );
  assert.equal(
    getWeeklyCardState({ dismissed: true, needsCheckin: true }),
    "collapsed"
  );
  assert.equal(
    getWeeklyCardState({ dismissed: false, needsCheckin: false }),
    "hidden"
  );
});

test("premium detail uses paywall only for a locked account", () => {
  assert.equal(
    getDailyCtaMode({ isPremium: false, premiumRequired: true }),
    "paywall"
  );
  assert.equal(
    getDailyCtaMode({ isPremium: true, premiumRequired: true }),
    "premium_detail"
  );
  assert.equal(
    getDailyCtaMode({ isPremium: false, premiumRequired: false }),
    "destination"
  );
});

test("daily destinations are allowlisted", () => {
  assert.equal(isDailyDestination("care-journal"), true);
  assert.equal(isDailyDestination("pregnancy-nutrition"), true);
  assert.equal(isDailyDestination("https://example.com"), false);
});
