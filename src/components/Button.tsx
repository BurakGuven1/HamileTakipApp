import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/motion/PressableScale";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, shadows, spacing, typography } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<ComponentProps<typeof PressableScale>, "style" | "children"> & {
  /** Geçmişten kalan prop; sürekli nefes animasyonu artık kullanılmıyor. */
  breathing?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

/**
 * Standart eylem butonu.
 *
 * Birincil varyant temanın gradyanını taşır, ikincil varyant cam bir
 * yüzey üstünde renkli kenarlıkla durur. Geri bildirim tek bir yay
 * ölçeğidir — sürekli nefes alan buton kaldırıldı, dikkat gerçek
 * durum değişimlerine ayrıldı.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    disabled,
    icon,
    label,
    loading = false,
    style,
    variant = "primary",
    ...pressableProps
  }: ButtonProps,
  ref
) {
  const appTheme = useAppTheme();
  const isDisabled = Boolean(disabled) || loading;

  const body = (
    <View style={styles.content}>
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          variant === "primary"
            ? styles.primaryLabel
            : { color: isDisabled ? colors.textMuted : appTheme.primary }
        ]}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : appTheme.primary}
          size="small"
        />
      ) : null}
    </View>
  );

  return (
    <PressableScale
      ref={ref}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      haptic={variant === "primary" ? "medium" : "light"}
      scaleTo={0.96}
      style={[
        styles.base,
        variant === "primary" && !isDisabled && shadows.soft,
        variant === "secondary" && {
          backgroundColor: colors.glass,
          borderColor: isDisabled ? colors.border : appTheme.primary,
          borderWidth: 1.5
        },
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        style
      ]}
      {...pressableProps}
    >
      {variant === "primary" && !isDisabled ? (
        <LinearGradient
          colors={appTheme.gradient as readonly [string, string, ...string[]]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.fill}
        >
          {body}
        </LinearGradient>
      ) : (
        <View style={styles.fill}>{body}</View>
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    minHeight: 52,
    overflow: "hidden"
  },
  fill: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  ghost: {
    backgroundColor: colors.transparent
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    // Devre dışı buton gradyan taşımaz; kenarlık tek ayırt edici olur.
    borderColor: colors.border,
    borderWidth: Platform.OS === "ios" ? StyleSheet.hairlineWidth : 1
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  label: {
    ...typography.button
  },
  primaryLabel: {
    color: "#FFFFFF"
  }
});
