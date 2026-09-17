import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { BookOpen, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { filterArticlesForExperience, listArticles } from "@/api/articles";
import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { getExperienceStage } from "@/features/life-stage/lifeStage";
import { getPregnancyProgress } from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";

export default function ArticlesScreen() {
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });
  const articlesQuery = useQuery({
    queryKey: ["articles"],
    queryFn: listArticles
  });
  const experienceStage = getExperienceStage(
    profileQuery.data,
    Boolean(babiesQuery.data?.length)
  );
  const pregnancyWeek = getPregnancyProgress(
    profileQuery.data?.due_date
  )?.week;
  const sortedArticles = filterArticlesForExperience(
    articlesQuery.data ?? [],
    experienceStage,
    pregnancyWeek
  );
  const heroTitle =
    experienceStage === "pregnancy"
      ? "Gebelik haftana uygun rehberler"
      : experienceStage === "postpartum"
        ? "Bebek bakımı ve gelişim rehberleri"
        : "Sana uygun rehberleri birlikte seçelim";
  const heroBody =
    experienceStage === "pregnancy"
      ? "Haftana denk gelen gelişim ve günlük yaşam içerikleri burada sade bir akışta."
      : experienceStage === "postpartum"
        ? "Beslenme, bakım ve gelişim içerikleri bebeğinle başlayan akışta bir arada."
        : "Profilinden hamilelik veya doğum sonrası deneyimini seçtiğinde içerikler burada kişiselleşir.";

  if (profileQuery.isLoading || babiesQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Kişisel rehberlerin hazırlanıyor…" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Yaşam evren belirlenemediği için rehberler kişiselleştirilemedi."
          onRetry={() =>
            void Promise.all([profileQuery.refetch(), babiesQuery.refetch()])
          }
          retrying={profileQuery.isFetching || babiesQuery.isFetching}
          title="Rehberler hazırlanamadı"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <BookOpen color={colors.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>Anne+ rehberleri</Text>
          <Text style={typography.heading1}>{heroTitle}</Text>
          <Text style={styles.heroText}>{heroBody}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={typography.heading2}>Sana uygun yazılar</Text>
          <Sparkles color={colors.accent} size={22} />
        </View>

        <View style={styles.articleList}>
          {articlesQuery.isLoading ? (
            <QueryState compact loading description="Yayınlanmış yazılar hazırlanıyor…" />
          ) : articlesQuery.isError ? (
            <QueryState
              description="Makaleler şu anda alınamadı."
              onRetry={() => void articlesQuery.refetch()}
              retrying={articlesQuery.isFetching}
              title="Makaleler yüklenemedi"
            />
          ) : sortedArticles.length === 0 ? (
            <EmptyState
              title="Yeni rehberler hazırlanıyor"
              description={
                experienceStage === "general"
                  ? "Yaşam evreni seçtiğinde yalnızca o döneme uygun yayınlar burada görünecek."
                  : "Bu yaşam evresine uygun yeni yayınlar eklendiğinde burada görünecek."
              }
            />
          ) : (
            sortedArticles.map((article) => (
            <Link key={article.slug} href={`/articles/${article.slug}`} asChild>
              <Pressable accessibilityRole="button">
                <Card style={styles.articleCard}>
                  <View style={styles.articleRow}>
                    <ArticleCover
                      accent={article.accent}
                      imageSource={article.imageSource}
                      imageUrl={article.imageUrl}
                      period={article.period}
                    />
                    <View style={styles.articleCopy}>
                      <Text style={styles.period}>{article.period}</Text>
                      <Text style={styles.articleTitle}>{article.title}</Text>
                      <Text style={styles.articleExcerpt}>{article.excerpt}</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Link>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function ArticleCover({
  accent,
  imageSource,
  imageUrl,
  period
}: {
  accent: string;
  imageSource?: number;
  imageUrl?: string;
  period: string;
}) {
  if (imageSource || imageUrl) {
    return (
      <Image
        accessibilityLabel={`${period} makale görseli`}
        contentFit="cover"
        source={imageSource ?? { uri: imageUrl }}
        style={styles.coverImage}
      />
    );
  }

  return (
    <View style={[styles.coverFallback, { backgroundColor: accent }]}>
      <View style={styles.coverOrb} />
      <Text style={styles.coverText}>{period}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    ...radii.cardLarge,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
    padding: spacing.lg
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  articleList: {
    gap: spacing.md
  },
  articleCard: {
    padding: spacing.md
  },
  articleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  coverImage: {
    ...radii.card,
    height: 112,
    width: 96
  },
  coverFallback: {
    ...radii.card,
    height: 112,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: spacing.sm,
    width: 96
  },
  coverOrb: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: radii.pill,
    height: 70,
    position: "absolute",
    right: -18,
    top: -18,
    width: 70
  },
  coverText: {
    ...typography.label,
    color: colors.onPrimary
  },
  articleCopy: {
    flex: 1,
    gap: spacing.xs
  },
  period: {
    ...typography.eyebrow,
    color: colors.accent
  },
  articleTitle: {
    ...typography.heading3,
    color: colors.text
  },
  articleExcerpt: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21
  }
});
