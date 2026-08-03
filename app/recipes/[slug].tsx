import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Clock3,
  CookingPot,
  ShieldAlert,
  Snowflake,
  Wheat
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { getSolidFoodRecipe } from "@/features/nutrition/solidFoodRecipes";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function SolidFoodRecipeDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const recipe = getSolidFoodRecipe(slug);
  const accentColor = useAppTheme();
  const appTheme = accentColor.theme;

  if (!recipe) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>Tarif bulunamadı</Text>
              <Text style={typography.body}>Bu tarif kaldırılmış veya bağlantısı değişmiş olabilir.</Text>
              <Button label="Tariflere dön" onPress={() => router.replace("/solid-food-recipes")} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <BackButton />

        <View style={styles.hero}>
          <Image
            accessibilityLabel={`${recipe.title} tarif görseli`}
            contentFit="cover"
            source={recipe.image}
            style={styles.heroImage}
            transition={180}
          />
          <View style={styles.heroCopy}>
            <View style={styles.metaRow}>
              <View style={[styles.metaChip, { backgroundColor: appTheme.primarySoft }]}>
                <Text style={[styles.metaChipText, { color: appTheme.primary }]}>{recipe.minMonth}+ ay</Text>
              </View>
              <View style={styles.metaChip}>
                <Clock3 color={colors.textMuted} size={15} />
                <Text style={styles.metaChipText}>{recipe.prepMinutes} dk</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{recipe.category}</Text>
              </View>
            </View>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.summary}>{recipe.summary}</Text>
          </View>
        </View>

        <View style={[styles.safetyCallout, { backgroundColor: appTheme.accentSoft }]}>
          <ShieldAlert color={appTheme.accent} size={24} />
          <View style={styles.calloutCopy}>
            <Text style={styles.calloutTitle}>Sunmadan önce</Text>
            <Text style={styles.calloutText}>{recipe.safetyNote}</Text>
          </View>
        </View>

        <Card>
          <View style={styles.cardContent}>
            <View style={styles.cardHeading}>
              <CookingPot color={appTheme.primary} size={23} />
              <Text style={typography.heading2}>Malzemeler</Text>
            </View>
            {recipe.ingredients.map((ingredient) => (
              <View key={ingredient} style={styles.listRow}>
                <View style={[styles.bullet, { backgroundColor: appTheme.primary }]} />
                <Text style={styles.listText}>{ingredient}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.stepsSection}>
          <Text style={typography.heading2}>Hazırlama</Text>
          <View style={styles.stepsList}>
            {recipe.steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: appTheme.primary }]}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Wheat color={appTheme.primary} size={22} />
            <Text style={styles.detailLabel}>Alerjenler</Text>
            <Text style={styles.detailValue}>
              {recipe.allergens.length ? recipe.allergens.join(" · ") : "Belirgin yaygın alerjen yok"}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Snowflake color={appTheme.primary} size={22} />
            <Text style={styles.detailLabel}>Saklama</Text>
            <Text style={styles.detailValue}>{recipe.storage}</Text>
          </View>
        </View>

        <View style={styles.sourceNote}>
          <Text style={styles.sourceText}>
            İçerikler WHO ve CDC tamamlayıcı beslenme güvenlik ilkeleri temel alınarak Anne+ için
            hazırlanmıştır; tanı veya kişisel beslenme planı değildir.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Ek gıda tariflerine dön"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
    >
      <ArrowLeft color={colors.text} size={22} />
      <Text style={styles.backText}>Tariflere dön</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  backRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 48 },
  backText: { ...typography.label, color: colors.text },
  hero: { ...radii.cardLarge, backgroundColor: colors.surface, overflow: "hidden" },
  heroImage: { height: 280, width: "100%" },
  heroCopy: { gap: spacing.md, padding: spacing.lg },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md
  },
  metaChipText: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  title: { ...typography.heading1, color: colors.text, fontSize: 32, lineHeight: 38 },
  summary: { ...typography.body, color: colors.textMuted },
  safetyCallout: { ...radii.card, alignItems: "flex-start", flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  calloutCopy: { flex: 1, gap: spacing.xs },
  calloutTitle: { ...typography.heading3, color: colors.text },
  calloutText: { ...typography.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  cardContent: { gap: spacing.md },
  cardHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  listRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  bullet: { borderRadius: radii.pill, height: 7, marginTop: 8, width: 7 },
  listText: { ...typography.body, color: colors.text, flex: 1 },
  stepsSection: { gap: spacing.md },
  stepsList: { gap: spacing.lg },
  stepRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  stepNumber: { alignItems: "center", borderRadius: radii.pill, height: 34, justifyContent: "center", width: 34 },
  stepNumberText: { ...typography.dataStrong, color: colors.onPrimary, fontSize: 14, lineHeight: 19 },
  stepText: { ...typography.body, color: colors.text, flex: 1, paddingTop: 4 },
  detailGrid: { gap: spacing.md },
  detailItem: { ...radii.card, backgroundColor: colors.surface, gap: spacing.sm, padding: spacing.lg },
  detailLabel: { ...typography.heading3, color: colors.text },
  detailValue: { ...typography.body, color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  sourceNote: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  sourceText: { ...typography.body, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 }
});
