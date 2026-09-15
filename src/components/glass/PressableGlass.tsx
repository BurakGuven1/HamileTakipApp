import type { ComponentProps, PropsWithChildren } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import {
  GlassSurface,
  type GlassElevation,
  type GlassTone
} from "@/components/glass/GlassSurface";
import { PressableScale } from "@/components/motion/PressableScale";
import { radii } from "@/theme";

type PressableGlassProps = PropsWithChildren<
  Omit<ComponentProps<typeof PressableScale>, "style" | "children"> & {
    /** İçeriğin sarıldığı katman — dolgu ve iç yerleşim buraya yazılır. */
    contentStyle?: StyleProp<ViewStyle>;
    elevation?: GlassElevation;
    radius?: number;
    /** Dış yerleşim (flex, genişlik, kenar boşluğu) — dokunma kutusuna gider. */
    style?: StyleProp<ViewStyle>;
    tint?: string;
    tone?: GlassTone;
  }
>;

/**
 * Dokunulabilir cam yüzey.
 *
 * `style` dokunma kutusuna gider ki ızgara içinde `flex: 1` gibi yerleşim
 * kuralları çalışsın; cam yüzey de o kutuyu tamamen doldurur. Görsel olarak
 * `GlassSurface` ile aynıdır, böylece dokunulabilir ve dokunulamaz kartlar
 * aynı dilde kalır.
 */
export function PressableGlass({
  children,
  contentStyle,
  elevation = "soft",
  radius = radii.tile,
  style,
  tint,
  tone = "regular",
  ...pressableProps
}: PressableGlassProps) {
  return (
    <PressableScale style={[styles.pressable, style]} {...pressableProps}>
      <GlassSurface
        contentStyle={contentStyle}
        elevation={elevation}
        radius={radius}
        style={styles.surface}
        tint={tint}
        tone={tone}
      >
        {children}
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "stretch"
  },
  surface: {
    flexGrow: 1
  }
});
