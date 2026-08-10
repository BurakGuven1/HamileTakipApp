import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Link, router, type Href } from "expo-router";
import {
  Activity,
  Baby,
  BellRing,
  BookOpen,
  BookOpenCheck,
  CalendarHeart,
  Camera,
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
  Smile,
  Ruler,
  Sparkles,
  Stethoscope,
  Syringe,
  Users,
  Wrench
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
import { getCareHandoverSnapshot, getCurrentCareUserId, listCareJournalEntries, subscribeToCareCoordination, takeOverBabyCare, type CareJournalEntry } from "@/api/careJournal";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { getFeaturedArticlesForExperience } from "@/api/articles";
import { getCurrentProfile } from "@/api/profiles";
import {
  getBabyPhotoSignedUrl,
  removeBabyHomePhoto,
  uploadBabyHomePhoto
} from "@/api/gallery";
import {
  getNextUpcomingVaccination,
  listVaccinationsForBaby,
  type BabyVaccinationWithSchedule
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import { Thread } from "@/components/Thread";
import { VibrantBackdrop } from "@/components/VibrantBackdrop";
import { WeeklyBabyDevelopmentCard } from "@/components/WeeklyBabyDevelopmentCard";
import { syncCareQuickWidget } from "@/features/care-journal/widgetSync";
import type { Article } from "@/features/articles/articles";
import { getExperienceStage } from "@/features/life-stage/lifeStage";
import { getPregnancyWeekInfo } from "@/features/pregnancy/weekInfo";
import {
  formatDate,
  getBabyAgeLabel,
  getPregnancyProgress,
  getRelativeDayLabel
} from "@/lib/dates";
import { useFeedback } from "@/providers/FeedbackProvider";
import {
  colors,
  radii,
  spacing,
  typography,
  vibrantColors,
  vibrantTheme
} from "@/theme";

let homeWelcomeToastShown = false;
const motherBabyIllustration = require("../../../assets/illustrations/mother-baby-connection.jpg");

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
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

  const vaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", firstBaby?.id],
    queryFn: () => listVaccinationsForBaby(firstBaby?.id as string),
    enabled: Boolean(firstBaby?.id && isMotherhoodMode)
  });
  const appTheme = vibrantTheme;
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
  const vaccinations: BabyVaccinationWithSchedule[] = vaccinationsQuery.data ?? [];
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
        <VibrantBackdrop />
        {!isPregnancyMode ? (
          <Reveal>
            <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
              <View style={[styles.visualStage, { backgroundColor: appTheme.accentSoft }]}>
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
                      transition={reducedMotion ? 0 : 220}
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
                      <Camera color={colors.text} size={17} />
                      <Text style={styles.photoEditText}>
                        {homePhotoMutation.isPending ? "Yükleniyor…" : "Fotoğrafı değiştir"}
                      </Text>
                    </Pressable>
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
                <View style={styles.weekTopCopy}>
                  <Text style={[styles.weekNavigatorGreeting, { color: appTheme.primary }]}>
                    İyi günler, {displayName}
                  </Text>
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
                {isPregnancyMode
                  ? "Gebelik takibi"
                  : isMotherhoodMode
                    ? "Bebek bakımı"
                    : "Takibini başlat"}
              </Text>
              <View style={styles.shortcutPanel}>
                {isPregnancyMode ? (
                  <>
                    <ShortcutCard
                      accent={vibrantColors.primary}
                      featured
                      href="/pregnancy-tools"
                      icon={<Wrench color={vibrantColors.primary} fill={vibrantColors.primaryLight} size={25} strokeWidth={2.6} />}
                      subtitle="Tekme, su ve ölçümler"
                      title="Takip araçları"
                      tint={vibrantColors.primaryLight}
                    />
                    <ShortcutCard
                      accent={vibrantColors.secondary}
                      href={{ pathname: "/doctor-visit", params: { subject: "pregnancy" } }}
                      icon={<Stethoscope color={vibrantColors.secondary} fill={vibrantColors.secondarySoft} size={23} strokeWidth={2.6} />}
                      subtitle="Soruların ve kayıtların hazır"
                      title="Doktora hazırlan"
                      tint={vibrantColors.secondarySoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.mint}
                      href="/family-planner"
                      icon={<Users color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Görevler ve ortak destek"
                      title="Aile görevleri"
                      tint={vibrantColors.mintSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.blue}
                      href="/pregnancy-nutrition"
                      icon={<Salad color={vibrantColors.blue} fill={vibrantColors.blueSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Haftana uygun beslenme"
                      title="Beslenme & su"
                      tint={vibrantColors.blueSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.secondary}
                      href="/baby-names"
                      icon={<Sparkles color={vibrantColors.secondary} fill={vibrantColors.secondarySoft} size={23} strokeWidth={2.6} />}
                      subtitle="Renkli isim keşfi"
                      title="Bebek isimleri"
                      tint={vibrantColors.secondarySoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.primary}
                      href="/pregnancy-exercise"
                      icon={<Activity color={vibrantColors.primary} fill={vibrantColors.primaryLight} size={23} strokeWidth={2.6} />}
                      subtitle="Haftana uygun egzersiz"
                      title="Hareket"
                      tint={vibrantColors.primaryLight}
                    />
                    <ShortcutCard
                      accent={vibrantColors.peach}
                      href="/birth-preparation"
                      icon={<BookOpenCheck color={vibrantColors.peach} fill={vibrantColors.peachSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Çanta, plan ve hazırlık"
                      title="Doğuma hazırlık"
                      tint={vibrantColors.peachSoft}
                    />
                  </>
                ) : isMotherhoodMode ? (
                  <>
                    <ShortcutCard
                      accent={vibrantColors.primary}
                      featured
                      href={{ pathname: "/care-journal", params: { section: "record" } }}
                      icon={<CalendarHeart color={vibrantColors.primary} fill={vibrantColors.primaryLight} size={25} strokeWidth={2.6} />}
                      subtitle="Beslenme, uyku veya bez kaydını hemen ekle"
                      title="Şimdi bakım kaydet"
                      tint={vibrantColors.primaryLight}
                    />
                    <ShortcutCard
                      accent={vibrantColors.peach}
                      href={{ pathname: "/care-journal", params: { section: "plan" } }}
                      icon={<BellRing color={vibrantColors.peach} fill={vibrantColors.peachSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Alarm, uyku tahmini, sağım ve süt stoğu"
                      title="Bakım planı"
                      tint={vibrantColors.peachSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.secondary}
                      href={{ pathname: "/care-journal", params: { section: "family" } }}
                      icon={<Users color={vibrantColors.secondary} fill={vibrantColors.secondarySoft} size={23} strokeWidth={2.6} />}
                      subtitle="Canlı vardiya, görevler ve anne desteği"
                      title="Aile vardiyası"
                      tint={vibrantColors.secondarySoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.mint}
                      href="/family-planner"
                      icon={<Users color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Kime, ne zaman: ortak görev ve alarmlar"
                      title="Aile görevleri"
                      tint={vibrantColors.mintSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.blue}
                      href={{ pathname: "/doctor-visit", params: { subject: "baby" } }}
                      icon={<Stethoscope color={vibrantColors.blue} fill={vibrantColors.blueSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Bebek veya anne için ayrı, gerçek veri özeti"
                      title="Doktora hazırlan"
                      tint={vibrantColors.blueSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.mint}
                      href="/baby"
                      icon={<Ruler color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Ölçümler ve yaklaşan aşılar"
                      title="Büyüme & aşı"
                      tint={vibrantColors.mintSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.yellow}
                      href="/teething"
                      icon={<Smile color={vibrantColors.yellow} fill={vibrantColors.yellowSoft} size={23} strokeWidth={2.6} />}
                      subtitle="20 süt dişini ailece işaretle"
                      title="Diş takibi"
                      tint={vibrantColors.yellowSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.blue}
                      href="/solid-food-recipes"
                      icon={<Salad color={vibrantColors.blue} fill={vibrantColors.blueSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Yaşa ve dokuya uygun güvenli tarifler"
                      title="Ek gıda tarifleri"
                      tint={vibrantColors.blueSoft}
                    />
                    <ShortcutCard
                      accent={vibrantColors.primary}
                      href="/lullaby"
                      icon={<Music2 color={vibrantColors.primary} fill={vibrantColors.primaryLight} size={23} strokeWidth={2.6} />}
                      subtitle="Sakinleştiren uyku sesleri"
                      title="Ninniler"
                      tint={vibrantColors.primaryLight}
                    />
                  </>
                ) : (
                  <>
                    {membershipQuery.data ? (
                      <ShortcutCard
                        accent={vibrantColors.mint}
                        featured
                        href="/family-planner"
                        icon={<Users color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={25} strokeWidth={2.6} />}
                        subtitle="Sana atanan görev, alarm ve vardiya burada"
                        title="Aile görevleri"
                        tint={vibrantColors.mintSoft}
                      />
                    ) : null}
                    <ShortcutCard
                      accent={vibrantColors.primary}
                      featured={!membershipQuery.data}
                      href="/settings"
                      icon={<CalendarHeart color={vibrantColors.primary} fill={vibrantColors.primaryLight} size={25} strokeWidth={2.6} />}
                      subtitle="Hafta ve gününü girerek takibe başla"
                      title="Hamilelik akışı"
                      tint={vibrantColors.primaryLight}
                    />
                    <ShortcutCard
                      accent={vibrantColors.blue}
                      href="/baby"
                      icon={<Baby color={vibrantColors.blue} fill={vibrantColors.blueSoft} size={23} strokeWidth={2.6} />}
                      subtitle="Doğum bilgileriyle bakım alanını hazırla"
                      title="Bebek profili"
                      tint={vibrantColors.blueSoft}
                    />
                  </>
                )}
              </View>
            </View>

            <View style={styles.shortcutGroup}>
              <Text style={styles.shortcutGroupTitle}>Aile alanları</Text>
              <View style={styles.shortcutPanel}>
                <ShortcutCard
                  accent={vibrantColors.peach}
                  href="/document-insight"
                  icon={<FileSearch color={vibrantColors.peach} fill={vibrantColors.peachSoft} size={23} strokeWidth={2.6} />}
                  subtitle="Sağlık belgelerini sadeleştir"
                  title="Belgeyi Anla"
                  tint={vibrantColors.peachSoft}
                />
                {isMotherhoodMode ? (
                  <ShortcutCard
                    accent={vibrantColors.secondary}
                    href="/gallery"
                    icon={<Images color={vibrantColors.secondary} fill={vibrantColors.secondarySoft} size={23} strokeWidth={2.6} />}
                    subtitle="İlk 5 anıyı ücretsiz, devamını Premium ile sakla"
                    title="Anı galerisi"
                    tint={vibrantColors.secondarySoft}
                  />
                ) : null}
                {!membershipQuery.data ? (
                  <ShortcutCard
                    accent={vibrantColors.mint}
                    href="/forum"
                    icon={<HeartPulse color={vibrantColors.mint} fill={vibrantColors.mintSoft} size={23} strokeWidth={2.6} />}
                    subtitle="Deneyimlerini toplulukla paylaş"
                    title="Anne forumu"
                    tint={vibrantColors.mintSoft}
                  />
                ) : null}
              </View>
            </View>
          </View>
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

        {experienceStage === "general" ? (
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

        {isMotherhoodMode ? (
          <View style={styles.metricRow}>
            <MetricCard label="Bebek profili" value={`${babies.length}`} />
            <MetricCard
              label="Bebek aşıları"
              value={
                vaccinationsQuery.isError
                  ? "—"
                  : vaccinations.length > 0
                  ? `${completedVaccines}/${vaccinations.length}`
                  : "0"
              }
            />
          </View>
        ) : null}

        {experienceStage !== "general" ? <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ gap: spacing.xs, flex: 1 }}>
                <Text style={typography.heading2}>Sıradaki aşı</Text>
                {nextVaccinationQuery.isLoading ? (
                  <Text style={typography.body}>Aşı bilgileri yükleniyor…</Text>
                ) : nextVaccinationQuery.isError ? (
                  <Text style={typography.body}>Aşı bilgileri şu anda alınamadı.</Text>
                ) : nextVaccinationQuery.data ? (
                  <Text style={typography.body}>
                    {nextVaccinationQuery.data.subjectName} · {nextVaccinationQuery.data.vaccineName} ·{" "}
                    {getRelativeDayLabel(nextVaccinationQuery.data.scheduledDate)} ·{" "}
                    {formatDate(nextVaccinationQuery.data.scheduledDate)}
                  </Text>
                ) : (
                  <Text style={typography.body}>
                    Şu an yaklaşan aşı yok. Yeni kayıt ekledikçe burada görünür.
                  </Text>
                )}
              </View>
              <Syringe color={appTheme.primary} size={28} />
            </View>
            <Link href="/vaccines" asChild>
              <Button label="Aşı merkezini aç" variant="secondary" />
            </Link>
          </View>
        </Card> : null}

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

function ShortcutCard({
  accent,
  featured = false,
  href,
  icon,
  premium = false,
  subtitle,
  title,
  tint
}: {
  accent?: string;
  featured?: boolean;
  href: Href;
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
        <View
          style={[
            styles.shortcutCard,
            featured && styles.shortcutFeaturedCard,
            { borderLeftColor: accent ?? tint }
          ]}
        >
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
            <Text numberOfLines={2} style={styles.shortcutSubtitle}>
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
    minHeight: 48,
    paddingHorizontal: spacing.md,
    position: "absolute"
  },
  familyStoryBadgeText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  photoEditButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm
  },
  photoEditButtonPressed: {
    opacity: 0.72
  },
  photoEditText: {
    ...typography.label,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17
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
  livingThreadMetaStart: { flex: 1 },
  livingThreadMetaEnd: { flex: 1, textAlign: "right" },
  weekCard: {
    borderWidth: 1
  },
  weekTopCopy: {
    flex: 1,
    gap: spacing.xs
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
