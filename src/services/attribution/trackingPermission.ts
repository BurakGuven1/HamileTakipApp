import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync
} from "expo-tracking-transparency";
import { Platform } from "react-native";

import { applyFirebaseConsent } from "@/services/firebase/firebaseAnalytics";

let pendingRequest: Promise<boolean> | null = null;

/**
 * One ATT prompt for the whole app.
 *
 * The prompt used to live inside the Meta bootstrap, so a build without Meta
 * credentials never asked at all and Firebase was left without the IDFA that
 * Google Ads needs to attribute an install to a campaign. Asking here and
 * broadcasting the answer keeps a single system prompt while both ad platforms
 * learn the result.
 */
export function requestTrackingPermissionIfNeeded() {
  if (Platform.OS !== "ios") {
    return Promise.resolve(false);
  }

  if (!pendingRequest) {
    pendingRequest = resolveTrackingPermission(true).catch((error) => {
      console.warn("Tracking permission request failed", error);
      pendingRequest = null;
      return false;
    });
  }

  return pendingRequest;
}

/** Re-reads the setting (the user can flip it in iOS Settings at any time). */
export function refreshTrackingPermission() {
  if (Platform.OS !== "ios") {
    return Promise.resolve(false);
  }

  return resolveTrackingPermission(false).catch((error) => {
    console.warn("Tracking permission refresh failed", error);
    return false;
  });
}

async function resolveTrackingPermission(requestIfUndetermined: boolean) {
  const currentPermission = await getTrackingPermissionsAsync();
  const permission =
    requestIfUndetermined &&
    currentPermission.status === "undetermined" &&
    currentPermission.canAskAgain
      ? await requestTrackingPermissionsAsync()
      : currentPermission;
  const trackingGranted = permission.granted === true;

  await applyFirebaseConsent({ trackingGranted });
  return trackingGranted;
}
