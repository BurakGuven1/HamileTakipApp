import { Image } from "expo-image";
import { Leaf } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { colors, radii, spacing, typography } from "@/theme";

const journeyArtwork = {
  early: require("../../assets/illustrations/pregnancy-journey-early.jpg"),
  middle: require("../../assets/illustrations/pregnancy-journey-middle.jpg"),
  late: require("../../assets/illustrations/pregnancy-journey-late.jpg")
} as const;

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
  const stage = week <= 13 ? "early" : week <= 27 ? "middle" : "late";
  const reducedMotion = useReducedMotion();

  return (
    <View style={[styles.frame, { height }, style]}>
      <Image
        accessibilityLabel={`${week}. hafta için simgesel gelişim illüstrasyonu. Tıbbi görsel değildir.`}
        accessibilityRole="image"
        accessible
        contentFit="cover"
        source={journeyArtwork[stage]}
        style={StyleSheet.absoluteFill}
        transition={reducedMotion ? 0 : 180}
      />
      <View style={styles.caption}>
        <Leaf color={colors.primary} size={16} strokeWidth={2.2} />
        <Text style={styles.captionText}>Yolculuğun bu haftası</Text>
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
