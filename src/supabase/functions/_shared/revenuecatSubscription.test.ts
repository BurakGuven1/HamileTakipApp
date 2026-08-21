import {
  normalizeRevenueCatEnvironment,
  normalizeRevenueCatSubscriber
} from "./revenuecatSubscription.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function subscriberFixture({
  entitlementExpiresAt,
  entitlementProduct = "com.burakguven.hamiletakip.premium.yearly",
  expiresAt,
  gracePeriodExpiresAt = null,
  isSandbox,
  refundedAt = null,
  unsubscribeDetectedAt = null
}: {
  entitlementExpiresAt: string | null;
  entitlementProduct?: string;
  expiresAt: string | null;
  gracePeriodExpiresAt?: string | null;
  isSandbox: boolean;
  refundedAt?: string | null;
  unsubscribeDetectedAt?: string | null;
}) {
  return {
    subscriber: {
      entitlements: {
        premium: {
          expires_date: entitlementExpiresAt,
          product_identifier: entitlementProduct
        }
      },
      subscriptions: {
        [entitlementProduct]: {
          expires_date: expiresAt,
          grace_period_expires_date: gracePeriodExpiresAt,
          is_sandbox: isSandbox,
          original_purchase_date: "2026-06-01T00:00:00Z",
          ownership_type: "PURCHASED",
          period_type: "normal",
          purchase_date: "2026-07-01T00:00:00Z",
          refunded_at: refundedAt,
          store: "app_store",
          unsubscribe_detected_at: unsubscribeDetectedAt
        }
      }
    }
  };
}

Deno.test("active production entitlement keeps production provenance", () => {
  const result = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2027-06-01T00:00:00Z",
      expiresAt: "2027-06-01T00:00:00Z",
      isSandbox: false
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(result, {
    environment: "PRODUCTION",
    expiresAt: "2027-06-01T00:00:00Z",
    isLifetime: false,
    productId: "com.burakguven.hamiletakip.premium.yearly",
    status: "active"
  });
});

Deno.test("active sandbox entitlement is marked as sandbox", () => {
  const result = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2026-08-21T13:00:00Z",
      expiresAt: "2026-08-21T13:00:00Z",
      isSandbox: true
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(result?.environment, "SANDBOX");
  assertEquals(result?.status, "active");
});

Deno.test("future grace period remains premium", () => {
  const result = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2026-08-21T11:00:00Z",
      expiresAt: "2026-08-21T11:00:00Z",
      gracePeriodExpiresAt: "2026-08-22T12:00:00Z",
      isSandbox: false
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(result?.status, "grace_period");
  assertEquals(result?.expiresAt, "2026-08-22T12:00:00Z");
});

Deno.test("cancelled renewal keeps active access until expiry", () => {
  const result = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2026-09-01T00:00:00Z",
      expiresAt: "2026-09-01T00:00:00Z",
      isSandbox: false,
      unsubscribeDetectedAt: "2026-08-20T00:00:00Z"
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(result?.status, "active");
});

Deno.test("refunded or elapsed subscription is expired", () => {
  const refunded = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2026-09-01T00:00:00Z",
      expiresAt: "2026-09-01T00:00:00Z",
      isSandbox: false,
      refundedAt: "2026-08-21T10:00:00Z"
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );
  const elapsed = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: "2026-08-21T10:00:00Z",
      expiresAt: "2026-08-21T10:00:00Z",
      isSandbox: false
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(refunded?.status, "expired");
  assertEquals(elapsed?.status, "expired");
});

Deno.test("lifetime entitlement has no expiry", () => {
  const result = normalizeRevenueCatSubscriber(
    subscriberFixture({
      entitlementExpiresAt: null,
      expiresAt: null,
      isSandbox: false
    }),
    "premium",
    new Date("2026-08-21T12:00:00Z")
  );

  assertEquals(result?.isLifetime, true);
  assertEquals(result?.status, "active");
});

Deno.test("missing entitlement or malformed response returns null", () => {
  assertEquals(
    normalizeRevenueCatSubscriber({ subscriber: {} }, "premium"),
    null
  );
  assertEquals(normalizeRevenueCatSubscriber("invalid", "premium"), null);
});

Deno.test("environment values are normalized defensively", () => {
  assertEquals(normalizeRevenueCatEnvironment("PRODUCTION"), "PRODUCTION");
  assertEquals(normalizeRevenueCatEnvironment("sandbox"), "SANDBOX");
  assertEquals(normalizeRevenueCatEnvironment(null), "UNKNOWN");
});
