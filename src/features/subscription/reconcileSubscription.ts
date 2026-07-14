import type { CustomerInfo } from "react-native-purchases";

import {
  reconcileSubscription,
  type SubscriptionCacheStatus
} from "@/api/subscriptions";
import {
  getPremiumEntitlement,
  getSubscriptionStatusFromCustomerInfo
} from "@/lib/revenuecat";

export async function reconcileCustomerInfoWithSupabase(
  customerInfo: CustomerInfo | null
) {
  if (!customerInfo) {
    return null;
  }

  const entitlement = getPremiumEntitlement(customerInfo);
  const status = getSubscriptionStatusFromCustomerInfo(customerInfo);

  if (entitlement) {
    return null;
  }

  const fallbackProductId = getMostRelevantProductIdentifier(customerInfo);
  const productId = status.productIdentifier ?? fallbackProductId;

  if (!productId) {
    return null;
  }

  const cacheStatus: SubscriptionCacheStatus = entitlement
    ? "active"
    : getInactiveCacheStatus(customerInfo);

  try {
    return await reconcileSubscription({
      expiresAt: status.expirationDate ?? customerInfo.latestExpirationDate,
      isLifetime: status.isLifetime,
      productId,
      status: cacheStatus
    });
  } catch (error) {
    console.warn("RevenueCat Supabase reconciliation failed", error);
    return null;
  }
}

function getInactiveCacheStatus(customerInfo: CustomerInfo): SubscriptionCacheStatus {
  const latestExpirationDate = customerInfo.latestExpirationDate;

  if (!latestExpirationDate) {
    return "expired";
  }

  const expirationTime = Date.parse(latestExpirationDate);
  if (Number.isFinite(expirationTime) && expirationTime > Date.now()) {
    return "cancelled";
  }

  return "expired";
}

function getMostRelevantProductIdentifier(customerInfo: CustomerInfo) {
  if (customerInfo.activeSubscriptions.length > 0) {
    return customerInfo.activeSubscriptions[0] ?? null;
  }

  const purchasedProducts = customerInfo.allPurchasedProductIdentifiers;
  if (purchasedProducts.length === 0) {
    return null;
  }

  return [...purchasedProducts].sort((first, second) => {
    const firstDate = customerInfo.allPurchaseDates[first];
    const secondDate = customerInfo.allPurchaseDates[second];
    return Date.parse(secondDate ?? "") - Date.parse(firstDate ?? "");
  })[0] ?? null;
}
