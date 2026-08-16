import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  FirebaseAnalyticsEventMap,
  FirebaseSignUpMethod
} from "@/services/firebase/firebaseAnalytics.types";

export type { FirebaseAnalyticsEventMap, FirebaseSignUpMethod };

const SIGN_UP_MARKER_PREFIX = "@anne-plus/firebase-analytics/sign-up/v1:";

type FirebaseModules = {
  analytics: typeof import("@react-native-firebase/analytics");
  app: typeof import("@react-native-firebase/app");
};

let modulesPromise: Promise<FirebaseModules | null> | null = null;
let signUpQueue: Promise<unknown> = Promise.resolve();

export async function isFirebaseAnalyticsAvailable() {
  const modules = await getFirebaseModules();
  if (!modules) return false;

  try {
    return modules.app.getApps().length > 0;
  } catch (error) {
    logDevelopmentError("availability check failed", error);
    return false;
  }
}

export async function logFirebaseAnalyticsEvent<
  EventName extends keyof FirebaseAnalyticsEventMap
>(
  eventName: EventName,
  parameters: FirebaseAnalyticsEventMap[EventName]
) {
  const modules = await getFirebaseModules();
  if (!modules) return false;

  try {
    if (modules.app.getApps().length === 0) {
      logDevelopmentError("default Firebase app is not configured");
      return false;
    }

    const analytics = modules.analytics.getAnalytics();

    switch (eventName) {
      case "sign_up":
        await modules.analytics.logSignUp(
          analytics,
          parameters as FirebaseAnalyticsEventMap["sign_up"]
        );
        return true;
    }
  } catch (error) {
    logDevelopmentError(`event ${String(eventName)} failed`, error);
    return false;
  }
}

export function trackFirebaseSignUpOnce(
  registrationId: string,
  method: FirebaseSignUpMethod
) {
  const operation = signUpQueue.then(async () => {
    if (!registrationId) return false;

    const markerKey = `${SIGN_UP_MARKER_PREFIX}${registrationId}`;

    try {
      if (await AsyncStorage.getItem(markerKey)) return false;

      const logged = await logFirebaseAnalyticsEvent("sign_up", { method });
      if (!logged) return false;

      await AsyncStorage.setItem(markerKey, "true");
      return true;
    } catch (error) {
      logDevelopmentError("sign_up deduplication failed", error);
      return false;
    }
  });

  signUpQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

function getFirebaseModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("@react-native-firebase/analytics"),
      import("@react-native-firebase/app")
    ])
      .then(([analytics, app]) => ({ analytics, app }))
      .catch((error) => {
        logDevelopmentError(
          "native modules are unavailable; use a native development build instead of Expo Go",
          error
        );
        return null;
      });
  }

  return modulesPromise;
}

function logDevelopmentError(message: string, error?: unknown) {
  if (!__DEV__) return;

  if (error === undefined) {
    console.warn(`[Firebase Analytics] ${message}`);
    return;
  }

  console.warn(`[Firebase Analytics] ${message}`, error);
}
