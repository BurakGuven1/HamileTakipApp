import { useEffect, type PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import { distances, durations, easings } from "@/theme/motion";

type FadeSlideInProps = PropsWithChildren<{
  /** Giriş gecikmesi (ms). Listelerde StaggeredList bunu yönetir. */
  delay?: number;
  /** Kayma mesafesi (px). Varsayılan: distances.md */
  distance?: number;
  /** İçeriğin geldiği yön. */
  from?: "bottom" | "top" | "left" | "right";
  style?: StyleProp<ViewStyle>;
}>;

/**
 * İçeriği kısa bir opaklık + küçük mesafe kaymasıyla ekrana getirir.
 * Reduce Motion açıkken yalnızca opaklık kullanılır; mesafe sıfırlanır.
 */
export function FadeSlideIn({
  children,
  delay = 0,
  distance = distances.md,
  from = "bottom",
  style
}: FadeSlideInProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      reducedMotion ? 0 : delay,
      withTiming(1, {
        duration: reducedMotion ? durations.fast : durations.slow,
        easing: easings.entrance
      })
    );
  }, [delay, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const offset = reducedMotion ? 0 : (1 - progress.value) * distance;
    const horizontal = from === "left" || from === "right";
    const sign = from === "top" || from === "left" ? -1 : 1;

    return {
      opacity: progress.value,
      transform: horizontal
        ? [{ translateX: offset * sign }]
        : [{ translateY: offset * sign }]
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
