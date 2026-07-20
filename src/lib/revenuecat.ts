import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo
} from "react-native-purchases";

import { env, getRevenueCatApiKey } from "@/config/env";
import { trackEvent } from "@/lib/analytics";

let configured = false;
let currentRevenueCatUserId: string | null = null;

export const SUBSCRIPTION_STATUS_QUERY_KEY = ["subscription-status"] as const;

export type PremiumSubscriptionStatus = {
  accessSource: "family_trial" | "none" | "own";
  customerInfo: CustomerInfo | null;
  expirationDate: string | null;
  familyTrialExpirationDate: string | null;
  familyTrialStartedAt: string | null;
  isLifetime: boolean;
  isPremium: boolean;
  productIdentifier: string | null;
  willRenew: boolean;
};

export function configureRevenueCat() {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey || configured || Platform.OS === "web") {
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey
  });
  configured = true;
}

export const initializeRevenueCat = configureRevenueCat;

export function isRevenueCatConfigured() {
  return configured;
}

export async function logInRevenueCat(userId: string) {
  configureRevenueCat();

  if (!configured) {
    return null;
  }

  if (currentRevenueCatUserId === userId) {
    return Purchases.getCustomerInfo();
  }

  const result = await Purchases.logIn(userId);
  currentRevenueCatUserId = userId;
  return result.customerInfo;
}

export async function logOutRevenueCat() {
  configureRevenueCat();

  if (!configured) {
    currentRevenueCatUserId = null;
    return null;
  }

  currentRevenueCatUserId = null;
  return Purchases.logOut();
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

export function getPremiumEntitlement(customerInfo: CustomerInfo | null) {
  return customerInfo?.entitlements.active[env.revenueCatEntitlementId] ?? null;
}

export function getSubscriptionStatusFromCustomerInfo(
  customerInfo: CustomerInfo | null
): PremiumSubscriptionStatus {
  const entitlement = getPremiumEntitlement(customerInfo);

  return {
    accessSource: entitlement ? "own" : "none",
    customerInfo,
    expirationDate: entitlement?.expirationDate ?? null,
    familyTrialExpirationDate: null,
    familyTrialStartedAt: null,
    isLifetime: Boolean(entitlement && !entitlement.expirationDate),
    isPremium: Boolean(entitlement),
    productIdentifier: entitlement?.productIdentifier ?? null,
    willRenew: entitlement?.willRenew ?? false
  };
}

export async function restorePremiumPurchases() {
  if (!configured) {
    configureRevenueCat();
  }

  if (!configured) {
    return null;
  }

  await trackEvent("restore_purchases_attempted");
  const customerInfo = await Purchases.restorePurchases();
  await trackEvent("restore_purchases_succeeded", {
    premium_active: hasPremiumEntitlement(customerInfo)
  });

  return customerInfo;
}
