import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { PressableGlass } from "@/components/glass";
import type { ToolItem } from "@/features/tools/toolCatalog";
import { colors, radii, spacing, typography } from "@/theme";

type ToolShortcutCardProps = {
  /** Kategorinin ilk aracı: biraz daha yüksek ve ikonu daha belirgin. */
  featured?: boolean;
  tool: ToolItem;
};

/** Araç listelerinde kullanılan tek satırlık cam araç kartı. */
export function ToolShortcutCard({ featured = false, tool }: ToolShortcutCardProps) {
  const Icon = tool.icon;

  return (
    <Link href={tool.href} asChild>
      <PressableGlass
        accessibilityHint={tool.subtitle}
        accessibilityLabel={tool.title}
        accessibilityRole="button"
        contentStyle={[styles.row, featured && styles.rowFeatured]}
        elevation="soft"
        radius={radii.tile}
        tint={featured ? tool.tint : undefined}
        tone={featured ? "tinted" : "regular"}
      >
        <View
          style={[
            styles.icon,
            featured && styles.iconFeatured,
            { backgroundColor: tool.tint }
          ]}
        >
          <Icon color={tool.accent} size={featured ? 25 : 22} strokeWidth={2.3} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {tool.title}
          </Text>
          <Text numberOfLines={2} style={styles.subtitle}>
            {tool.subtitle}
          </Text>
        </View>
        <ChevronRight color={colors.textMuted} size={20} strokeWidth={2.2} />
      </PressableGlass>
    </Link>
  );
}

/**
 * Ana ekrandaki hızlı eylem karesi.
 *
 * İkon kapsülü ve başlık aynı karenin içinde, ikisi de yatayda ortalanmış ve
 * kare sabit yükseklikte. Önceki sürümde başlık kutunun dışında ve sola
 * yaslıydı; ikonla hizası kayıyordu. Sabit yükseklik, başlığın iki satıra
 * çıktığı yerlerde ızgaranın basamaklanmasını da engelliyor.
 */
export function ToolQuickAction({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;

  return (
    <Link href={tool.href} asChild>
      <PressableGlass
        accessibilityHint={tool.subtitle}
        accessibilityLabel={tool.title}
        accessibilityRole="button"
        contentStyle={styles.quickAction}
        elevation="soft"
        radius={radii.tile}
        tint={tool.tint}
        tone="tinted"
      >
        <View style={[styles.quickIcon, { backgroundColor: colors.surface }]}>
          <Icon color={tool.accent} size={22} strokeWidth={2.4} />
        </View>
        <Text numberOfLines={2} style={styles.quickTitle}>
          {tool.title}
        </Text>
      </PressableGlass>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md
  },
  rowFeatured: {
    minHeight: 82
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  iconFeatured: {
    borderRadius: radii.lg,
    height: 52,
    width: 52
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    ...typography.bodyStrong
  },
  subtitle: {
    ...typography.caption
  },
  quickAction: {
    alignItems: "center",
    gap: spacing.sm,
    // Sabit yükseklik: başlığı iki satır olan kare, tek satırlıkla aynı
    // boyda kalsın ki ızgara basamaklanmasın.
    height: 112,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  quickIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  quickTitle: {
    ...typography.captionStrong,
    textAlign: "center"
  }
});
