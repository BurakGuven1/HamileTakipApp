import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHcgPregnancyContext,
  findHcgWeekBand,
  HCG_SINGLE_VALUE_CAVEAT
} from "./hcgContext.ts";

test("a week maps to the band that contains it", () => {
  assert.equal(findHcgWeekBand(3).fromWeek, 3);
  assert.equal(findHcgWeekBand(7).toWeek, 8);
  assert.equal(findHcgWeekBand(8).fromWeek, 7);
  assert.equal(findHcgWeekBand(11).fromWeek, 9);
  assert.equal(findHcgWeekBand(30).fromWeek, 25);
});

test("a week outside the published table yields no band", () => {
  assert.equal(findHcgWeekBand(null), null);
  assert.equal(findHcgWeekBand(1), null);
  assert.equal(findHcgWeekBand(60), null);
  assert.equal(findHcgWeekBand(Number.NaN), null);
});

test("neighbouring weeks overlap, which is exactly why no verdict is given", () => {
  const six = findHcgWeekBand(6);
  const seven = findHcgWeekBand(7);
  assert.ok(seven.minMilliIuPerMl < six.maxMilliIuPerMl);
});

test("the caveat about a single measurement is always present", () => {
  for (const week of [5, 12, 30, null]) {
    assert.ok(buildHcgPregnancyContext(week).includes(HCG_SINGLE_VALUE_CAVEAT), String(week));
  }
});

test("the week band is presented as information, never as a reference range", () => {
  const text = buildHcgPregnancyContext(6);
  assert.match(text, /tipik/);
  assert.match(text, /referans aralığı değil/);
  assert.match(text, /48 saat/);
});

test("no hCG text ever calls a single value good, bad, high or low", () => {
  // A single level says nothing about whether a pregnancy is progressing or
  // where it is; wording that implies otherwise is the whole risk here.
  for (const week of [4, 9, 20, null]) {
    const text = buildHcgPregnancyContext(week);
    assert.doesNotMatch(text, /sonucun (?:iyi|kötü)|normaldir|sorun yok|riskli|düşük çıkmış|yüksek çıkmış/i);
    assert.doesNotMatch(text, /teşhis|tanı|tedavi/i);
  }
});

test("an unknown week still gets the honest explanation rather than silence", () => {
  const text = buildHcgPregnancyContext(null);
  assert.match(text, /haftadan haftaya çok geniş/);
});
