import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { ArrowLeft, CalendarDays, CheckCircle2, Info } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listArticles } from "@/api/articles";
import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import {
  TIMELINE_TOTAL_WEEKS,
  getActiveTimelineBands,
  getTimelineMilestonesForWeek,
  pregnancyTimelineBands,
  pregnancyTimelineMilestones
} from "@/features/pregnancy/timeline";
import { getPregnancyWeek } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

const WEEK_CELL_WIDTH = 68;
const TIMELINE_WIDTH = TIMELINE_TOTAL_WEEKS * WEEK_CELL_WIDTH;

export default function PregnancyTimelineScreen() {
  const accentColor = useAppTheme();
  const weekScroller = useRef<ScrollView>(null);
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const articlesQuery = useQuery({
    queryKey: ["articles", "timeline"],
    queryFn: listArticles
  });

  const profile = profileQuery.data;
  const currentWeek = getPregnancyWeek(profile?.due_date) ?? 1;
  const appTheme = accentColor.theme;
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

  useEffect(() => {
    setSelectedWeek(currentWeek);
    const x = Math.max(0, (currentWeek - 2) * WEEK_CELL_WIDTH);
    setTimeout(() => weekScroller.current?.scrollTo({ x, animated: true }), 250);
  }, [currentWeek]);

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
        <BackButton />

        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: appTheme.accentSoft }]}>
            <CalendarDays color={appTheme.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>Hamilelik çizelgesi</Text>
          <Text style={typography.heading1}>Hafta hafta yol haritası</Text>
          <Text style={styles.heroText}>
            Güncel haftana odaklanan, soldan sağa ilerleyen gelişim ve takip
            çizelgesi. Bilgiler genel rehberdir; kişisel takip planın doktorunla
            netleşmelidir.
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Hafta seç</Text>
                <Text style={typography.body}>
                  Şu an hesaplanan hafta: {currentWeek}. hafta
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedWeek(currentWeek)}
                style={[styles.currentWeekButton, { borderColor: appTheme.primary }]}
              >
                <Text style={[styles.currentWeekText, { color: appTheme.primary }]}>
                  Bugünkü hafta
                </Text>
              </Pressable>
            </View>

            <ScrollView
              ref={weekScroller}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekRail}
            >
              {weeks.map((week) => {
                const selected = week === selectedWeek;
                const current = week === currentWeek;
                const hasMilestone = pregnancyTimelineMilestones.some(
                  (item) => item.week === week
                );
                const hasArticle = articles.some((article) =>
                  isArticleVisibleForWeek(
                    article.timelineStartWeek,
                    article.timelineEndWeek,
                    week
                  )
                );

                return (
                  <Pressable
                    key={week}
                    accessibilityRole="button"
                    onPress={() => setSelectedWeek(week)}
                    style={[
                      styles.weekNode,
                      selected && {
                        backgroundColor: appTheme.primary,
                        borderColor: appTheme.primary
                      },
                      current && !selected && { borderColor: appTheme.accent }
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekNumber,
                        selected && styles.weekNumberSelected
                      ]}
                    >
                      {week}
                    </Text>
                    <Text
                      style={[
                        styles.weekLabel,
                        selected && styles.weekNumberSelected
                      ]}
                    >
                      hafta
                    </Text>
                    {hasMilestone || hasArticle ? (
                      <View
                        style={[
                          styles.milestoneDot,
                          {
                            backgroundColor: selected
                              ? colors.surfaceStrong
                              : hasArticle
                                ? appTheme.primary
                                : appTheme.accent
                          }
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Card>

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
              <Info color={appTheme.primary} size={28} />
            </View>

            {weekInfo ? (
              <View style={styles.statRow}>
                <MiniStat label="Boy" value={weekInfo.lengthCm} />
                <MiniStat label="Kilo" value={weekInfo.weightG} />
              </View>
            ) : null}

            {selectedMilestones.map((item) => (
              <View key={`${item.week}-${item.title}`} style={styles.milestoneCard}>
                <Text style={styles.milestoneType}>{typeLabel(item.type)}</Text>
                <Text style={styles.milestoneTitle}>{item.title}</Text>
                <Text style={styles.milestoneBody}>{item.body}</Text>
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
              <Text style={typography.body}>Makaleler yükleniyor.</Text>
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
                      <Text style={typography.body}>{article.excerpt}</Text>
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
                      <Text style={typography.body}>{band.note}</Text>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function BackButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.back()}>
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
    ...radii.cardLarge,
    gap: spacing.sm,
    padding: spacing.lg
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  currentWeekButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  currentWeekText: {
    ...typography.label
  },
  weekRail: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  weekNode: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    gap: 1,
    minHeight: 74,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 58
  },
  weekNumber: {
    ...typography.dataStrong,
    color: colors.text,
    fontSize: 22,
    lineHeight: 27
  },
  weekNumberSelected: {
    color: colors.surfaceStrong
  },
  weekLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18
  },
  milestoneDot: {
    borderRadius: radii.pill,
    height: 7,
    marginTop: spacing.xs,
    width: 7
  },
  selectedCard: {
    borderWidth: 1
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  miniStat: {
    ...radii.card,
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  miniStatLabel: {
    ...typography.label,
    color: colors.textMuted
  },
  miniStatValue: {
    ...typography.label,
    color: colors.text
  },
  milestoneCard: {
    ...radii.card,
    backgroundColor: colors.surfaceMuted,
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
    backgroundColor: colors.surfaceMuted,
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
    color: colors.surfaceStrong
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
    color: colors.surfaceStrong,
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
