import assert from "node:assert/strict";
import test from "node:test";

import {
  getRemainingAnalysisCopy,
  resolveValueMomentPaywall
} from "./valueMomentPaywall.ts";

const FRESH = {
  hasSeenResult: false,
  isPremium: false,
  remaining: 3,
  alreadyOffered: false
};

test("nothing is offered before the user has seen a real result", () => {
  // The whole point of the module: the first value the app ever gives has to
  // land before the first thing it ever asks for.
  for (const action of ["pick_document", "view_result", "expand_value", "copy_questions"]) {
    assert.equal(resolveValueMomentPaywall(action, { ...FRESH, remaining: 0 }).present, false);
  }
});

test("seeing the result is the value moment, not the decision moment", () => {
  assert.equal(
    resolveValueMomentPaywall("view_result", { ...FRESH, hasSeenResult: true, remaining: 0 }).present,
    false
  );
});

test("engaging with the result after the last free analysis opens the paywall", () => {
  const decision = resolveValueMomentPaywall("expand_value", {
    ...FRESH,
    hasSeenResult: true,
    remaining: 0
  });
  assert.equal(decision.present, true);
  assert.equal(decision.reason, "last_free_credit_used");
  assert.equal(decision.mode, "required");
});

test("engaging while free analyses remain stays quiet", () => {
  for (const remaining of [1, 2, 3]) {
    assert.equal(
      resolveValueMomentPaywall("expand_value", { ...FRESH, hasSeenResult: true, remaining }).present,
      false
    );
  }
});

test("reaching for a second document with nothing left is a clear intent signal", () => {
  const decision = resolveValueMomentPaywall("pick_document", {
    ...FRESH,
    hasSeenResult: true,
    remaining: 0
  });
  assert.equal(decision.present, true);
  assert.equal(decision.reason, "free_credits_exhausted");
});

test("saving into the health file is a premium feature the user asked for", () => {
  const decision = resolveValueMomentPaywall("save_to_health_file", {
    ...FRESH,
    hasSeenResult: true,
    remaining: 3
  });
  assert.equal(decision.present, true);
  assert.equal(decision.reason, "premium_feature_selected");
});

test("a premium user is never interrupted", () => {
  for (const action of ["pick_document", "expand_value", "save_to_health_file", "copy_questions"]) {
    assert.equal(
      resolveValueMomentPaywall(action, {
        hasSeenResult: true,
        isPremium: true,
        remaining: null,
        alreadyOffered: false
      }).present,
      false
    );
  }
});

test("the paywall is offered at most once per result", () => {
  assert.equal(
    resolveValueMomentPaywall("copy_questions", {
      ...FRESH,
      hasSeenResult: true,
      remaining: 0,
      alreadyOffered: true
    }).present,
    false
  );
});

test("an unknown credit balance does not trigger an offer on its own", () => {
  assert.equal(
    resolveValueMomentPaywall("expand_value", { ...FRESH, hasSeenResult: true, remaining: null }).present,
    false
  );
});

test("the remaining-analyses copy stays calm and singular-aware", () => {
  assert.equal(getRemainingAnalysisCopy(true, null), "Premium · sınırsız belge analizi");
  assert.equal(getRemainingAnalysisCopy(false, 1), "1 ücretsiz analiz hakkın kaldı.");
  assert.equal(getRemainingAnalysisCopy(false, 2), "2 ücretsiz analiz hakkın kaldı.");
  assert.equal(getRemainingAnalysisCopy(false, 0), "Bu ayki ücretsiz analiz hakkın doldu.");
  assert.equal(getRemainingAnalysisCopy(false, null), "");
});
