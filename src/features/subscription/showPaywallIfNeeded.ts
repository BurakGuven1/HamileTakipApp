import { router } from "expo-router";

import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { trackEvent } from "@/lib/analytics";
import {
  configureRevenueCat,
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo
} from "@/lib/revenuecat";

export type PaywallTriggerSource =
  | "ad_limit_reached"
  | "day5_offer"
  | "onboarding_end"
  | "premium_feature"
  | "seasonal"
  | "settings";

type PaywallTriggerProperties = Record<string, string | number | boolean | null>;

export type PaywallPresentationResult = {
  didBecomePremium: boolean;
  presented: boolean;
  result: "already_premium" | "opened";
};

export async function showPaywallIfNeeded(
  triggerSource: PaywallTriggerSource,
  properties: PaywallTriggerProperties = {}
): Promise<PaywallPresentationResult> {
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

  await trackEvent("paywall_viewed", {
    ...properties,
    trigger_source: triggerSource
  });

  router.push("/paywall");

  return {
    didBecomePremium: false,
    presented: true,
    result: "opened"
  };
}
