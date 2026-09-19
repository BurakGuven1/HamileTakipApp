import { Plus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Thread } from "@/components/Thread";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

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
    <View style={styles.wrapper}>
      <View style={styles.signature}>
        <Thread
          accessibilityLabel={`${title} için açık ilmek`}
          color={appTheme.primary}
          height={58}
          markers={[{ kind: "loop", position: 0.26 }]}
          mutedColor={appTheme.theme.primarySoft}
          progress={0.27}
          semantic="timeline"
          variant="progress"
        />
        <View style={[styles.invitationMark, { backgroundColor: appTheme.theme.primarySoft }]}>
          <Plus color={appTheme.primary} size={20} strokeWidth={2.4} />
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    overflow: "hidden",
    padding: spacing.xl
  },
  signature: {
    minHeight: 58,
    position: "relative"
  },
  invitationMark: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: 38
  },
  copy: {
    gap: spacing.sm
  },
  title: {
    ...typography.heading2,
    color: colors.text
  },
  description: {
    ...typography.body,
    color: colors.textMuted
  }
});
