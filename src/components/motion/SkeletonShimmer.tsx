import { useEffect } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { colors, radii, spacing } from "@/theme";
import { durations, easings } from "@/theme/motion";

type SkeletonShimmerProps = {
  /** Parıltının başlangıç gecikmesi (ms); satırları kaydırmak için. */
  delay?: number;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
};

/**
 * Yükleme sırasında ekranın gerçek silüetini gösteren parıltılı yüzey.
 * Spinner yerine kullanılır. Reduce Motion açıkken sabit, düşük kontrastlı
 * bir yüzey olarak kalır.
 */
export function SkeletonShimmer({
  delay = 0,
  height = 14,
  radius = radii.sm,
  style,
  width = "100%"
}: SkeletonShimmerProps) {
  const reducedMotion = useReducedMotion();
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) {
      glow.value = withTiming(0.7, { duration: durations.fast });
      return;
    }

    glow.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: durations.slow * 2, easing: easings.pulse }),
        -1,
        true
      )
    );
  }, [delay, glow, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.bar,
        { borderRadius: radius, height, width },
        animatedStyle,
        style
      ]}
    />
  );
}

type SkeletonCardProps = {
  /** Kart içinde gösterilecek metin satırı sayısı. Varsayılan: 3 */
  lines?: number;
  style?: StyleProp<ViewStyle>;
};

/** Bir kartın yükleme silüeti: başlık + birkaç satır. */
export function SkeletonCard({ lines = 3, style }: SkeletonCardProps) {
  return (
    <View
      accessibilityLabel="İçerik yükleniyor"
      accessibilityRole="progressbar"
      style={[styles.card, style]}
    >
      <SkeletonShimmer height={22} radius={radii.sm} width="54%" />
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonShimmer
          key={`skeleton-line-${index}`}
          delay={(index + 1) * 90}
          width={index === lines - 1 ? "62%" : "94%"}
        />
      ))}
    </View>
  );
}

type SkeletonListProps = {
  /** Kart sayısı. Varsayılan: 3 */
  count?: number;
  lines?: number;
};

/** Liste ekranları için art arda kart silüetleri. */
export function SkeletonList({ count = 3, lines = 2 }: SkeletonListProps) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-card-${index}`} lines={lines} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surfaceMuted
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.lg
  },
  list: {
    gap: spacing.md
  }
});
