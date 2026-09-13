import { router } from "expo-router";

import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { trackEvent } from "@/lib/analytics";
import {
  configureRevenueCat,
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo
} from "@/lib/revenuecat";

import {
  shouldCheckPremiumBeforePaywall,
  type PremiumPaywallMode
} from "./paywallPolicy";
import { getPremiumBundleForSource } from "./premiumFeatures";

type PaywallTriggerProperties = Record<string, string | number | boolean | null>;

export type PaywallPresentationResult = {
  didBecomePremium: boolean;
  presented: boolean;
  result: "already_premium" | "opened";
};

export async function showPaywallIfNeeded(
  source: string,
  properties: PaywallTriggerProperties = {},
  options: { mode?: PremiumPaywallMode } = {}
): Promise<PaywallPresentationResult> {
  const presentationMode = options.mode ?? "if_needed";
  // Every gate reports the bundle it belongs to so the funnel can be read per
  // promise instead of per individual lock.
  const bundle = getPremiumBundleForSource(source);
  await trackEvent("premium_gate_hit", {
    ...properties,
    bundle: bundle.key,
    presentation_mode: presentationMode,
    source
  });

  if (shouldCheckPremiumBeforePaywall(presentationMode)) {
    try {
      configureRevenueCat();
      const [customerInfo, effectiveAccess] = await Promise.all([
        getCustomerInfo(),
        getEffectivePremiumAccess().catch(() => null)
      ]);
      const status = getSubscriptionStatusFromCustomerInfo(customerInfo);

      if (status.isPremium || effectiveAccess?.isPremium) {
        return {
          didBecomePremium: true,
          presented: false,
          result: "already_premium"
        };
      }
    } catch (error) {
      console.warn("Premium durum kontrolu yapilamadi", error);
    }
  }

  await trackEvent("paywall_requested", {
    ...properties,
    bundle: bundle.key,
    presentation_mode: presentationMode,
    source
  });

  router.push({
    pathname: "/paywall",
    params: {
      source,
      bundle: bundle.key,
      feature: toRouteParam(properties.feature),
      life_stage: toRouteParam(properties.life_stage),
      reason: toRouteParam(properties.reason),
      remaining: toRouteParam(properties.remaining)
    }
  });

  return {
    didBecomePremium: false,
    presented: true,
    result: "opened"
  };
}

function toRouteParam(value: string | number | boolean | null | undefined) {
  return value === null || value === undefined ? undefined : String(value);
}
