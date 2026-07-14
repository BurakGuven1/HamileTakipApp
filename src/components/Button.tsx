import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { forwardRef, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, type View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonProps = Omit<ComponentProps<typeof Pressable>, "style"> & {
  breathing?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export const Button = forwardRef<View, ButtonProps>(function Button({
  breathing = false,
  label,
  variant = "primary",
  style,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...pressableProps
}: ButtonProps, ref) {
  const appTheme = useAppTheme();
  const breathScale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const themedVariantStyle =
    variant === "primary"
      ? { backgroundColor: appTheme.primary, borderColor: appTheme.primary }
      : variant === "secondary"
        ? { borderColor: appTheme.primary }
        : null;

  useEffect(() => {
    if (!breathing || disabled) {
      breathScale.value = withTiming(1, { duration: 180 });
      return;
    }

    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [breathing, breathScale, disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value * pressScale.value }]
  }));

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => {
        if (!disabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        pressScale.value = withTiming(0.98, { duration: 110 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressScale.value = withTiming(1, { duration: 140 });
        onPressOut?.(event);
      }}
      style={[
        styles.base,
        styles[variant],
        themedVariantStyle,
        disabled && styles.disabled,
        animatedStyle,
        style
      ]}
      {...pressableProps}
    >
      <Text
        style={[
          typography.button,
          variant === "secondary" && { color: appTheme.primary },
          variant === "ghost" && { color: appTheme.primary },
          disabled && styles.disabledText
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    ...radii.button,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.transparent,
    borderColor: colors.primary
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderColor: colors.transparent
  },
  secondaryText: {
    color: colors.primary
  },
  ghostText: {
    color: colors.primary
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border
  },
  disabledText: {
    color: colors.textMuted
  }
});
