import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { BookOpen, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { listArticles } from "@/api/articles";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing, typography } from "@/theme";

export default function ArticlesScreen() {
  const articlesQuery = useQuery({
    queryKey: ["articles"],
    queryFn: listArticles
  });
  const sortedArticles = articlesQuery.data ?? [];

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <BookOpen color={colors.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>Makaleler</Text>
          <Text style={typography.heading1}>Hafta hafta okunacak rehberler</Text>
          <Text style={styles.heroText}>
            Gebelik haftaları, ay rehberleri ve günlük ipuçları düzenli bir akışta.
            Sonradan ekleyeceğin görseller bu kapaklarda gösterilir.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={typography.heading2}>Tüm yazılar</Text>
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
              title="Henüz yayınlanmış makale yok"
              description="Supabase articles tablosunda is_published alanı açık olan yazılar burada görünür."
            />
          ) : (
            sortedArticles.map((article) => (
            <Link key={article.slug} href={`/articles/${article.slug}`} asChild>
              <Pressable accessibilityRole="button">
                <Card style={styles.articleCard}>
                  <View style={styles.articleRow}>
                    <ArticleCover
                      accent={article.accent}
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
  imageUrl,
  period
}: {
  accent: string;
  imageUrl?: string;
  period: string;
}) {
  if (imageUrl) {
    return (
      <Image
        accessibilityLabel={`${period} makale görseli`}
        contentFit="cover"
        source={{ uri: imageUrl }}
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
