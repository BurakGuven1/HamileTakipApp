import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DailyExperience } from "@/api/dailyExperience";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing, typography, vibrantColors } from "@/theme";

type Props = {
  experience: DailyExperience;
  isPremium: boolean;
  pending: boolean;
  onAction: () => void;
  onComplete: () => void;
  onPremiumPress: () => void;
};

export function DailyForYouCard({
  experience,
  isPremium,
  onAction,
  onComplete,
  onPremiumPress,
  pending
}: Props) {
  const { payload } = experience;
  const completed = Boolean(experience.completedAt);

  return (
    <Card style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Sparkles color={colors.primary} size={16} />
          <Text style={styles.badgeText}>BUGÜN SENİN İÇİN</Text>
        </View>
        {completed ? (
          <View style={styles.doneBadge}>
            <CheckCircle2 color={colors.success} size={16} />
            <Text style={styles.doneText}>Tamamlandı</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{payload.title}</Text>
        <Text style={styles.body}>{payload.body}</Text>
      </View>

      <View style={styles.factBox}>
        <Text style={styles.factLabel}>BUGÜNÜN BİLGİSİ</Text>
        <Text style={styles.fact}>{payload.stageFact}</Text>
      </View>

      <Button label={payload.actionLabel} onPress={onAction} />
      {!completed ? (
        <Button
          disabled={pending}
          label={pending ? "Kaydediliyor…" : "Bugün yaptım"}
          onPress={onComplete}
          variant="secondary"
        />
      ) : null}

      {isPremium ? (
        <View style={styles.premiumOpen}>
          <Text style={styles.premiumTitle}>{payload.premiumTitle}</Text>
          <Text style={styles.premiumBody}>{payload.premiumBody}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityHint="Premium ayrıntılarını ve satın alma ekranını açar"
          accessibilityRole="button"
          onPress={onPremiumPress}
          style={({ pressed }) => [styles.premiumLocked, pressed && styles.pressed]}
        >
          <View style={styles.lockBubble}>
            <LockKeyhole color={colors.highlight} size={17} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.premiumTitle}>{payload.premiumTitle}</Text>
            <Text style={styles.premiumBody}>{payload.premiumBody}</Text>
          </View>
          <Text style={styles.premiumCta}>Premium</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  badgeRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  badgeText: { ...typography.eyebrow, fontSize: 12 },
  body: { ...typography.body },
  card: { gap: spacing.lg },
  copy: { gap: spacing.sm },
  doneBadge: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  doneText: { ...typography.label, color: colors.success, fontSize: 13 },
  fact: { ...typography.body, fontSize: 15, lineHeight: 22 },
  factBox: { backgroundColor: vibrantColors.mintSoft, borderRadius: 14, gap: spacing.xs, padding: spacing.md },
  factLabel: { ...typography.eyebrow, color: colors.sageGreen, fontSize: 11 },
  flex: { flex: 1 },
  lockBubble: {
    alignItems: "center",
    backgroundColor: colors.highlightSoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  premiumBody: { ...typography.body, fontSize: 14, lineHeight: 20 },
  premiumCta: { ...typography.label, color: colors.primary, fontSize: 13 },
  premiumLocked: {
    alignItems: "center",
    backgroundColor: colors.highlightSoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md
  },
  premiumOpen: { backgroundColor: colors.primarySoft, borderRadius: 16, gap: spacing.xs, padding: spacing.md },
  premiumTitle: { ...typography.label, fontSize: 15 },
  pressed: { opacity: 0.76 },
  title: { ...typography.heading2 }
});
