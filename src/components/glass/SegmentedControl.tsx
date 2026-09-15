import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, durations, radii, shadows, spacing, springs, typography } from "@/theme";

export type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  style?: StyleProp<ViewStyle>;
  value: T;
};

/**
 * Seçili sekmenin altında yay ile kayan cam kapsül.
 *
 * Kapsülün kayması hangi sekmeden hangisine geçildiğini gösterir; anında
 * yer değiştiren bir vurgu bu yönü kaybeder. Reduce Motion açıkken kapsül
 * hâlâ doğru yerde durur, yalnızca kayma anlık olur.
 */
export function SegmentedControl<T extends string>({
  onChange,
  options,
  style,
  value
}: SegmentedControlProps<T>) {
  const appTheme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  // Kapsül, iz içindeki dolgunun iç kenarından başlar; genişlik hesabı da
  // bu iç alana göre yapılmazsa son sekmede taşar.
  const innerWidth = Math.max(0, trackWidth - spacing.xs * 2);
  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => {
    const target = segmentWidth * index;
    return {
      width: segmentWidth,
      transform: [
        {
          translateX: reducedMotion
            ? withTiming(target, { duration: durations.instant })
            : withSpring(target, springs.snappy)
        }
      ]
    };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityRole="tablist"
      onLayout={handleLayout}
      style={[styles.track, style]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            shadows.soft,
            { backgroundColor: colors.surface, borderColor: colors.glassBorder },
            thumbStyle
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? appTheme.primary : colors.textMuted }
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    padding: spacing.xs
  },
  thumb: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: spacing.xs,
    left: spacing.xs,
    position: "absolute",
    top: spacing.xs
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.sm
  },
  label: {
    ...typography.captionStrong
  }
});
