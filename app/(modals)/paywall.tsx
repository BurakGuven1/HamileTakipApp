import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Check, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { openLegalPage, type LegalPage } from "@/config/legal";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/errors";
import {
  configureRevenueCat,
  getPaywallPackages,
  getSubscriptionStatusFromCustomerInfo,
  isPurchaseUserCancelled,
  isRevenueCatConfigured,
  purchasePremiumPackage,
  restorePremiumPurchases,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

type PaywallErrorSource = "configure" | "load" | "purchase" | "restore" | "sync";

export default function PaywallScreen() {
  const appTheme = useAppTheme();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        configureRevenueCat();
        const isConfigured = isRevenueCatConfigured();
        if (!active) return;

        setConfigured(isConfigured);
        if (!isConfigured) {
          throw new Error(
            "RevenueCat is not configured. Check EXPO_PUBLIC_REVENUECAT_IOS_API_KEY."
          );
        }

        const availablePackages = await getPaywallPackages();
        if (!active) return;

        setPackages(availablePackages);
        setSelectedIdentifier(
          getPreferredPackage(availablePackages)?.identifier ?? null
        );
        setLoadError(null);
      } catch (error) {
        if (!active) return;
        const errorSource = isRevenueCatConfigured() ? "load" : "configure";
        if (errorSource === "configure") setConfigured(false);
        setLoadError(error);
        logPaywallError(errorSource, error).catch(() => undefined);
      } finally {
        if (active) setLoadingPackages(false);
      }
    }

    initialize().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const selectedPackage = useMemo(
    () =>
      packages.find(
        (purchasePackage) => purchasePackage.identifier === selectedIdentifier
      ) ?? null,
    [packages, selectedIdentifier]
  );

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

  async function purchaseSelectedPackage() {
    if (!selectedPackage || purchasing) return;

    setPurchasing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined
    );

    try {
      const result = await purchasePremiumPackage(selectedPackage.identifier);
      if (!result) {
        throw new Error("Seçilen abonelik paketi bulunamadı.");
      }

      await syncPremiumState(result.customerInfo);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      showSuccess("Premium avantajların aktif edildi.", "Premium aktif");
      router.back();
    } catch (error) {
      if (!isPurchaseUserCancelled(error)) {
        await logPaywallError("purchase", error);
        showError(error, "Satın alma tamamlanamadı");
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function restorePurchases() {
    if (restoring) return;
    setRestoring(true);

    try {
      const customerInfo = await restorePremiumPurchases();
      if (!customerInfo) {
        throw new Error("Satın alma bilgilerine ulaşılamadı.");
      }

      await syncPremiumState(customerInfo);
      showSuccess("Satın alımlar kontrol edildi.", "Geri yükleme tamamlandı");
    } catch (error) {
      await logPaywallError("restore", error);
      showError(error, "Satın alma geri yüklenemedi");
    } finally {
      setRestoring(false);
    }
  }

  async function openLegal(page: LegalPage) {
    try {
      await openLegalPage(page);
    } catch (error) {
      showError(error, "Bağlantı açılamadı");
    }
  }

  if (configured === false) {
    return (
      <SafeAreaView style={styles.centered}>
        <EmptyState
          title="Abonelikler yüklenemedi"
          description="RevenueCat iOS anahtarı eksik. EXPO_PUBLIC_REVENUECAT_IOS_API_KEY değerini EAS ortamına ekleyin."
        />
        <Button label="Kapat" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (loadingPackages || configured === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={appTheme.primary} size="large" />
        <Text style={typography.body}>Güncel paketler yükleniyor…</Text>
      </SafeAreaView>
    );
  }

  if (loadError || packages.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <EmptyState
          title="Abonelik paketleri bulunamadı"
          description={
            loadError
              ? getErrorMessage(loadError)
              : "RevenueCat Current Offering içinde en az bir App Store paketi yayınlayın."
          }
        />
        <Button label="Kapat" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const selectedTerms = selectedPackage
    ? getPackageTerms(selectedPackage)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Premium</Text>
        <Pressable
          accessibilityLabel="Premium ekranını kapat"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <X color={colors.text} size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: appTheme.tint }]}>
              <ShieldCheck color={appTheme.primary} size={30} />
            </View>
            <Text style={typography.heading1}>Anne+ Premium</Text>
            <Text style={styles.heroDescription}>
              Takip, analiz ve kişiselleştirilmiş Premium özelliklerine erişin.
            </Text>
          </View>

          <View style={styles.benefits}>
            <Benefit text="Premium takip ve analiz araçları" />
            <Benefit text="Tüm uygun cihazlarda aynı abonelik" />
            <Benefit text={`${storeName} üzerinden kolay abonelik yönetimi`} />
          </View>

          <View accessibilityRole="radiogroup" style={styles.packageList}>
            {sortPackages(packages).map((purchasePackage) => (
              <PackageOption
                key={purchasePackage.identifier}
                isSelected={purchasePackage.identifier === selectedIdentifier}
                onSelect={() =>
                  setSelectedIdentifier(purchasePackage.identifier)
                }
                purchasePackage={purchasePackage}
              />
            ))}
          </View>

          {selectedTerms ? (
            <View style={styles.purchaseSummary}>
              <Text style={styles.summaryHeading}>Abonelik özeti</Text>
              <Text style={styles.summaryText}>
                İptal edilmediği sürece abonelik her {selectedTerms.duration} sonunda
                otomatik yenilenir. Her yenilemede toplam {selectedTerms.price} tahsil
                edilir.
              </Text>
              <Text style={styles.summaryFinePrint}>
                {storeName} satın alma penceresi, hesabınıza özel varsa ücretsiz
                deneme veya tanıtım teklifini ve ilk tahsilat tarihini onaydan önce
                gösterir.
              </Text>
            </View>
          ) : null}

          <Button
            disabled={!selectedPackage || purchasing || restoring}
            label={
              purchasing
                ? "Satın alma açılıyor…"
                : selectedTerms
                  ? `${selectedTerms.price} / ${selectedTerms.duration} ile abone ol`
                  : "Bir paket seçin"
            }
            onPress={purchaseSelectedPackage}
            style={styles.purchaseButton}
          />

          <Pressable
            accessibilityRole="button"
            disabled={purchasing || restoring}
            onPress={restorePurchases}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>
              {restoring ? "Kontrol ediliyor…" : "Satın alımları geri yükle"}
            </Text>
          </Pressable>

          <Text style={styles.legalCopy}>
            Ödeme {Platform.OS === "ios" ? "Apple" : "Google Play"} hesabınızdan
            alınır. Abonelik, mevcut dönem bitmeden en az 24 saat önce iptal edilmezse
            otomatik yenilenir. Aboneliğinizi {storeName} hesap ayarlarından
            yönetebilir veya iptal edebilirsiniz.
          </Text>

          <View style={styles.legalLinks}>
            <LegalLink
              label="Gizlilik Politikası"
              onPress={() => openLegal("privacy")}
            />
            <Text style={styles.legalSeparator}>•</Text>
            <LegalLink
              label={
                Platform.OS === "ios"
                  ? "Kullanım Koşulları (EULA)"
                  : "Kullanım Şartları"
              }
              onPress={() =>
                openLegal(Platform.OS === "ios" ? "appleEula" : "terms")
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PackageOption({
  isSelected,
  onSelect,
  purchasePackage
}: {
  isSelected: boolean;
  onSelect: () => void;
  purchasePackage: PurchasesPackage;
}) {
  const appTheme = useAppTheme();
  const terms = getPackageTerms(purchasePackage);
  const monthlyEquivalent =
    purchasePackage.packageType === "ANNUAL"
      ? purchasePackage.product.pricePerMonthString
      : null;

  return (
    <Pressable
      accessibilityLabel={`${terms.title}, ${terms.price}, ${terms.duration}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onSelect}
      style={[
        styles.packageCard,
        isSelected && {
          backgroundColor: appTheme.theme.primarySoft,
          borderColor: appTheme.primary
        }
      ]}
    >
      <View style={styles.packageHeader}>
        <Text style={styles.packageTitle}>{terms.title}</Text>
        <View
          style={[
            styles.radio,
            isSelected && {
              backgroundColor: appTheme.primary,
              borderColor: appTheme.primary
            }
          ]}
        >
          {isSelected ? <Check color={colors.background} size={14} /> : null}
        </View>
      </View>

      <Text style={styles.billedLabel}>YENİLEMEDE TAHSİL EDİLECEK TOPLAM</Text>
      <View style={styles.priceRow}>
        <Text style={styles.billedPrice}>{terms.price}</Text>
        <Text style={styles.billedPeriod}>/ {terms.duration}</Text>
      </View>
      {monthlyEquivalent ? (
        <Text style={styles.calculatedPrice}>
          Aylık karşılığı yaklaşık {monthlyEquivalent}; ödeme yıllık olarak
          {` ${terms.price}`} tahsil edilir.
        </Text>
      ) : null}
    </Pressable>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitDot}>
        <Check color={colors.background} size={12} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={onPress}>
      <Text style={styles.legalLink}>{label}</Text>
    </Pressable>
  );
}

function getPreferredPackage(packages: PurchasesPackage[]) {
  return (
    packages.find((purchasePackage) => purchasePackage.packageType === "ANNUAL") ??
    packages[0]
  );
}

function sortPackages(packages: PurchasesPackage[]) {
  const order: Record<string, number> = {
    ANNUAL: 0,
    SIX_MONTH: 1,
    THREE_MONTH: 2,
    TWO_MONTH: 3,
    MONTHLY: 4,
    WEEKLY: 5,
    LIFETIME: 6
  };

  return [...packages].sort(
    (left, right) =>
      (order[left.packageType] ?? 99) - (order[right.packageType] ?? 99)
  );
}

function getPackageTerms(purchasePackage: PurchasesPackage) {
  return {
    duration: getPackageDuration(
      purchasePackage.packageType,
      purchasePackage.product.subscriptionPeriod
    ),
    price: purchasePackage.product.priceString,
    title: purchasePackage.product.title || getFallbackTitle(purchasePackage.packageType)
  };
}

function getFallbackTitle(packageType: string) {
  const titles: Record<string, string> = {
    ANNUAL: "Anne+ Premium Yıllık",
    SIX_MONTH: "Anne+ Premium 6 Aylık",
    THREE_MONTH: "Anne+ Premium 3 Aylık",
    TWO_MONTH: "Anne+ Premium 2 Aylık",
    MONTHLY: "Anne+ Premium Aylık",
    WEEKLY: "Anne+ Premium Haftalık",
    LIFETIME: "Anne+ Premium Ömür Boyu"
  };

  return titles[packageType] ?? "Anne+ Premium";
}

function getPackageDuration(packageType: string, subscriptionPeriod: string | null) {
  const durations: Record<string, string> = {
    ANNUAL: "1 yıl",
    SIX_MONTH: "6 ay",
    THREE_MONTH: "3 ay",
    TWO_MONTH: "2 ay",
    MONTHLY: "1 ay",
    WEEKLY: "1 hafta",
    LIFETIME: "tek sefer"
  };

  if (durations[packageType]) return durations[packageType];

  const match = subscriptionPeriod?.match(/^P(\d+)([DWMY])$/);
  if (!match) return "abonelik dönemi";

  const count = Number(match[1]);
  const periodUnit = match[2];
  if (!periodUnit) return "abonelik dönemi";

  const units: Record<string, string> = {
    D: "gün",
    W: "hafta",
    M: "ay",
    Y: "yıl"
  };
  const unit = units[periodUnit] ?? "dönem";
  return `${count} ${unit}`;
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
  safeArea: { backgroundColor: colors.background, flex: 1 },
  centered: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.xl
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  headerSpacer: { height: 40, width: 40 },
  headerTitle: { ...typography.label, fontSize: 16 },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  scrollContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxxl },
  content: { alignSelf: "center", gap: spacing.xl, maxWidth: 680, width: "100%" },
  hero: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 58,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 58
  },
  heroDescription: {
    ...typography.body,
    color: colors.text,
    maxWidth: 480,
    textAlign: "center"
  },
  benefits: { alignSelf: "center", gap: spacing.sm, maxWidth: 480, width: "100%" },
  benefitRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  benefitDot: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  benefitText: { ...typography.bodyStrong, flex: 1, fontSize: 15 },
  packageList: { gap: spacing.md },
  packageCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.lg
  },
  packageHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  packageTitle: { ...typography.heading3, flex: 1 },
  radio: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  billedLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
    lineHeight: 16,
    marginTop: spacing.xs
  },
  priceRow: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  billedPrice: {
    color: colors.text,
    fontFamily: fonts.dataBold,
    fontSize: 34,
    lineHeight: 42
  },
  billedPeriod: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 15 },
  calculatedPrice: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  purchaseSummary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.lg
  },
  summaryHeading: { ...typography.label, fontSize: 14 },
  summaryText: { ...typography.bodyStrong, fontSize: 14, lineHeight: 21 },
  summaryFinePrint: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18
  },
  purchaseButton: { minHeight: 56 },
  textButton: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  textButtonLabel: { ...typography.label, color: colors.primary },
  legalCopy: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  legalLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center"
  },
  legalLink: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textDecorationLine: "underline"
  },
  legalSeparator: { color: colors.textMuted }
});
