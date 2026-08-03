import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookOpen, ExternalLink, ShieldAlert } from "lucide-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { getArticleBySlug } from "@/api/articles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing, typography } from "@/theme";

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const articleQuery = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticleBySlug(slug),
    enabled: Boolean(slug)
  });
  const article = articleQuery.data;

  if (articleQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <View style={styles.backRow}>
              <ArrowLeft color={colors.primary} size={20} />
              <Text style={styles.backText}>Makalelere dön</Text>
            </View>
          </Pressable>
          <QueryState loading description="Yazı ve kapak görseli hazırlanıyor…" />
        </View>
      </Screen>
    );
  }

  if (articleQuery.isError) {
    return (
      <Screen>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <View style={styles.backRow}>
              <ArrowLeft color={colors.primary} size={20} />
              <Text style={styles.backText}>Makalelere dön</Text>
            </View>
          </Pressable>
          <QueryState
            description="Bu yazı şu anda alınamadı."
            onRetry={() => void articleQuery.refetch()}
            retrying={articleQuery.isFetching}
            title="Makale yüklenemedi"
          />
        </View>
      </Screen>
    );
  }

  if (!article) {
    return (
      <Screen>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <View style={styles.backRow}>
              <ArrowLeft color={colors.primary} size={20} />
              <Text style={styles.backText}>Makalelere dön</Text>
            </View>
          </Pressable>
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>Makale bulunamadı</Text>
              <Text style={typography.body}>
                Bu yazı kaldırılmış veya bağlantı değişmiş olabilir.
              </Text>
              <Button label="Makaleleri aç" onPress={() => router.replace("/articles")} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <View style={styles.backRow}>
            <ArrowLeft color={colors.primary} size={20} />
            <Text style={styles.backText}>Makalelere dön</Text>
          </View>
        </Pressable>

        <View style={styles.hero}>
          <ArticleHeroImage
            accent={article.accent}
            imageSource={article.imageSource}
            imageUrl={article.imageUrl}
            period={article.period}
          />
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.period}>{article.period}</Text>
            <Text style={typography.heading1}>{article.title}</Text>
            <Text style={styles.excerpt}>{article.excerpt}</Text>
          </View>
        </View>

        <Card>
          <View style={styles.body}>
            {article.body.map((paragraph, index) => {
              if (paragraph.startsWith("## ")) {
                return (
                  <Text key={`${index}-${paragraph}`} style={styles.bodyHeading}>
                    {paragraph.slice(3)}
                  </Text>
                );
              }

              if (paragraph.startsWith("! ")) {
                return (
                  <View key={`${index}-${paragraph}`} style={styles.safetyCallout}>
                    <ShieldAlert color={colors.danger} size={22} />
                    <Text style={styles.safetyText}>{paragraph.slice(2)}</Text>
                  </View>
                );
              }

              return (
                <Text key={`${index}-${paragraph}`} style={styles.paragraph}>
                  {paragraph}
                </Text>
              );
            })}
          </View>
        </Card>

        {article.sources?.length ? (
          <View style={styles.sources}>
            <Text style={typography.heading3}>Hazırlanırken yararlanılan rehberler</Text>
            <Text style={styles.sourcesIntro}>
              Sağlık kararların için kendi doktorunun ve takip ekibinin önerileri önceliklidir.
            </Text>
            {article.sources.map((source) => (
              <Pressable
                accessibilityHint="Resmî kaynağı tarayıcıda açar"
                accessibilityRole="link"
                key={source.url}
                onPress={() => void Linking.openURL(source.url)}
                style={({ pressed }) => [styles.sourceLink, pressed && styles.sourceLinkPressed]}
              >
                <Text style={styles.sourceLinkText}>{source.title}</Text>
                <ExternalLink color={colors.primary} size={18} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ArticleHeroImage({
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
        style={styles.heroImage}
      />
    );
  }

  return (
    <View style={[styles.heroFallback, { backgroundColor: accent }]}>
      <View style={styles.heroOrbLarge} />
      <View style={styles.heroOrbSmall} />
      <BookOpen color={colors.onPrimary} size={34} />
      <Text style={styles.heroFallbackText}>{period}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  backText: {
    ...typography.label,
    color: colors.primary
  },
  hero: {
    gap: spacing.lg
  },
  heroImage: {
    ...radii.cardLarge,
    height: 220,
    width: "100%"
  },
  heroFallback: {
    ...radii.cardLarge,
    gap: spacing.md,
    height: 220,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: spacing.lg,
    width: "100%"
  },
  heroOrbLarge: {
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: radii.pill,
    height: 150,
    position: "absolute",
    right: -34,
    top: -36,
    width: 150
  },
  heroOrbSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: radii.pill,
    bottom: 28,
    height: 72,
    position: "absolute",
    right: 34,
    width: 72
  },
  heroFallbackText: {
    ...typography.heading2,
    color: colors.onPrimary
  },
  period: {
    ...typography.eyebrow,
    color: colors.accent
  },
  excerpt: {
    ...typography.body,
    color: colors.text
  },
  body: {
    gap: spacing.md
  },
  bodyHeading: {
    ...typography.heading2,
    color: colors.text,
    marginTop: spacing.sm
  },
  paragraph: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 25
  },
  safetyCallout: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  safetyText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 23
  },
  sources: {
    gap: spacing.sm,
    paddingBottom: spacing.md
  },
  sourcesIntro: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  sourceLink: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  sourceLinkPressed: {
    opacity: 0.72
  },
  sourceLinkText: {
    ...typography.label,
    color: colors.primary,
    flex: 1
  }
});
