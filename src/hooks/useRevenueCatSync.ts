import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { CustomerInfo } from "react-native-purchases";
import Purchases from "react-native-purchases";

import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { trackEvent } from "@/lib/analytics";
import {
  configureRevenueCat,
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo,
  isRevenueCatConfigured,
  logInRevenueCat,
  logOutRevenueCat,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";

export function useRevenueCatSync() {
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);
  const lastPremiumRef = useRef<boolean | null>(null);

  useEffect(() => {
    configureRevenueCat();

    if (!isRevenueCatConfigured()) {
      return;
    }

    function writeCustomerInfo(customerInfo: CustomerInfo | null) {
      const status = getSubscriptionStatusFromCustomerInfo(customerInfo);
      queryClient.setQueryData<PremiumSubscriptionStatus>(
        SUBSCRIPTION_STATUS_QUERY_KEY,
        status
      );
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_STATUS_QUERY_KEY });

      const previousPremium = lastPremiumRef.current;
      lastPremiumRef.current = status.isPremium;

      if (previousPremium === true && !status.isPremium) {
        trackEvent("subscription_expired", {
          product_id: status.productIdentifier
        }).catch(() => undefined);
      }
    }

    async function syncCustomerInfo(customerInfo: CustomerInfo | null) {
      writeCustomerInfo(customerInfo);

      try {
        await reconcileCustomerInfoWithSupabase(customerInfo);
      } catch (error) {
        console.warn("RevenueCat reconciliation failed", error);
      }
    }

    async function syncRevenueCatUser(userId: string | null) {
      try {
        if (userId) {
          if (lastUserIdRef.current !== userId) {
            const customerInfo = await logInRevenueCat(userId);
            lastUserIdRef.current = userId;
            await syncCustomerInfo(customerInfo);
            return;
          }

          const customerInfo = await getCustomerInfo();
          await syncCustomerInfo(customerInfo);
          return;
        }

        if (lastUserIdRef.current) {
          const customerInfo = await logOutRevenueCat();
          lastUserIdRef.current = null;
          await syncCustomerInfo(customerInfo);
        }
      } catch (error) {
        console.warn("RevenueCat auth sync failed", error);
      }
    }

    const customerInfoListener = (customerInfo: CustomerInfo) => {
      syncCustomerInfo(customerInfo).catch(() => undefined);
    };

    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    supabase.auth
      .getSession()
      .then(({ data }) => syncRevenueCatUser(data.session?.user.id ?? null))
      .catch((error) => console.warn("Initial RevenueCat auth sync failed", error));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        syncRevenueCatUser(session?.user.id ?? null).catch(() => undefined);
        return;
      }

      if (event === "SIGNED_OUT") {
        syncRevenueCatUser(null).catch(() => undefined);
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }

      getCustomerInfo()
        .then(syncCustomerInfo)
        .catch((error) =>
          console.warn("RevenueCat active-state sync failed", error)
        );
    });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [queryClient]);
}
