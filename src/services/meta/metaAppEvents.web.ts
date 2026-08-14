import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreTransaction
} from "react-native-purchases";

export function initializeMetaAppEvents() {
  return Promise.resolve(false);
}

export function requestMetaTrackingPermissionIfNeeded() {
  return Promise.resolve(false);
}

export function refreshMetaTrackingPermission() {
  return Promise.resolve(false);
}

export function trackMetaCompleteRegistrationOnce(_supabaseUserId: string) {
  return Promise.resolve(false);
}

export function trackMetaVerifiedRevenueCatPurchase(_input: {
  customerInfo: CustomerInfo;
  purchasedPackage: PurchasesPackage | null;
  storeTransaction: PurchasesStoreTransaction;
}) {
  return Promise.resolve();
}

export function logMetaDevelopmentTestEventIfEnabled() {
  return Promise.resolve();
}
