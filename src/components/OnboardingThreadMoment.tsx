import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const path =
  "M8 56 C48 22 80 84 120 52 C160 20 188 82 228 50 C268 18 300 74 336 44";
const pathLength = 390;

function getMarkerY(position: number) {
  const scaled = Math.max(0, Math.min(0.999_999, position)) * 3;
  const segment = Math.floor(scaled);
  const t = scaled - segment;
  const points = [
    [56, 22, 84, 52],
    [52, 20, 82, 50],
    [50, 18, 74, 44]
  ][segment] ?? [56, 56, 56, 56];
  const inverse = 1 - t;

  return (
    inverse ** 3 * points[0]! +
    3 * inverse ** 2 * t * points[1]! +
    3 * inverse * t ** 2 * points[2]! +
    t ** 3 * points[3]!
  );
}

type OnboardingThreadMomentProps = {
  detail: string;
  markerPosition: number;
  title: string;
};

export function OnboardingThreadMoment({
  detail,
  markerPosition,
  title
}: OnboardingThreadMomentProps) {
  const appTheme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const draw = useSharedValue(reducedMotion ? 0.84 : 0);
  const knot = useSharedValue(reducedMotion ? 0.72 : 0);
  const clampedPosition = Math.max(0.08, Math.min(0.92, markerPosition));
  const markerX = 8 + clampedPosition * 328;
  const markerY = getMarkerY(clampedPosition);

  useEffect(() => {
    draw.value = withTiming(1, {
      duration: reducedMotion ? 220 : 1_080,
      easing: Easing.out(Easing.exp)
    });
    knot.value = withDelay(
      reducedMotion ? 40 : 720,
      withTiming(1, {
        duration: reducedMotion ? 180 : 420,
        easing: Easing.out(Easing.exp)
      })
    );
  }, [draw, knot, reducedMotion]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - draw.value)
  }));
  const knotProps = useAnimatedProps(() => ({
    opacity: knot.value,
    r: 5 + knot.value * 3
  }));

  return (
    <Screen>
      <View
        accessibilityLabel={`${title}. ${detail}`}
        accessibilityLiveRegion="polite"
        accessible
        style={styles.scene}
      >
        <View style={styles.copy}>
          <View style={[styles.check, { backgroundColor: appTheme.theme.primarySoft }]}>
            <Check color={appTheme.primary} size={26} strokeWidth={2.8} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.threadStage, { backgroundColor: appTheme.theme.primarySoft }]}
        >
          <Svg height="100%" pointerEvents="none" viewBox="0 0 344 112" width="100%">
            <Path
              d={path}
              fill="none"
              opacity={0.34}
              stroke={colors.border}
              strokeLinecap="round"
              strokeWidth={3}
            />
            <AnimatedPath
              animatedProps={pathProps}
              d={path}
              fill="none"
              stroke={appTheme.primary}
              strokeDasharray={`${pathLength}, ${pathLength}`}
              strokeLinecap="round"
              strokeWidth={4}
            />
            <AnimatedCircle
              animatedProps={knotProps}
              cx={markerX}
              cy={markerY}
              fill={appTheme.primary}
              stroke={colors.surfaceStrong}
              strokeWidth={4}
            />
          </Svg>
        </View>

        <Text style={[styles.footnote, { color: appTheme.primary }]}>
          Ana sayfanda aynı yerden devam ediyor
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    paddingVertical: spacing.xxl
  },
  copy: {
    alignItems: "center",
    gap: spacing.md
  },
  check: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  title: {
    ...typography.heading1,
    color: colors.text,
    textAlign: "center"
  },
  detail: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 420,
    textAlign: "center"
  },
  threadStage: {
    ...radii.cardLarge,
    height: 178,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: spacing.sm
  },
  footnote: {
    ...typography.label,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  }
});
