import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/motion";
import type { ToolItem } from "@/features/tools/toolCatalog";
import { colors, radii, spacing, typography } from "@/theme";

type ToolShortcutCardProps = {
  /** Kategorinin ilk aracı: biraz daha yüksek ve kalın kenarlı. */
  featured?: boolean;
  tool: ToolItem;
};

/** Araç listelerinde ve ana ekranda kullanılan tek satırlık araç kartı. */
export function ToolShortcutCard({ featured = false, tool }: ToolShortcutCardProps) {
  const Icon = tool.icon;

  return (
    <Link href={tool.href} asChild>
      <PressableScale
        accessibilityHint={tool.subtitle}
        accessibilityLabel={tool.title}
        accessibilityRole="button"
        style={[
          styles.card,
          featured && styles.featured,
          { borderLeftColor: tool.accent }
        ]}
      >
        <View style={[styles.icon, { backgroundColor: tool.tint }]}>
          <Icon color={tool.accent} size={23} strokeWidth={2.4} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{tool.title}</Text>
          <Text numberOfLines={2} style={styles.subtitle}>
            {tool.subtitle}
          </Text>
        </View>
        <ChevronRight color={colors.textMuted} size={20} strokeWidth={2.2} />
      </PressableScale>
    </Link>
  );
}

/** Ana ekrandaki hızlı eylem satırı için kompakt, dikey kart. */
export function ToolQuickAction({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;

  return (
    <Link href={tool.href} asChild>
      <PressableScale
        accessibilityHint={tool.subtitle}
        accessibilityLabel={tool.title}
        accessibilityRole="button"
        style={[styles.quickAction, { backgroundColor: tool.tint }]}
      >
        <View style={[styles.quickIcon, { backgroundColor: colors.surface }]}>
          <Icon color={tool.accent} size={21} strokeWidth={2.4} />
        </View>
        <Text numberOfLines={2} style={styles.quickTitle}>
          {tool.title}
        </Text>
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md
  },
  featured: {
    borderLeftWidth: 6,
    minHeight: 80
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  quickAction: {
    ...radii.card,
    alignItems: "flex-start",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 104,
    minWidth: 84,
    padding: spacing.md
  },
  quickIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 40
  },
  quickTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19
  }
});
