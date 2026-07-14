import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type MetricCardProps = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: MetricCardProps) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: appTheme.primary }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  value: {
    ...typography.dataStrong
  },
  label: {
    ...typography.body,
    fontSize: 14
  }
});
