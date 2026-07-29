import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import {
  configureRevenueCat,
  getCurrentOffering,
  getSubscriptionStatusFromCustomerInfo,
  isRevenueCatConfigured,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, spacing } from "@/theme";

type PaywallErrorSource = "offering" | "purchase" | "restore" | "sync";

export default function PaywallScreen() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const dismissedRef = useRef(false);
  const purchasingPackageRef = useRef<PurchasesPackage | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isOfferingLoading, setIsOfferingLoading] = useState(true);
  const [offeringLoadError, setOfferingLoadError] = useState<unknown>(null);

  configureRevenueCat();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        // `current` offering; Dashboard'daki Default Offering, targeting ve
        // experiment kuralları burada çözülür. Uygulamada ürün ID'si yoktur.
        const currentOffering = await getCurrentOffering();

        if (!currentOffering || currentOffering.availablePackages.length === 0) {
          throw new Error(
            "RevenueCat current offering için satın alınabilir paket bulunamadı."
          );
        }

        if (isMounted) {
          setOffering(currentOffering);
        }
      } catch (error) {
        await logPaywallError("offering", error);
        if (isMounted) {
          setOfferingLoadError(error);
        }
      } finally {
        if (isMounted) {
          setIsOfferingLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  function closePaywall() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    router.back();
  }

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

  if (!isRevenueCatConfigured()) {
    return (
      <View style={styles.fallback}>
        <EmptyState
          title="Abonelikler yüklenemedi"
          description="RevenueCat API anahtarı bulunamadı. Uygulamanın RevenueCat ortam değişkenlerini kontrol edin."
        />
        <Button label="Kapat" variant="ghost" onPress={closePaywall} />
      </View>
    );
  }

  if (isOfferingLoading) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (offeringLoadError || !offering) {
    return (
      <View style={styles.fallback}>
        <EmptyState
          title="Abonelik paketleri kullanılamıyor"
          description="RevenueCat, bu paywall'daki ürünleri mağazadan alamadı. RevenueCat'teki varsayılan offering'e bağlı ürün kimliklerini ve App Store Connect/Google Play ürün durumlarını kontrol edin."
        />
        <Button label="Kapat" variant="ghost" onPress={closePaywall} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true, offering }}
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
