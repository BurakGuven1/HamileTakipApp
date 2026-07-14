import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode
} from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomerInfo } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import {
  configureRevenueCat,
  getSubscriptionStatusFromCustomerInfo,
  isRevenueCatConfigured,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, spacing } from "@/theme";

type PaywallErrorSource =
  | "configure"
  | "purchase"
  | "render"
  | "restore"
  | "sync";

export default function PaywallScreen() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      configureRevenueCat();
      const configured = isRevenueCatConfigured();
      setReady(configured);

      if (!configured) {
        logPaywallError(
          "configure",
          new Error("RevenueCat is not configured. Check EXPO_PUBLIC_REVENUECAT_IOS_API_KEY.")
        ).catch(() => undefined);
      }
    } catch (error) {
      setReady(false);
      logPaywallError("configure", error).catch(() => undefined);
      showError(error, "RevenueCat başlatılamadı");
    }
  }, []);

  async function syncPremiumState(customerInfo: CustomerInfo) {
    try {
      const status = getSubscriptionStatusFromCustomerInfo(customerInfo);

      queryClient.setQueryData<PremiumSubscriptionStatus>(
        SUBSCRIPTION_STATUS_QUERY_KEY,
        status
      );
      await reconcileCustomerInfoWithSupabase(customerInfo);
      await queryClient.invalidateQueries({
        queryKey: SUBSCRIPTION_STATUS_QUERY_KEY
      });
    } catch (error) {
      await logPaywallError("sync", error);
      throw error;
    }
  }

  if (!ready) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="RevenueCat iOS SDK key eksik"
          description="Dashboard paywall'u açmak için EXPO_PUBLIC_REVENUECAT_IOS_API_KEY değerini .env ve EAS environment içine eklemelisin."
        />
        <Button label="Kapat" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PaywallErrorBoundary>
        <RevenueCatUI.Paywall
          style={styles.paywall}
          options={{ displayCloseButton: true }}
          onDismiss={() => router.back()}
          onPurchaseStarted={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => undefined
            );
          }}
          onPurchaseCompleted={async ({ customerInfo }) => {
            try {
              await syncPremiumState(customerInfo);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              showSuccess("Premium avantajların aktif edildi.", "Premium aktif");
              router.back();
            } catch (error) {
              showError(error, "Premium durumu güncellenemedi");
            }
          }}
          onPurchaseError={({ error }) => {
            logPaywallError("purchase", error).catch(() => undefined);
            showError(error, "Satın alma tamamlanamadı");
          }}
          onPurchaseCancelled={() => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => undefined);
          }}
          onRestoreStarted={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => undefined
            );
          }}
          onRestoreCompleted={async ({ customerInfo }) => {
            try {
              await syncPremiumState(customerInfo);
              showSuccess(
                "Satın alımlar kontrol edildi.",
                "Geri yükleme tamamlandı"
              );
            } catch (error) {
              showError(error, "Premium durumu güncellenemedi");
            }
          }}
          onRestoreError={({ error }) => {
            logPaywallError("restore", error).catch(() => undefined);
            showError(error, "Satın alma geri yüklenemedi");
          }}
        />
      </PaywallErrorBoundary>
    </View>
  );
}

class PaywallErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logPaywallError("render", error, {
      componentStack: info.componentStack ?? null
    }).catch(() => undefined);
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.centered}>
        <EmptyState
          title="RevenueCat paywall açılamadı"
          description={getErrorMessage(this.state.error)}
        />
        <Button label="Kapat" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }
}

async function logPaywallError(
  source: PaywallErrorSource,
  error: unknown,
  extra: Record<string, string | number | boolean | null> = {}
) {
  const details = getPaywallErrorDetails(error);

  console.error("RevenueCat paywall error", {
    ...details,
    source
  });

  await trackEvent("paywall_error", {
    ...details,
    ...extra,
    source
  });
}

function getPaywallErrorDetails(error: unknown) {
  const errorObject =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};

  return {
    code: toNullableString(errorObject.code),
    message: getErrorMessage(error),
    readable_error_code: toNullableString(errorObject.readableErrorCode),
    underlying_error_message: toNullableString(
      errorObject.underlyingErrorMessage
    )
  };
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  centered: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.lg
  },
  paywall: {
    flex: 1
  }
});
