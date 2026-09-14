import assert from "node:assert/strict";
import test from "node:test";

import {
  getTrimester,
  getTrimesterLabel,
  resolveInterpretationContext
} from "./pregnancyContext.ts";

test("trimester boundaries follow the usual 13 / 27 week split", () => {
  assert.equal(getTrimester(1), 1);
  assert.equal(getTrimester(13), 1);
  assert.equal(getTrimester(14), 2);
  assert.equal(getTrimester(27), 2);
  assert.equal(getTrimester(28), 3);
  assert.equal(getTrimester(41), 3);
});

test("an impossible or missing week yields no trimester", () => {
  assert.equal(getTrimester(null), null);
  assert.equal(getTrimester(0), null);
  assert.equal(getTrimester(60), null);
  assert.equal(getTrimester(Number.NaN), null);
});

test("a known pregnancy carries its trimester into the context", () => {
  assert.deepEqual(
    resolveInterpretationContext({ isPregnant: true, pregnancyWeek: 20 }),
    { pregnancyStatus: "pregnant", trimester: 2, pregnancyWeek: 20 }
  );
});

test("a pregnancy with no due date is still pregnant", () => {
  assert.deepEqual(
    resolveInterpretationContext({ isPregnant: true, pregnancyWeek: null }),
    { pregnancyStatus: "pregnant", trimester: null, pregnancyWeek: null }
  );
});

test("an unset pregnancy flag is unknown rather than assumed", () => {
  // Assuming non-pregnant ranges inside a pregnancy app is the wrong way to be
  // wrong, so a missing flag must not become a "not pregnant" verdict.
  for (const isPregnant of [null, undefined]) {
    assert.equal(
      resolveInterpretationContext({ isPregnant, pregnancyWeek: 20 }).pregnancyStatus,
      "unknown"
    );
  }
  assert.equal(
    resolveInterpretationContext({ isPregnant: false, pregnancyWeek: null }).pregnancyStatus,
    "not_pregnant"
  );
});

test("an impossible week never reaches the context as a usable week", () => {
  // hCG bands are read straight off this number, so an out-of-range week must
  // not survive into the context at all.
  assert.equal(resolveInterpretationContext({ isPregnant: true, pregnancyWeek: 60 }).pregnancyWeek, null);
  assert.equal(resolveInterpretationContext({ isPregnant: true, pregnancyWeek: 0 }).pregnancyWeek, null);
  assert.equal(resolveInterpretationContext({ isPregnant: true, pregnancyWeek: 8 }).pregnancyWeek, 8);
});

test("the trimester label is only spoken when there is a pregnancy to label", () => {
  assert.equal(getTrimesterLabel({ pregnancyStatus: "pregnant", trimester: 3 }), "Gebelik 3. dönem");
  assert.equal(getTrimesterLabel({ pregnancyStatus: "pregnant", trimester: null }), "Gebelik dönemi");
  assert.equal(getTrimesterLabel({ pregnancyStatus: "unknown", trimester: null }), "");
  assert.equal(getTrimesterLabel({ pregnancyStatus: "not_pregnant", trimester: null }), "");
});
