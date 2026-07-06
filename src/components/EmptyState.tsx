import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={typography.heading2}>{title}</Text>
      <Text style={[typography.body, styles.description]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  description: {
    textAlign: "center"
  }
});
