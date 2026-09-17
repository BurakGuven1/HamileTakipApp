import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Baby, ChevronRight, Sparkles } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

/**
 * Stüdyonun iki kapısı var. Gebelikte karın kartı öne çıkar, doğumdan sonra
 * anı kartı; ama ikisi de her zaman açık, çünkü anne doğumdan sonra da eski
 * karın fotoğrafını kart yapmak isteyebiliyor.
 */
export default function PhotoStudioScreen() {
  const appTheme = useAppTheme();
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  useEffect(() => {
    void trackEvent("photo_studio_opened", {});
  }, []);

  if (profileQuery.isPending) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Foto Stüdyo hazırlanıyor…" />
      </Screen>
    );
  }

  const isPregnant = profileQuery.data?.is_pregnant === true;

  const options = [
    {
      description:
        "Karnına ışıltılı taşları, kalpleri ve çiçekleri yapıştır. Yüzün, saçın ve kıyafetin hiç değişmez.",
      href: "/photo-studio/belly" as const,
      icon: Sparkles,
      key: "belly",
      title: "Karın ışıltısı"
    },
    {
      description:
        "Bebeğinin fotoğrafına kaç aylık olduğunu, kilo ve boyunu tatlı tabelalarla ekle.",
      href: "/photo-studio/milestone" as const,
      icon: Baby,
      key: "milestone",
      title: "Aylık anı kartı"
    }
  ];

  const ordered = isPregnant ? options : [...options].reverse();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.eyebrow}>Foto Stüdyo</Text>
        <Text style={typography.heading1}>Fotoğrafını anıya çevir</Text>
        <Text style={styles.lede}>
          Fotoğrafın olduğu gibi kalır; süslemeleri biz üstüne yerleştiririz.
        </Text>
      </View>

      <View style={styles.list}>
        {ordered.map((option) => (
          <Pressable
            accessibilityHint={option.description}
            accessibilityRole="button"
            key={option.key}
            onPress={() => router.push(option.href)}
          >
            <Card style={styles.card}>
              <View style={[styles.icon, { backgroundColor: appTheme.theme.primarySoft }]}>
                <option.icon color={appTheme.theme.primary} size={24} />
              </View>
              <View style={styles.copy}>
                <Text style={typography.heading3}>{option.title}</Text>
                <Text style={styles.cardHint}>{option.description}</Text>
              </View>
              <ChevronRight color={colors.textMuted} size={20} />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  lede: {
    ...typography.body
  },
  list: {
    gap: spacing.md
  },
  card: {
    ...radii.card,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  icon: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  cardHint: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19
  }
});
