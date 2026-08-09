import * as Haptics from "expo-haptics";
import { LockKeyhole, Sparkles } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type PremiumFeatureBoundaryProps = PropsWithChildren<{
  description: string;
  featureKey: string;
  title: string;
}>;

export function PremiumFeatureBoundary({
  children,
  description,
  featureKey,
  title
}: PremiumFeatureBoundaryProps) {
  const appTheme = useAppTheme();
  const { isLoading, isPremium } = useSubscriptionStatus();
  const { showError, showSuccess } = useFeedback();
  const [opening, setOpening] = useState(false);

  async function openPaywall() {
    setOpening(true);
    try {
      const result = await showPaywallIfNeeded(featureKey, {
        feature: featureKey
      });

      if (result.didBecomePremium) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess("Premium avantajların aktif edildi.", "Premium aktif");
      }
    } catch (error) {
      showError(error, "Premium ekranı açılamadı");
    } finally {
      setOpening(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={appTheme.primary} />
        </View>
      </Screen>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Card style={[styles.hero, { backgroundColor: appTheme.theme.primarySoft }]}>
          <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>
            <LockKeyhole color={appTheme.primary} size={30} />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.eyebrow}>Premium alan</Text>
            <Text style={typography.heading1}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Premium paketlerini incele</Text>
                <Text style={typography.body}>
                  Paket süresi ve tahsil edilecek toplam tutar, satın almadan
                  önce açıkça gösterilir.
                </Text>
              </View>
              <Sparkles color={appTheme.primary} size={28} />
            </View>
            <PremiumPurchaseTimeline />
            <Button
              breathing
              disabled={opening}
              label={opening ? "Açılıyor..." : "Premium ile aç"}
              onPress={openPaywall}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

export function PremiumPurchaseTimeline() {
  return (
    <View style={styles.timeline}>
      <TimelineItem
        label="Paket seçimi"
        text="Süreyi ve her yenilemede tahsil edilecek toplam tutarı görürsün."
      />
      <TimelineItem
        label="Satın alma"
        text="Apple onayın olmadan ücret alınmaz; varsa teklif koşulları App Store ekranında görünür."
      />
      <TimelineItem
        last
        label="İstediğin an"
        text="App Store üzerinden tek dokunuşla iptal edebilirsin."
      />
    </View>
  );
}

function TimelineItem({
  label,
  last,
  text
}: {
  label: string;
  last?: boolean;
  text: string;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280
  },
  hero: {
    gap: spacing.md
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  description: {
    ...typography.body,
    color: colors.text
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  timeline: {
    gap: spacing.sm
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  timelineRail: {
    alignItems: "center",
    width: 18
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 12,
    marginTop: 4,
    width: 12
  },
  timelineLine: {
    backgroundColor: colors.border,
    flex: 1,
    marginTop: spacing.xs,
    minHeight: 26,
    width: 2
  },
  timelineCopy: {
    flex: 1,
    gap: 2
  },
  timelineLabel: {
    ...typography.label,
    color: colors.text
  },
  timelineText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
