import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { PressableScale } from "@/components/motion/PressableScale";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, shadows, spacing, typography } from "@/theme";

type GradientButtonProps = Omit<
  ComponentProps<typeof PressableScale>,
  "style" | "children"
> & {
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  /** Tam genişlik yerine içeriğe göre daral. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Birincil eylem butonu: temanın gradyanı, cam kenarlık ve yumuşak gölge.
 * Yükleme sırasında etiket korunur (fiil değişmez), yanında gösterge döner.
 */
export function GradientButton({
  compact = false,
  disabled,
  icon,
  label,
  loading = false,
  style,
  ...pressableProps
}: GradientButtonProps) {
  const appTheme = useAppTheme();
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityState={{ busy: loading, disabled: Boolean(isDisabled) }}
      disabled={isDisabled}
      haptic="medium"
      scaleTo={0.96}
      style={[
        styles.pressable,
        shadows.card,
        compact && styles.compact,
        isDisabled && styles.disabled,
        style
      ]}
      {...pressableProps}
    >
      <LinearGradient
        colors={appTheme.gradient as readonly [string, string, ...string[]]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {icon}
          <Text numberOfLines={1} style={styles.label}>
            {label}
          </Text>
          {loading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : null}
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.lg,
    overflow: "hidden"
  },
  compact: {
    alignSelf: "flex-start"
  },
  disabled: {
    opacity: 0.5
  },
  gradient: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  label: {
    ...typography.button,
    color: "#FFFFFF"
  }
});
