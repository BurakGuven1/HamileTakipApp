import { AlertCircle } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Thread } from "@/components/Thread";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type QueryStateShape = "baby" | "forum" | "home" | "paywall" | "generic";

type QueryStateProps = {
  compact?: boolean;
  description?: string;
  loading?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  shape?: QueryStateShape;
  title?: string;
};

export function QueryState({
  compact = false,
  description,
  loading = false,
  onRetry,
  retrying = false,
  shape = "generic",
  title
}: QueryStateProps) {
  const appTheme = useAppTheme();

  if (loading) {
    return (
      <LoadingSilhouette
        color={appTheme.primary}
        compact={compact}
        description={description ?? "Bilgilerin hazırlanıyor…"}
        shape={shape}
      />
    );
  }

  return (
    <Card style={styles.errorCard}>
      <View accessibilityLiveRegion="polite" style={styles.errorContent}>
        <View style={styles.errorIcon}>
          <AlertCircle color={colors.danger} size={24} strokeWidth={2.2} />
        </View>
        <View style={styles.copy}>
          <Text style={typography.heading3}>{title ?? "Bilgiler alınamadı"}</Text>
          <Text style={styles.description}>
            {description ?? "Bağlantını kontrol et ve yeniden dene."}
          </Text>
        </View>
      </View>
      {onRetry ? (
        <Button
          accessibilityState={{ busy: retrying, disabled: retrying }}
          disabled={retrying}
          label={retrying ? "Yeniden deneniyor…" : "Yeniden dene"}
          variant="secondary"
          onPress={onRetry}
        />
      ) : null}
    </Card>
  );
}

function LoadingSilhouette({
  color,
  compact,
  description,
  shape
}: {
  color: string;
  compact: boolean;
  description: string;
  shape: QueryStateShape;
}) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0.62);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = withTiming(0.78, { duration: 180 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      accessibilityLabel={description}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.loading, compact && styles.compact]}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.skeleton, animatedStyle]}
      >
        {shape === "home" ? <HomeSkeleton color={color} /> : null}
        {shape === "baby" ? <BabySkeleton color={color} /> : null}
        {shape === "forum" ? <ForumSkeleton color={color} /> : null}
        {shape === "paywall" ? <PaywallSkeleton color={color} /> : null}
        {shape === "generic" ? <GenericSkeleton color={color} /> : null}
      </Animated.View>
      <Text style={styles.loadingLabel}>{description}</Text>
    </View>
  );
}

function HomeSkeleton({ color }: { color: string }) {
  return (
    <>
      <View style={styles.skeletonHeading} />
      <Thread color={color} height={58} progress={0.64} variant="progress" />
      <View style={styles.skeletonHero} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonAction} />
        <View style={styles.skeletonAction} />
      </View>
    </>
  );
}

function BabySkeleton({ color }: { color: string }) {
  return (
    <>
      <View style={styles.skeletonHeading} />
      <View style={styles.skeletonTabs}>
        <View style={styles.skeletonTab} />
        <View style={styles.skeletonTab} />
        <View style={styles.skeletonTab} />
      </View>
      <View style={styles.skeletonHero}>
        <Thread color={color} height={64} progress={0.72} variant="chart" />
      </View>
    </>
  );
}

function ForumSkeleton({ color }: { color: string }) {
  return (
    <View style={styles.forumSkeleton}>
      <View style={[styles.forumRail, { backgroundColor: color }]} />
      {[0, 1].map((item) => (
        <View key={item} style={styles.forumSkeletonRow}>
          <View style={[styles.forumKnot, { borderColor: color }]} />
          <View style={styles.skeletonPost}>
            <View style={styles.skeletonShortLine} />
            <View style={styles.skeletonLongLine} />
            <View style={styles.skeletonMediumLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

function PaywallSkeleton({ color }: { color: string }) {
  return (
    <>
      <View style={styles.skeletonHeading} />
      <Thread
        color={color}
        height={58}
        markers={[
          { kind: "knot", position: 0.22 },
          { kind: "loop", position: 0.7 }
        ]}
        progress={0.72}
        variant="progress"
      />
      <View style={styles.skeletonPlan} />
      <View style={styles.skeletonButton} />
    </>
  );
}

function GenericSkeleton({ color }: { color: string }) {
  return (
    <>
      <Thread color={color} height={58} progress={0.54} variant="progress" />
      <View style={styles.skeletonLongLine} />
      <View style={styles.skeletonMediumLine} />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 210,
    paddingVertical: spacing.lg
  },
  compact: {
    minHeight: 132,
    paddingVertical: spacing.sm
  },
  skeleton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg
  },
  loadingLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  skeletonHeading: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 24,
    width: "52%"
  },
  skeletonHero: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    minHeight: 86,
    padding: spacing.sm
  },
  skeletonRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  skeletonAction: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flex: 1,
    height: 58
  },
  skeletonTabs: {
    flexDirection: "row",
    gap: spacing.sm
  },
  skeletonTab: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flex: 1,
    height: 42
  },
  forumSkeleton: {
    gap: spacing.md,
    paddingLeft: spacing.md,
    position: "relative"
  },
  forumRail: {
    bottom: spacing.xl,
    left: 21,
    opacity: 0.32,
    position: "absolute",
    top: spacing.xl,
    width: 2
  },
  forumSkeletonRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  forumKnot: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 18,
    marginTop: spacing.lg,
    width: 18
  },
  skeletonPost: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flex: 1,
    gap: spacing.sm,
    minHeight: 104,
    padding: spacing.md
  },
  skeletonShortLine: {
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    height: 12,
    width: "34%"
  },
  skeletonLongLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 14,
    width: "92%"
  },
  skeletonMediumLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 14,
    width: "68%"
  },
  skeletonPlan: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    height: 94
  },
  skeletonButton: {
    backgroundColor: colors.surfaceMuted,
    ...radii.button,
    height: 50
  },
  errorCard: {
    gap: spacing.lg
  },
  errorContent: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  errorIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  description: {
    ...typography.body,
    color: colors.textMuted
  }
});
