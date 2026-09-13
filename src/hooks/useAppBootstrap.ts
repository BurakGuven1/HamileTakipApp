import { useEffect } from "react";
import { router } from "expo-router";
import { AppState } from "react-native";

import {
  initializeAnalytics,
  trackAuthenticatedSessionStartedIfNeeded,
  trackSessionStartedIfNeeded
} from "@/lib/analytics";
import {
  clearAppNotificationBadge,
  registerAndSavePushToken
} from "@/lib/notifications";
import { configureRevenueCat } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";
import {
  initializeMetaAppEvents,
  logMetaDevelopmentTestEventIfEnabled,
  refreshMetaTrackingPermission,
  requestMetaTrackingPermissionIfNeeded
} from "@/services/meta/metaAppEvents";

export function useAppBootstrap() {
  useEffect(() => {
    let mounted = true;

    async function bootstrapPushToken(requestPermission = true) {
      const { data } = await supabase.auth.getSession();
      if (!mounted || !data.session) return;
      await registerAndSavePushToken(requestPermission);
    }

    async function bootstrap() {
      configureRevenueCat();
      clearAppNotificationBadge();
      void initializeMetaAppEvents()
        .then(async (initialized) => {
          if (!initialized) return;
          await requestMetaTrackingPermissionIfNeeded();
          await logMetaDevelopmentTestEventIfEnabled();
        })
        .catch((error) => {
          console.warn("Meta App Events bootstrap failed", error);
        });
      await initializeAnalytics();
      // A cold start by a signed-out user used to emit nothing at all:
      // trackAuthenticatedSessionStartedIfNeeded() returns early without a
      // userId, and the AppState listener below never fires for a launch that
      // is already active. Every install that stalled on the sign-in screen was
      // therefore invisible in the funnel. The unauthenticated session is
      // recorded first so installs can be compared against sign-ins.
      await trackSessionStartedIfNeeded();
      await trackAuthenticatedSessionStartedIfNeeded();
      await bootstrapPushToken(false);
    }

    bootstrap().catch((error) => {
      console.warn("App bootstrap failed", error);
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
          trackAuthenticatedSessionStartedIfNeeded().catch(() => undefined);
          bootstrapPushToken(false).catch((error) => {
            console.warn("Push token registration after sign-in failed", error);
          });
        } else if (event === "SIGNED_OUT") {
          router.replace("/sign-in");
        }
      }
    );

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      clearAppNotificationBadge();
      trackSessionStartedIfNeeded()
        .then(() => trackAuthenticatedSessionStartedIfNeeded())
        .catch(() => undefined);
      refreshMetaTrackingPermission().catch((error) => {
        console.warn("Meta tracking permission refresh failed", error);
      });
      bootstrapPushToken(false).catch((error) => {
        console.warn("Push token refresh failed", error);
      });
    });

    return () => {
      mounted = false;
      authSubscription.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);
}
