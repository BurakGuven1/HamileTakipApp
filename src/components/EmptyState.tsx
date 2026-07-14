import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Thread } from "@/components/Thread";
import { colors, radii, spacing, typography } from "@/theme";

type EmptyStateProps = {
  actionLabel?: string;
  title: string;
  description: string;
  onActionPress?: () => void;
};

export function EmptyState({
  actionLabel,
  title,
  description,
  onActionPress
}: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.thread}>
        <Thread height={96} variant="decorative" />
      </View>
      <Text style={[typography.heading2, styles.title]}>{title}</Text>
      <Text style={[typography.body, styles.description]}>{description}</Text>
      {actionLabel && onActionPress ? (
        <Button label={actionLabel} variant="secondary" onPress={onActionPress} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.xl
  },
  thread: {
    left: spacing.md,
    opacity: 0.42,
    position: "absolute",
    right: spacing.md,
    top: spacing.sm
  },
  title: {
    marginTop: spacing.xl,
    textAlign: "center"
  },
  description: {
    textAlign: "center"
  }
});
