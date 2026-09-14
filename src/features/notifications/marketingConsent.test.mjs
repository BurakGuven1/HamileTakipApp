import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMarketingPushAllowed,
  isMarketingNotificationType,
  isMarketingPushAllowed,
  MARKETING_CONSENT_COPY
} from "./marketingConsent.ts";
import { resolveInterruptionLevel } from "./interruption.ts";

const CONSENTED = {
  notify_premium_offers: true,
  premium_offer_consent_at: "2026-09-01T10:00:00.000Z"
};

test("açık onay verilmiş profil kampanya bildirimi alabilir", () => {
  assert.equal(isMarketingPushAllowed(CONSENTED), true);
  assert.doesNotThrow(() => assertMarketingPushAllowed(CONSENTED));
});

test("anahtar açık ama onay damgası yoksa gönderim engellenir", () => {
  assert.equal(
    isMarketingPushAllowed({
      notify_premium_offers: true,
      premium_offer_consent_at: null
    }),
    false
  );
  assert.equal(
    isMarketingPushAllowed({
      notify_premium_offers: true,
      premium_offer_consent_at: "   "
    }),
    false
  );
  assert.equal(
    isMarketingPushAllowed({
      notify_premium_offers: true,
      premium_offer_consent_at: "hiç de tarih değil"
    }),
    false
  );
});

test("varsayılan (opt-in yapılmamış) profil kampanya bildirimi almaz", () => {
  assert.equal(isMarketingPushAllowed(null), false);
  assert.equal(isMarketingPushAllowed(undefined), false);
  assert.equal(isMarketingPushAllowed({}), false);
  assert.equal(
    isMarketingPushAllowed({
      notify_premium_offers: false,
      premium_offer_consent_at: "2026-09-01T10:00:00.000Z"
    }),
    false
  );
});

test("truthy ama true olmayan değerler onay sayılmaz", () => {
  assert.equal(
    isMarketingPushAllowed({
      notify_premium_offers: "true",
      premium_offer_consent_at: "2026-09-01T10:00:00.000Z"
    }),
    false
  );
});

test("onay yokken gönderim denemesi hata fırlatır", () => {
  assert.throws(
    () => assertMarketingPushAllowed({ notify_premium_offers: false }),
    /4\.5\.4/
  );
});

test("pazarlama tipleri asla Time Sensitive teslim edilmez", () => {
  for (const type of [
    "premium_campaign",
    "premium_offer",
    "product_announcement"
  ]) {
    assert.equal(isMarketingNotificationType(type), true);
    assert.equal(resolveInterruptionLevel(type), "active");
  }

  assert.equal(isMarketingNotificationType("care_alarm"), false);
  assert.equal(resolveInterruptionLevel("care_alarm"), "timeSensitive");
});

test("onay metni varsayılanın kapalı olduğunu ve kapatma yolunu söyler", () => {
  assert.match(MARKETING_CONSENT_COPY.description, /kapalı/i);
  assert.match(MARKETING_CONSENT_COPY.description, /kapatabilirsin/i);
});
