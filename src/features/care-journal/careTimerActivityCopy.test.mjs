import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCareDuration,
  getCareTimerSideLine,
  getCareTimerSummaryLine,
  getCareTimerTitle
} from "./careTimerActivityCopy.ts";

test("each timer type has its own Turkish title", () => {
  assert.equal(getCareTimerTitle("breastfeeding"), "Emzirme");
  assert.equal(getCareTimerTitle("pumping"), "Sağım");
  assert.equal(getCareTimerTitle("sleep"), "Uyku");
});

test("the second line names the side, which is what gets forgotten at 3am", () => {
  assert.equal(
    getCareTimerSideLine({
      breastSide: "left",
      sleepKind: null,
      timerType: "breastfeeding"
    }),
    "Sol meme"
  );
  assert.equal(
    getCareTimerSideLine({
      breastSide: "right",
      sleepKind: null,
      timerType: "breastfeeding"
    }),
    "Sağ meme"
  );
  assert.equal(
    getCareTimerSideLine({
      breastSide: "both",
      sleepKind: null,
      timerType: "pumping"
    }),
    "Her iki meme"
  );
});

test("sleep shows day or night instead of a side", () => {
  assert.equal(
    getCareTimerSideLine({ breastSide: null, sleepKind: "night", timerType: "sleep" }),
    "Gece uykusu"
  );
  assert.equal(
    getCareTimerSideLine({ breastSide: null, sleepKind: "day", timerType: "sleep" }),
    "Gündüz uykusu"
  );
});

test("a missing side falls back to the timer name rather than an empty line", () => {
  assert.equal(
    getCareTimerSideLine({
      breastSide: null,
      sleepKind: null,
      timerType: "breastfeeding"
    }),
    "Emzirme"
  );
});

test("durations read in whole minutes and hours", () => {
  assert.equal(formatCareDuration(0), "0 dk");
  assert.equal(formatCareDuration(12 * 60_000), "12 dk");
  assert.equal(formatCareDuration(59.6 * 60_000), "1 sa");
  assert.equal(formatCareDuration(60 * 60_000), "1 sa");
  assert.equal(formatCareDuration(95 * 60_000), "1 sa 35 dk");
});

test("a negative duration never renders as a negative time", () => {
  // Clock skew between two phones in the same family must not print "-3 dk".
  assert.equal(formatCareDuration(-5000), "0 dk");
});

test("the finished card says what was recorded", () => {
  assert.equal(
    getCareTimerSummaryLine({
      breastSide: "left",
      durationMs: 14 * 60_000,
      sleepKind: null,
      timerType: "breastfeeding"
    }),
    "Sol meme · 14 dk"
  );
  assert.equal(
    getCareTimerSummaryLine({
      breastSide: null,
      durationMs: 95 * 60_000,
      sleepKind: "night",
      timerType: "sleep"
    }),
    "Gece uykusu · 1 sa 35 dk"
  );
});
