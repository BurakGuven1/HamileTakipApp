import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage
} from "react-native-purchases";

import { env, getRevenueCatApiKey } from "@/config/env";
import { trackEvent } from "@/lib/analytics";

let configured = false;

export function configureRevenueCat(userId?: string) {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey || configured || Platform.OS === "web") {
    return;
  }

  Purchases.configure({
    apiKey,
    appUserID: userId
  });
  configured = true;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) {
    configureRevenueCat();
  }

  if (!configured) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null) {
  return Boolean(
    customerInfo?.entitlements.active[env.revenueCatEntitlementId]
  );
}

export async function getPaywallPackages(): Promise<PurchasesPackage[]> {
  if (!configured) {
    configureRevenueCat();
  }

  if (!configured) {
    return [];
  }

  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePremiumPackage(identifier: string) {
  await trackEvent("purchase_started", { product_id: identifier });

  const packages = await getPaywallPackages();
  const selectedPackage = packages.find(
    (purchasePackage) => purchasePackage.identifier === identifier
  );

  if (!selectedPackage) {
    await trackEvent("purchase_cancelled", {
      product_id: identifier,
      reason: "package_not_found"
    });
    return null;
  }

  try {
    const result = await Purchases.purchasePackage(selectedPackage);
    await trackEvent("purchase_completed", { product_id: identifier });
    return result;
  } catch (error) {
    await trackEvent("purchase_cancelled", { product_id: identifier });
    throw error;
  }
}
