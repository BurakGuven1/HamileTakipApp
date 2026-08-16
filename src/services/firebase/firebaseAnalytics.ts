import type {
  FirebaseAnalyticsEventMap,
  FirebaseSignUpMethod
} from "@/services/firebase/firebaseAnalytics.types";

export type { FirebaseAnalyticsEventMap, FirebaseSignUpMethod };

export async function isFirebaseAnalyticsAvailable() {
  return false;
}

export async function logFirebaseAnalyticsEvent<
  EventName extends keyof FirebaseAnalyticsEventMap
>(
  _eventName: EventName,
  _parameters: FirebaseAnalyticsEventMap[EventName]
) {
  return false;
}

export async function trackFirebaseSignUpOnce(
  _registrationId: string,
  _method: FirebaseSignUpMethod
) {
  return false;
}
