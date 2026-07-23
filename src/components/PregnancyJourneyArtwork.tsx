import { Image } from "expo-image";
import { Heart, Sparkles } from "lucide-react-native";
import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { colors, radii, spacing, typography } from "@/theme";

const expectingParentsArtwork = require("../../assets/illustrations/expecting-parents-connection.jpg");

type PregnancyJourneyArtworkProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
  week: number;
};

export function PregnancyJourneyArtwork({
  height = 176,
  style,
  week
}: PregnancyJourneyArtworkProps) {
  const reducedMotion = useReducedMotion();
  const drift = useSharedValue(0);
  const heartbeat = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      drift.value = 0;
      heartbeat.value = 0;
      return;
    }

    drift.value = withRepeat(
      withTiming(1, {
        duration: 6_400,
        easing: Easing.inOut(Easing.quad)
      }),
      -1,
      true
    );
    heartbeat.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 520,
          easing: Easing.out(Easing.exp)
        }),
        withDelay(
          1_100,
          withTiming(0, {
            duration: 680,
            easing: Easing.inOut(Easing.quad)
          })
        )
      ),
      -1
    );

    return () => {
      cancelAnimation(drift);
      cancelAnimation(heartbeat);
    };
  }, [drift, heartbeat, reducedMotion]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(drift.value, [0, 1], [1.015, 1.055]) },
      { translateY: interpolate(drift.value, [0, 1], [1, -3]) }
    ]
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 1], [0.2, 0.42]),
    transform: [{ scale: interpolate(drift.value, [0, 1], [0.9, 1.1]) }]
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heartbeat.value, [0, 1], [0.34, 0]),
    transform: [{ scale: interpolate(heartbeat.value, [0, 1], [0.76, 1.48]) }]
  }));

  return (
    <View style={[styles.frame, { height }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <Image
          accessibilityLabel={`${week}. haftada bebeğini birlikte bekleyen anne ve baba illüstrasyonu.`}
          accessibilityRole="image"
          accessible
          contentFit="cover"
          contentPosition="center"
          source={expectingParentsArtwork}
          style={StyleSheet.absoluteFill}
          transition={reducedMotion ? 0 : 220}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.ambientHalo, haloStyle]} />
      <View pointerEvents="none" style={styles.heartbeatAnchor}>
        <Animated.View style={[styles.heartbeatPulse, pulseStyle]} />
        <View style={styles.heartbeatCore}>
          <Heart color={colors.dustyRose} fill={colors.dustyRose} size={13} strokeWidth={2} />
        </View>
      </View>
      <View pointerEvents="none" style={styles.sparkle}>
        <Sparkles color={colors.honeyGold} size={19} strokeWidth={2.2} />
      </View>
      <View style={styles.caption}>
        <Heart color={colors.dustyRose} size={16} strokeWidth={2.2} />
        <Text style={styles.captionText}>Birlikte bekliyoruz</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    overflow: "hidden",
    position: "relative"
  },
  ambientHalo: {
    backgroundColor: colors.highlightSoft,
    borderRadius: radii.pill,
    height: 150,
    position: "absolute",
    right: -44,
    top: -72,
    width: 150
  },
  heartbeatAnchor: {
    alignItems: "center",
    bottom: 16,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    width: 38
  },
  heartbeatPulse: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.dustyRose,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    position: "absolute",
    width: 38
  },
  heartbeatCore: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  sparkle: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    width: 34
  },
  caption: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    bottom: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    left: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    position: "absolute"
  },
  captionText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  }
});
