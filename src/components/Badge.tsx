import { StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type BadgeProps = {
  label: string;
};

export function Badge({ label }: BadgeProps) {
  return <Text style={styles.badge}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    ...typography.label,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    color: colors.text,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  }
});
