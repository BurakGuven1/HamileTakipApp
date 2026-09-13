// @ts-nocheck -- Executed with Deno; kept outside the app bundle.
import { getSleepPredictionPresentation } from "./predictionPresentation.ts";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("free users get a tappable Premium lock after seven completed sleeps", () => {
  const result = getSleepPredictionPresentation({
    isPremium: false,
    predictionReady: true,
    requiredSampleCount: 7,
    sampleCount: 7
  });

  assertEquals(result, "locked", "Seven completed sleeps should reach the Premium gate");
});

Deno.test("prediction remains in learning mode before seven completed sleeps", () => {
  const result = getSleepPredictionPresentation({
    isPremium: false,
    predictionReady: false,
    requiredSampleCount: 7,
    sampleCount: 6
  });

  assertEquals(result, "learning", "Incomplete training data must not open the Premium gate");
});

Deno.test("trained predictions wait for subscription access to finish loading", () => {
  const result = getSleepPredictionPresentation({
    isAccessLoading: true,
    isPremium: false,
    predictionReady: true,
    requiredSampleCount: 7,
    sampleCount: 7
  });

  assertEquals(result, "checking_access", "Loading access must not briefly expose a false Premium lock");
});

Deno.test("premium users see a ready prediction after training", () => {
  const result = getSleepPredictionPresentation({
    isPremium: true,
    predictionReady: true,
    requiredSampleCount: 7,
    sampleCount: 7
  });

  assertEquals(result, "ready", "Premium users should see the calculated window");
});
