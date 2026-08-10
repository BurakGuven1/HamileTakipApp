import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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
import { createAnalyticsEventId, trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import {
  getCurrentRevenueCatOffering,
  getSubscriptionStatusFromCustomerInfo,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { useFeedback } from "@/providers/FeedbackProvider";
import { trackPaywallView } from "@/services/analytics/paywallAnalytics";
import { colors, spacing } from "@/theme";

type PaywallErrorSource = "load" | "purchase" | "restore" | "sync";
type PaywallRouteParams = {
  feature?: string | string[];
  life_stage?: string | string[];
  reason?: string | string[];
  remaining?: string | string[];
  source?: string | string[];
};

export default function PaywallScreen() {
  const params = useLocalSearchParams<PaywallRouteParams>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const dismissedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const purchasingPackageRef = useRef<PurchasesPackage | null>(null);
  const paywallViewIdRef = useRef(createAnalyticsEventId());
  const viewedAtRef = useRef(Date.now());
  const viewTrackedRef = useRef(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;

    const sourceParam = Array.isArray(params.source)
      ? params.source[0]
      : params.source;
    const source = sourceParam?.trim() || "direct_navigation";

    void trackPaywallView(source, {
      featureKey: getRouteParam(params.feature),
      paywallViewId: paywallViewIdRef.current,
      triggerReason: getRouteParam(params.reason)
    });
  }, [params.feature, params.reason, params.source]);

  function closePaywall() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    void trackEvent(
      "paywall_dismissed",
      {
        ...getPaywallEventProperties(params),
        duration_ms: Date.now() - viewedAtRef.current
      },
      { paywallViewId: paywallViewIdRef.current }
    );
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
        ...getPaywallEventProperties(params),
        offering_id: currentOffering.identifier,
        package_count: currentOffering.availablePackages.length
      }, { paywallViewId: paywallViewIdRef.current });
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;

      setOffering(null);
      setLoadError(error);
      void logPaywallError("load", error, {
        paywallViewId: paywallViewIdRef.current,
        paywallSource: getPaywallSource(params.source)
      });
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
      await logPaywallError("sync", error, {
        paywallViewId: paywallViewIdRef.current,
        paywallSource: getPaywallSource(params.source)
      });
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
            ...getPaywallEventProperties(params),
            currency: packageBeingPurchased.product.currencyCode,
            offering_id: packageBeingPurchased.offeringIdentifier,
            package_id: packageBeingPurchased.identifier,
            product_id: packageBeingPurchased.product.identifier
          }, { paywallViewId: paywallViewIdRef.current });
        }}
        onPurchaseCompleted={({ customerInfo, storeTransaction }) => {
          void (async () => {
            const status = await syncPremiumState(customerInfo);
            await trackEvent("purchase_client_completed", {
              ...getPaywallEventProperties(params),
              product_id: storeTransaction.productIdentifier,
              transaction_id: storeTransaction.transactionIdentifier
            }, { paywallViewId: paywallViewIdRef.current });
            showSuccess("Premium avantajların aktif edildi.", "Premium aktif");
          })();
        }}
        onPurchaseCancelled={() => {
          void trackEvent("purchase_cancelled", {
            ...getPaywallEventProperties(params),
            product_id: purchasingPackageRef.current?.product.identifier ?? null
          }, { paywallViewId: paywallViewIdRef.current });
          purchasingPackageRef.current = null;
        }}
        onPurchaseError={({ error }) => {
          void logPaywallError("purchase", error, {
            paywallViewId: paywallViewIdRef.current,
            paywallSource: getPaywallSource(params.source)
          });
          void trackEvent("purchase_failed", {
            ...getPaywallEventProperties(params),
            product_id: purchasingPackageRef.current?.product.identifier ?? null
          }, { paywallViewId: paywallViewIdRef.current });
          purchasingPackageRef.current = null;
          showError(error, "Satın alma tamamlanamadı");
        }}
        onRestoreStarted={() => {
          void trackEvent("restore_purchases_attempted", {
            ...getPaywallEventProperties(params)
          }, { paywallViewId: paywallViewIdRef.current });
        }}
        onRestoreCompleted={({ customerInfo }) => {
          void (async () => {
            const status = await syncPremiumState(customerInfo);
            await trackEvent("restore_purchases_succeeded", {
              ...getPaywallEventProperties(params),
              premium_active: status.isPremium
            }, { paywallViewId: paywallViewIdRef.current });
            showSuccess("Satın alımlar kontrol edildi.", "Geri yükleme tamamlandı");
          })();
        }}
        onRestoreError={({ error }) => {
          void logPaywallError("restore", error, {
            paywallViewId: paywallViewIdRef.current,
            paywallSource: getPaywallSource(params.source)
          });
          showError(error, "Satın alma geri yüklenemedi");
        }}
        style={styles.paywall}
      />
    </View>
  );
}

async function logPaywallError(
  source: PaywallErrorSource,
  error: unknown,
  context?: { paywallSource: string; paywallViewId: string }
) {
  const details = getPaywallErrorDetails(error);
  console.error("RevenueCat paywall error", { ...details, source });
  await trackEvent(
    "paywall_error",
    {
      code: details.code,
      error_stage: source,
      source: context?.paywallSource ?? "unknown"
    },
    { paywallViewId: context?.paywallViewId }
  );
}

function getPaywallSource(source?: string | string[]) {
  const sourceParam = getRouteParam(source);
  return sourceParam?.trim() || "direct_navigation";
}

function getRouteParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getPaywallEventProperties(params: PaywallRouteParams) {
  const remainingParam = getRouteParam(params.remaining);
  const remaining = remainingParam === undefined ? null : Number(remainingParam);
  return {
    feature: getRouteParam(params.feature)?.trim() || null,
    life_stage: getRouteParam(params.life_stage)?.trim() || null,
    reason: getRouteParam(params.reason)?.trim() || null,
    remaining: Number.isFinite(remaining) ? remaining : null,
    source: getPaywallSource(params.source)
  };
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
