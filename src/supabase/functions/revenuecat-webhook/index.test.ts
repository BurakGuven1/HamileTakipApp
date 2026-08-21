import {
  buildWebhookSubscriptionWrite,
  getTransferUserIds,
  mapEventTypeToStatus
} from "../_shared/revenuecatWebhook.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

Deno.test("sandbox expiration keeps sandbox provenance", () => {
  const result = buildWebhookSubscriptionWrite({
    environment: "SANDBOX",
    event_timestamp_ms: 1787306400000,
    expiration_at_ms: 1787302800000,
    product_id: "com.burakguven.hamiletakip.premium.yearly",
    type: "EXPIRATION"
  }, "11111111-1111-4111-8111-111111111111");

  assertEquals(result, {
    environment: "SANDBOX",
    eventAt: new Date(1787306400000).toISOString(),
    expiresAt: new Date(1787302800000).toISOString(),
    isLifetime: false,
    productId: "com.burakguven.hamiletakip.premium.yearly",
    status: "expired",
    userId: "11111111-1111-4111-8111-111111111111",
    verifiedAt: null
  });
});

Deno.test("future cancellation remains active until its expiry", () => {
  assertEquals(
    mapEventTypeToStatus("CANCELLATION", Date.now() + 60_000),
    "active"
  );
});

Deno.test("refund expires access", () => {
  assertEquals(mapEventTypeToStatus("REFUND", null), "expired");
});

Deno.test("non-renewing purchase without expiration keeps lifetime access", () => {
  const write = buildWebhookSubscriptionWrite({
    environment: "PRODUCTION",
    event_timestamp_ms: Date.parse("2026-08-21T10:00:00Z"),
    expiration_at_ms: null,
    product_id: "premium.lifetime",
    type: "NON_RENEWING_PURCHASE"
  }, "11111111-1111-4111-8111-111111111111");

  assertEquals(write?.status, "active");
  assertEquals(write?.expiresAt, null);
  assertEquals(write?.isLifetime, true);
});

Deno.test("transfer collects unique valid source and destination UUIDs", () => {
  assertEquals(getTransferUserIds({
    transferred_from: [
      "11111111-1111-4111-8111-111111111111",
      "$RCAnonymousID:ignored"
    ],
    transferred_to: [
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111"
    ],
    type: "TRANSFER"
  }).sort(), [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ]);
});
