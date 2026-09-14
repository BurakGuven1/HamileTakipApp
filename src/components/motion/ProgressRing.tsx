import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { durations, easings } from "@/theme/motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = PropsWithChildren<{
  accessibilityLabel?: string;
  /** Dolu halkanın rengi. */
  color: string;
  /** Halka kalınlığı (px). Varsayılan: 8 */
  strokeWidth?: number;
  /** 0-1 arası ilerleme oranı. */
  progress: number;
  /** Dış çap (px). Varsayılan: 116 */
  size?: number;
  /** Boş kalan halkanın rengi. */
  trackColor: string;
}>;

/**
 * Gerçek ilerlemeyi (ör. gebelik haftası) gösteren, değer değiştikçe
 * yumuşakça dolan halka. Ortasındaki alana içerik yerleştirilebilir.
 * Reduce Motion açıkken değer animasyonsuz yazılır.
 */
export function ProgressRing({
  accessibilityLabel,
  children,
  color,
  progress,
  size = 116,
  strokeWidth = 8,
  trackColor
}: ProgressRingProps) {
  const reducedMotion = useReducedMotion();
  const ratio = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedRatio = useSharedValue(reducedMotion ? ratio : 0);

  useEffect(() => {
    animatedRatio.value = reducedMotion
      ? ratio
      : withTiming(ratio, { duration: durations.slow * 2, easing: easings.entrance });
  }, [animatedRatio, ratio, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedRatio.value)
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: Math.round(ratio * 100) }}
      accessible={Boolean(accessibilityLabel)}
      style={[styles.wrapper, { height: size, width: size }]}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={color}
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      {children ? (
        <View pointerEvents="none" style={styles.center}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center"
  }
});
