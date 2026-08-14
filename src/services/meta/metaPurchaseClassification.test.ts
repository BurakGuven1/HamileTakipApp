// @ts-nocheck -- Executed with Deno; kept outside the app bundle.
import { classifyMetaPurchase } from "./metaPurchaseClassification.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

const baseInput = {
  currencyCode: "TRY",
  entitlementProductIdentifier: "premium_monthly",
  hasActiveEntitlement: true,
  introPrice: null,
  isSubscriptionProduct: true,
  periodType: "NORMAL",
  productPrice: 149.99,
  transactionProductIdentifier: "premium_monthly"
};

Deno.test("a verified paid subscription logs Subscribe and Purchase", () => {
  assertEquals(classifyMetaPurchase(baseInput), {
    currencyCode: "TRY",
    purchaseValue: 149.99,
    shouldLogStartTrial: false,
    shouldLogSubscribe: true
  });
});

Deno.test("a verified free trial logs StartTrial and Subscribe without Purchase", () => {
  assertEquals(
    classifyMetaPurchase({
      ...baseInput,
      introPrice: 0,
      periodType: "TRIAL"
    }),
    {
      currencyCode: null,
      purchaseValue: null,
      shouldLogStartTrial: true,
      shouldLogSubscribe: true
    }
  );
});

Deno.test("a paid introductory period uses the introductory charge", () => {
  assertEquals(
    classifyMetaPurchase({
      ...baseInput,
      introPrice: 29.99,
      periodType: "INTRO"
    }),
    {
      currencyCode: "TRY",
      purchaseValue: 29.99,
      shouldLogStartTrial: false,
      shouldLogSubscribe: true
    }
  );
});

Deno.test("a transaction that does not unlock the entitlement logs nothing", () => {
  assertEquals(
    classifyMetaPurchase({
      ...baseInput,
      transactionProductIdentifier: "different_product"
    }),
    {
      currencyCode: null,
      purchaseValue: null,
      shouldLogStartTrial: false,
      shouldLogSubscribe: false
    }
  );
});
