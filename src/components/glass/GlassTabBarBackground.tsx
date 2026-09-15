import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

import { colors, radii } from "@/theme";

/**
 * Yüzen sekme çubuğunun zemini.
 *
 * Çubuk opak bir çubuk değil, içeriğin üstünde duran bir cam kapsül:
 * altından geçen aurora ve kartlar bulanık olarak görünür, böylece sayfanın
 * devam ettiği hissi kaybolmaz.
 */
export function GlassTabBarBackground() {
  return (
    <View style={styles.container}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={72} style={StyleSheet.absoluteFill} tint="default" />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Platform.OS === "ios" ? colors.glassStrong : colors.surface }
        ]}
      />
      <LinearGradient
        colors={[colors.glassHighlight, colors.transparent]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.highlight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    borderColor: colors.glassBorder,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  highlight: {
    height: 24,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  }
});
