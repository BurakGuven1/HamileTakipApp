import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Baby,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  HeartPulse,
  Info,
  NotebookPen,
  Ruler,
  Salad,
  Scale,
  Sparkles,
  Stethoscope
} from "lucide-react-native";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listArticles } from "@/api/articles";
import {
  listPregnancyDailyCounters,
  listPregnancyWeightRecords
} from "@/api/pregnancyTools";
import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import { VibrantBackdrop } from "@/components/VibrantBackdrop";
import { WeeklyBabyDevelopmentCard } from "@/components/WeeklyBabyDevelopmentCard";
import { trackEvent } from "@/lib/analytics";
import {
  getActiveTimelineBands,
  getPrenatalVisitGuidance,
  getTimelineMilestonesForWeek
} from "@/features/pregnancy/timeline";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import {
  formatDate,
  getPregnancyProgress,
  getPregnancyWeek,
  toDateOnly
} from "@/lib/dates";
import {
  colors,
  radii,
  spacing,
  typography,
  vibrantColors,
  vibrantGradients
} from "@/theme";

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
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const isPregnant = Boolean(profile?.is_pregnant);

  useEffect(() => {
    if (!isPregnant) return;
    void trackEvent("pregnancy_timeline_viewed", {
      pregnancy_week_bucket: Math.floor(currentWeek / 4) * 4
    });
  }, [currentWeek, isPregnant]);

  const weightQuery = useQuery({
    enabled: isPregnant,
    queryKey: ["pregnancy-weight-records"],
    queryFn: listPregnancyWeightRecords
  });
  const countersQuery = useQuery({
    enabled: isPregnant,
    queryKey: ["pregnancy-daily-counters", "timeline"],
    queryFn: () => listPregnancyDailyCounters(1)
  });

  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const weekInfo = getPregnancyWeekInfo(selectedWeek);
  const pregnancyProgress = getPregnancyProgress(profile?.due_date);
  const selectedMilestones = getTimelineMilestonesForWeek(selectedWeek);
  const visitGuidance = getPrenatalVisitGuidance(selectedWeek);
  const activeBands = getActiveTimelineBands(selectedWeek);
  const motherFocus = getMotherFocus(selectedWeek, selectedMilestones);
  const selectedArticles = useMemo(
    () =>
      (articlesQuery.data ?? []).filter((article) =>
        isArticleVisibleForWeek(
          article.timelineStartWeek,
          article.timelineEndWeek,
          selectedWeek
        )
      ),
    [articlesQuery.data, selectedWeek]
  );
  const latestWeight = weightQuery.data?.[0];
  const todayCounter = countersQuery.data?.find(
    (item) => item.counter_date === toDateOnly(new Date())
  );
  const weekProgress = Math.min(100, Math.max(0, (selectedWeek / 40) * 100));
  const isCurrentWeek = selectedWeek === currentWeek;

  if (profileQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Haftalık yol haritan hazırlanıyor…" />
      </Screen>
    );
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
            title="Yol haritası hamilelik profiline özel"
            description="Profilinde Hamileyim seçili olduğunda haftalık gelişim ve takip planın burada görünür."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <VibrantBackdrop />

        <View style={styles.topBar}>
          <BackButton />
          <View style={styles.screenTitleGroup}>
            <Text style={styles.screenEyebrow}>HAMİLELİK YOL HARİTAM</Text>
            <Text style={styles.screenTitle}>Bu hafta ne önemli?</Text>
          </View>
        </View>

        <Reveal>
          <WeeklyBabyDevelopmentCard
            initialWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
          />
        </Reveal>

        <Reveal delay={50}>
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={styles.progressIcon}>
                <Sparkles
                  color={vibrantColors.primary}
                  fill={vibrantColors.primaryLight}
                  size={22}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.flexCopy}>
                <Text style={styles.cardEyebrow}>
                  {isCurrentWeek ? "BUGÜNÜN NOKTASI" : "GÖRÜNTÜLENEN HAFTA"}
                </Text>
                <Text style={styles.cardTitle}>{selectedWeek}. hafta</Text>
              </View>
              {!isCurrentWeek ? (
                <Pressable
                  accessibilityLabel={`${currentWeek}. hafta olan bugüne dön`}
                  accessibilityRole="button"
                  onPress={() => setSelectedWeek(currentWeek)}
                  style={styles.todayButton}
                >
                  <Text style={styles.todayButtonText}>Bugüne dön</Text>
                </Pressable>
              ) : null}
            </View>

            <View
              accessibilityLabel={`Gebeliğin yüzde ${Math.round(weekProgress)} ilerledi`}
              accessibilityRole="progressbar"
              accessibilityValue={{ max: 100, min: 0, now: Math.round(weekProgress) }}
              style={styles.progressTrack}
            >
              <LinearGradient
                colors={vibrantGradients.primary}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={[styles.progressFill, { width: `${weekProgress}%` }]}
              />
            </View>

            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMeta}>{getTrimesterLabel(selectedWeek)}</Text>
              {isCurrentWeek && pregnancyProgress ? (
                <Text style={styles.progressMeta}>
                  Doğuma yaklaşık {pregnancyProgress.daysUntilDue} gün
                </Text>
              ) : (
                <Text style={styles.progressMeta}>40 haftalık yolculuk</Text>
              )}
            </View>

            {weekInfo ? (
              <View style={styles.statRow}>
                <MiniStat
                  backgroundColor={vibrantColors.blueSoft}
                  icon={<Ruler color={vibrantColors.blue} size={19} strokeWidth={2.6} />}
                  label="Boy"
                  value={weekInfo.lengthCm}
                />
                <MiniStat
                  backgroundColor={vibrantColors.peachSoft}
                  icon={<Scale color={vibrantColors.peach} size={19} strokeWidth={2.6} />}
                  label="Kilo"
                  value={weekInfo.weightG}
                />
                <MiniStat
                  backgroundColor={vibrantColors.mintSoft}
                  icon={<Baby color={vibrantColors.mint} size={19} strokeWidth={2.6} />}
                  label="Tahmini doğum"
                  value={profile?.due_date ? formatDate(profile.due_date) : "Belirtilmedi"}
                />
              </View>
            ) : null}
          </Card>
        </Reveal>

        <SectionHeading
          eyebrow="HAFTANIN ÖZETİ"
          title="Bebeğinde ve sende"
          description="Uzun metinler yerine bu haftanın iki temel odağı."
        />

        <View style={styles.focusGrid}>
          <FocusCard
            backgroundColor={vibrantColors.secondarySoft}
            icon={<Baby color={vibrantColors.secondary} fill={vibrantColors.secondarySoft} size={25} />}
            label="BEBEĞİNDE"
            title={weekInfo?.milestone ?? selectedMilestones[0]?.title ?? "Gelişim sürüyor"}
            body={weekInfo?.note ?? selectedMilestones[0]?.body ?? "Her hafta kendine özgü bir gelişim ritmi taşır."}
          />
          <FocusCard
            backgroundColor={vibrantColors.mintSoft}
            icon={<HeartPulse color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={25} />}
            label="SENDE"
            title={motherFocus.title}
            body={motherFocus.body}
          />
        </View>

        <Link href={{ pathname: "/doctor-visit", params: { subject: "pregnancy" } }} asChild>
          <Pressable accessibilityRole="button" style={styles.visitCard}>
            <View style={styles.visitIcon}>
              <CalendarCheck2
                color={vibrantColors.primary}
                fill={vibrantColors.primaryLight}
                size={28}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.flexCopy}>
              <View style={styles.visitTopLine}>
                <Text style={styles.visitPeriod}>{visitGuidance.period}</Text>
                <View
                  style={[
                    styles.visitStatus,
                    visitGuidance.status === "current" && styles.visitStatusCurrent
                  ]}
                >
                  <Text style={styles.visitStatusText}>
                    {visitGuidance.status === "current" ? "Şimdi" : "Planla"}
                  </Text>
                </View>
              </View>
              <Text style={styles.visitTitle}>{visitGuidance.title}</Text>
              <Text numberOfLines={2} style={styles.visitBody}>
                {visitGuidance.body}
              </Text>
              <Text numberOfLines={1} style={styles.sourceText}>{visitGuidance.source}</Text>
            </View>
            <ChevronRight color={vibrantColors.primary} size={22} />
          </Pressable>
        </Link>

        <SectionHeading
          eyebrow="TEK DOKUNUŞLA"
          title="Bugün ne lazım?"
          description="Kayıt, hazırlık ve günlük destek araçların burada."
        />

        <View style={styles.actionGrid}>
          <QuickAction
            backgroundColor={vibrantColors.secondarySoft}
            color={vibrantColors.secondary}
            href="/pregnancy-tools"
            icon={<Scale color={vibrantColors.secondary} size={24} strokeWidth={2.6} />}
            label="Kilo ve hareket"
          />
          <QuickAction
            backgroundColor={vibrantColors.primaryLight}
            color={vibrantColors.primary}
            href={{ pathname: "/doctor-visit", params: { subject: "pregnancy" } }}
            icon={<Stethoscope color={vibrantColors.primary} size={24} strokeWidth={2.6} />}
            label="Doktora hazırlan"
          />
          <QuickAction
            backgroundColor={vibrantColors.blueSoft}
            color={vibrantColors.blue}
            href="/pregnancy-nutrition"
            icon={<Salad color={vibrantColors.blue} size={24} strokeWidth={2.6} />}
            label="Beslenme"
          />
          <QuickAction
            backgroundColor={vibrantColors.mintSoft}
            color={vibrantColors.mint}
            href="/pregnancy-exercise"
            icon={<Dumbbell color={vibrantColors.mint} size={24} strokeWidth={2.6} />}
            label="Güvenli hareket"
          />
          <QuickAction
            backgroundColor={vibrantColors.peachSoft}
            color={vibrantColors.peach}
            href="/birth-preparation"
            icon={<NotebookPen color={vibrantColors.peach} size={24} strokeWidth={2.6} />}
            label="Doğuma hazırlık"
          />
          <QuickAction
            backgroundColor={vibrantColors.yellowSoft}
            color={colors.highlight}
            href="/pregnancy-tools"
            icon={<Activity color={colors.highlight} size={24} strokeWidth={2.6} />}
            label="Kasılma sayacı"
          />
        </View>

        <Card style={styles.todayRecordsCard}>
          <View style={styles.cardHeader}>
            <View style={styles.flexCopy}>
              <Text style={styles.cardEyebrow}>BUGÜNKÜ RİTMİN</Text>
              <Text style={styles.cardTitle}>Kayıtların bir bakışta</Text>
            </View>
            <Clock3 color={vibrantColors.secondary} size={25} strokeWidth={2.5} />
          </View>
          <View style={styles.recordRow}>
            <RecordItem
              label="Son kilo"
              value={latestWeight ? `${latestWeight.weight_kg} kg` : "Kayıt yok"}
            />
            <RecordItem
              label="Bugün hareket"
              value={todayCounter ? String(todayCounter.kick_count) : "—"}
            />
            <RecordItem
              label="Kasılma"
              value={todayCounter ? String(todayCounter.contraction_count) : "—"}
            />
          </View>
          <Link href="/pregnancy-tools" asChild>
            <Pressable accessibilityRole="button" style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Kayıtları aç veya yeni kayıt ekle</Text>
              <ChevronRight color={vibrantColors.primary} size={18} />
            </Pressable>
          </Link>
        </Card>

        <SectionHeading
          eyebrow="AKTİF TAKİPLER"
          title="Bu haftanın hatırlatmaları"
          description="Yalnızca seçtiğin haftada geçerli olan takip başlıkları."
        />

        <View style={styles.bandList}>
          {activeBands.length > 0 ? (
            activeBands.map((band) => (
              <View key={band.id} style={styles.bandCard}>
                <View style={[styles.bandIcon, { backgroundColor: band.tint }]}>
                  <CheckCircle2 color={band.color} size={23} strokeWidth={2.6} />
                </View>
                <View style={styles.flexCopy}>
                  <Text style={styles.bandTitle}>{band.title}</Text>
                  <Text numberOfLines={2} style={styles.bandBody}>{band.note}</Text>
                  <Text numberOfLines={1} style={styles.sourceText}>Kaynak: {band.source}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.calmCard}>
              <CheckCircle2 color={vibrantColors.mint} size={24} strokeWidth={2.5} />
              <Text style={styles.calmText}>
                Bu hafta için ek bir dönemsel hatırlatma yok. Kişisel planını doktorunla sürdür.
              </Text>
            </View>
          )}
        </View>

        <SectionHeading
          eyebrow="DAHA FAZLASINI KEŞFET"
          title={`${selectedWeek}. haftaya uygun okumalar`}
          description="İhtiyacın olduğunda açabileceğin kısa rehberler."
        />

        {articlesQuery.isLoading ? (
          <QueryState compact loading description="Haftanın içerikleri yükleniyor…" />
        ) : articlesQuery.isError ? (
          <QueryState
            compact
            description="Bu haftaya ait içerikler alınamadı."
            onRetry={() => void articlesQuery.refetch()}
            retrying={articlesQuery.isFetching}
          />
        ) : selectedArticles.length === 0 ? (
          <View style={styles.calmCard}>
            <Info color={vibrantColors.blue} size={24} />
            <Text style={styles.calmText}>Bu hafta için ayrıca zamanlanmış bir okuma yok.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.articleRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {selectedArticles.map((article) => {
              const imageSource = article.imageSource ??
                (article.imageUrl ? { uri: article.imageUrl } : null);

              return (
                <Link key={article.slug} href={`/articles/${article.slug}`} asChild>
                  <Pressable accessibilityRole="button" style={styles.articleCard}>
                    {imageSource ? (
                      <Image
                        accessibilityLabel={`${article.title} görseli`}
                        contentFit="cover"
                        source={imageSource}
                        style={styles.articleImage}
                      />
                    ) : (
                      <LinearGradient colors={vibrantGradients.hero} style={styles.articleImageFallback}>
                        <NotebookPen color={vibrantColors.primary} size={34} strokeWidth={2.3} />
                      </LinearGradient>
                    )}
                    <Text style={styles.articlePeriod}>{article.period}</Text>
                    <Text numberOfLines={2} style={styles.articleTitle}>{article.title}</Text>
                    <Text numberOfLines={2} style={styles.articleExcerpt}>{article.excerpt}</Text>
                  </Pressable>
                </Link>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerIcon}>
            <Info color={vibrantColors.primary} size={21} strokeWidth={2.5} />
          </View>
          <Text style={styles.disclaimerText}>
            Bu yol haritası genel bilgilendirme içindir; kişisel doktor planının ve tıbbi değerlendirmenin yerini tutmaz.
          </Text>
        </View>
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
      <Text numberOfLines={2} style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function FocusCard({
  backgroundColor,
  body,
  icon,
  label,
  title
}: {
  backgroundColor: string;
  body: string;
  icon: ReactNode;
  label: string;
  title: string;
}) {
  return (
    <View style={[styles.focusCard, { backgroundColor }]}>
      <View style={styles.focusIcon}>{icon}</View>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.focusTitle}>{title}</Text>
      <Text numberOfLines={3} style={styles.focusBody}>{body}</Text>
    </View>
  );
}

function QuickAction({
  backgroundColor,
  color,
  href,
  icon,
  label
}: {
  backgroundColor: string;
  color: string;
  href: ComponentProps<typeof Link>["href"];
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" style={[styles.quickAction, { backgroundColor }]}>
        <View style={styles.quickIcon}>{icon}</View>
        <Text style={[styles.quickLabel, { color }]}>{label}</Text>
        <ChevronRight color={color} size={18} />
      </Pressable>
    </Link>
  );
}

function RecordItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordItem}>
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

function SectionHeading({
  description,
  eyebrow,
  title
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
    </View>
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Geri dön"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={styles.backButton}
    >
      <ArrowLeft color={vibrantColors.primary} size={21} strokeWidth={2.6} />
    </Pressable>
  );
}

function getTrimesterLabel(week: number) {
  if (week <= 13) return "1. trimester";
  if (week <= 27) return "2. trimester";
  return "3. trimester";
}

function getMotherFocus(
  week: number,
  milestones: ReturnType<typeof getTimelineMilestonesForWeek>
) {
  const motherMilestone = milestones.find((item) => item.type === "anne");
  if (motherMilestone) {
    return { body: motherMilestone.body, title: motherMilestone.title };
  }

  if (week <= 13) {
    return {
      body: "Enerji, bulantı ve duygusal değişimlerini kısa notlarla takip et; kontrolde paylaş.",
      title: "Bedeninin yeni ritmini gözle"
    };
  }
  if (week <= 27) {
    return {
      body: "Uyku, hareket ve beslenme düzeninde sana iyi gelen küçük rutinleri görünür kıl.",
      title: "Günlük ritmini güçlendir"
    };
  }
  return {
    body: "Dinlenme ihtiyacını, hareket düzenini ve doğum hazırlığını haftalık olarak gözden geçir.",
    title: "Hazırlığını küçük adımlara böl"
  };
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
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  articleCard: {
    ...radii.card,
    backgroundColor: vibrantColors.surface,
    borderColor: vibrantColors.border,
    borderWidth: 1,
    gap: spacing.xs,
    overflow: "hidden",
    padding: spacing.sm,
    width: 236
  },
  articleExcerpt: {
    ...typography.body,
    color: vibrantColors.body,
    fontSize: 14,
    lineHeight: 20
  },
  articleImage: {
    borderRadius: radii.lg,
    height: 126,
    width: "100%"
  },
  articleImageFallback: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 126,
    justifyContent: "center",
    width: "100%"
  },
  articlePeriod: {
    ...typography.eyebrow,
    color: vibrantColors.secondary,
    marginTop: spacing.xs
  },
  articleRail: {
    gap: spacing.md,
    paddingRight: spacing.lg
  },
  articleTitle: {
    ...typography.heading3,
    color: vibrantColors.heading
  },
  backButton: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderColor: vibrantColors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  bandBody: {
    ...typography.body,
    color: vibrantColors.body,
    fontSize: 14,
    lineHeight: 20
  },
  bandCard: {
    ...radii.card,
    alignItems: "flex-start",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderColor: vibrantColors.border,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  bandIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  bandList: { gap: spacing.sm },
  bandTitle: {
    ...typography.heading3,
    color: vibrantColors.heading
  },
  calmCard: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: vibrantColors.mintSoft,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  calmText: {
    ...typography.body,
    color: vibrantColors.body,
    flex: 1
  },
  cardEyebrow: {
    ...typography.eyebrow,
    color: vibrantColors.primary
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  cardTitle: {
    ...typography.heading2,
    color: vibrantColors.heading
  },
  container: {
    gap: spacing.lg,
    position: "relative"
  },
  disclaimerCard: {
    ...radii.card,
    alignItems: "flex-start",
    backgroundColor: vibrantColors.primaryLight,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  disclaimerIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  disclaimerText: {
    ...typography.body,
    color: vibrantColors.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  flexCopy: { flex: 1, gap: 3 },
  focusBody: {
    ...typography.body,
    color: vibrantColors.body,
    fontSize: 14,
    lineHeight: 20
  },
  focusCard: {
    ...radii.card,
    flex: 1,
    gap: spacing.xs,
    minHeight: 204,
    padding: spacing.md
  },
  focusGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  focusIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 44
  },
  focusLabel: {
    ...typography.eyebrow,
    color: vibrantColors.heading
  },
  focusTitle: {
    ...typography.heading3,
    color: vibrantColors.heading,
    fontSize: 17,
    lineHeight: 22
  },
  inlineLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44
  },
  inlineLinkText: {
    ...typography.label,
    color: vibrantColors.primary
  },
  miniStat: {
    ...radii.card,
    flex: 1,
    gap: 3,
    minHeight: 116,
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
    color: vibrantColors.body,
    fontSize: 12,
    lineHeight: 17
  },
  miniStatValue: {
    ...typography.dataStrong,
    color: vibrantColors.heading,
    fontSize: 15,
    lineHeight: 20
  },
  progressCard: {
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderColor: vibrantColors.border,
    borderWidth: 1,
    gap: spacing.md
  },
  progressFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  progressIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.primaryLight,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  progressMeta: {
    ...typography.label,
    color: vibrantColors.body,
    fontSize: 13,
    lineHeight: 18
  },
  progressMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressTrack: {
    backgroundColor: vibrantColors.primaryLight,
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  quickAction: {
    ...radii.card,
    alignItems: "center",
    flexBasis: "47%",
    flexDirection: "row",
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.sm
  },
  quickIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  quickLabel: {
    ...typography.label,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  recordItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.xs
  },
  recordLabel: {
    ...typography.label,
    color: vibrantColors.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },
  recordRow: {
    backgroundColor: vibrantColors.secondarySoft,
    borderRadius: radii.lg,
    flexDirection: "row",
    paddingVertical: spacing.md
  },
  recordValue: {
    ...typography.dataStrong,
    color: vibrantColors.heading,
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center"
  },
  screenEyebrow: {
    ...typography.eyebrow,
    color: vibrantColors.secondary
  },
  screenTitle: {
    ...typography.heading1,
    color: vibrantColors.heading,
    fontSize: 27,
    lineHeight: 33
  },
  screenTitleGroup: { flex: 1, gap: 2 },
  sectionDescription: {
    ...typography.body,
    color: vibrantColors.body
  },
  sectionEyebrow: {
    ...typography.eyebrow,
    color: vibrantColors.secondary
  },
  sectionHeading: { gap: 3, marginTop: spacing.xs },
  sectionTitle: {
    ...typography.heading2,
    color: vibrantColors.heading
  },
  sourceText: {
    ...typography.label,
    color: vibrantColors.body,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.8
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  todayButton: {
    backgroundColor: vibrantColors.primaryLight,
    borderRadius: radii.pill,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  todayButtonText: {
    ...typography.label,
    color: vibrantColors.primary,
    fontSize: 12,
    lineHeight: 17
  },
  todayRecordsCard: {
    backgroundColor: vibrantColors.surfaceTranslucent,
    gap: spacing.md
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  visitBody: {
    ...typography.body,
    color: vibrantColors.body,
    fontSize: 14,
    lineHeight: 20
  },
  visitCard: {
    ...radii.cardLarge,
    alignItems: "center",
    backgroundColor: vibrantColors.primaryLight,
    borderColor: vibrantColors.primary,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  visitIcon: {
    alignItems: "center",
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  visitPeriod: {
    ...typography.eyebrow,
    color: vibrantColors.primary
  },
  visitStatus: {
    backgroundColor: vibrantColors.peachSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  visitStatusCurrent: { backgroundColor: vibrantColors.mintSoft },
  visitStatusText: {
    ...typography.label,
    color: vibrantColors.heading,
    fontSize: 11,
    lineHeight: 15
  },
  visitTitle: {
    ...typography.heading3,
    color: vibrantColors.heading
  },
  visitTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  }
});
