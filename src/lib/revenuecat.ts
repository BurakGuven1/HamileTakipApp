import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering
} from "react-native-purchases";

import { env, getRevenueCatApiKey } from "@/config/env";
import { trackEvent } from "@/lib/analytics";

let configured = false;
let currentRevenueCatUserId: string | null = null;

export const SUBSCRIPTION_STATUS_QUERY_KEY = ["subscription-status"] as const;

export type RevenueCatConfigurationIssue =
  | "missing_api_key"
  | "unsupported_platform"
  | "wrong_platform_api_key";

export type PremiumAccessSource =
  | "family"
  | "family_trial"
  | "none"
  | "own";

export class RevenueCatConfigurationError extends Error {
  readonly code = "REVENUECAT_CONFIGURATION";

  constructor(
    message: string,
    readonly issue: RevenueCatConfigurationIssue
  ) {
    super(message);
    this.name = "RevenueCatConfigurationError";
  }
}

export type PremiumSubscriptionStatus = {
  accessSource: PremiumAccessSource;
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
  const configurationIssue = getRevenueCatConfigurationIssue();

  if (configurationIssue || !apiKey || configured) {
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

  Purchases.configure({
    apiKey
  });
  configured = true;
}

export const initializeRevenueCat = configureRevenueCat;

export function isRevenueCatConfigured() {
  return configured;
}

export function getRevenueCatConfigurationIssue(): RevenueCatConfigurationIssue | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return "unsupported_platform";
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return "missing_api_key";
  }

  const expectedPrefix = Platform.OS === "ios" ? "appl_" : "goog_";
  if (!apiKey.startsWith(expectedPrefix)) {
    return "wrong_platform_api_key";
  }

  return null;
}

export async function getCurrentRevenueCatOffering(): Promise<PurchasesOffering> {
  configureRevenueCat();

  const configurationIssue = getRevenueCatConfigurationIssue();
  if (configurationIssue) {
    throw new RevenueCatConfigurationError(
      getRevenueCatConfigurationErrorMessage(configurationIssue),
      configurationIssue
    );
  }

  if (!configured) {
    throw new RevenueCatConfigurationError(
      "RevenueCat SDK could not be configured.",
      "missing_api_key"
    );
  }

  const offerings = await Purchases.getOfferings();
  const currentOffering = offerings.current;

  if (!currentOffering || currentOffering.availablePackages.length === 0) {
    throw new RevenueCatConfigurationError(
      "RevenueCat current offering has no Store products available on this device.",
      "wrong_platform_api_key"
    );
  }

  return currentOffering;
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

function getRevenueCatConfigurationErrorMessage(
  issue: RevenueCatConfigurationIssue
) {
  switch (issue) {
    case "missing_api_key":
      return "RevenueCat public SDK API key is missing from this build.";
    case "wrong_platform_api_key":
      return `RevenueCat public SDK API key does not match the ${Platform.OS} store.`;
    case "unsupported_platform":
      return `RevenueCat purchases are not supported on ${Platform.OS}.`;
  }
}
