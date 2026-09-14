import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { forwardRef } from "react";
import {
  Pressable,
  type StyleProp,
  type View,
  type ViewStyle
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { durations, easings, springs } from "@/theme/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<ComponentProps<typeof Pressable>, "style"> & {
  /** Basıldığında hafif dokunsal geri bildirim ver. Varsayılan: açık. */
  haptic?: boolean | "light" | "medium";
  /** Basma sırasında ulaşılacak ölçek. Varsayılan: 0.97 */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Basma anında kısa bir ölçek ve opaklık geri bildirimi veren dokunma yüzeyi.
 * Reduce Motion açıkken ölçek uygulanmaz; yalnızca opaklık değişir.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(
  function PressableScale(
    {
      children,
      disabled,
      haptic = true,
      onPress,
      onPressIn,
      onPressOut,
      scaleTo = 0.97,
      style,
      ...pressableProps
    },
    ref
  ) {
    const reducedMotion = useReducedMotion();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: 1 - pressed.value * 0.12,
      transform: [
        { scale: reducedMotion ? 1 : 1 - pressed.value * (1 - scaleTo) }
      ]
    }));

    return (
      <AnimatedPressable
        ref={ref}
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={(event) => {
          if (!disabled && haptic) {
            Haptics.impactAsync(
              haptic === "medium"
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light
            ).catch(() => undefined);
          }
          onPress?.(event);
        }}
        onPressIn={(event) => {
          pressed.value = withSpring(1, springs.press);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressed.value = withTiming(0, {
            duration: durations.base,
            easing: easings.standard
          });
          onPressOut?.(event);
        }}
        style={[style, animatedStyle]}
        {...pressableProps}
      >
        {children}
      </AnimatedPressable>
    );
  }
);
