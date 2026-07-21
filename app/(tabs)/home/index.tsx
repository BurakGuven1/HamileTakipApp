import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import {
  Activity,
  Baby,
  BookOpen,
  BookOpenCheck,
  CalendarHeart,
  ChevronRight,
  Clock3,
  Droplets,
  FileSearch,
  HandHeart,
  HeartPulse,
  Images,
  Music2,
  Milk,
  Moon,
  Salad,
  Ruler,
  Sparkles,
  Syringe,
  Wrench
} from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import { listBabies } from "@/api/babies";
import { getCareHandoverSnapshot, getCurrentCareUserId, listCareJournalEntries, subscribeToCareCoordination, takeOverBabyCare, type CareJournalEntry } from "@/api/careJournal";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { getFeaturedArticles } from "@/api/articles";
import { getCurrentProfile } from "@/api/profiles";
import {
  listVaccinationsForBaby,
  type BabyVaccinationWithSchedule
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { Thread } from "@/components/Thread";
import { syncCareQuickWidget } from "@/features/care-journal/widgetSync";
import type { Article } from "@/features/articles/articles";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import {
  formatDate,
  getBabyAgeLabel,
  getPregnancyProgress,
  getRelativeDayLabel
} from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

let homeWelcomeToastShown = false;

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo } = useFeedback();
  const [showDaysUntilDue, setShowDaysUntilDue] = useState(false);
  const reducedMotion = useReducedMotion();
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const membershipQuery = useQuery({ queryKey: ["current-family-membership"], queryFn: getCurrentFamilyMembership });
  const currentUserQuery = useQuery({ queryKey: ["current-care-user-id"], queryFn: getCurrentCareUserId });

  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const babies = babiesQuery.data ?? [];
  const firstBaby = babies[0];
  const careHandoverQuery = useQuery({
    queryKey: ["care-handover", firstBaby?.id],
    queryFn: () => getCareHandoverSnapshot(firstBaby?.id as string),
    enabled: Boolean(firstBaby?.id),
    refetchInterval: 30_000
  });
  const careJournalWidgetQuery = useQuery({
    queryKey: ["care-journal-home", firstBaby?.id],
    queryFn: () => listCareJournalEntries(firstBaby?.id as string, 300),
    enabled: Boolean(firstBaby?.id)
  });

  const vaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", firstBaby?.id],
    queryFn: () => listVaccinationsForBaby(firstBaby?.id as string),
    enabled: Boolean(firstBaby?.id)
  });

  const profile = profileQuery.data;
  const accentColor = useAppTheme();
  const appTheme = accentColor.theme;
  const pregnancyProgress = getPregnancyProgress(profile?.due_date);
  const week = pregnancyProgress?.week
    ? Math.min(40, pregnancyProgress.week)
    : null;
  const weekInfo = getPregnancyWeekInfo(week);
  const featuredArticlesQuery = useQuery({
    queryKey: ["articles", "featured"],
    queryFn: () => getFeaturedArticles(4)
  });
  const featuredArticles = featuredArticlesQuery.data ?? [];
  const vaccinations: BabyVaccinationWithSchedule[] = vaccinationsQuery.data ?? [];
  const nextVaccination = vaccinations.find((item) => !item.completed);
  const completedVaccines = vaccinations.filter((item) => item.completed).length;
  const babyAge = firstBaby ? getBabyAgeLabel(firstBaby.birth_date) : null;
  const displayName =
    profile?.mother_name ||
    profile?.display_name ||
    profile?.forum_nickname ||
    firstBaby?.name ||
    "Anne";
  const careGiverName = membershipQuery.data
    ? profile?.father_name || "Baba"
    : profile?.mother_name || profile?.display_name || "Anne";
  const handoverMutation = useMutation({
    mutationFn: async () => {
      if (!firstBaby) throw new Error("Bebek profili bulunamadı.");
      return takeOverBabyCare(firstBaby.id, careGiverName);
    },
    onSuccess: async (result) => {
      showInfo(result.queued ? "Bağlantı gelince aileyle eşitlenecek." : "Bakım sende. Aile özeti güncellendi.", "Bakım devralındı");
      await queryClient.invalidateQueries({ queryKey: ["care-handover", firstBaby?.id] });
    },
    onError: (error) => showError(error, "Bakım devralınamadı")
  });
  useEffect(() => {
    if (!firstBaby?.id) return;
    return subscribeToCareCoordination(firstBaby.id, () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["care-handover", firstBaby.id] }),
        queryClient.invalidateQueries({ queryKey: ["care-journal-home", firstBaby.id] })
      ]).catch(() => undefined);
    });
  }, [firstBaby?.id, queryClient]);
  useEffect(() => {
    if (firstBaby && careJournalWidgetQuery.isSuccess) {
      syncCareQuickWidget(
        firstBaby.id,
        firstBaby.name,
        careJournalWidgetQuery.data ?? []
      ).catch(() => undefined);
      return;
    }
    if (!firstBaby && profile?.is_pregnant) {
      syncCareQuickWidget(null, displayName || "Anne", []).catch(
        () => undefined
      );
    }
  }, [
    careJournalWidgetQuery.data,
    careJournalWidgetQuery.isSuccess,
    firstBaby?.id,
    firstBaby?.name,
    profile?.is_pregnant,
    displayName
  ]);
  const heroTitle =
    profile?.is_pregnant && week
      ? `${week}. hafta`
      : firstBaby && babyAge
        ? `${firstBaby.name}, ${babyAge}`
        : "Deneyimini kişiselleştir";
  const heroBody =
    profile?.is_pregnant && week
      ? `Tahmini doğum: ${formatDate(profile.due_date)}`
      : firstBaby && babyAge
        ? `Doğum: ${formatDate(firstBaby.birth_date)}`
        : "Gebelik veya bebek bilgisi eklediğinde ana sayfa sana göre hazırlanır.";

  useEffect(() => {
    if (homeWelcomeToastShown || !profile) {
      return;
    }

    const timer = setTimeout(() => {
      let message =
        profile.is_pregnant && weekInfo
          ? `Hoş geldin anneciğim, bugün biraz daha büyüdüm. Şu an ${weekInfo.emoji} ${weekInfo.size}.`
          : firstBaby
            ? `Hoş geldin anneciğim, bugün de ${firstBaby.name} için güzel bir an biriktirelim.`
            : "Hoş geldin anneciğim, bugün birlikte minik bir adım atalım.";

      if (profile.is_pregnant && weekInfo) {
        message = getPregnancySizeNotification(weekInfo.size);
      }

      showInfo(message, "Benden minik bir not");
      homeWelcomeToastShown = true;
    }, 650);

    return () => clearTimeout(timer);
  }, [firstBaby, profile, showInfo, weekInfo]);

  useEffect(() => {
    if (!profile?.is_pregnant || !pregnancyProgress || reducedMotion) {
      setShowDaysUntilDue(false);
      return;
    }

    const interval = setInterval(() => {
      setShowDaysUntilDue((current) => !current);
    }, 4_000);

    return () => clearInterval(interval);
  }, [pregnancyProgress, profile?.is_pregnant, reducedMotion]);

  if (profileQuery.isLoading || babiesQuery.isLoading || membershipQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Ana sayfan hazırlanıyor…" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError || membershipQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Profil ve bebek bilgileri alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() => void Promise.all([profileQuery.refetch(), babiesQuery.refetch(), membershipQuery.refetch()])}
          retrying={profileQuery.isFetching || babiesQuery.isFetching || membershipQuery.isFetching}
          title="Ana sayfa yüklenemedi"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {!profile?.is_pregnant ? (
          <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
            <View style={[styles.visualStage, { backgroundColor: appTheme.accentSoft }]}>
              <View style={styles.visualThread}>
                <Thread height={126} mutedColor={appTheme.accent} progress={0.84} variant="decorative" />
              </View>
              <View style={styles.sizeVisual}>
                <View
                  style={[
                    styles.sizeEmojiOrb,
                    { backgroundColor: appTheme.primarySoft }
                  ]}
                >
                  {firstBaby ? (
                    <Baby color={appTheme.primary} size={34} />
                  ) : (
                    <Sparkles color={appTheme.primary} size={34} />
                  )}
                </View>
                <View style={styles.sizeVisualCopy}>
                  <Text style={[styles.sizeVisualEyebrow, { color: appTheme.primary }]}>Bugün</Text>
                  <Text style={styles.sizeVisualTitle}>
                    {firstBaby ? `${firstBaby.name} ile takip` : "Kişisel takip alanın"}
                  </Text>
                </View>
              </View>
              <View style={styles.visualFooter}>
                <View>
                  <Text style={styles.heroTitle}>{heroTitle}</Text>
                  <Text style={styles.heroText}>{heroBody}</Text>
                </View>
                <Link href="/articles" asChild>
                  <Pressable accessibilityRole="button" style={styles.openArticlesButton}>
                    <Text style={styles.openArticlesText}>Aç</Text>
                    <ChevronRight color={colors.text} size={18} />
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        ) : null}

        {profile?.is_pregnant && weekInfo && week ? (
          <Card style={[styles.weekCard, { borderColor: appTheme.primary }]}>
            <View style={{ gap: spacing.lg }}>
              <View style={styles.weekNavigator}>
                <View style={styles.weekNavigatorCopy}>
                  <Text style={[styles.weekNavigatorGreeting, { color: appTheme.primary }]}>
                    İyi günler, {displayName}
                  </Text>
                  <Text style={styles.weekNavigatorTitle}>
                    {week}. hafta / 40
                  </Text>
                  <Text style={styles.weekNavigatorText}>
                    Güncel hamilelik özetin
                  </Text>
                </View>
              </View>

              {pregnancyProgress ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[styles.pregnancyStatusBox, { backgroundColor: appTheme.primarySoft }]}
                >
                  <Animated.Text
                    key={showDaysUntilDue ? "days-until-due" : "pregnancy-day"}
                    entering={reducedMotion ? undefined : FadeIn.duration(260).easing(Easing.out(Easing.cubic))}
                    exiting={reducedMotion ? undefined : FadeOut.duration(180).easing(Easing.inOut(Easing.quad))}
                    style={styles.pregnancyStatusText}
                  >
                    {showDaysUntilDue
                      ? `${pregnancyProgress.daysUntilDue} gün kaldı`
                      : `${pregnancyProgress.day}. günlük hamile`}
                  </Animated.Text>
                </View>
              ) : null}

              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.eyebrow}>Bu hafta neler oluyor?</Text>
                  <View style={styles.sizeTitleRow}>
                    <Text style={styles.sizeEmoji}>{weekInfo.emoji}</Text>
                    <Text style={[typography.heading2, styles.sizeTitle]}>
                      Bebeğin yaklaşık {weekInfo.size}
                    </Text>
                  </View>
                </View>
                <Sparkles color={appTheme.primary} size={28} />
              </View>
              <View style={styles.weekStats}>
                <MiniStat
                  backgroundColor={colors.lengthTint}
                  label="Boy"
                  value={weekInfo.lengthCm}
                />
                <MiniStat
                  backgroundColor={colors.weightTint}
                  label="Kilo"
                  value={weekInfo.weightG}
                />
                <MiniStat
                  backgroundColor={accentColor.tint}
                  label="Hafta"
                  value={`${week}.`}
                />
              </View>
              <View style={[styles.developmentBox, { backgroundColor: appTheme.primarySoft }]}>
                <Text style={styles.developmentTitle}>
                  {weekInfo.milestone}
                </Text>
                <Text style={styles.developmentText}>{weekInfo.note}</Text>
              </View>
              <Link href="/pregnancy-timeline" asChild>
                <Button label="Hafta hafta yol haritasını aç" variant="secondary" />
              </Link>
            </View>
          </Card>
        ) : null}

        <View style={styles.shortcutsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCopy}>
              <Text style={typography.eyebrow}>Tek dokunuşla</Text>
              <Text style={typography.heading2}>Kısayollar</Text>
            </View>
            <View style={[styles.shortcutSpark, { backgroundColor: appTheme.accentSoft }]}>
              <Sparkles color={appTheme.accent} size={20} />
            </View>
          </View>
          <View style={styles.shortcutGrid}>
            {profile?.is_pregnant ? (
              <>
                <ShortcutCard href="/pregnancy-tools" icon={<Wrench color={appTheme.primary} size={26} />} title="Takip araçları" tint={appTheme.primarySoft} />
                <ShortcutCard href="/pregnancy-nutrition" icon={<Salad color={colors.sageGreen} size={26} />} title="Beslenme & su" tint={colors.primarySoft} />
                <ShortcutCard href="/pregnancy-exercise" icon={<Activity color={colors.dustyRose} size={26} />} title="Hareket" tint={colors.accentSoft} />
                <ShortcutCard href="/birth-preparation" icon={<BookOpenCheck color={colors.honeyGold} size={26} />} title="Doğuma hazırlık" tint={colors.highlightSoft} />
              </>
            ) : (
              <>
                <ShortcutCard href="/care-journal" icon={<CalendarHeart color={appTheme.primary} size={26} />} title="Bakım günlüğü" tint={appTheme.primarySoft} />
                <ShortcutCard href="/baby" icon={<Ruler color={colors.sageGreen} size={26} />} title="Büyüme & aşı" tint={colors.primarySoft} />
                <ShortcutCard href="/lullaby" icon={<Music2 color={colors.dustyRose} size={26} />} title="Ninniler" tint={colors.accentSoft} />
              </>
            )}
            <ShortcutCard href="/document-insight" icon={<FileSearch color={colors.honeyGold} size={26} />} title="Belgeyi Anla" tint={colors.highlightSoft} />
            <ShortcutCard href="/gallery" icon={<Images color={appTheme.accent} size={26} />} premium title="Anı galerisi" tint={appTheme.accentSoft} />
            {!membershipQuery.data ? (
              <ShortcutCard href="/forum" icon={<HeartPulse color={appTheme.primary} size={26} />} premium title="Anne forumu" tint={appTheme.primarySoft} />
            ) : null}
          </View>
        </View>

        {firstBaby && careHandoverQuery.isLoading ? (
          <QueryState compact loading description="Canlı aile bakımı yükleniyor…" />
        ) : firstBaby && careHandoverQuery.isError ? (
          <QueryState
            description="Canlı bakım özeti alınamadı."
            onRetry={() => void careHandoverQuery.refetch()}
            retrying={careHandoverQuery.isFetching}
          />
        ) : firstBaby ? (
          <Card style={[styles.toolsCard, { backgroundColor: appTheme.primarySoft }]}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.eyebrow}>Canlı aile vardiyası</Text>
                  <Text style={typography.heading2}>{firstBaby.name} için bakımı devral</Text>
                  <Text style={typography.body}>
                    {careHandoverQuery.data?.handover
                      ? `${careHandoverQuery.data.handover.caregiver_name} ${careHomeRelativeTimeValue(careHandoverQuery.data.handover.started_at)} bakımı devraldı.`
                      : "Şu anda atanmış bir bakıcı yok."}
                  </Text>
                </View>
                <HandHeart color={appTheme.primary} size={30} />
              </View>
              <View style={styles.latestCareList}>
                <HomeCareRow icon={<Milk color={colors.dustyRose} size={17} />} label="Beslenme" value={formatHomeFeed(careHandoverQuery.data?.last_feed ?? null)} />
                <HomeCareRow icon={<Droplets color={colors.sageGreen} size={17} />} label="Bez" value={careHandoverQuery.data?.last_diaper ? careHomeRelativeTime(careHandoverQuery.data.last_diaper) : "Kayıt yok"} />
                <HomeCareRow icon={<Moon color={colors.nightPlum} size={17} />} label="Uyku" value={careHandoverQuery.data?.active_timer?.timer_type === "sleep" ? `Şu anda uyuyor · ${careHomeRelativeTimeValue(careHandoverQuery.data.active_timer.started_at, false)}` : careHandoverQuery.data?.last_sleep?.ended_at ? `${careHomeRelativeTimeValue(careHandoverQuery.data.last_sleep.ended_at)} uyandı` : "Aktif uyku yok"} />
                <HomeCareRow icon={<Clock3 color={colors.highlight} size={17} />} label="Plan" value={`${careHandoverQuery.data?.active_reminder_count ?? 0} alarm · ${careHandoverQuery.data?.open_task_count ?? 0} görev`} />
              </View>
              {careHandoverQuery.data?.handover?.caregiver_id === currentUserQuery.data ? (
                <Button testID="open-care-summary" label="Bakım sende · özeti aç" onPress={() => router.push("/care-journal")} />
              ) : (
                <Button disabled={handoverMutation.isPending} label={handoverMutation.isPending ? "Devralınıyor..." : "Bakımı devraldım"} onPress={() => handoverMutation.mutate()} />
              )}
            </View>
          </Card>
        ) : null}

        {!profile?.is_pregnant && !firstBaby ? (
          <Card style={[styles.primaryCard, { backgroundColor: appTheme.primarySoft }]}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.cardHeader}>
                <View style={{ gap: spacing.xs, flex: 1 }}>
                  <Text style={typography.heading2}>Deneyimini kişiselleştir</Text>
                  <Text style={typography.body}>
                    Gebelik veya bebek bilgisi eklediğinde ana ekran sana özel
                    hatırlatmalar ve gelişim özeti gösterir.
                  </Text>
                </View>
                <Sparkles color={appTheme.primary} size={30} />
              </View>
              <Link href="/baby" asChild>
                <Button label="Bebek bilgisi ekle" variant="secondary" />
              </Link>
            </View>
          </Card>
        ) : null}

        <View style={styles.metricRow}>
          <MetricCard label="Bebek profili" value={`${babies.length}`} />
          <MetricCard
            label="Aşı tamamlama"
            value={
              vaccinationsQuery.isError
                ? "—"
                : vaccinations.length > 0
                ? `${completedVaccines}/${vaccinations.length}`
                : "0"
            }
          />
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ gap: spacing.xs, flex: 1 }}>
                <Text style={typography.heading2}>Sıradaki hatırlatıcı</Text>
                {vaccinationsQuery.isLoading ? (
                  <Text style={typography.body}>Aşı bilgileri yükleniyor…</Text>
                ) : vaccinationsQuery.isError ? (
                  <Text style={typography.body}>Aşı bilgileri şu anda alınamadı.</Text>
                ) : nextVaccination ? (
                  <Text style={typography.body}>
                    {nextVaccination.vaccine_schedule?.vaccine_name ?? "Aşı"} /{" "}
                    {getRelativeDayLabel(nextVaccination.scheduled_date)} /{" "}
                    {formatDate(nextVaccination.scheduled_date)}
                  </Text>
                ) : (
                  <Text style={typography.body}>
                    Şu an yaklaşan aşı yok. Yeni kayıt ekledikçe burada görünür.
                  </Text>
                )}
              </View>
              <Syringe color={appTheme.primary} size={28} />
            </View>
            <Link href="/baby" asChild>
              <Button label="Aşı takvimini aç" variant="secondary" />
            </Link>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={typography.heading2}>Makaleler</Text>
            <Text style={styles.sectionHint}>Hafta ve ay rehberleri</Text>
          </View>
          <Link href="/articles" asChild>
            <Pressable accessibilityRole="button" style={styles.sectionLink}>
              <Text style={[styles.sectionLinkText, { color: appTheme.primary }]}>
                Tümünü gör
              </Text>
              <ChevronRight color={appTheme.primary} size={18} />
            </Pressable>
          </Link>
        </View>

        {featuredArticlesQuery.isLoading ? (
          <QueryState compact loading description="Makaleler yükleniyor…" />
        ) : featuredArticlesQuery.isError ? (
          <QueryState
            compact
            description="Makaleler şu anda alınamadı."
            onRetry={() => void featuredArticlesQuery.refetch()}
            retrying={featuredArticlesQuery.isFetching}
          />
        ) : <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.articleRail}
        >
          {featuredArticles.map((article) => (
            <ArticlePreview key={article.slug} article={article} />
          ))}
        </ScrollView>}

      </View>
    </Screen>
  );
}

function HomeCareRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <View style={styles.latestCareRow}><View style={styles.homeCareLabelRow}>{icon}<Text style={styles.latestCareLabel}>{label}</Text></View><Text style={styles.latestCareValue}>{value}</Text></View>;
}

function formatHomeFeed(entry: CareJournalEntry | null) {
  if (!entry) return "Kayıt yok";
  if (entry.entry_type === "bottle") return `${entry.amount_ml ?? "—"} ml · ${careHomeRelativeTime(entry)}`;
  return `${entry.breast_side === "left" ? "Sol" : entry.breast_side === "right" ? "Sağ" : "İki taraf"} · ${careHomeRelativeTime(entry)}`;
}

function careHomeRelativeTimeValue(value: string, usePastSuffix = true) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  const suffix = usePastSuffix ? " önce" : "";
  if (minutes < 1) return usePastSuffix ? "şimdi" : "şimdi";
  if (minutes < 60) return `${minutes} dk${suffix}`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} sa${suffix}` : `${Math.floor(hours / 24)} gün${suffix}`;
}

function getPregnancySizeNotification(size: string) {
  if (!size.endsWith(" kadar")) {
    return "Bug\u00fcn hen\u00fcz haz\u0131rl\u0131k d\u00f6nemindeyim.";
  }

  const nounPhrase = size.replace(/\s+kadar$/u, "");
  const adjectiveMatch = nounPhrase.match(/^(b\u00fcy\u00fck|k\u00fc\u00e7\u00fck)\s+(.+)$/u);
  const naturalNounPhrase = adjectiveMatch
    ? `${adjectiveMatch[1]} bir ${adjectiveMatch[2]}`
    : `bir ${nounPhrase}`;

  return `Bug\u00fcn ${naturalNounPhrase} kadar\u0131m.`;
}

function careHomeRelativeTime(entry: CareJournalEntry) {
  return careHomeRelativeTimeValue(entry.occurred_at);
}

function MiniStat({
  backgroundColor,
  label,
  value
}: {
  backgroundColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.miniStat, { backgroundColor }]}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function ArticlePreview({ article }: { article: Article }) {
  return (
    <Link href={`/articles/${article.slug}`} asChild>
      <Pressable accessibilityRole="button" style={styles.articlePressable}>
        <View style={styles.articleCard}>
          {article.imageUrl ? (
            <Image
              accessibilityLabel={`${article.period} makale görseli`}
              contentFit="cover"
              source={{ uri: article.imageUrl }}
              style={styles.articleImage}
            />
          ) : (
            <View style={[styles.articleImage, { backgroundColor: article.accent }]}>
              <View style={styles.articleOrb} />
              <BookOpen color={colors.onPrimary} size={24} />
            </View>
          )}
          <View style={styles.articleCopy}>
            <Text style={styles.articlePeriod}>{article.period}</Text>
            <Text style={styles.articleTitle}>{article.title}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function ShortcutCard({
  href,
  icon,
  premium = false,
  title,
  tint
}: {
  href: "/baby" | "/birth-preparation" | "/care-journal" | "/document-insight" | "/forum" | "/gallery" | "/lullaby" | "/pregnancy-exercise" | "/pregnancy-nutrition" | "/pregnancy-tools";
  icon: ReactNode;
  premium?: boolean;
  title: string;
  tint: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={`${title}${premium ? ", Premium" : ""}`}
        accessibilityRole="button"
        style={({ pressed }) => [styles.shortcutPressable, pressed && styles.shortcutPressed]}
      >
        <View style={styles.shortcutCard}>
          <View style={[styles.shortcutVisual, { backgroundColor: tint }]}>
            <View style={styles.shortcutOrb}>{icon}</View>
            {premium ? (
              <View style={styles.premiumBadge}>
                <Sparkles color={colors.honeyGold} size={12} />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.shortcutCopy}>
            <Text numberOfLines={2} style={styles.shortcutTitle}>{title}</Text>
            <ChevronRight color={colors.textMuted} size={18} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  latestCareList: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md
  },
  latestCareRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 28
  },
  homeCareLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing.sm
  },
  latestCareLabel: {
    ...typography.label,
    color: colors.textMuted
  },
  latestCareValue: {
    ...typography.label,
    color: colors.text,
    flex: 1,
    marginLeft: spacing.sm,
    textAlign: "right"
  },
  container: {
    gap: spacing.lg
  },
  hero: {
    ...radii.cardLarge,
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  greeting: {
    ...typography.label,
    color: colors.textMuted
  },
  heroName: {
    ...typography.heading2,
    color: colors.text
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  visualStage: {
    ...radii.cardLarge,
    minHeight: 244,
    overflow: "hidden",
    padding: spacing.md
  },
  visualThread: {
    bottom: 48,
    left: -spacing.lg,
    opacity: 0.36,
    position: "absolute",
    right: -spacing.lg
  },
  sizeVisual: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 118,
    paddingTop: spacing.sm
  },
  sizeEmojiOrb: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 96,
    justifyContent: "center",
    width: 96
  },
  heroSizeEmoji: {
    fontSize: 54,
    lineHeight: 62
  },
  sizeVisualCopy: {
    flex: 1,
    gap: spacing.xs
  },
  sizeVisualEyebrow: {
    ...typography.eyebrow
  },
  sizeVisualTitle: {
    ...typography.heading2,
    color: colors.text
  },
  sizeVisualText: {
    ...typography.body,
    color: colors.textMuted
  },
  visualFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: "auto"
  },
  heroTitle: {
    ...typography.heading1,
    fontSize: 32,
    lineHeight: 38
  },
  heroText: {
    ...typography.body,
    color: colors.text,
    maxWidth: 230
  },
  openArticlesButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  openArticlesText: {
    ...typography.label,
    color: colors.text
  },
  pregnancyStatusBox: {
    ...radii.card,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  pregnancyStatusText: {
    ...typography.heading2,
    color: colors.text,
    position: "absolute",
    textAlign: "center"
  },
  weekCard: {
    borderWidth: 1
  },
  primaryCard: {
    backgroundColor: colors.surface
  },
  offerCard: {
    borderColor: colors.transparent
  },
  offerText: {
    ...typography.body,
    color: colors.text
  },
  toolsCard: {
    borderColor: colors.transparent
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  weekNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  weekNavButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  weekNavButtonDisabled: {
    opacity: 0.42
  },
  weekNavigatorCopy: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs
  },
  weekNavigatorGreeting: {
    ...typography.label,
    textAlign: "center"
  },
  weekNavigatorTitle: {
    ...typography.heading2,
    color: colors.text,
    textAlign: "center"
  },
  weekNavigatorText: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: "center"
  },
  sizeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  sizeEmoji: {
    fontSize: 34,
    lineHeight: 40
  },
  sizeTitle: {
    flex: 1
  },
  weekStats: {
    flexDirection: "row",
    gap: spacing.sm
  },
  miniStat: {
    ...radii.card,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  miniStatLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  miniStatValue: {
    ...typography.label,
    color: colors.text
  },
  developmentBox: {
    ...radii.card,
    gap: spacing.sm,
    padding: spacing.md
  },
  developmentTitle: {
    ...typography.heading3,
    color: colors.text
  },
  developmentText: {
    ...typography.body,
    color: colors.text
  },
  shareStorySurface: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing.xl,
    width: "100%"
  },
  shareStoryTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  shareBrand: {
    ...typography.heading2,
    color: colors.text
  },
  shareTag: {
    ...typography.label,
    color: colors.textMuted
  },
  shareWeekBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  shareWeekBadgeText: {
    ...typography.label
  },
  shareStoryBody: {
    alignItems: "center",
    gap: spacing.md
  },
  shareEmojiFrame: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 112,
    justifyContent: "center",
    width: 112
  },
  shareStoryEmoji: {
    fontSize: 62,
    lineHeight: 70
  },
  shareStoryHeadline: {
    ...typography.heading1,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center"
  },
  shareStorySubhead: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: "center"
  },
  shareStoryStats: {
    flexDirection: "row",
    gap: spacing.sm
  },
  shareStoryStat: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  shareStoryStatLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  shareStoryStatValue: {
    ...typography.label,
    color: colors.text
  },
  shareStoryAccent: {
    borderRadius: radii.pill,
    height: 4,
    width: "42%"
  },
  shareStoryMilestone: {
    ...typography.heading3,
    color: colors.text
  },
  shareStoryNote: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22
  },
  shareStoryFooter: {
    gap: spacing.xs
  },
  shareStoryFooterTitle: {
    ...typography.label,
    color: colors.text
  },
  shareStoryFooterText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  shareWeekButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  shareWeekButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitleCopy: {
    flex: 1,
    gap: 2
  },
  shortcutsSection: {
    gap: spacing.md
  },
  shortcutSpark: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  shortcutPressable: {
    flexBasis: "47%",
    flexGrow: 0,
    minWidth: 128
  },
  shortcutPressed: {
    opacity: 0.74
  },
  shortcutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 168,
    overflow: "hidden"
  },
  shortcutVisual: {
    flex: 1,
    justifyContent: "center",
    minHeight: 108,
    overflow: "hidden",
    padding: spacing.md
  },
  shortcutOrb: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  premiumBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.highlight,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm
  },
  premiumBadgeText: {
    ...typography.label,
    color: colors.highlight,
    fontSize: 12,
    lineHeight: 16
  },
  shortcutCopy: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  shortcutTitle: {
    ...typography.label,
    color: colors.text,
    flex: 1
  },
  sectionHint: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21
  },
  sectionLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  sectionLinkText: {
    ...typography.label
  },
  articleRail: {
    gap: spacing.md,
    paddingRight: spacing.lg
  },
  articlePressable: {
    width: 210
  },
  articleCard: {
    ...radii.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  articleImage: {
    height: 124,
    justifyContent: "flex-end",
    padding: spacing.md,
    width: "100%"
  },
  articleOrb: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: radii.pill,
    height: 84,
    position: "absolute",
    right: -22,
    top: -20,
    width: 84
  },
  articleCopy: {
    gap: spacing.xs,
    minHeight: 96,
    padding: spacing.md
  },
  articlePeriod: {
    ...typography.eyebrow,
    color: colors.accent
  },
  articleTitle: {
    ...typography.label,
    color: colors.text
  },
});
