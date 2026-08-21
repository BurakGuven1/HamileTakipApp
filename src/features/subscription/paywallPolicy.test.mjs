import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreditGateDecision,
  shouldCheckPremiumBeforePaywall
} from "./paywallPolicy.ts";

test("required paywall does not repeat a stale premium check", () => {
  assert.equal(shouldCheckPremiumBeforePaywall("required"), false);
});

test("if-needed paywall refreshes premium before presenting", () => {
  assert.equal(shouldCheckPremiumBeforePaywall("if_needed"), true);
});

test("Doctor PDF proceeds for premium or every positive credit balance", () => {
  assert.equal(
    getCreditGateDecision({ allowed: true, isPremium: true, remaining: null }),
    "proceed"
  );
  for (const remaining of [1, 2, 3]) {
    assert.equal(
      getCreditGateDecision({ allowed: true, isPremium: false, remaining }),
      "proceed"
    );
  }
});

test("zero credit or explicit denial requires the paywall", () => {
  assert.equal(
    getCreditGateDecision({ isPremium: false, remaining: 0 }),
    "required_paywall"
  );
  assert.equal(
    getCreditGateDecision({ allowed: false, isPremium: false, remaining: 1 }),
    "required_paywall"
  );
  assert.equal(
    getCreditGateDecision({ allowed: false, isPremium: true, remaining: null }),
    "required_paywall"
  );
});

test("missing non-premium credit balance cannot silently proceed", () => {
  assert.equal(
    getCreditGateDecision({ isPremium: false, remaining: null }),
    "required_paywall"
  );
});
