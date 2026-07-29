import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { Button } from "@/components/Button";
import { QueryState } from "@/components/QueryState";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import {
  getCurrentRevenueCatOffering,
  getSubscriptionStatusFromCustomerInfo,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, spacing } from "@/theme";

type PaywallErrorSource = "load" | "purchase" | "restore" | "sync";

export default function PaywallScreen() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const dismissedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const purchasingPackageRef = useRef<PurchasesPackage | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  function closePaywall() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    router.back();
  }

  const loadPaywall = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const currentOffering = await getCurrentRevenueCatOffering();
      if (generation !== loadGenerationRef.current) return;

      setOffering(currentOffering);
      void trackEvent("paywall_offering_loaded", {
        offering_id: currentOffering.identifier,
        package_count: currentOffering.availablePackages.length
      });
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;

      setOffering(null);
      setLoadError(error);
      void logPaywallError("load", error);
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPaywall();

    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadPaywall]);

  async function syncPremiumState(customerInfo: CustomerInfo) {
    const status = getSubscriptionStatusFromCustomerInfo(customerInfo);
    queryClient.setQueryData<PremiumSubscriptionStatus>(
      SUBSCRIPTION_STATUS_QUERY_KEY,
      status
    );

    try {
      await reconcileCustomerInfoWithSupabase(customerInfo);
      await queryClient.invalidateQueries({
        queryKey: SUBSCRIPTION_STATUS_QUERY_KEY
      });
    } catch (error) {
      await logPaywallError("sync", error);
    }

    return status;
  }

  if (loading) {
    return (
      <View style={styles.fallback}>
        <QueryState
          loading
          description="App Store'daki abonelik seçenekleri hazırlanıyor…"
          shape="paywall"
        />
        <Button label="Kapat" variant="ghost" onPress={closePaywall} />
      </View>
    );
  }

  if (loadError || !offering) {
    return (
      <View style={styles.fallback}>
        <QueryState
          description={getErrorMessage(
            loadError,
            "Abonelik seçenekleri şu anda alınamıyor."
          )}
          onRetry={() => void loadPaywall()}
          shape="paywall"
          title="Abonelikler şu anda kullanılamıyor"
        />
        <Button label="Kapat" variant="ghost" onPress={closePaywall} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        options={{ offering }}
        onDismiss={closePaywall}
        onPurchaseStarted={({ packageBeingPurchased }) => {
          purchasingPackageRef.current = packageBeingPurchased;
          void trackEvent("purchase_started", {
            product_id: packageBeingPurchased.identifier
          });
        }}
        onPurchaseCompleted={({ customerInfo }) => {
          void (async () => {
            const status = await syncPremiumState(customerInfo);
            await trackEvent("purchase_completed", {
              product_id: status.productIdentifier
            });
            showSuccess("Premium avantajların aktif edildi.", "Premium aktif");
          })();
        }}
        onPurchaseCancelled={() => {
          void trackEvent("purchase_cancelled", {
            product_id: purchasingPackageRef.current?.identifier ?? null,
            user_cancelled: true
          });
          purchasingPackageRef.current = null;
        }}
        onPurchaseError={({ error }) => {
          void logPaywallError("purchase", error);
          void trackEvent("purchase_cancelled", {
            product_id: purchasingPackageRef.current?.identifier ?? null,
            user_cancelled: false
          });
          purchasingPackageRef.current = null;
          showError(error, "Satın alma tamamlanamadı");
        }}
        onRestoreStarted={() => {
          void trackEvent("restore_purchases_attempted");
        }}
        onRestoreCompleted={({ customerInfo }) => {
          void (async () => {
            const status = await syncPremiumState(customerInfo);
            await trackEvent("restore_purchases_succeeded", {
              premium_active: status.isPremium
            });
            showSuccess("Satın alımlar kontrol edildi.", "Geri yükleme tamamlandı");
          })();
        }}
        onRestoreError={({ error }) => {
          void logPaywallError("restore", error);
          showError(error, "Satın alma geri yüklenemedi");
        }}
        style={styles.paywall}
      />
    </View>
  );
}

async function logPaywallError(source: PaywallErrorSource, error: unknown) {
  const details = getPaywallErrorDetails(error);
  console.error("RevenueCat paywall error", { ...details, source });
  await trackEvent("paywall_error", { ...details, source });
}

function getPaywallErrorDetails(error: unknown) {
  const errorObject =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const userInfo =
    typeof errorObject.userInfo === "object" && errorObject.userInfo !== null
      ? (errorObject.userInfo as Record<string, unknown>)
      : {};

  return {
    code: toNullableString(errorObject.code),
    domain: toNullableString(errorObject.domain),
    message: getRawErrorMessage(error),
    readable_error_code:
      toNullableString(errorObject.readableErrorCode) ??
      toNullableString(userInfo.readableErrorCode) ??
      toNullableString(userInfo.readable_error_code),
    underlying_error_message: toNullableString(
      errorObject.underlyingErrorMessage
    ),
    user_info: toNullableJson(userInfo)
  };
}

function toNullableString(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "Unknown RevenueCat error";
}

function toNullableJson(value: Record<string, unknown>) {
  if (Object.keys(value).length === 0) return null;

  try {
    return JSON.stringify(value).slice(0, 1_000);
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  paywall: {
    flex: 1
  },
  fallback: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.xl
  }
});
