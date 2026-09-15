import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, durations, gradients } from "@/theme";

type AuroraBackgroundProps = {
  /** Işıkların görünürlüğü. Metin yoğun ekranlarda düşürülür. */
  intensity?: number;
};

/**
 * Uygulamanın zemini: yavaşça sürüklenen üç renkli ışık.
 *
 * Cam yüzeylerin altında değişen bir renk olmadan "liquid glass" yalnızca gri
 * bir bulanıklık olur; aurora o rengi sağlar. Hareket çok yavaş (9 sn) ve
 * Reduce Motion açıkken tamamen durur — dekoratif olduğu için durması
 * hiçbir bilgiyi götürmez.
 */
export function AuroraBackground({ intensity = 1 }: AuroraBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: durations.ambient, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [drift, reducedMotion]);

  const blobSize = Math.max(width, height) * 0.9;
  const palette = isDark ? gradients.auroraDark : gradients.auroraLight;

  const first = useAnimatedStyle(() => ({
    transform: [
      { translateX: -blobSize * 0.25 + drift.value * 40 },
      { translateY: -blobSize * 0.3 + drift.value * 24 }
    ]
  }));

  const second = useAnimatedStyle(() => ({
    transform: [
      { translateX: width - blobSize * 0.65 - drift.value * 52 },
      { translateY: height * 0.18 + drift.value * 36 }
    ]
  }));

  const third = useAnimatedStyle(() => ({
    transform: [
      { translateX: -blobSize * 0.2 + drift.value * 30 },
      { translateY: height * 0.55 - drift.value * 30 }
    ]
  }));

  const blob = { width: blobSize, height: blobSize, borderRadius: blobSize / 2 };
  const opacity = (isDark ? 0.5 : 0.34) * intensity;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      <Animated.View style={[styles.blob, blob, { opacity }, first]}>
        <Radial color={palette[0]} size={blobSize} />
      </Animated.View>
      <Animated.View style={[styles.blob, blob, { opacity: opacity * 0.9 }, second]}>
        <Radial color={palette[1]} size={blobSize} />
      </Animated.View>
      <Animated.View style={[styles.blob, blob, { opacity: opacity * 0.75 }, third]}>
        <Radial color={palette[2]} size={blobSize} />
      </Animated.View>
    </View>
  );
}

/**
 * expo-linear-gradient radial gradyan sunmuyor; iç içe geçen üç halkayla
 * merkezden kenara sönen yumuşak bir ışık taklit ediliyor.
 */
function Radial({ color, size }: { color: string; size: number }) {
  return (
    <View style={[styles.radial, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={[color, `${color}00`]}
        end={{ x: 0.9, y: 0.9 }}
        start={{ x: 0.1, y: 0.1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute"
  },
  radial: {
    overflow: "hidden"
  }
});
