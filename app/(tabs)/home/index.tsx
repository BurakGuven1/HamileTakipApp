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
import { useEffect, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

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
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PregnancyJourneyArtwork } from "@/components/PregnancyJourneyArtwork";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
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
const motherBabyIllustration = require("../../../assets/illustrations/mother-baby-connection.jpg");

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo } = useFeedback();
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

  if (profileQuery.isLoading || babiesQuery.isLoading || membershipQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Aile ipliğin hazırlanıyor…" shape="home" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError || membershipQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Profil ve bebek bilgileri alınamadı. Bağlantını kontrol et ve yeniden dene."
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
          <Reveal>
            <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
              <View style={[styles.visualStage, { backgroundColor: appTheme.accentSoft }]}>
                {firstBaby ? (
                  <View style={styles.familyVisual}>
                    <Image
                      accessibilityLabel="Bebeğini sevgiyle kucağında tutan anne illüstrasyonu"
                      accessibilityRole="image"
                      accessible
                      contentFit="cover"
                      source={motherBabyIllustration}
                      style={styles.familyHeroImage}
                      transition={reducedMotion ? 0 : 220}
                    />
                    <View style={styles.familyStoryBadge}>
                      <HandHeart color={appTheme.primary} size={17} strokeWidth={2.3} />
                      <Text style={styles.familyStoryBadgeText}>Birlikte büyüyen anlar</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.visualThread}>
                      <Thread
                        accessibilityLabel="İlk aile düğümünü eklemek için açık ilmek"
                        color={appTheme.primary}
                        height={126}
                        markers={[{ kind: "loop", position: 0.18 }]}
                        mutedColor={appTheme.accentSoft}
                        progress={0.19}
                        semantic="timeline"
                        variant="progress"
                      />
                    </View>
                    <View style={styles.sizeVisual}>
                      <View
                        style={[
                          styles.sizeEmojiOrb,
                          { backgroundColor: appTheme.primarySoft }
                        ]}
                      >
                        <Sparkles color={appTheme.primary} size={34} />
                      </View>
                      <View style={styles.sizeVisualCopy}>
                        <Text style={[styles.sizeVisualEyebrow, { color: appTheme.primary }]}>Bugün</Text>
                        <Text style={styles.sizeVisualTitle}>Kişisel takip alanın</Text>
                      </View>
                    </View>
                  </>
                )}
                <View style={styles.visualFooter}>
                  <View style={styles.heroFooterCopy}>
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
          </Reveal>
        ) : null}

        {profile?.is_pregnant && weekInfo && week ? (
          <Reveal>
            <Card style={[styles.weekCard, { borderColor: appTheme.primary }]}>
              <View style={{ gap: spacing.lg }}>
                <View style={styles.weekTopRow}>
                  <View style={styles.weekTopCopy}>
                  <Text style={[styles.weekNavigatorGreeting, { color: appTheme.primary }]}>
                    İyi günler, {displayName}
                  </Text>
                    <Text style={styles.weekNavigatorTitle}>{week}. hafta</Text>
                  </View>
                  <View style={[styles.weekBadge, { backgroundColor: appTheme.primarySoft }]}>
                    <Text style={[styles.weekBadgeValue, { color: appTheme.primary }]}>{week}</Text>
                    <Text style={styles.weekBadgeLabel}>/ 40</Text>
                  </View>
                </View>

                {pregnancyProgress ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={[styles.livingThreadStage, { backgroundColor: appTheme.primarySoft }]}
                  >
                    <View style={styles.livingThreadHeading}>
                      <View style={styles.livingThreadCopy}>
                        <Text style={[styles.livingThreadEyebrow, { color: appTheme.primary }]}>
                          Yaşayan İplik
                        </Text>
                        <Text style={styles.livingThreadTitle}>
                          {week}. hafta düğümü
                        </Text>
                      </View>
                      <Text style={[styles.livingThreadValue, { color: appTheme.primary }]}>
                        %{Math.round((week / 40) * 100)}
                      </Text>
                    </View>
                    <Thread
                      accessibilityLabel={`Gebelik ipliği, 40 haftanın ${week} haftası tamamlandı`}
                      color={appTheme.primary}
                      height={72}
                      markers={[
                        { kind: "knot", position: week / 40 },
                        { kind: "loop", position: Math.min(0.98, (week + 4) / 40) }
                      ]}
                      mutedColor={colors.border}
                      progress={week / 40}
                      variant="progress"
                    />
                    <View style={styles.livingThreadFooter}>
                      <Text style={styles.livingThreadMeta}>
                        {pregnancyProgress.day}. gün
                      </Text>
                      <Text style={styles.livingThreadMeta}>
                        Doğuma {pregnancyProgress.daysUntilDue} gün
                      </Text>
                    </View>
                  </View>
                ) : null}

                <PregnancyJourneyArtwork week={week} />

                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={typography.eyebrow}>Bu hafta</Text>
                    <View style={styles.sizeTitleRow}>
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
                  <View style={styles.developmentHeading}>
                    <View style={[styles.developmentIcon, { backgroundColor: colors.surfaceStrong }]}>
                      <BookOpen color={appTheme.primary} size={18} strokeWidth={2.2} />
                    </View>
                    <View style={styles.developmentHeadingCopy}>
                      <Text style={[styles.developmentEyebrow, { color: appTheme.primary }]}>
                        Haftanın notu
                      </Text>
                      <Text style={styles.developmentTitle}>{weekInfo.milestone}</Text>
                    </View>
                  </View>
                  <Text style={styles.developmentText}>{weekInfo.note}</Text>
                </View>
                <Link href="/pregnancy-timeline" asChild>
                  <Button label="Hafta hafta yol haritasını aç" variant="secondary" />
                </Link>
              </View>
            </Card>
          </Reveal>
        ) : null}

        <Reveal delay={90} style={styles.shortcutsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCopy}>
              <Text style={typography.eyebrow}>Tek dokunuşla</Text>
              <Text style={typography.heading2}>Kısayollar</Text>
              <Text style={styles.sectionHint}>En sık kullandıkların önde</Text>
            </View>
            <View style={[styles.shortcutSpark, { backgroundColor: appTheme.accentSoft }]}>
              <Sparkles color={appTheme.accent} size={20} />
            </View>
          </View>
          <View style={styles.shortcutGroups}>
            <View style={styles.shortcutGroup}>
              <Text style={styles.shortcutGroupTitle}>
                {profile?.is_pregnant ? "Gebelik takibi" : "Bebek bakımı"}
              </Text>
              <View style={styles.shortcutPanel}>
                {profile?.is_pregnant ? (
                  <>
                    <ShortcutCard
                      featured
                      href="/pregnancy-tools"
                      icon={<Wrench color={appTheme.primary} size={25} />}
                      subtitle="Tekmeler, su ve günlük ölçümler"
                      title="Takip araçları"
                      tint={appTheme.primarySoft}
                    />
                    <ShortcutCard
                      href="/pregnancy-nutrition"
                      icon={<Salad color={colors.sageGreen} size={23} />}
                      subtitle="Güvenli öneriler ve su takibi"
                      title="Beslenme & su"
                      tint={colors.primarySoft}
                    />
                    <ShortcutCard
                      href="/pregnancy-exercise"
                      icon={<Activity color={colors.dustyRose} size={23} />}
                      subtitle="Haftana uygun hareket önerileri"
                      title="Hareket"
                      tint={colors.accentSoft}
                    />
                    <ShortcutCard
                      href="/birth-preparation"
                      icon={<BookOpenCheck color={colors.honeyGold} size={23} />}
                      subtitle="Plan, çanta ve hazırlık adımları"
                      title="Doğuma hazırlık"
                      tint={colors.highlightSoft}
                    />
                  </>
                ) : (
                  <>
                    <ShortcutCard
                      featured
                      href="/care-journal"
                      icon={<CalendarHeart color={appTheme.primary} size={25} />}
                      subtitle="Uyku, beslenme ve bez takibi"
                      title="Bakım günlüğü"
                      tint={appTheme.primarySoft}
                    />
                    <ShortcutCard
                      href="/baby"
                      icon={<Ruler color={colors.sageGreen} size={23} />}
                      subtitle="Ölçümler ve yaklaşan aşılar"
                      title="Büyüme & aşı"
                      tint={colors.primarySoft}
                    />
                    <ShortcutCard
                      href="/lullaby"
                      icon={<Music2 color={colors.dustyRose} size={23} />}
                      subtitle="Sakinleştiren uyku sesleri"
                      title="Ninniler"
                      tint={colors.accentSoft}
                    />
                  </>
                )}
              </View>
            </View>

            <View style={styles.shortcutGroup}>
              <Text style={styles.shortcutGroupTitle}>Aile alanları</Text>
              <View style={styles.shortcutPanel}>
                <ShortcutCard
                  href="/document-insight"
                  icon={<FileSearch color={colors.honeyGold} size={23} />}
                  subtitle="Sağlık belgelerini sadeleştir"
                  title="Belgeyi Anla"
                  tint={colors.highlightSoft}
                />
                <ShortcutCard
                  href="/gallery"
                  icon={<Images color={appTheme.accent} size={23} />}
                  premium
                  subtitle="Özel anılarını güvenle sakla"
                  title="Anı galerisi"
                  tint={appTheme.accentSoft}
                />
                {!membershipQuery.data ? (
                  <ShortcutCard
                    href="/forum"
                    icon={<HeartPulse color={appTheme.primary} size={23} />}
                    premium
                    subtitle="Deneyimlerini toplulukla paylaş"
                    title="Anne forumu"
                    tint={appTheme.primarySoft}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Reveal>

        {firstBaby && careHandoverQuery.isLoading ? (
          <QueryState compact loading description="Bakım özeti hazırlanıyor…" shape="home" />
        ) : firstBaby && careHandoverQuery.isError ? (
          <QueryState
            description="Canlı bakım özeti alınamadı. Bağlantını kontrol et ve yeniden dene."
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
                <Button disabled={handoverMutation.isPending} label={handoverMutation.isPending ? "Devralınıyor…" : "Bakımı devraldım"} onPress={() => handoverMutation.mutate()} />
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
          <QueryState compact loading description="Haftana uygun rehberler hazırlanıyor…" shape="home" />
        ) : featuredArticlesQuery.isError ? (
          <QueryState
            compact
            description="Makaleler alınamadı. Bağlantını kontrol et ve yeniden dene."
            onRetry={() => void featuredArticlesQuery.refetch()}
            retrying={featuredArticlesQuery.isFetching}
          />
        ) : featuredArticles.length === 0 ? (
          <EmptyState
            actionLabel="Tüm rehberleri gör"
            description="Gebelik haftanı veya bebeğinin yaşını eklediğinde en uygun rehberler burada sıralanır."
            onActionPress={() => router.push("/articles")}
            title="İlk rehberini keşfet"
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
            <Text numberOfLines={2} style={styles.articleTitle}>{article.title}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function ShortcutCard({
  featured = false,
  href,
  icon,
  premium = false,
  subtitle,
  title,
  tint
}: {
  featured?: boolean;
  href: "/baby" | "/birth-preparation" | "/care-journal" | "/document-insight" | "/forum" | "/gallery" | "/lullaby" | "/pregnancy-exercise" | "/pregnancy-nutrition" | "/pregnancy-tools";
  icon: ReactNode;
  premium?: boolean;
  subtitle: string;
  title: string;
  tint: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={`${title}${premium ? ", Premium" : ""}`}
        accessibilityHint={subtitle}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.shortcutPressable,
          pressed && styles.shortcutPressed
        ]}
      >
        <View style={[styles.shortcutCard, featured && styles.shortcutFeaturedCard]}>
          <View style={[styles.shortcutIcon, { backgroundColor: tint }]}>
            {icon}
          </View>
          <View style={styles.shortcutCopy}>
            <View style={styles.shortcutTitleRow}>
              <Text style={styles.shortcutTitle}>
                {title}
              </Text>
              {premium ? (
                <View style={styles.premiumBadge}>
                  <Sparkles color={colors.honeyGold} size={11} strokeWidth={2.4} />
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.shortcutSubtitle}>
              {subtitle}
            </Text>
          </View>
          <View style={styles.shortcutChevron}>
            <ChevronRight color={colors.textMuted} size={20} strokeWidth={2.2} />
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
  familyVisual: {
    borderRadius: radii.lg,
    minHeight: 210,
    overflow: "hidden",
    position: "relative"
  },
  familyHeroImage: {
    height: 210,
    width: "100%"
  },
  familyStoryBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    bottom: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    left: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    position: "absolute"
  },
  familyStoryBadgeText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
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
  heroFooterCopy: {
    flex: 1,
    gap: spacing.xs
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
  livingThreadStage: {
    ...radii.card,
    gap: spacing.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  livingThreadHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  livingThreadCopy: {
    flex: 1,
    gap: 2
  },
  livingThreadEyebrow: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18
  },
  livingThreadTitle: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24
  },
  livingThreadValue: {
    ...typography.dataStrong,
    fontSize: 18,
    lineHeight: 24
  },
  livingThreadFooter: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  livingThreadMeta: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  weekCard: {
    borderWidth: 1
  },
  weekTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  weekTopCopy: {
    flex: 1,
    gap: spacing.xs
  },
  weekBadge: {
    alignItems: "baseline",
    borderRadius: radii.pill,
    flexDirection: "row",
    minWidth: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  weekBadgeValue: {
    ...typography.dataStrong,
    fontSize: 22,
    lineHeight: 28
  },
  weekBadgeLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
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
    gap: spacing.md,
    padding: spacing.lg
  },
  developmentHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  developmentHeadingCopy: {
    flex: 1,
    gap: 2
  },
  developmentIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  developmentEyebrow: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18
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
    gap: spacing.lg
  },
  shortcutSpark: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  shortcutGroups: {
    gap: spacing.xl
  },
  shortcutGroup: {
    gap: spacing.sm
  },
  shortcutGroupTitle: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    paddingHorizontal: spacing.xs
  },
  shortcutPanel: {
    gap: spacing.sm
  },
  shortcutPressable: {
    width: "100%"
  },
  shortcutPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.988 }]
  },
  shortcutCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 82,
    padding: spacing.md,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.035,
    shadowRadius: 18
  },
  shortcutFeaturedCard: {
    borderColor: colors.primary,
    borderWidth: 1
  },
  shortcutIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  premiumBadge: {
    alignItems: "center",
    backgroundColor: colors.highlightSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  premiumBadgeText: {
    ...typography.label,
    color: colors.highlight,
    fontSize: 11,
    lineHeight: 14
  },
  shortcutCopy: {
    flex: 1,
    gap: 3
  },
  shortcutTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  shortcutTitle: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1
  },
  shortcutSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  shortcutChevron: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 28
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
