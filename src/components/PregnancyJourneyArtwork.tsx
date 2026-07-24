import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

const expectingParentsArtwork = require("../../assets/illustrations/expecting-parents-connection-v2.jpg");

type PregnancyJourneyArtworkProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
  week: number;
};

export function PregnancyJourneyArtwork({
  height = 176,
  style,
  week
}: PregnancyJourneyArtworkProps) {
  const appTheme = useAppTheme();
  const reducedMotion = useReducedMotion();

  return (
    <View style={[styles.frame, { height }, style]}>
      <Image
        accessibilityLabel={`${week}. haftada bebeğini birlikte bekleyen anne ve baba illüstrasyonu.`}
        accessibilityRole="image"
        accessible
        contentFit="cover"
        contentPosition="center"
        source={expectingParentsArtwork}
        style={StyleSheet.absoluteFill}
        transition={reducedMotion ? 0 : 220}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: appTheme.isDark
              ? "rgba(23, 20, 25, 0.24)"
              : "rgba(55, 47, 61, 0.04)"
          }
        ]}
      />
      <View style={styles.caption}>
        <Heart color={colors.dustyRose} size={16} strokeWidth={2.2} />
        <Text style={styles.captionText}>Birlikte bekliyoruz</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    overflow: "hidden",
    position: "relative"
  },
  caption: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    bottom: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    left: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    position: "absolute"
  },
  captionText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  }
});
