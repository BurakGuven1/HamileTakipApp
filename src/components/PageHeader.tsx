import { router } from "expo-router";
import { ChevronLeft, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { PressableScale } from "@/components/motion/PressableScale";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type PageHeaderProps = {
  /** Geri butonu göster. Sekme olmayan, gezinilerek açılan ekranlar için. */
  back?: boolean;
  /** Başlığın üstündeki küçük bağlam etiketi. */
  eyebrow?: string;
  /** Sağdaki yuvarlak ikon kapsülü. */
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

/**
 * Her ekranın açılış başlığı.
 *
 * Ekranlar başlıklarını kendileri kuruyordu: kimi hero kutusunun içinde, kimi
 * çıplak, farklı punto ve dolgularla — bu yüzden sekmeler arasında geçerken
 * başlık yerinden oynuyordu. Tek bileşen, tek ölçü: ekran adı her yerde aynı
 * yükseklikte ve aynı hizada başlıyor.
 */
export function PageHeader({
  back = false,
  eyebrow,
  icon: Icon,
  style,
  subtitle,
  title
}: PageHeaderProps) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.header, style]}>
      {back ? (
        <PressableScale
          accessibilityLabel="Geri"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.4} />
        </PressableScale>
      ) : null}
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={[typography.eyebrow, { color: appTheme.primary }]}>{eyebrow}</Text>
        ) : null}
        <Text style={typography.display}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: appTheme.primarySoft }]}>
          <Icon color={appTheme.primary} size={26} strokeWidth={2.3} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  back: {
    alignItems: "center",
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  subtitle: {
    ...typography.caption
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  }
});
