import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type MetricCardProps = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  value: {
    ...typography.heading1,
    color: colors.primary
  },
  label: {
    ...typography.body,
    fontSize: 14
  }
});
