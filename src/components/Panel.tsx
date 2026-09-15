import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, spacing } from "@/theme";

type PanelProps = PropsWithChildren<{
  /** Vurgu gerektiğinde camın yerine bu renk serilir. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Bir kartın *içindeki* ikincil yüzey.
 *
 * Cam içine cam koymuyoruz — ikinci bir bulanıklık katmanı hem pahalı hem de
 * okunaksız. Bunun yerine iç panel, camın üstünde duran hafif opak bir
 * kutudur; ekranlarda dağınık duran `backgroundColor: colors.surface`
 * bloklarının tek karşılığı budur.
 */
export function Panel({ children, style, tint }: PanelProps) {
  return (
    <View style={[styles.panel, tint ? { backgroundColor: tint } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.glassBorder,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md
  }
});
