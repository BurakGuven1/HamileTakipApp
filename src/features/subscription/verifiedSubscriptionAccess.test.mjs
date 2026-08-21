import assert from "node:assert/strict";
import test from "node:test";

import { parseVerifiedSubscriptionAccess } from "./verifiedSubscriptionAccess.ts";

test("parses a verified production subscription response", () => {
  assert.deepEqual(parseVerifiedSubscriptionAccess({
    environment: "PRODUCTION",
    expires_at: "2027-06-01T00:00:00Z",
    is_premium: true,
    product_id: "com.burakguven.hamiletakip.premium.yearly",
    repaired: true,
    status: "active"
  }), {
    environment: "PRODUCTION",
    expiresAt: "2027-06-01T00:00:00Z",
    isPremium: true,
    productId: "com.burakguven.hamiletakip.premium.yearly",
    repaired: true,
    status: "active"
  });
});

test("rejects invalid environment and status values", () => {
  assert.throws(() => parseVerifiedSubscriptionAccess({
    environment: "TESTFLIGHT",
    expires_at: null,
    is_premium: false,
    product_id: null,
    repaired: false,
    status: "active"
  }), /Abonelik doğrulama yanıtı/);

  assert.throws(() => parseVerifiedSubscriptionAccess({
    environment: "PRODUCTION",
    expires_at: null,
    is_premium: false,
    product_id: null,
    repaired: false,
    status: "unknown_status"
  }), /Abonelik doğrulama yanıtı/);
});
