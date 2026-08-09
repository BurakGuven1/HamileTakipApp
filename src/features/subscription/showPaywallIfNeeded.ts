import { router } from "expo-router";

import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { trackEvent } from "@/lib/analytics";
import {
  configureRevenueCat,
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo
} from "@/lib/revenuecat";

type PaywallTriggerProperties = Record<string, string | number | boolean | null>;

export type PaywallPresentationResult = {
  didBecomePremium: boolean;
  presented: boolean;
  result: "already_premium" | "opened";
};

export async function showPaywallIfNeeded(
  source: string,
  properties: PaywallTriggerProperties = {}
): Promise<PaywallPresentationResult> {
  await trackEvent("premium_gate_hit", {
    ...properties,
    source
  });

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

  await trackEvent("paywall_requested", {
    ...properties,
    source
  });

  router.push({ pathname: "/paywall", params: { source } });

  return {
    didBecomePremium: false,
    presented: true,
    result: "opened"
  };
}
