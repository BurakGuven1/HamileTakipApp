import type { ComponentProps } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<ComponentProps<typeof Pressable>, "style"> & {
  label: string;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function Button({
  label,
  variant = "primary",
  style,
  disabled,
  ...pressableProps
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
      {...pressableProps}
    >
      <Text
        style={[
          typography.button,
          variant !== "primary" && styles.secondaryText,
          disabled && styles.disabledText
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.primarySoft
  },
  ghost: {
    backgroundColor: "transparent"
  },
  secondaryText: {
    color: colors.primary
  },
  pressed: {
    opacity: 0.84
  },
  disabled: {
    backgroundColor: colors.border
  },
  disabledText: {
    color: colors.textMuted
  }
});
