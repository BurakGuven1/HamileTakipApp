import {
  createReconcileRevenueCatHandler,
  type SubscriptionCacheRow
} from "./index.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

const userId = "11111111-1111-4111-8111-111111111111";
const productionSubscriber = {
  subscriber: {
    entitlements: {
      premium: {
        expires_date: "2027-06-01T00:00:00Z",
        product_identifier: "com.burakguven.hamiletakip.premium.yearly"
      }
    },
    subscriptions: {
      "com.burakguven.hamiletakip.premium.yearly": {
        expires_date: "2027-06-01T00:00:00Z",
        grace_period_expires_date: null,
        is_sandbox: false,
        original_purchase_date: "2026-06-01T00:00:00Z",
        ownership_type: "PURCHASED",
        period_type: "normal",
        purchase_date: "2026-06-01T00:00:00Z",
        refunded_at: null,
        store: "app_store",
        unsubscribe_detected_at: null
      }
    }
  }
};

Deno.test("authenticated reconciliation writes verified production state", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const handler = createReconcileRevenueCatHandler({
    authenticate: async () => userId,
    entitlementId: "premium",
    fetchSubscriber: async () => productionSubscriber,
    now: () => new Date("2026-08-21T12:00:00Z"),
    readSubscription: async () => null,
    writeSubscription: async (input) => {
      writes.push(input);
      return {
        environment: input.environment,
        expires_at: input.expiresAt,
        is_lifetime: input.isLifetime,
        product_id: input.productId,
        status: input.status,
        verified_at: input.verifiedAt
      };
    }
  });

  const response = await handler(new Request("http://local", {
    method: "POST",
    headers: { Authorization: "Bearer valid" }
  }));
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(writes, [{
    environment: "PRODUCTION",
    eventAt: null,
    expiresAt: "2027-06-01T00:00:00Z",
    isLifetime: false,
    productId: "com.burakguven.hamiletakip.premium.yearly",
    status: "active",
    userId,
    verifiedAt: "2026-08-21T12:00:00.000Z"
  }]);
  assertEquals(body, {
    environment: "PRODUCTION",
    expires_at: "2027-06-01T00:00:00Z",
    is_premium: true,
    product_id: "com.burakguven.hamiletakip.premium.yearly",
    repaired: true,
    status: "active"
  });
});

Deno.test("missing authentication is rejected without RevenueCat request", async () => {
  let fetched = false;
  const handler = createReconcileRevenueCatHandler({
    authenticate: async () => null,
    entitlementId: "premium",
    fetchSubscriber: async () => {
      fetched = true;
      return productionSubscriber;
    },
    now: () => new Date("2026-08-21T12:00:00Z"),
    readSubscription: async () => null,
    writeSubscription: async () => null
  });

  const response = await handler(new Request("http://local", { method: "POST" }));

  assertEquals(response.status, 401);
  assertEquals(fetched, false);
});

Deno.test("RevenueCat failure does not write or downgrade cache", async () => {
  let writes = 0;
  const handler = createReconcileRevenueCatHandler({
    authenticate: async () => userId,
    entitlementId: "premium",
    fetchSubscriber: async () => {
      throw new Error("RevenueCat unavailable");
    },
    now: () => new Date("2026-08-21T12:00:00Z"),
    readSubscription: async () => ({
      environment: "PRODUCTION",
      expires_at: "2027-06-01T00:00:00Z",
      is_lifetime: false,
      product_id: "com.burakguven.hamiletakip.premium.yearly",
      status: "active",
      verified_at: null
    }),
    reportError: () => undefined,
    writeSubscription: async () => {
      writes += 1;
      return null;
    }
  });

  const response = await handler(new Request("http://local", {
    method: "POST",
    headers: { Authorization: "Bearer valid" }
  }));

  assertEquals(response.status, 502);
  assertEquals(writes, 0);
});

Deno.test("authoritative missing entitlement expires the cached product", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const cached = {
    environment: "PRODUCTION",
    expires_at: "2027-06-01T00:00:00Z",
    is_lifetime: false,
    product_id: "com.burakguven.hamiletakip.premium.yearly",
    status: "active",
    verified_at: null
  } satisfies SubscriptionCacheRow;
  const handler = createReconcileRevenueCatHandler({
    authenticate: async () => userId,
    entitlementId: "premium",
    fetchSubscriber: async () => ({
      subscriber: { entitlements: {}, subscriptions: {} }
    }),
    now: () => new Date("2026-08-21T12:00:00Z"),
    readSubscription: async () => cached,
    writeSubscription: async (input) => {
      writes.push(input);
      return {
        ...cached,
        expires_at: input.expiresAt,
        status: input.status,
        verified_at: input.verifiedAt
      };
    }
  });

  const response = await handler(new Request("http://local", {
    method: "POST",
    headers: { Authorization: "Bearer valid" }
  }));
  const body = await response.json();

  assertEquals(writes[0]?.status, "expired");
  assertEquals(body.is_premium, false);
});
