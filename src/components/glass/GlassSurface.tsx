import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, shadows } from "@/theme";

export type GlassTone = "regular" | "strong" | "tinted";
export type GlassElevation = "none" | "soft" | "card" | "lifted" | "floating";

type GlassSurfaceProps = PropsWithChildren<{
  /** Köşe yarıçapı. Blur maskesinin doğru kırpılması için burada verilir. */
  radius?: number;
  /** Camın yoğunluğu. `tinted` verilen rengi camın altına serer. */
  tone?: GlassTone;
  /** `tone="tinted"` ile kullanılan renk. */
  tint?: string;
  elevation?: GlassElevation;
  /** Üst kenardaki specular parlamayı gizle. */
  noHighlight?: boolean;
  style?: StyleProp<ViewStyle>;
  /** İçeriğin sarıldığı katmana uygulanır (padding vb.). */
  contentStyle?: StyleProp<ViewStyle>;
  pointerEvents?: ViewStyle["pointerEvents"];
}>;

/**
 * Cam yüzey: bulanık zemin + yarı saydam dolgu + ışık kenarlığı.
 *
 * Aurora zemini bulanıklaştırdığı için kartın rengi bulunduğu yere göre
 * değişir; uygulamanın derinlik hissi buradan gelir. Blur'un pahalı ya da
 * desteksiz olduğu yerlerde (Android, düşük güçlü cihaz) opak yüzeye düşer,
 * ölçüler aynı kaldığı için düzen bozulmaz.
 */
export function GlassSurface({
  children,
  contentStyle,
  elevation = "card",
  noHighlight = false,
  pointerEvents,
  radius = radii.tile,
  style,
  tint,
  tone = "regular"
}: GlassSurfaceProps) {
  const supportsBlur = Platform.OS === "ios";
  const fill =
    tone === "strong" ? colors.glassStrong : tone === "tinted" ? colors.glass : colors.glass;

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        { borderRadius: radius, borderColor: colors.glassBorder },
        elevation !== "none" && shadows[elevation],
        !supportsBlur && { backgroundColor: colors.surface },
        style
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {supportsBlur ? (
          <BlurView
            intensity={tone === "strong" ? 60 : 38}
            style={StyleSheet.absoluteFill}
            tint="default"
          />
        ) : null}
        {supportsBlur ? <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} /> : null}
        {tone === "tinted" && tint ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        ) : null}
        {noHighlight ? null : (
          <LinearGradient
            colors={[colors.glassHighlight, colors.transparent]}
            end={{ x: 0.6, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={styles.highlight}
          />
        )}
      </View>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  clip: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0
  },
  highlight: {
    height: 64,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  }
});
