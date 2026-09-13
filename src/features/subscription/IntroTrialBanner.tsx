import { Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

/**
 * A trial nobody notices converts like no trial at all. The banner names what
 * is currently open and how long it stays that way, so the paywall on day eight
 * is a decision the parent already saw coming.
 */
export function IntroTrialBanner({ onPress }: { onPress: () => void }) {
  const appTheme = useAppTheme();
  const { introTrialDaysRemaining, isIntroTrial } = useSubscriptionStatus();

  if (!isIntroTrial || introTrialDaysRemaining <= 0) {
    return null;
  }

  const isLastStretch = introTrialDaysRemaining <= 2;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={[styles.card, { backgroundColor: appTheme.theme.primarySoft }]}>
        <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>
          <Sparkles color={appTheme.primary} size={22} />
        </View>
        <View style={styles.copy}>
          <Text style={typography.eyebrow}>
            {isLastStretch ? "Deneme bitmek üzere" : "Premium deneme"}
          </Text>
          <Text style={styles.remaining}>
            {introTrialDaysRemaining === 1
              ? "Son gün"
              : `${introTrialDaysRemaining} gün kaldı`}
          </Text>
          <Text style={styles.text}>
            {isLastStretch
              ? "Uyku tahmini, bakım geçmişi ve Sağlık Dosyam şimdi açık. Deneme bitince kayıtların kalır, bu özellikler kapanır."
              : "Uyku tahmini, bakım geçmişi ve Sağlık Dosyam dahil her şey sana açık."}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  copy: {
    flex: 1,
    gap: 2
  },
  // A countdown is measurable data, so it earns the mono face.
  remaining: {
    ...typography.dataStrong,
    fontSize: 20,
    lineHeight: 26
  },
  text: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
