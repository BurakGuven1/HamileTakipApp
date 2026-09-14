import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreTransaction
} from "react-native-purchases";

import { getPremiumEntitlement } from "@/lib/revenuecat";
import { logFirebaseAnalyticsEvent } from "@/services/firebase/firebaseAnalytics";
import { classifyMetaPurchase } from "@/services/meta/metaPurchaseClassification";

const PURCHASE_MARKER_PREFIX = "@anne-plus/firebase-analytics/purchase/v1:";

/**
 * Mirrors the verified Meta purchase event into Firebase so Google Ads can
 * import `purchase` as a conversion and bid for paying installs instead of raw
 * downloads. The RevenueCat entitlement is the source of truth, so a cancelled
 * or unverified transaction never reports revenue.
 */
export async function trackFirebaseVerifiedRevenueCatPurchase(input: {
  customerInfo: CustomerInfo;
  purchasedPackage: PurchasesPackage | null;
  storeTransaction: PurchasesStoreTransaction;
}) {
  const { customerInfo, purchasedPackage, storeTransaction } = input;
  const entitlement = getPremiumEntitlement(customerInfo);
  if (!entitlement) return false;

  const product = purchasedPackage?.product ?? null;
  const classification = classifyMetaPurchase({
    currencyCode: product?.currencyCode ?? null,
    entitlementProductIdentifier: entitlement.productIdentifier,
    hasActiveEntitlement: entitlement.isActive,
    introPrice: product?.introPrice?.price ?? null,
    isSubscriptionProduct: Boolean(
      product?.subscriptionPeriod || entitlement.expirationDate
    ),
    periodType: entitlement.periodType,
    productPrice: product?.price ?? null,
    transactionProductIdentifier: storeTransaction.productIdentifier
  });

  if (
    classification.purchaseValue === null ||
    classification.currencyCode === null
  ) {
    return false;
  }

  const transactionId = storeTransaction.transactionIdentifier;
  const markerKey = `${PURCHASE_MARKER_PREFIX}${transactionId}`;

  try {
    if (await AsyncStorage.getItem(markerKey)) return false;
  } catch {
    // A failed marker read must not block the conversion.
  }

  const logged = await logFirebaseAnalyticsEvent("purchase", {
    value: classification.purchaseValue,
    currency: classification.currencyCode,
    transaction_id: transactionId
  });

  if (!logged) return false;

  try {
    await AsyncStorage.setItem(markerKey, "true");
  } catch {
    // Best effort: a duplicate is preferable to a missing conversion.
  }

  return true;
}
