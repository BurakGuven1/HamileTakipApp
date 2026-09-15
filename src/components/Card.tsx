import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";

import { GlassSurface, type GlassElevation, type GlassTone } from "@/components/glass/GlassSurface";
import { radii, spacing } from "@/theme";

type CardProps = PropsWithChildren<{
  elevation?: GlassElevation;
  /** Büyük hero yüzeyi için daha geniş köşe. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  tone?: GlassTone;
}>;

/**
 * Uygulamanın standart yüzeyi.
 *
 * İsmi ve prop'ları korunuyor çünkü onlarca ekran bunu çağırıyor; gövdesi
 * artık cam. Böylece her ekran tek değişiklikle yeni dile geçti.
 */
export function Card({
  children,
  elevation = "card",
  large = false,
  style,
  tint,
  tone = "regular"
}: CardProps) {
  return (
    <GlassSurface
      contentStyle={styles.content}
      elevation={elevation}
      radius={large ? 34 : radii.tile + 4}
      style={style}
      tint={tint}
      tone={tone}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg
  }
});
