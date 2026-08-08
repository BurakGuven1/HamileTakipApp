import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { ArrowLeft, Baby, CheckCircle2, Info, Ruler, Scale, Sparkles } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listArticles } from "@/api/articles";
import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import { VibrantBackdrop } from "@/components/VibrantBackdrop";
import { WeeklyBabyDevelopmentCard } from "@/components/WeeklyBabyDevelopmentCard";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import {
  TIMELINE_TOTAL_WEEKS,
  getActiveTimelineBands,
  getTimelineMilestonesForWeek,
  pregnancyTimelineBands
} from "@/features/pregnancy/timeline";
import { getPregnancyWeek } from "@/lib/dates";
import {
  colors,
  radii,
  spacing,
  typography,
  vibrantColors,
  vibrantTheme
} from "@/theme";

const WEEK_CELL_WIDTH = 68;
const TIMELINE_WIDTH = TIMELINE_TOTAL_WEEKS * WEEK_CELL_WIDTH;

export default function PregnancyTimelineScreen() {
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const articlesQuery = useQuery({
    queryKey: ["articles", "timeline"],
    queryFn: listArticles
  });

  const profile = profileQuery.data;
  const currentWeek = Math.max(2, Math.min(40, getPregnancyWeek(profile?.due_date) ?? 2));
  const appTheme = vibrantTheme;
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const weekInfo = getPregnancyWeekInfo(selectedWeek);
  const activeBands = getActiveTimelineBands(selectedWeek);
  const selectedMilestones = getTimelineMilestonesForWeek(selectedWeek);
  const articles = articlesQuery.data ?? [];
  const selectedArticles = articles.filter((article) =>
    isArticleVisibleForWeek(article.timelineStartWeek, article.timelineEndWeek, selectedWeek)
  );
  const weeks = useMemo(
    () => Array.from({ length: TIMELINE_TOTAL_WEEKS }, (_, index) => index + 1),
    []
  );

  if (profileQuery.isLoading) {
    return <Screen scroll={false}><QueryState loading description="Hamilelik çizelgesi hazırlanıyor…" /></Screen>;
  }

  if (profileQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Hamilelik profilin alınamadı."
          onRetry={() => void profileQuery.refetch()}
          retrying={profileQuery.isFetching}
        />
      </Screen>
    );
  }

  if (profile && !profile.is_pregnant) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <EmptyState
            title="Çizelge hamilelik profiline özel"
            description="Profilinde Hamileyim seçili olduğunda haftalık gelişim ve takip çizelgesi burada görünür."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <VibrantBackdrop />
        <BackButton />

        <Reveal>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Baby
                color={vibrantColors.secondary}
                fill={vibrantColors.secondarySoft}
                size={30}
                strokeWidth={2.5}
              />
            </View>
            <Text style={styles.heroEyebrow}>Bebek gelişimi</Text>
            <Text style={styles.heroTitle}>Her hafta yeni bir mucize</Text>
            <Text numberOfLines={2} style={styles.heroText}>
              Bebeğinin büyüklüğünü, gelişim notlarını ve haftana özel önerileri keşfet.
            </Text>
          </View>
        </Reveal>

        <Reveal delay={60}>
          <WeeklyBabyDevelopmentCard
            initialWeek={currentWeek}
            onWeekChange={setSelectedWeek}
          />
        </Reveal>

        <Card style={[styles.selectedCard, { borderColor: appTheme.primary }]}>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.eyebrow}>{selectedWeek}. hafta</Text>
                <Text style={typography.heading2}>
                  {weekInfo
                    ? `Bebek yaklaşık ${weekInfo.size}`
                    : "Bu hafta için genel takip"}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`${currentWeek}. hafta olan bugünkü haftaya dön`}
                accessibilityRole="button"
                onPress={() => setSelectedWeek(currentWeek)}
                style={styles.currentWeekButton}
              >
                <Sparkles color={vibrantColors.primary} size={16} strokeWidth={2.5} />
                <Text style={styles.currentWeekText}>Bugün</Text>
              </Pressable>
            </View>

            {weekInfo ? (
              <View style={styles.statRow}>
                <MiniStat
                  backgroundColor={vibrantColors.blueSoft}
                  icon={<Ruler color={vibrantColors.blue} size={20} strokeWidth={2.5} />}
                  label="Boy"
                  value={weekInfo.lengthCm}
                />
                <MiniStat
                  backgroundColor={vibrantColors.peachSoft}
                  icon={<Scale color={vibrantColors.peach} size={20} strokeWidth={2.5} />}
                  label="Kilo"
                  value={weekInfo.weightG}
                />
                <MiniStat
                  backgroundColor={vibrantColors.mintSoft}
                  icon={<Baby color={vibrantColors.mint} size={20} strokeWidth={2.5} />}
                  label="Hafta"
                  value={`${selectedWeek}.`}
                />
              </View>
            ) : null}

            {selectedMilestones.map((item) => (
              <View key={`${item.week}-${item.title}`} style={styles.milestoneCard}>
                <Text style={styles.milestoneType}>{typeLabel(item.type)}</Text>
                <Text style={styles.milestoneTitle}>{item.title}</Text>
                <ExpandableText
                  collapsedLines={2}
                  lessLabel="Gelişim notunu kapat"
                  moreLabel="Gelişim notunu aç"
                  style={styles.milestoneBody}
                  text={item.body}
                />
                <Text style={styles.sourceText}>Kaynak: {item.source}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Bu haftaya uygun makaleler</Text>
                <Text style={typography.body}>
                  Panelde seçtiğin hafta veya hafta aralığına göre burada görünür.
                </Text>
              </View>
              <Info color={appTheme.primary} size={26} />
            </View>

            {articlesQuery.isLoading ? (
              <QueryState compact loading description="Makaleler yükleniyor…" />
            ) : articlesQuery.isError ? (
              <QueryState
                compact
                description="Bu haftaya ait makaleler alınamadı."
                onRetry={() => void articlesQuery.refetch()}
                retrying={articlesQuery.isFetching}
              />
            ) : selectedArticles.length === 0 ? (
              <Text style={typography.body}>
                Bu hafta için zamanlanmış makale yok.
              </Text>
            ) : (
              selectedArticles.map((article) => (
                <Link key={article.slug} href={`/articles/${article.slug}`} asChild>
                  <Pressable accessibilityRole="button" style={styles.articleRow}>
                    {article.imageUrl ? (
                      <Image
                        accessibilityLabel={`${article.period} makale görseli`}
                        contentFit="cover"
                        source={{ uri: article.imageUrl }}
                        style={styles.articleImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.articleFallback,
                          { backgroundColor: article.accent }
                        ]}
                      >
                        <Text style={styles.articleFallbackText}>{article.period}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={styles.milestoneType}>
                        {article.timelineStartWeek === article.timelineEndWeek
                          ? `${article.timelineStartWeek}. hafta`
                          : `${article.timelineStartWeek ?? "?"}-${article.timelineEndWeek ?? "?"}. hafta`}
                      </Text>
                      <Text style={styles.milestoneTitle}>{article.title}</Text>
                      <Text numberOfLines={2} style={typography.body}>{article.excerpt}</Text>
                    </View>
                  </Pressable>
                </Link>
              ))
            )}
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Takviye ve takip bantları</Text>
                <Text style={typography.body}>
                  Dönemsel öneriler yatay çizelgede kapsadığı haftalara yayılır.
                </Text>
              </View>
              <CheckCircle2 color={appTheme.accent} size={28} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bandCanvas}>
                <View style={styles.bandWeekHeader}>
                  {weeks.map((week) => (
                    <Text key={week} style={styles.bandWeekLabel}>
                      {week}
                    </Text>
                  ))}
                </View>
                {pregnancyTimelineBands.map((band) => (
                  <View key={band.id} style={styles.bandRow}>
                    <View
                      style={[
                        styles.bandBar,
                        {
                          backgroundColor: band.color,
                          left: (band.startWeek - 1) * WEEK_CELL_WIDTH,
                          width: (band.endWeek - band.startWeek + 1) * WEEK_CELL_WIDTH
                        }
                      ]}
                    >
                      <Text style={styles.bandText}>{band.title}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ gap: spacing.sm }}>
              {activeBands.length === 0 ? (
                <Text style={typography.body}>
                  Bu haftaya özel aktif dönemsel bant yok.
                </Text>
              ) : (
                activeBands.map((band) => (
                  <View key={band.id} style={styles.activeBandCard}>
                    <View style={[styles.bandColorDot, { backgroundColor: band.color }]} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={styles.activeBandTitle}>{band.title}</Text>
                      <ExpandableText
                        collapsedLines={2}
                        lessLabel="Takip notunu kapat"
                        moreLabel="Takip notunu aç"
                        style={typography.body}
                        text={band.note}
                      />
                      <Text style={styles.sourceText}>Kaynak: {band.source}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function MiniStat({
  backgroundColor,
  icon,
  label,
  value
}: {
  backgroundColor: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.miniStat, { backgroundColor }]}>
      <View style={styles.miniStatIcon}>{icon}</View>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function BackButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
      <View style={styles.backRow}>
        <ArrowLeft color={colors.primary} size={20} />
        <Text style={styles.backText}>Geri dön</Text>
      </View>
    </Pressable>
  );
}

function typeLabel(type: "bebek" | "anne" | "kontrol" | "beslenme") {
  switch (type) {
    case "anne":
      return "Anne";
    case "kontrol":
      return "Kontrol";
    case "beslenme":
      return "Beslenme";
    default:
      return "Bebek";
  }
}

function isArticleVisibleForWeek(
  startWeek: number | null | undefined,
  endWeek: number | null | undefined,
  week: number
) {
  if (!startWeek || !endWeek) return false;
  return week >= startWeek && week <= endWeek;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    position: "relative"
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  backButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44
  },
  backText: {
    ...typography.label,
    color: colors.primary
  },
  hero: {
    ...radii.cardLarge,
    backgroundColor: vibrantColors.primaryLight,
    borderColor: vibrantColors.border,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.secondarySoft,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: vibrantColors.heading
  },
  heroTitle: {
    ...typography.heading1,
    color: vibrantColors.heading,
    fontSize: 30,
    lineHeight: 36
  },
  heroText: {
    ...typography.body,
    color: vibrantColors.body
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  currentWeekButton: {
    alignItems: "center",
    backgroundColor: vibrantColors.primaryLight,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  currentWeekText: {
    ...typography.label,
    color: vibrantColors.heading
  },
  selectedCard: {
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderWidth: 1
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  miniStat: {
    ...radii.card,
    alignItems: "flex-start",
    flex: 1,
    gap: 3,
    padding: spacing.sm
  },
  miniStatIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 34
  },
  miniStatLabel: {
    ...typography.label,
    color: colors.textMuted
  },
  miniStatValue: {
    ...typography.dataStrong,
    color: colors.text
  },
  milestoneCard: {
    ...radii.card,
    backgroundColor: vibrantColors.secondarySoft,
    borderLeftColor: vibrantColors.secondary,
    borderLeftWidth: 4,
    gap: spacing.xs,
    padding: spacing.md
  },
  milestoneType: {
    ...typography.eyebrow,
    color: colors.accent
  },
  milestoneTitle: {
    ...typography.heading3,
    color: colors.text
  },
  milestoneBody: {
    ...typography.body,
    color: colors.text
  },
  sourceText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  articleRow: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: vibrantColors.blueSoft,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  articleImage: {
    ...radii.card,
    height: 96,
    width: 82
  },
  articleFallback: {
    ...radii.card,
    height: 96,
    justifyContent: "flex-end",
    padding: spacing.sm,
    width: 82
  },
  articleFallbackText: {
    ...typography.label,
    color: colors.onPrimary
  },
  bandCanvas: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    width: TIMELINE_WIDTH
  },
  bandWeekHeader: {
    flexDirection: "row"
  },
  bandWeekLabel: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: "center",
    width: WEEK_CELL_WIDTH
  },
  bandRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 42,
    overflow: "hidden",
    position: "relative",
    width: TIMELINE_WIDTH
  },
  bandBar: {
    alignItems: "center",
    borderRadius: radii.pill,
    bottom: 5,
    justifyContent: "center",
    position: "absolute",
    top: 5
  },
  bandText: {
    ...typography.label,
    color: colors.onPrimary,
    textAlign: "center"
  },
  activeBandCard: {
    ...radii.card,
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  bandColorDot: {
    borderRadius: radii.pill,
    height: 16,
    marginTop: spacing.xs,
    width: 16
  },
  activeBandTitle: {
    ...typography.heading3,
    color: colors.text
  }
});
