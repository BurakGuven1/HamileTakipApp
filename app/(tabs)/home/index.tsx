import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Link, router, type Href } from "expo-router";
import {
  BookOpen,
  Camera,
  ChevronRight,
  Clock3,
  Droplets,
  FileHeart,
  HandHeart,
  Milk,
  Moon,
  Sparkles,
  Syringe,
  Wrench,
  type LucideIcon
} from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { listBabies, type Baby as BabyRecord } from "@/api/babies";
import {
  completeDailyExperience,
  DAILY_EXPERIENCE_QUERY_KEY,
  getTodayDailyExperience,
  getWeeklyCheckInContext,
  submitWeeklyCheckIn,
  WEEKLY_CHECKIN_QUERY_KEY
} from "@/api/dailyExperience";
import { getCareHandoverSnapshot, getCurrentCareUserId, listCareJournalEntries, subscribeToCareCoordination, takeOverBabyCare, type CareHandoverSnapshot, type CareJournalEntry } from "@/api/careJournal";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { getFeaturedArticlesForExperience } from "@/api/articles";
import { getCurrentProfile } from "@/api/profiles";
import {
  getBabyPhotoSignedUrl,
  removeBabyHomePhoto,
  uploadBabyHomePhoto
} from "@/api/gallery";
import { getNextUpcomingVaccination } from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { GlassSurface, PressableGlass } from "@/components/glass";
import {
  AnimatedNumber,
  PressableScale,
  ProgressRing,
  StaggeredList
} from "@/components/motion";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import { WeeklyBabyDevelopmentCard } from "@/components/WeeklyBabyDevelopmentCard";
import { DailyForYouCard } from "@/features/daily-experience/DailyForYouCard";
import { PartnerCard } from "@/features/family/PartnerCard";
import { IntroTrialBanner } from "@/features/subscription/IntroTrialBanner";
import { getDailyDestinationPath } from "@/features/daily-experience/dailyExperiencePolicy";
import { WeeklyCheckInCard } from "@/features/daily-experience/WeeklyCheckInCard";
import { syncCareQuickWidget } from "@/features/care-journal/widgetSync";
import type { Article } from "@/features/articles/articles";
import { getExperienceStage, type ExperienceStage } from "@/features/life-stage/lifeStage";
import { countTools, getQuickActions } from "@/features/tools/toolCatalog";
import { ToolQuickAction } from "@/features/tools/ToolShortcutCard";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import {
  formatDate,
  getBabyAgeLabel,
  getBabyAgeMonths,
  getPregnancyProgress,
  getRelativeDayLabel
} from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { trackProductEvent } from "@/services/analytics/productAnalytics";
import { colors, radii, spacing, typography, vibrantColors } from "@/theme";

