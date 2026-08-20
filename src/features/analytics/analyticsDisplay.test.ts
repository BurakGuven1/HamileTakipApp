// @ts-nocheck -- Executed with Deno; kept outside the app bundle.
import {
  describeMissingOfferingEvents,
  formatOfferingLabel
} from "./analyticsDisplay.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

Deno.test("labels legacy offering rows without pretending an identifier exists", () => {
  assertEquals(
    formatOfferingLabel("unknown"),
    "Bilinmeyen (eski kayıtta RevenueCat offering kimliği yok)"
  );
  assertEquals(formatOfferingLabel("premium_monthly"), "premium_monthly");
});

Deno.test("explains exactly how many paywall impressions are excluded from offering comparison", () => {
  assertEquals(
    describeMissingOfferingEvents(7),
    "7 paywall gösteriminde RevenueCat offering kimliği alınamadı; bu kayıtlar offering karşılaştırmasına dahil edilemez."
  );
  assertEquals(
    describeMissingOfferingEvents(0),
    "Seçili dönemde tüm paywall gösterimlerinin RevenueCat offering kimliği kaydedildi."
  );
});
