import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Search,
  ShieldCheck,
  Soup
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "@/components/Screen";
import {
  solidFoodRecipeCategories,
  solidFoodRecipes,
  type SolidFoodRecipe,
  type SolidFoodRecipeCategory
} from "@/features/nutrition/solidFoodRecipes";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type RecipeFilter = "Tümü" | SolidFoodRecipeCategory;

export default function SolidFoodRecipesScreen() {
  const accentColor = useAppTheme();
  const appTheme = accentColor.theme;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("Tümü");
  const featuredRecipe = solidFoodRecipes[0]!;
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filteredRecipes = useMemo(
    () =>
      solidFoodRecipes.filter((recipe) => {
        const matchesFilter = filter === "Tümü" || recipe.category === filter;
        const searchable = `${recipe.title} ${recipe.summary} ${recipe.ingredients.join(" ")}`
          .toLocaleLowerCase("tr-TR");
        return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
      }),
    [filter, normalizedQuery]
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Geri dön"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.text} size={24} />
          </Pressable>
          <Text style={styles.screenTitle}>Ek gıda tarifleri</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.intro, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.surfaceStrong }]}>
            <Soup color={appTheme.primary} size={30} strokeWidth={2.1} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Minik kaşıklar için</Text>
            <Text style={styles.introBody}>
              Yaşa değil, bebeğinin hazır oluşuna da uyan sade ve güvenli fikirler.
            </Text>
          </View>
        </View>

        <View style={styles.searchField}>
          <Search color={appTheme.primary} size={22} />
          <TextInput
            accessibilityLabel="Tarif ara"
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder="Tarif veya malzeme ara"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView
          accessibilityLabel="Tarif kategorileri"
          contentContainerStyle={styles.filterContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {solidFoodRecipeCategories.map((category) => {
            const active = filter === category;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={category}
                onPress={() => setFilter(category)}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }
                ]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{category}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!normalizedQuery && filter === "Tümü" ? (
          <FeaturedRecipeCard recipe={featuredRecipe} />
        ) : null}

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={typography.heading2}>
              {normalizedQuery || filter !== "Tümü" ? "Eşleşen tarifler" : "Tüm tarifler"}
            </Text>
            <Text style={styles.resultCount}>{filteredRecipes.length} tarif</Text>
          </View>
        </View>

        {filteredRecipes.length ? (
          <View style={styles.recipeList}>
            {filteredRecipes.map((recipe) => (
              <RecipeRow key={recipe.slug} recipe={recipe} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Search color={colors.textMuted} size={28} />
            <Text style={typography.heading3}>Bu aramada tarif yok</Text>
            <Text style={styles.emptyText}>Başka bir malzeme yazabilir veya filtreyi değiştirebilirsin.</Text>
          </View>
        )}

        <View style={styles.safetyStrip}>
          <ShieldCheck color={appTheme.primary} size={23} />
          <Text style={styles.safetyText}>
            Ek gıdaya genellikle 6. ay civarında ve gelişimsel hazır oluşla başlanır. Bebeğini dik
            oturt, her lokmada yanında kal; kendi çocuk doktorunun planı her zaman önceliklidir.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function FeaturedRecipeCard({ recipe }: { recipe: SolidFoodRecipe }) {
  const accentColor = useAppTheme();
  return (
    <Pressable
      accessibilityHint="Tarif ayrıntılarını açar"
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/recipes/[slug]", params: { slug: recipe.slug } })}
      style={({ pressed }) => [styles.featuredCard, pressed && styles.pressed]}
    >
      <Image
        accessibilityLabel={`${recipe.title} tarif görseli`}
        contentFit="cover"
        source={recipe.image}
        style={styles.featuredImage}
        transition={180}
      />
      <View style={styles.featuredCopy}>
        <View style={[styles.featuredTag, { backgroundColor: accentColor.accentSoft }]}>
          <Text style={[styles.featuredTagText, { color: accentColor.accent }]}>Öne çıkan tarif</Text>
        </View>
        <Text style={styles.featuredTitle}>{recipe.title}</Text>
        <Text style={styles.featuredSummary}>{recipe.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{recipe.minMonth}+ ay</Text>
          <View style={styles.metaDot} />
          <Clock3 color={colors.textMuted} size={15} />
          <Text style={styles.metaText}>{recipe.prepMinutes} dk</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecipeRow({ recipe }: { recipe: SolidFoodRecipe }) {
  return (
    <Pressable
      accessibilityHint="Tarif ayrıntılarını açar"
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/recipes/[slug]", params: { slug: recipe.slug } })}
      style={({ pressed }) => [styles.recipeRow, pressed && styles.pressed]}
    >
      <Image
        accessibilityLabel={`${recipe.title} tarif görseli`}
        contentFit="cover"
        source={recipe.image}
        style={styles.recipeImage}
        transition={160}
      />
      <View style={styles.recipeCopy}>
        <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
        <Text numberOfLines={2} style={styles.recipeSummary}>{recipe.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{recipe.minMonth}+ ay</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{recipe.texture}</Text>
        </View>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  headerSpacer: { height: 48, width: 48 },
  screenTitle: { ...typography.heading2, color: colors.text, textAlign: "center" },
  intro: {
    ...radii.cardLarge,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg
  },
  introIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  introCopy: { flex: 1, gap: spacing.xs },
  introTitle: { ...typography.heading2, color: colors.text },
  introBody: { ...typography.body, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  searchField: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg
  },
  searchInput: { ...typography.body, color: colors.text, flex: 1, minHeight: 52, paddingVertical: 0 },
  filterContent: { gap: spacing.sm, paddingRight: spacing.lg },
  filterChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  filterText: { ...typography.label, color: colors.textMuted },
  filterTextActive: { color: colors.onPrimary },
  featuredCard: {
    ...radii.cardLarge,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  featuredImage: { height: 220, width: "100%" },
  featuredCopy: { gap: spacing.sm, padding: spacing.lg },
  featuredTag: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  featuredTagText: { ...typography.label, fontSize: 13, lineHeight: 18 },
  featuredTitle: { ...typography.heading1, color: colors.text, fontSize: 28, lineHeight: 34 },
  featuredSummary: { ...typography.body, color: colors.textMuted },
  sectionHeading: { marginTop: spacing.sm },
  sectionHeadingCopy: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  resultCount: { ...typography.label, color: colors.textMuted },
  recipeList: { gap: spacing.md },
  recipeRow: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 116,
    overflow: "hidden",
    padding: spacing.sm
  },
  recipeImage: { borderRadius: radii.md, height: 96, width: 96 },
  recipeCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  recipeTitle: { ...typography.heading3, color: colors.text, fontSize: 17, lineHeight: 23 },
  recipeSummary: { ...typography.body, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  metaDot: { backgroundColor: colors.border, borderRadius: radii.pill, height: 4, width: 4 },
  metaText: { ...typography.label, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  emptyState: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  safetyStrip: {
    ...radii.card,
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  safetyText: { ...typography.body, color: colors.text, flex: 1, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.74 }
});
