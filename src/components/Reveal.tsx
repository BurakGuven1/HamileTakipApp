import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";

type RevealProps = PropsWithChildren<{
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function Reveal({ children, delay = 0, style }: RevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={
        reducedMotion
          ? undefined
          : FadeInDown.delay(delay)
              .duration(380)
              .easing(Easing.out(Easing.exp))
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}