let homeWelcomeToastShown = false;
const motherBabyIllustration = require("../../../assets/illustrations/mother-baby-connection.jpg");

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
  const { isPremium } = useSubscriptionStatus();
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
  const homePhotoQuery = useQuery({
    queryKey: ["baby-home-photo", firstBaby?.id, firstBaby?.photo_url],
    queryFn: () => getBabyPhotoSignedUrl(firstBaby?.photo_url as string),
    enabled: Boolean(firstBaby?.id && firstBaby.photo_url)
  });
  const profile = profileQuery.data;
  const dailyExperienceEnabled = Boolean(
    profile?.onboarding_completed
      && currentUserQuery.data
      && currentUserQuery.data === profile.id
  );
  const weeklyCheckInQuery = useQuery({
    queryKey: WEEKLY_CHECKIN_QUERY_KEY,
    queryFn: getWeeklyCheckInContext,
    enabled: dailyExperienceEnabled,
    staleTime: 60_000
  });
  const dailyExperienceQuery = useQuery({
    queryKey: DAILY_EXPERIENCE_QUERY_KEY,
    queryFn: getTodayDailyExperience,
    enabled: dailyExperienceEnabled,
    staleTime: 60_000
  });
  const dailyExperience = dailyExperienceQuery.data;
  const experienceStage = getExperienceStage(profile, Boolean(firstBaby));
  const isMotherhoodMode = experienceStage === "postpartum";
  const isPregnancyMode = experienceStage === "pregnancy";
  const careHandoverQuery = useQuery({
    queryKey: ["care-handover", firstBaby?.id],
    queryFn: () => getCareHandoverSnapshot(firstBaby?.id as string),
    enabled: Boolean(firstBaby?.id && isMotherhoodMode),
    refetchInterval: 30_000
  });
  const careJournalWidgetQuery = useQuery({
    queryKey: ["care-journal-home", firstBaby?.id],
    queryFn: () => listCareJournalEntries(firstBaby?.id as string, 300),
    enabled: Boolean(firstBaby?.id && isMotherhoodMode)
  });

  // Aşı tamamlanma oranı artık Bebek sekmesinde yaşıyor; ana sayfa yalnızca
  // yaklaşan aşıyı soruyor, bu yüzden tam liste burada çekilmiyor.
  const appTheme = useAppTheme();
  const babyAgeMonths = getBabyAgeMonths(firstBaby?.birth_date);
  const quickActions = getQuickActions(experienceStage, babyAgeMonths);
  const toolCount = countTools(experienceStage);
  const pregnancyProgress = getPregnancyProgress(profile?.due_date);
  const week = pregnancyProgress?.week
    ? Math.max(2, Math.min(40, pregnancyProgress.week))
    : null;
  const pregnancyProgressRatio = pregnancyProgress
    ? Math.min(1, pregnancyProgress.day / pregnancyProgress.totalDays)
    : 0;
  const weekInfo = getPregnancyWeekInfo(week);
  const [browsedWeek, setBrowsedWeek] = useState<number | null>(null);
  const displayedWeek = browsedWeek ?? week ?? 2;
  const displayedWeekInfo = getPregnancyWeekInfo(displayedWeek);

  useEffect(() => {
    if (week) setBrowsedWeek(week);
  }, [week]);
  const featuredArticlesQuery = useQuery({
    queryKey: ["articles", "featured", experienceStage, week],
    queryFn: () =>
      getFeaturedArticlesForExperience(experienceStage, week, 4)
  });
  const nextVaccinationQuery = useQuery({
    queryKey: [
      "next-upcoming-vaccination",
      profile?.id,
      firstBaby?.id,
      profile?.is_pregnant
    ],
    queryFn: () => getNextUpcomingVaccination(firstBaby?.id ?? null, firstBaby?.name),
    enabled: Boolean(profile)
  });
  const featuredArticles = featuredArticlesQuery.data ?? [];
  const babyAge = firstBaby ? getBabyAgeLabel(firstBaby.birth_date) : null;
  const focus = resolveHomeFocus({
    babyName: firstBaby?.name ?? null,
    handover: careHandoverQuery.data ?? null,
    nextVaccination: nextVaccinationQuery.data ?? null,
    stage: experienceStage
  });
  const displayName =
    profile?.mother_name ||
    profile?.display_name ||
    profile?.forum_nickname ||
    firstBaby?.name ||
    "Anne";
  const careGiverName = membershipQuery.data
    ? profile?.father_name || "Baba"
    : profile?.mother_name || profile?.display_name || "Anne";
  const weeklyCheckInMutation = useMutation({
    mutationFn: submitWeeklyCheckIn,
    onSuccess: async () => {
      showSuccess("Sonraki önerilerin cevaplarına göre hazırlanacak.", "Haftan hazır");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: WEEKLY_CHECKIN_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DAILY_EXPERIENCE_QUERY_KEY })
      ]);
      void trackProductEvent("weekly_checkin_completed", {
        life_stage: experienceStage,
        week_key: weeklyCheckInQuery.data?.weekKey ?? null
      });
    },
    onError: (error) => showError(error, "Haftalık cevapların kaydedilemedi")
  });
  const dailyCompleteMutation = useMutation({
    mutationFn: completeDailyExperience,
    onSuccess: async () => {
      showSuccess("Küçük adımını tamamladın.", "Bugün tamamlandı");
      await queryClient.invalidateQueries({ queryKey: DAILY_EXPERIENCE_QUERY_KEY });
      void trackProductEvent("daily_experience_completed", {
        content_key: dailyExperience?.contentKey ?? null,
        life_stage: experienceStage
      });
    },
    onError: (error) => showError(error, "Bugünkü adım kaydedilemedi")
  });

  useEffect(() => {
    if (!dailyExperience?.id) return;
    void trackProductEvent("daily_experience_opened", {
      content_key: dailyExperience.contentKey,
      life_stage: dailyExperience.lifeStage
    });
  }, [dailyExperience?.contentKey, dailyExperience?.id, dailyExperience?.lifeStage]);
  const handoverMutation = useMutation({
    mutationFn: async () => {
      if (!firstBaby) throw new Error("Bebek profili bulunamadı.");
      return takeOverBabyCare(firstBaby.id, careGiverName);
    },
    onSuccess: async (result) => {
      if (result.queued) {
        showInfo("Bağlantı gelince aileyle eşitlenecek.", "Bakım sıraya alındı");
      } else {
        showSuccess("Bakım sende. Aile özeti güncellendi.", "Bakım devralındı");
      }
      await queryClient.invalidateQueries({ queryKey: ["care-handover", firstBaby?.id] });
    },
    onError: (error) => showError(error, "Bakım devralınamadı")
  });
  const homePhotoMutation = useMutation({
    mutationFn: (input: { kind: "upload"; uri: string } | { kind: "remove" }) => {
      if (!firstBaby) throw new Error("Önce bebek profili eklemelisin.");
      return input.kind === "upload"
        ? uploadBabyHomePhoto({
            babyId: firstBaby.id,
            uri: input.uri,
            previousPath: firstBaby.photo_url
          })
        : removeBabyHomePhoto({
            babyId: firstBaby.id,
            storagePath: firstBaby.photo_url
          });
    },
    onSuccess: async (updatedBaby, input) => {
      queryClient.setQueryData<BabyRecord[]>(["babies"], (current) =>
        (current ?? []).map((baby) => (baby.id === updatedBaby.id ? updatedBaby : baby))
      );
      showSuccess(
        input.kind === "upload"
          ? "Seçtiğin fotoğraf artık ana sayfanda."
          : "Ana sayfa görseli varsayılana döndü.",
        "Fotoğraf güncellendi"
      );
      await queryClient.invalidateQueries({ queryKey: ["babies"] });
    },
    onError: (error) => showError(error, "Ana sayfa fotoğrafı güncellenemedi")
  });

  async function chooseHomePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showInfo(
        "Telefon ayarlarından fotoğraf erişimi verirsen ana sayfana kendi görselini ekleyebilirsin.",
        "Fotoğraf izni gerekli"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });
    if (!result.canceled && result.assets[0]) {
      homePhotoMutation.mutate({ kind: "upload", uri: result.assets[0].uri });
    }
  }

  function openHomePhotoMenu() {
    if (homePhotoMutation.isPending) return;
    Alert.alert(
      "Ana sayfa fotoğrafı",
      "Bebeğinin fotoğrafını, bir aile anını veya sana iyi gelen başka bir görseli seçebilirsin.",
      [
        { text: "Galeriden seç", onPress: () => void chooseHomePhoto() },
        ...(firstBaby?.photo_url
          ? [
              {
                text: "Varsayılan görsele dön",
                style: "destructive" as const,
                onPress: () => homePhotoMutation.mutate({ kind: "remove" as const })
              }
            ]
          : []),
        { text: "Vazgeç", style: "cancel" }
      ]
    );
  }
  useEffect(() => {
    if (!firstBaby?.id || !isMotherhoodMode) return;
    return subscribeToCareCoordination(firstBaby.id, () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["care-handover", firstBaby.id] }),
        queryClient.invalidateQueries({ queryKey: ["care-journal-home", firstBaby.id] })
      ]).catch(() => undefined);
    });
  }, [firstBaby?.id, isMotherhoodMode, queryClient]);
  useEffect(() => {
    if (profile?.is_pregnant) {
      syncCareQuickWidget(
        firstBaby?.id ?? null,
        firstBaby?.name ?? displayName ?? "Anne",
        []
      ).catch(
        () => undefined
      );
      return;
    }
    if (firstBaby && careJournalWidgetQuery.isSuccess) {
      syncCareQuickWidget(
        firstBaby.id,
        firstBaby.name,
        careJournalWidgetQuery.data ?? []
      ).catch(() => undefined);
      return;
    }
    if (profile && !firstBaby) {
      syncCareQuickWidget(null, displayName || "Anne", []).catch(() => undefined);
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
        <HomeGreeting name={displayName} stage={experienceStage} />
        {/* Rendered without <Reveal> because the banner returns null outside the
            trial, and an empty wrapper would still take a gap in this column. */}
        <IntroTrialBanner
          onPress={() => {
            void showPaywallIfNeeded(
              "intro_trial_banner",
              { feature: "intro_trial_banner", reason: "trial_active" },
              { mode: "required" }
            ).catch((error) => showError(error, "Premium ekranı açılamadı"));
          }}
        />
        {weeklyCheckInQuery.data?.needsCheckIn ? (
          <Reveal>
            <WeeklyCheckInCard
              context={weeklyCheckInQuery.data}
              onSubmit={(input) => weeklyCheckInMutation.mutate(input)}
              pending={weeklyCheckInMutation.isPending}
              profileId={profile!.id}
            />
          </Reveal>
        ) : null}
        {dailyExperience ? (
          <Reveal>
            <DailyForYouCard
              experience={dailyExperience}
              isPremium={isPremium}
              onAction={() => {
                void trackProductEvent("daily_experience_action_tapped", {
                  content_key: dailyExperience.contentKey,
                  destination: dailyExperience.payload.destination
                });
                router.push(getDailyDestinationPath(dailyExperience.payload.destination) as Href);
              }}
              onComplete={() => dailyCompleteMutation.mutate(dailyExperience.id)}
              onPremiumPress={() => {
                void trackProductEvent("daily_premium_teaser_tapped", {
                  content_key: dailyExperience.contentKey,
                  life_stage: dailyExperience.lifeStage
                });
                void showPaywallIfNeeded(
                  "daily_personalized_insight",
                  {
                    feature: "daily_personalized_insight",
                    life_stage: dailyExperience.lifeStage
                  },
                  { mode: "required" }
                ).catch((error) => showError(error, "Premium ekranı açılamadı"));
              }}
              pending={dailyCompleteMutation.isPending}
            />
          </Reveal>
        ) : null}
        {!isPregnancyMode ? (
          <Reveal>
            <GlassSurface contentStyle={styles.heroContent} elevation="lifted" radius={34}>
              {firstBaby ? (
                <View style={styles.familyVisual}>
                  <Image
                    accessibilityLabel={
                      homePhotoQuery.data
                        ? "Ana sayfada seçtiğin kişisel fotoğraf"
                        : "Bebeğini sevgiyle kucağında tutan anne illüstrasyonu"
                    }
                    accessibilityRole="image"
                    accessible
                    contentFit="cover"
                    source={homePhotoQuery.data ? { uri: homePhotoQuery.data } : motherBabyIllustration}
                    style={styles.familyHeroImage}
                    transition={reducedMotion ? 0 : 260}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(12, 8, 22, 0.72)"]}
                    pointerEvents="none"
                    style={styles.familyScrim}
                  />
                  <Pressable
                    accessibilityHint="Galeriden yeni bir fotoğraf seçmeyi veya varsayılan görsele dönmeyi sağlar"
                    accessibilityLabel="Ana sayfa fotoğrafını değiştir"
                    accessibilityRole="button"
                    disabled={homePhotoMutation.isPending}
                    onPress={openHomePhotoMenu}
                    style={({ pressed }) => [
                      styles.photoEditButton,
                      pressed && styles.photoEditButtonPressed
                    ]}
                  >
                    <Camera color="#FFFFFF" size={17} />
                    <Text style={styles.photoEditText}>
                      {homePhotoMutation.isPending ? "Yükleniyor…" : "Değiştir"}
                    </Text>
                  </Pressable>
                  <View style={styles.familyCaption}>
                    <Text style={styles.familyCaptionName}>{firstBaby.name}</Text>
                    <Text style={styles.familyCaptionAge}>{getBabyAgeLabel(firstBaby.birth_date)}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.emptyHeroVisual, { backgroundColor: appTheme.primarySoft }]}>
                  <View style={[styles.sizeEmojiOrb, { backgroundColor: appTheme.accentSoft }]}>
                    <Sparkles color={appTheme.primary} size={34} />
                  </View>
                  <Text style={[styles.sizeVisualEyebrow, { color: appTheme.primary }]}>Bugün</Text>
                  <Text style={styles.sizeVisualTitle}>Kişisel takip alanın</Text>
                </View>
              )}
              <View style={styles.visualFooter}>
                <View style={styles.heroFooterCopy}>
                  <Text style={styles.heroTitle}>{heroTitle}</Text>
                  <Text numberOfLines={2} style={styles.heroText}>{heroBody}</Text>
                </View>
                <Link href="/articles" asChild>
                  <PressableScale
                    accessibilityLabel="Rehberleri aç"
                    accessibilityRole="button"
                    style={[styles.openArticlesButton, { backgroundColor: appTheme.primarySoft }]}
                  >
                    <ChevronRight color={appTheme.primary} size={22} strokeWidth={2.6} />
                  </PressableScale>
                </Link>
              </View>
            </GlassSurface>
          </Reveal>
        ) : null}

        {profile?.is_pregnant && weekInfo && week ? (
          <Reveal>
            <Card elevation="lifted" large style={styles.weekCard}>
              <View style={{ gap: spacing.lg }}>
                <View style={styles.weekTopCopy}>
                  <ProgressRing
                    accessibilityLabel={`Gebelik ilerlemesi: ${week}. hafta, yüzde ${Math.round(pregnancyProgressRatio * 100)}`}
                    color={appTheme.primary}
                    progress={pregnancyProgressRatio}
                    size={96}
                    strokeWidth={9}
                    trackColor={appTheme.primarySoft}
                  >
                    <AnimatedNumber
                      accessibilityLabel={`${week}. hafta`}
                      style={[styles.weekRingValue, { color: appTheme.primary }]}
                      value={week}
                    />
                    <Text style={styles.weekRingUnit}>hafta</Text>
                  </ProgressRing>
                  <View style={styles.weekTopTexts}>
                    <Text style={[styles.weekNavigatorGreeting, { color: appTheme.primary }]}>
                      İyi günler, {displayName}
                    </Text>
                    <Text style={styles.weekTopTitle}>Bu hafta</Text>
                    <Text style={styles.weekTopHint}>{heroBody}</Text>
                  </View>
                </View>

                <WeeklyBabyDevelopmentCard
                  initialWeek={week}
                  onWeekChange={setBrowsedWeek}
                />

                {displayedWeekInfo ? (
                  <>
                    <View style={styles.weekStats}>
                      <MiniStat
                        backgroundColor={colors.lengthTint}
                        label="Boy"
                        value={displayedWeekInfo.lengthCm}
                      />
                      <MiniStat
                        backgroundColor={colors.weightTint}
                        label="Kilo"
                        value={displayedWeekInfo.weightG}
                      />
                      <MiniStat
                        backgroundColor={vibrantColors.mintSoft}
                        label="Hafta"
                        value={`${displayedWeek}.`}
                      />
                    </View>
                    <View style={[styles.developmentBox, { backgroundColor: appTheme.primarySoft }]}>
                      <View style={styles.developmentHeading}>
                        <View style={[styles.developmentIcon, { backgroundColor: colors.surfaceStrong }]}>
                          <BookOpen color={appTheme.primary} size={18} strokeWidth={2.2} />
                        </View>
                        <View style={styles.developmentHeadingCopy}>
                          <Text style={[styles.developmentEyebrow, { color: appTheme.primary }]}>
                            {displayedWeek}. haftanın notu
                          </Text>
                          <Text style={styles.developmentTitle}>{displayedWeekInfo.milestone}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={2} style={styles.developmentText}>
                        {displayedWeekInfo.note}
                      </Text>
                    </View>
                  </>
                ) : null}
                <Link href="/pregnancy-timeline" asChild>
                  <Button label="Hafta hafta yol haritasını aç" variant="secondary" />
                </Link>
              </View>
            </Card>
          </Reveal>
        ) : null}

        <Reveal delay={60}>
          <Card style={styles.focusCard} tint={appTheme.primarySoft} tone="tinted">
            <View style={styles.focusHeader}>
              <View style={[styles.focusIcon, { backgroundColor: appTheme.primarySoft }]}>
                <focus.Icon color={appTheme.primary} size={22} strokeWidth={2.4} />
              </View>
              <View style={styles.focusCopy}>
                <Text style={typography.eyebrow}>Şimdi ne önemli?</Text>
                <Text style={styles.focusTitle}>{focus.title}</Text>
                <Text style={styles.focusBody}>{focus.body}</Text>
              </View>
            </View>
            <Link href={focus.href} asChild>
              <Button
                accessibilityHint={focus.body}
                label={focus.actionLabel}
                variant="secondary"
              />
            </Link>
          </Card>
        </Reveal>

        {/* No <Reveal>: the card renders nothing without a family code, and an
            empty wrapper would still take a gap in this column. */}
        <PartnerCard lifeStage={isPregnancyMode ? "pregnancy" : "postpartum"} />

        <Reveal delay={90} style={styles.shortcutsSection}>
          <View style={styles.sectionHeader}>
            <Text style={typography.heading2}>Hızlı eylemler</Text>
          </View>
          <StaggeredList itemStyle={styles.quickActionItem} style={styles.quickActionRow}>
            {quickActions.map((tool) => (
              <ToolQuickAction key={tool.key} tool={tool} />
            ))}
          </StaggeredList>
          <Link href="/pregnancy-tools" asChild>
            <PressableGlass
              accessibilityHint={`${toolCount} aracın kategorilere ayrılmış listesini açar`}
              accessibilityLabel="Tüm araçlar"
              accessibilityRole="button"
              contentStyle={styles.allToolsCard}
            >
              <View style={[styles.allToolsIcon, { backgroundColor: appTheme.primarySoft }]}>
                <Wrench color={appTheme.primary} size={22} strokeWidth={2.4} />
              </View>
              <View style={styles.allToolsCopy}>
                <Text style={styles.allToolsTitle}>Tüm araçlar</Text>
                <Text style={styles.allToolsHint}>
                  {`${toolCount} araç, kategorilere ayrılmış`}
                </Text>
              </View>
              <ChevronRight color={colors.textMuted} size={20} strokeWidth={2.2} />
            </PressableGlass>
          </Link>
        </Reveal>

        {isMotherhoodMode && firstBaby && careHandoverQuery.isLoading ? (
          <QueryState compact loading description="Bakım özeti hazırlanıyor…" shape="home" />
        ) : isMotherhoodMode && firstBaby && careHandoverQuery.isError ? (
          <QueryState
            description="Canlı bakım özeti alınamadı. Bağlantını kontrol et ve yeniden dene."
            onRetry={() => void careHandoverQuery.refetch()}
            retrying={careHandoverQuery.isFetching}
          />
        ) : isMotherhoodMode && firstBaby ? (
          <Card elevation="lifted" style={styles.toolsCard} tint={appTheme.primarySoft} tone="tinted">
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

        {experienceStage === "general" ? (
          <Card style={styles.primaryCard} tint={appTheme.primarySoft} tone="tinted">
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
              <Button
                label="Hamilelik akışını başlat"
                onPress={() => router.push("/settings")}
              />
              <Button
                label="Bebek bilgisi ekle"
                onPress={() => router.push("/baby")}
                variant="secondary"
              />
            </View>
          </Card>
        ) : null}


        <View style={styles.sectionHeader}>
          <View>
            <Text style={typography.heading2}>Makaleler</Text>
            <Text style={styles.sectionHint}>
              {isPregnancyMode
                ? "Gebelik haftana uygun rehberler"
                : isMotherhoodMode
                  ? "Bebek bakımı ve gelişim rehberleri"
                  : "Deneyimini seçtiğinde sana uygun rehberler"}
            </Text>
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
          <QueryState compact loading description="Rehberler hazırlanıyor…" shape="home" />
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
            description={
              experienceStage === "general"
                ? "Yaşam evreni seçtiğinde yalnızca sana uygun rehberler burada sıralanır."
                : "Bu yaşam evresine uygun yeni rehberler yayınlandığında burada sıralanır."
            }
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

/**
 * Ekranın ilk satırı: günün saatine göre selam ve kullanıcının adı.
 *
 * Eskiden ana sayfa doğrudan bir karta başlıyordu; kim olduğunu ve hangi
 * günde olduğunu söyleyen bir çapa yoktu. Selamlama o çapayı veriyor ve
 * altındaki kartların hepsi ondan sonra gelen ayrıntı olarak okunuyor.
 */
function HomeGreeting({ name, stage }: { name: string; stage: ExperienceStage }) {
  const hour = new Date().getHours();
  const salutation =
    hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const subtitle =
    stage === "pregnancy"
      ? "Bugün bebeğinle nasılsın?"
      : stage === "postpartum"
        ? "Bugünün küçük anlarını birlikte biriktirelim."
        : "Takibini kurduğunda burası tamamen sana göre olacak.";

  return (
    <View style={styles.greetingBlock}>
      <Text style={styles.greetingSalutation}>{`${salutation},`}</Text>
      <Text style={styles.greetingName}>{name}</Text>
      <Text style={styles.greetingSubtitle}>{subtitle}</Text>
    </View>
  );
}

type HomeFocus = {
  actionLabel: string;
  body: string;
  href: Href;
  Icon: LucideIcon;
  title: string;
};

/**
 * Ana ekrandaki tek eylem kartının içeriğini belirler: şu anda gerçekten
 * önemli olan tek şey. Sıra: süren bakım → yaklaşan aşı → evreye göre
 * sıradaki anlamlı adım.
 */
function resolveHomeFocus({
  babyName,
  handover,
  nextVaccination,
  stage
}: {
  babyName: string | null;
  handover: CareHandoverSnapshot | null;
  nextVaccination: { scheduledDate: string; subjectName: string; vaccineName: string } | null;
  stage: ExperienceStage;
}): HomeFocus {
  if (handover?.active_timer?.timer_type === "sleep") {
    return {
      actionLabel: "Bakım günlüğünü aç",
      body: `${babyName ?? "Bebeğin"} ${careHomeRelativeTimeValue(handover.active_timer.started_at, false)} önce uyudu. Uyanınca kaydı kapatabilirsin.`,
      href: "/care-journal",
      Icon: Moon,
      title: "Uyku sürüyor"
    };
  }

  if (nextVaccination) {
    return {
      actionLabel: "Aşı merkezini aç",
      body: `${nextVaccination.subjectName} · ${nextVaccination.vaccineName} · ${getRelativeDayLabel(nextVaccination.scheduledDate)} (${formatDate(nextVaccination.scheduledDate)})`,
      href: "/vaccines",
      Icon: Syringe,
      title: "Yaklaşan aşı"
    };
  }

  if (stage === "postpartum") {
    return {
      actionLabel: "Bakım kaydet",
      body: handover?.last_feed
        ? `Son beslenme ${careHomeRelativeTime(handover.last_feed)}. Yeni kaydı tek dokunuşla ekleyebilirsin.`
        : "Bugün için henüz bakım kaydın yok. İlk kaydı eklediğinde ritmi burada göreceksin.",
      href: { pathname: "/care-journal", params: { section: "record" } },
      Icon: Milk,
      title: handover?.last_feed ? "Sıradaki beslenme" : "İlk bakım kaydın"
    };
  }

  if (stage === "pregnancy") {
    return {
      actionLabel: "Sağlık dosyanı aç",
      body: "Tahlil, randevu ve ölçümlerini güncel tutarsan doktor görüşmesine hazır gidersin.",
      href: "/pregnancy-health-file",
      Icon: FileHeart,
      title: "Sağlık dosyanı güncel tut"
    };
  }

  return {
    actionLabel: "Takibini kur",
    body: "Gebelik veya bebek bilgisi eklediğinde ana sayfa tamamen sana göre hazırlanır.",
    href: "/settings",
    Icon: Sparkles,
    title: "Deneyimini kişiselleştir"
  };
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
          {article.imageSource || article.imageUrl ? (
            <Image
              accessibilityLabel={`${article.period} makale görseli`}
              contentFit="cover"
              source={article.imageSource ?? { uri: article.imageUrl }}
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

const styles = StyleSheet.create({
  focusCard: {
    gap: spacing.lg
  },
  focusHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  focusIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44
  },
  focusCopy: {
    flex: 1,
    gap: spacing.xs
  },
  focusTitle: {
    ...typography.heading3,
    color: colors.text
  },
  focusBody: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  weekTopTexts: {
    flex: 1,
    gap: spacing.xs
  },
  weekTopTitle: {
    ...typography.heading2,
    color: colors.text
  },
  weekTopHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  weekRingValue: {
    ...typography.dataStrong,
    fontSize: 28,
    lineHeight: 34
  },
  weekRingUnit: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16
  },
  quickActionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  greetingSpacer: {
    height: spacing.xs
  },
  quickActionItem: {
    flex: 1
  },
  allToolsCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md
  },
  allToolsIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44
  },
  allToolsCopy: {
    flex: 1,
    gap: spacing.xs
  },
  allToolsTitle: {
    ...typography.bodyStrong,
    color: colors.text
  },
  allToolsHint: {
    ...typography.caption
  },
  latestCareList: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.glassBorder,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
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
    gap: spacing.lg,
    position: "relative"
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
  greetingBlock: {
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  greetingSalutation: {
    ...typography.body,
    color: colors.textMuted
  },
  greetingName: {
    ...typography.display
  },
  greetingSubtitle: {
    ...typography.caption,
    marginTop: spacing.xs
  },
  heroContent: {
    gap: spacing.lg,
    padding: spacing.md
  },
  familyVisual: {
    borderRadius: radii.lg,
    height: 236,
    overflow: "hidden",
    position: "relative"
  },
  familyHeroImage: {
    height: "100%",
    width: "100%"
  },
  familyScrim: {
    bottom: 0,
    height: 120,
    left: 0,
    position: "absolute",
    right: 0
  },
  familyCaption: {
    bottom: spacing.md,
    gap: 2,
    left: spacing.md,
    position: "absolute",
    right: spacing.md
  },
  familyCaptionName: {
    ...typography.heading2,
    color: "#FFFFFF"
  },
  familyCaptionAge: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.86)"
  },
  photoEditButton: {
    alignItems: "center",
    backgroundColor: "rgba(20, 14, 32, 0.52)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm
  },
  photoEditButtonPressed: {
    opacity: 0.72
  },
  photoEditText: {
    ...typography.captionStrong,
    color: "#FFFFFF"
  },
  emptyHeroVisual: {
    alignItems: "center",
    borderRadius: radii.lg,
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 200,
    padding: spacing.lg
  },
  sizeEmojiOrb: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 96,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 96
  },
  sizeVisualEyebrow: {
    ...typography.eyebrow
  },
  sizeVisualTitle: {
    ...typography.heading2,
    textAlign: "center"
  },
  visualFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs
  },
  heroFooterCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroTitle: {
    ...typography.heading2
  },
  heroText: {
    ...typography.caption
  },
  openArticlesButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
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
  livingThreadMetaStart: { flex: 1 },
  livingThreadMetaEnd: { flex: 1, textAlign: "right" },
  weekCard: {},
  weekTopCopy: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg
  },
  primaryCard: {},
  offerCard: {
    borderColor: colors.transparent
  },
  offerText: {
    ...typography.body,
    color: colors.text
  },
  toolsCard: {},
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  weekNavigatorGreeting: {
    ...typography.label,
    textAlign: "center"
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
    backgroundColor: vibrantColors.surfaceTranslucent,
    borderColor: vibrantColors.border,
    borderRadius: radii.md,
    borderLeftWidth: 5,
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
    borderColor: vibrantColors.primary,
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
