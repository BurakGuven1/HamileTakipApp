import type { LucideIcon } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { radii } from "@/theme";
import { durations, easings, springs } from "@/theme/motion";

type AnimatedTabIconProps = {
  /** Seçili durumda ikonun arkasına gelen yumuşak zemin. */
  activeBackground: string;
  color: string;
  focused: boolean;
  icon: LucideIcon;
  size: number;
};

/**
 * Sekme ikonu: seçildiğinde kısa bir ölçek hareketi yapar ve arkasında
 * yumuşak bir zemin belirir. Reduce Motion açıkken yalnızca zemin değişir.
 */
export function AnimatedTabIcon({
  activeBackground,
  color,
  focused,
  icon: Icon,
  size
}: AnimatedTabIconProps) {
  const reducedMotion = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = reducedMotion
      ? withTiming(focused ? 1 : 0, {
          duration: durations.fast,
          easing: easings.standard
        })
      : withSpring(focused ? 1 : 0, springs.snappy);
  }, [active, focused, reducedMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 + active.value * 0.12 }]
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.82 + active.value * 0.18 }]
  }));

  return (
    <Animated.View style={[styles.wrapper, iconStyle]}>
      <Animated.View
        style={[styles.pill, { backgroundColor: activeBackground }, pillStyle]}
      />
      <Icon color={color} size={size} strokeWidth={focused ? 2.6 : 2.2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    minWidth: 44
  },
  pill: {
    borderRadius: radii.pill,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  }
});
