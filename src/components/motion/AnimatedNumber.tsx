import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { durations, easings } from "@/theme/motion";

type AnimatedNumberProps = {
  accessibilityLabel?: string;
  /** Ondalık basamak sayısı. Varsayılan: 0 */
  decimals?: number;
  /** Sayıdan sonra gelen birim (ör. " ml"). */
  suffix?: string;
  /** Sayıdan önce gelen metin. */
  prefix?: string;
  style?: StyleProp<TextStyle>;
  value: number;
};

/**
 * Sayı değiştiğinde eski değerden yenisine sayarak geçer ve kısa bir
 * yükselme hareketi yapar. Reduce Motion açıkken değer anında yazılır.
 */
export function AnimatedNumber({
  accessibilityLabel,
  decimals = 0,
  prefix = "",
  style,
  suffix = "",
  value
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(value);
  const lift = useSharedValue(0);
  const [display, setDisplay] = useState(() => value.toFixed(decimals));

  useEffect(() => {
    if (reducedMotion) {
      progress.value = value;
      setDisplay(value.toFixed(decimals));
      return;
    }

    progress.value = withTiming(value, {
      duration: durations.slow,
      easing: easings.standard
    });
    lift.value = withSequence(
      withTiming(1, { duration: durations.fast, easing: easings.entrance }),
      withTiming(0, { duration: durations.base, easing: easings.standard })
    );
  }, [decimals, lift, progress, reducedMotion, value]);

  useAnimatedReaction(
    () => progress.value.toFixed(decimals),
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setDisplay)(next);
      }
    },
    [decimals]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 2 }]
  }));

  return (
    <Animated.Text
      accessibilityLabel={accessibilityLabel ?? `${prefix}${value}${suffix}`}
      style={[style, animatedStyle]}
    >
      {`${prefix}${display}${suffix}`}
    </Animated.Text>
  );
}
