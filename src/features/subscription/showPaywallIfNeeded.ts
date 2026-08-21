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
  await trackEvent("premium_gate_hit", {
    ...properties,
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
    presentation_mode: presentationMode,
    source
  });

  router.push({
    pathname: "/paywall",
    params: {
      source,
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
