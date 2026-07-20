import { AlertCircle } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing, typography } from "@/theme";

type QueryStateProps = {
  compact?: boolean;
  description?: string;
  loading?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
};

export function QueryState({
  compact = false,
  description,
  loading = false,
  onRetry,
  retrying = false,
  title
}: QueryStateProps) {
  const appTheme = useAppTheme();

  if (loading) {
    return (
      <View
        accessibilityLabel="İçerik yükleniyor"
        accessibilityRole="progressbar"
        style={[styles.loading, compact && styles.compact]}
      >
        <ActivityIndicator color={appTheme.primary} size={compact ? "small" : "large"} />
        <Text style={styles.description}>{description ?? "Bilgilerin hazırlanıyor…"}</Text>
      </View>
    );
  }

  return (
    <Card style={styles.errorCard}>
      <View accessibilityLiveRegion="polite" style={styles.errorContent}>
        <AlertCircle color={colors.danger} size={24} />
        <View style={styles.copy}>
          <Text style={typography.heading3}>{title ?? "Bilgiler alınamadı"}</Text>
          <Text style={styles.description}>
            {description ?? "Bağlantını kontrol edip yeniden deneyebilirsin."}
          </Text>
        </View>
      </View>
      {onRetry ? (
        <Button
          disabled={retrying}
          label={retrying ? "Yeniden deneniyor…" : "Yeniden dene"}
          variant="secondary"
          onPress={onRetry}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 180,
    padding: spacing.xl
  },
  compact: {
    minHeight: 96,
    padding: spacing.md
  },
  errorCard: {
    gap: spacing.lg
  },
  errorContent: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  description: {
    ...typography.body,
    color: colors.textMuted
  }
});
