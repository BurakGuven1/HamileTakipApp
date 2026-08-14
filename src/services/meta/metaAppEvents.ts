import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync
} from "expo-tracking-transparency";
import { NativeModules, Platform } from "react-native";
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreTransaction
} from "react-native-purchases";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";

import { getPremiumEntitlement } from "@/lib/revenuecat";
import { classifyMetaPurchase } from "@/services/meta/metaPurchaseClassification";

const META_DEDUPE_STORAGE_KEY = "@anne-plus/meta-app-events/v1";
const MAX_PERSISTED_DEDUPE_MARKERS = 512;

let initializationPromise: Promise<boolean> | null = null;
let dedupeMarkersPromise: Promise<Set<string>> | null = null;
let dedupeQueue: Promise<unknown> = Promise.resolve();

export function initializeMetaAppEvents() {
  if (!isMetaNativeModuleAvailable()) {
    return Promise.resolve(false);
  }

  if (!initializationPromise) {
    initializationPromise = Promise.resolve()
      .then(async () => {
        // Info.plist starts both values as false. Repeat that policy before SDK
        // initialization so an undetermined/denied ATT state can never use IDFA.
        Settings.setAdvertiserIDCollectionEnabled(false);
        await Settings.setAdvertiserTrackingEnabled(false);
        Settings.setAutoLogAppEventsEnabled(true);
        Settings.initializeSDK();

        await applyCurrentTrackingPermission(false);
        return true;
      })
      .catch((error) => {
        console.warn("Meta App Events initialization failed", error);
        return false;
      });
  }

  return initializationPromise;
}

export async function requestMetaTrackingPermissionIfNeeded() {
  if (!(await initializeMetaAppEvents())) {
    return false;
  }

  return applyCurrentTrackingPermission(true);
}

export async function refreshMetaTrackingPermission() {
  if (!(await initializeMetaAppEvents())) {
    return false;
  }

  return applyCurrentTrackingPermission(false);
}

export async function trackMetaCompleteRegistrationOnce(
  supabaseUserId: string
) {
  if (!supabaseUserId || !(await initializeMetaAppEvents())) {
    return false;
  }

  return logMetaEventOnce(`registration:${supabaseUserId}`, () => {
    AppEventsLogger.logEvent(
      AppEventsLogger.AppEvents.CompletedRegistration
    );
  });
}

export async function trackMetaVerifiedRevenueCatPurchase(input: {
  customerInfo: CustomerInfo;
  purchasedPackage: PurchasesPackage | null;
  storeTransaction: PurchasesStoreTransaction;
}) {
  if (!(await initializeMetaAppEvents())) {
    return;
  }

  const { customerInfo, purchasedPackage, storeTransaction } = input;
  const entitlement = getPremiumEntitlement(customerInfo);
  if (!entitlement) {
    return;
  }

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
  const transactionMarker = `transaction:${storeTransaction.transactionIdentifier}`;

  if (classification.shouldLogStartTrial) {
    await logMetaEventOnce(`${transactionMarker}:start-trial`, () => {
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.StartTrial);
    });
  }

  if (classification.shouldLogSubscribe) {
    await logMetaEventOnce(`${transactionMarker}:subscribe`, () => {
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.Subscribe);
    });
  }

  if (
    classification.purchaseValue !== null &&
    classification.currencyCode !== null
  ) {
    await logMetaEventOnce(`${transactionMarker}:purchase`, () => {
      AppEventsLogger.logPurchase(
        classification.purchaseValue!,
        classification.currencyCode!
      );
    });
  }
}

export async function logMetaDevelopmentTestEventIfEnabled() {
  if (
    !__DEV__ ||
    process.env.EXPO_PUBLIC_META_TEST_EVENT_ENABLED !== "true" ||
    !(await initializeMetaAppEvents())
  ) {
    return;
  }

  AppEventsLogger.logEvent("anne_meta_integration_test");
  AppEventsLogger.flush();
}

async function applyCurrentTrackingPermission(requestIfUndetermined: boolean) {
  const currentPermission = await getTrackingPermissionsAsync();
  const permission =
    requestIfUndetermined &&
    currentPermission.status === "undetermined" &&
    currentPermission.canAskAgain
      ? await requestTrackingPermissionsAsync()
      : currentPermission;
  const trackingGranted = permission.granted === true;

  Settings.setAdvertiserIDCollectionEnabled(trackingGranted);
  await Settings.setAdvertiserTrackingEnabled(trackingGranted);
  return trackingGranted;
}

function logMetaEventOnce(marker: string, logEvent: () => void) {
  const operation = dedupeQueue.then(async () => {
    const markers = await getDedupeMarkers();
    if (markers.has(marker)) {
      return false;
    }

    logEvent();
    markers.add(marker);

    while (markers.size > MAX_PERSISTED_DEDUPE_MARKERS) {
      const oldestMarker = markers.values().next().value;
      if (typeof oldestMarker !== "string") break;
      markers.delete(oldestMarker);
    }

    try {
      await AsyncStorage.setItem(
        META_DEDUPE_STORAGE_KEY,
        JSON.stringify([...markers])
      );
    } catch (error) {
      console.warn("Meta event deduplication could not be persisted", error);
    }

    return true;
  });

  dedupeQueue = operation.catch(() => undefined);
  return operation;
}

function getDedupeMarkers() {
  if (!dedupeMarkersPromise) {
    dedupeMarkersPromise = AsyncStorage.getItem(META_DEDUPE_STORAGE_KEY)
      .then((storedValue) => {
        if (!storedValue) return new Set<string>();

        const parsedValue: unknown = JSON.parse(storedValue);
        if (!Array.isArray(parsedValue)) return new Set<string>();

        return new Set(
          parsedValue.filter(
            (value): value is string => typeof value === "string"
          )
        );
      })
      .catch((error) => {
        console.warn("Meta event deduplication could not be loaded", error);
        return new Set<string>();
      });
  }

  return dedupeMarkersPromise;
}

function isMetaNativeModuleAvailable() {
  return (
    Platform.OS === "ios" &&
    Boolean(NativeModules.FBSettings) &&
    Boolean(NativeModules.FBAppEventsLogger)
  );
}
