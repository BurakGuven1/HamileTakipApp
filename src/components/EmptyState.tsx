import { Plus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { GlassSurface } from "@/components/glass";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { radii, spacing, typography } from "@/theme";

type EmptyStateProps = {
  actionHint?: string;
  actionLabel?: string;
  description: string;
  onActionPress?: () => void;
  title: string;
};

export function EmptyState({
  actionHint,
  actionLabel,
  description,
  onActionPress,
  title
}: EmptyStateProps) {
  const appTheme = useAppTheme();

  return (
    <GlassSurface contentStyle={styles.wrapper} elevation="soft" radius={26}>
      <View style={[styles.invitationMark, { backgroundColor: appTheme.primarySoft }]}>
        <Plus color={appTheme.primary} size={24} strokeWidth={2.4} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {actionLabel && onActionPress ? (
        <Button
          accessibilityHint={actionHint}
          label={actionLabel}
          variant="secondary"
          onPress={onActionPress}
        />
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xl
  },
  invitationMark: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  copy: {
    gap: spacing.sm
  },
  title: {
    ...typography.heading3,
    textAlign: "center"
  },
  description: {
    ...typography.caption,
    textAlign: "center"
  }
});
