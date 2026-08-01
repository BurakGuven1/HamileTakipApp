import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  ArrowLeft,
  BellRing,
  ChevronDown,
  ChevronUp,
  Droplets,
  ExternalLink,
  Info,
  Minus,
  Pill,
  Plus,
  ShieldAlert
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import {
  DEFAULT_DAILY_WATER_GLASSES,
  getDailyWaterIntake,
  getMillisecondsUntilNextLocalDay,
  MAX_DAILY_WATER_GLASSES,
  MIN_DAILY_WATER_GLASSES,
  setDailyWaterGoal,
  setDailyWaterProgress,
  type DailyWaterIntake
} from "@/features/pregnancy/dailyWaterIntake";
import {
  getGuidanceForMonth,
  getPregnancyMonth,
  getPregnancyMonthRange,
  getSourcesByIds,
  pregnancyGuidanceSources,
  pregnancyMonths,
  type PregnancySupplementGuidance
} from "@/features/pregnancy/nutritionGuidance";
import {
  getWaterRemindersEnabled,
  setWaterRemindersEnabled,
  WATER_REMINDER_TIME_LABEL
} from "@/features/pregnancy/waterReminders";
import { getPregnancyWeek } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

export default function PregnancyNutritionScreen() {
  const appTheme = useAppTheme();
  const { showError, showSuccess } = useFeedback();
  const reducedMotion = useReducedMotion();
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const currentWeek = getPregnancyWeek(profileQuery.data?.due_date) ?? 1;
  const currentMonth = getPregnancyMonth(currentWeek);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [waterRemindersEnabled, setWaterRemindersEnabledState] = useState(false);
  const [updatingReminders, setUpdatingReminders] = useState(false);
  const [waterIntake, setWaterIntake] = useState<DailyWaterIntake | null>(null);
  const [draftWaterGoal, setDraftWaterGoal] = useState(
    DEFAULT_DAILY_WATER_GLASSES
  );
  const [editingWaterGoal, setEditingWaterGoal] = useState(false);
  const [savingWaterIntake, setSavingWaterIntake] = useState(false);
  const [guidanceExpanded, setGuidanceExpanded] = useState(false);

  useEffect(() => {
    setSelectedMonth(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    getWaterRemindersEnabled()
      .then(setWaterRemindersEnabledState)
      .catch(() => setWaterRemindersEnabledState(false));
  }, []);

  useEffect(() => {
    let active = true;
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;

    async function refreshDailyWaterIntake() {
      try {
        const dailyIntake = await getDailyWaterIntake();
        if (!active) return;

        setWaterIntake(dailyIntake);
        setDraftWaterGoal(
          dailyIntake.goal ?? DEFAULT_DAILY_WATER_GLASSES
        );
        if (dailyIntake.goal === null) {
          setEditingWaterGoal(true);
        }
      } catch (error) {
        if (active) {
          showError(error, "Günlük su takibi yüklenemedi");
        }
      }
    }

    function scheduleMidnightReset() {
      midnightTimer = setTimeout(() => {
        if (!active) return;
        void refreshDailyWaterIntake();
        scheduleMidnightReset();
      }, getMillisecondsUntilNextLocalDay());
    }

    void refreshDailyWaterIntake();
    scheduleMidnightReset();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshDailyWaterIntake();
      }
    });

    return () => {
      active = false;
      if (midnightTimer) clearTimeout(midnightTimer);
      appStateSubscription.remove();
    };
  }, [showError]);

  async function toggleWaterReminders() {
    setUpdatingReminders(true);
    try {
      const enabled = await setWaterRemindersEnabled(!waterRemindersEnabled);
      setWaterRemindersEnabledState(enabled);
      showSuccess(
        enabled
          ? `${WATER_REMINDER_TIME_LABEL} saatlerinde günlük hatırlatmalar planlandı.`
          : "Planlanmış su hatırlatmaları kaldırıldı.",
        enabled ? "Su hatırlatmaları açık" : "Su hatırlatmaları kapalı"
      );
    } catch (error) {
      showError(error, "Su hatırlatmaları güncellenemedi");
    } finally {
      setUpdatingReminders(false);
    }
  }

  async function saveWaterGoal() {
    if (savingWaterIntake) return;
    setSavingWaterIntake(true);

    try {
      const nextIntake = await setDailyWaterGoal(draftWaterGoal);
      setWaterIntake(nextIntake);
      setEditingWaterGoal(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined
      );
    } catch (error) {
      showError(error, "Günlük su hedefi kaydedilemedi");
    } finally {
      setSavingWaterIntake(false);
    }
  }

  async function updateWaterProgress(glassNumber: number) {
    if (!waterIntake?.goal || savingWaterIntake) return;

    const previousIntake = waterIntake;
    const nextConsumed =
      glassNumber <= waterIntake.consumed ? glassNumber - 1 : glassNumber;
    const optimisticIntake = {
      ...waterIntake,
      consumed: nextConsumed
    };

    setWaterIntake(optimisticIntake);
    setSavingWaterIntake(true);

    try {
      const savedIntake = await setDailyWaterProgress(nextConsumed);
      setWaterIntake(savedIntake);
      await Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      setWaterIntake(previousIntake);
      showError(error, "Su ilerlemesi kaydedilemedi");
    } finally {
      setSavingWaterIntake(false);
    }
  }

  async function openSource(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("Kaynak bağlantısı açılamıyor.");
      await Linking.openURL(url);
    } catch (error) {
      showError(error, "Kaynak açılamadı");
    }
  }

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <Text style={typography.body}>Gebelik bilgileri yükleniyor…</Text>
        </View>
      </Screen>
    );
  }

  if (profileQuery.data && !profileQuery.data.is_pregnant) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <EmptyState
            title="Takviye rehberi hamilelik profiline özel"
            description="Su hatırlatmalarını Profil > Bildirim tercihleri alanından ücretsiz kullanabilirsin. Gebelik rehberi için profilinde Hamileyim seçeneğini açmalısın."
          />
        </View>
      </Screen>
    );
  }

  const range = getPregnancyMonthRange(selectedMonth);
  const guidance = getGuidanceForMonth(selectedMonth);

  return (
    <Screen>
      <View style={styles.container}>
        <BackButton />

        <Reveal>
          <View style={[styles.hero, { backgroundColor: appTheme.theme.primarySoft }]}>
            <View style={[styles.heroIcon, { backgroundColor: appTheme.tint }]}>
              <Droplets color={appTheme.primary} size={30} />
            </View>
            <Text style={typography.eyebrow}>Ücretsiz gebelik desteği</Text>
            <Text style={typography.heading1}>Su ve takviye rehberi</Text>
            <Text numberOfLines={3} style={styles.heroText}>
              Şu an hesaplanan dönem: {currentMonth}. ay, {currentWeek}. hafta.
              Bilgiler genel halk sağlığı rehberidir; reçete veya kişisel tedavi planı
              değildir.
            </Text>
          </View>
        </Reveal>

        <Card style={[styles.waterCard, { backgroundColor: appTheme.theme.primarySoft }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={typography.eyebrow}>Günlük su</Text>
              <Text style={typography.heading2}>Genel hedef: yaklaşık 2–2,5 litre</Text>
            </View>
            <Droplets color={appTheme.primary} size={30} />
          </View>
          <ExpandableText
            collapsedLines={2}
            lessLabel="Su notunu kapat"
            moreLabel="Su hedefi hakkında"
            style={styles.bodyText}
            text="Suyu gün içine yay. Sıcak hava, egzersiz, ateş, kusma veya ishalde ihtiyaç artabilir. WHO Avrupa sıcak havalarda gebeler için günde 2–3 litre suyu, sıcakta biraz daha fazlasını hatırlatır."
          />
          <DailyWaterTracker
            draftGoal={draftWaterGoal}
            editingGoal={editingWaterGoal}
            intake={waterIntake}
            onCancelGoalEdit={() => {
              setDraftWaterGoal(
                waterIntake?.goal ?? DEFAULT_DAILY_WATER_GLASSES
              );
              setEditingWaterGoal(false);
            }}
            onChangeGoal={setDraftWaterGoal}
            onEditGoal={() => {
              setDraftWaterGoal(
                waterIntake?.goal ?? DEFAULT_DAILY_WATER_GLASSES
              );
              setEditingWaterGoal(true);
            }}
            onSaveGoal={() => void saveWaterGoal()}
            onSelectGlass={(glassNumber) =>
              void updateWaterProgress(glassNumber)
            }
            saving={savingWaterIntake}
          />
          <View style={styles.reminderBox}>
            <BellRing color={appTheme.primary} size={24} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.label}>Nazik su molaları</Text>
              <Text style={styles.smallText}>{WATER_REMINDER_TIME_LABEL}</Text>
            </View>
          </View>
          <Button
            disabled={updatingReminders}
            label={
              updatingReminders
                ? "Güncelleniyor…"
                : waterRemindersEnabled
                  ? "Su hatırlatmalarını kapat"
                  : "Su hatırlatmalarını aç"
            }
            onPress={toggleWaterReminders}
            variant={waterRemindersEnabled ? "secondary" : "primary"}
          />
          <Text style={styles.safetyFinePrint}>
            Kalp/böbrek hastalığı, ciddi ödem, preeklampsi takibi veya sıvı kısıtlaması
            varsa genel hedef yerine doktorunun verdiği miktarı uygula.
          </Text>
        </Card>

        <Pressable
          accessibilityHint="Gebelik ayı, vitamin ve takviye bilgilerini gösterir"
          accessibilityRole="button"
          accessibilityState={{ expanded: guidanceExpanded }}
          onPress={() => setGuidanceExpanded((current) => !current)}
          style={({ pressed }) => [
            styles.guidanceDisclosure,
            { borderColor: appTheme.primary },
            pressed && styles.controlPressed
          ]}
        >
          <View style={styles.guidanceDisclosureCopy}>
            <Text style={[styles.guidanceDisclosureEyebrow, { color: appTheme.primary }]}>
              Daha fazla bilgi al
            </Text>
            <Text style={styles.guidanceDisclosureTitle}>
              Vitamin ve takviye rehberini oku
            </Text>
            <Text style={styles.guidanceDisclosureBody}>
              {selectedMonth}. aya uygun genel program ve güvenlik notları
            </Text>
          </View>
          <View style={[styles.guidanceDisclosureIcon, { backgroundColor: appTheme.theme.primarySoft }]}>
            {guidanceExpanded ? (
              <ChevronUp color={appTheme.primary} size={22} strokeWidth={2.4} />
            ) : (
              <ChevronDown color={appTheme.primary} size={22} strokeWidth={2.4} />
            )}
          </View>
        </Pressable>

        {guidanceExpanded ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            exiting={reducedMotion ? undefined : FadeOut.duration(120)}
            style={styles.guidanceContent}
          >
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Gebelik ayını seç</Text>
                <Text style={typography.body}>
                  {selectedMonth}. ay yaklaşık {range.startWeek}–{range.endWeek}. haftaları
                  kapsar.
                </Text>
              </View>
              <Pill color={appTheme.primary} size={28} />
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={styles.monthRail}
              showsHorizontalScrollIndicator={false}
            >
              {pregnancyMonths.map((item) => {
                const selected = item.month === selectedMonth;
                return (
                  <Pressable
                    key={item.month}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMonth(item.month)}
                    style={[
                      styles.monthChip,
                      selected && {
                        backgroundColor: appTheme.primary,
                        borderColor: appTheme.primary
                      }
                    ]}
                  >
                    <Text style={[styles.monthChipText, selected && styles.monthChipTextSelected]}>
                      {item.month}. ay
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Card>

        {guidance.length > 0 ? (
          guidance.map((item) => (
            <GuidanceCard key={item.id} item={item} onOpenSource={openSource} />
          ))
        ) : (
          <Card>
            <Text style={typography.body}>
              Bu ay başlayan yeni bir rutin takviye bulunmuyor. Daha önce doktorunla
              planlanan desteği aynı şekilde sürdür.
            </Text>
          </Card>
        )}

        <Card style={styles.cautionCard}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.cautionEyebrow}>KENDİ KENDİNE BAŞLAMA</Text>
              <Text style={typography.heading2}>Her vitamin herkese gerekli değildir</Text>
            </View>
            <ShieldAlert color={colors.danger} size={30} />
          </View>
          <ExpandableText
            collapsedLines={3}
            lessLabel="Uyarıyı kapat"
            moreLabel="Nedenini oku"
            style={styles.bodyText}
            text={
              "Kalsiyum desteği WHO’ya göre özellikle besinle kalsiyum alımının düşük olduğu topluluklarda ve klinik değerlendirmeyle düşünülür. İyot ve B12; beslenme, tiroit durumu, vegan beslenme, emilim sorunu ve kan sonuçlarına göre değerlendirilir.\n\n" +
              "Rutin yüksek doz A vitamini kullanma; prenatal ürünleri üst üste alma. WHO, rutin A vitamini desteğini yalnızca ciddi toplum düzeyi eksiklikte önerir; C+E, B6 ve çoklu mikrobesin ürünleri de herkese otomatik öneri değildir."
            }
          />
          <Text style={styles.safetyFinePrint}>
            Demir ve kalsiyum takviyeleri birbirinin emilimini etkileyebilir. İkisi de
            reçetelendiyse kullanım saatini doktor veya eczacıyla netleştir.
          </Text>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Resmî kaynaklar</Text>
                <Text style={typography.body}>
                  İçerik özetlenmiştir; bağlantılar belgenin aslına gider.
                </Text>
              </View>
              <Info color={appTheme.primary} size={26} />
            </View>
            {pregnancyGuidanceSources.map((source) => (
              <Pressable
                key={source.id}
                accessibilityRole="link"
                onPress={() => void openSource(source.url)}
                style={styles.sourceRow}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.sourcePublisher}>{source.publisher}</Text>
                  <Text numberOfLines={2} style={styles.sourceTitle}>{source.title}</Text>
                </View>
                <ExternalLink color={appTheme.primary} size={18} />
              </Pressable>
            ))}
          </View>
        </Card>
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}

function DailyWaterTracker({
  draftGoal,
  editingGoal,
  intake,
  onCancelGoalEdit,
  onChangeGoal,
  onEditGoal,
  onSaveGoal,
  onSelectGlass,
  saving
}: {
  draftGoal: number;
  editingGoal: boolean;
  intake: DailyWaterIntake | null;
  onCancelGoalEdit: () => void;
  onChangeGoal: (goal: number) => void;
  onEditGoal: () => void;
  onSaveGoal: () => void;
  onSelectGlass: (glassNumber: number) => void;
  saving: boolean;
}) {
  const appTheme = useAppTheme();

  if (!intake) {
    return (
      <View style={styles.waterTrackerLoading}>
        <ActivityIndicator color={appTheme.primary} />
        <Text style={styles.smallText}>Bugünkü su hedefin yükleniyor…</Text>
      </View>
    );
  }

  if (editingGoal || intake.goal === null) {
    const canDecrease = draftGoal > MIN_DAILY_WATER_GLASSES;
    const canIncrease = draftGoal < MAX_DAILY_WATER_GLASSES;
    const hasExistingGoal = intake.goal !== null;

    return (
      <View style={styles.waterTrackerBox}>
        <View style={styles.waterTrackerHeading}>
          <Text style={typography.heading3}>
            Bugün kaç bardak su içmek istersin?
          </Text>
          <Text style={styles.smallText}>
            Günlük hedefini 7–16 bardak arasında seç. İlerlemen gece 00.00’da
            sıfırlanır.
          </Text>
        </View>

        <View style={styles.goalStepper}>
          <Pressable
            accessibilityLabel="Günlük su hedefini bir bardak azalt"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDecrease || saving }}
            disabled={!canDecrease || saving}
            onPress={() => onChangeGoal(draftGoal - 1)}
            style={({ pressed }) => [
              styles.goalStepperButton,
              (!canDecrease || saving) && styles.controlDisabled,
              pressed && styles.controlPressed
            ]}
          >
            <Minus color={colors.text} size={22} />
          </Pressable>

          <View
            accessibilityLabel={`Günlük hedef ${draftGoal} bardak`}
            style={styles.goalValue}
          >
            <Text style={[styles.goalNumber, { color: appTheme.primary }]}>
              {draftGoal}
            </Text>
            <Text style={styles.goalUnit}>bardak</Text>
          </View>

          <Pressable
            accessibilityLabel="Günlük su hedefini bir bardak artır"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canIncrease || saving }}
            disabled={!canIncrease || saving}
            onPress={() => onChangeGoal(draftGoal + 1)}
            style={({ pressed }) => [
              styles.goalStepperButton,
              (!canIncrease || saving) && styles.controlDisabled,
              pressed && styles.controlPressed
            ]}
          >
            <Plus color={colors.text} size={22} />
          </Pressable>
        </View>

        <Button
          disabled={saving}
          label={
            saving
              ? "Kaydediliyor…"
              : hasExistingGoal
                ? "Hedefi güncelle"
                : "Bugünkü hedefi başlat"
          }
          onPress={onSaveGoal}
        />

        {hasExistingGoal ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCancelGoalEdit}
            style={({ pressed }) => [
              styles.cancelGoalButton,
              pressed && styles.controlPressed
            ]}
          >
            <Text style={[styles.changeGoalText, { color: appTheme.primary }]}>
              Vazgeç
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const percentage = Math.round((intake.consumed / intake.goal) * 100);
  const remaining = intake.goal - intake.consumed;

  return (
    <View style={styles.waterTrackerBox}>
      <View style={styles.progressHeading}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={typography.heading3}>Bugünkü su ilerlemen</Text>
          <Text style={styles.smallText}>
            Birkaç bardak içtiysen ilerideki boş bardağa dokunabilirsin.
          </Text>
        </View>
        <Text style={[styles.progressCount, { color: appTheme.primary }]}>
          {intake.consumed}/{intake.goal}
        </Text>
      </View>

      <View
        accessibilityLabel={`Günlük su hedefinin yüzde ${percentage} kadarı tamamlandı`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: intake.goal,
          min: 0,
          now: intake.consumed
        }}
        style={styles.progressTrack}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: appTheme.primary,
              width: `${percentage}%` as `${number}%`
            }
          ]}
        />
      </View>

      <View style={styles.waterGlassGrid}>
        {Array.from({ length: intake.goal }, (_, index) => {
          const glassNumber = index + 1;
          const filled = glassNumber <= intake.consumed;

          return (
            <Pressable
              key={glassNumber}
              accessibilityHint={
                filled
                  ? "Bu bardaktan sonraki ilerlemeyi geri alır."
                  : "Bu bardağa kadar olan ilerlemeyi dolu işaretler."
              }
              accessibilityLabel={`${glassNumber}. bardak, ${filled ? "içildi" : "boş"}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, selected: filled }}
              disabled={saving}
              onPress={() => onSelectGlass(glassNumber)}
              style={({ pressed }) => [
                styles.waterGlassButton,
                filled && {
                  backgroundColor: appTheme.tint,
                  borderColor: appTheme.primary
                },
                saving && styles.controlDisabled,
                pressed && styles.controlPressed
              ]}
            >
              <WaterGlassIcon color={appTheme.primary} filled={filled} />
              <Text
                style={[
                  styles.waterGlassNumber,
                  filled && { color: appTheme.primary }
                ]}
              >
                {glassNumber}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.progressMessage}>
        {remaining === 0
          ? "Bugünkü hedefine ulaştın. Ellerine sağlık!"
          : `Bugünkü hedefin için ${remaining} bardak kaldı.`}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={onEditGoal}
        style={({ pressed }) => [
          styles.changeGoalButton,
          pressed && styles.controlPressed
        ]}
      >
        <Text style={[styles.changeGoalText, { color: appTheme.primary }]}>
          Bugünkü hedefi değiştir
        </Text>
      </Pressable>
    </View>
  );
}

function WaterGlassIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg height={38} viewBox="0 0 40 48" width={32}>
      <Path
        d="M7 5h26l-3.2 35.5a3 3 0 0 1-3 2.5H13.2a3 3 0 0 1-3-2.5L7 5Z"
        fill={colors.surfaceStrong}
        stroke={filled ? color : colors.textMuted}
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
      {filled ? (
        <Path
          d="M8.4 13c3.7-2.2 7 2.2 10.8 0 3.7-2.2 7.2 2.2 12.4 0l-2.5 27.2c-.1 1-1 1.8-2 1.8H12.9c-1 0-1.9-.8-2-1.8L8.4 13Z"
          fill={color}
        />
      ) : null}
    </Svg>
  );
}

function GuidanceCard({
  item,
  onOpenSource
}: {
  item: PregnancySupplementGuidance;
  onOpenSource: (url: string) => Promise<void>;
}) {
  const appTheme = useAppTheme();
  const sources = getSourcesByIds(item.sourceIds);

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={typography.eyebrow}>{item.timing}</Text>
            <Text style={typography.heading2}>{item.title}</Text>
          </View>
          <View style={[styles.pillIcon, { backgroundColor: appTheme.tint }]}>
            <Pill color={appTheme.primary} size={24} />
          </View>
        </View>
        <View style={[styles.amountBox, { backgroundColor: appTheme.theme.primarySoft }]}>
          <Text style={styles.amountLabel}>GENEL PROGRAM BİLGİSİ</Text>
          <Text style={styles.amountText}>{item.amount}</Text>
        </View>
        <ExpandableText
          collapsedLines={3}
          lessLabel="Özeti kapat"
          moreLabel="Detaylı bilgiyi aç"
          style={styles.bodyText}
          text={item.body}
        />
        <View style={styles.warningBox}>
          <ShieldAlert color={colors.danger} size={20} />
          <Text style={styles.warningText}>{item.warning}</Text>
        </View>
        <View style={styles.inlineSources}>
          {sources.map((source) => (
            <Pressable
              key={source.id}
              accessibilityRole="link"
              onPress={() => void onOpenSource(source.url)}
            >
              <Text style={[styles.inlineSourceText, { color: appTheme.primary }]}>
                {source.publisher} ↗
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Geri"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={styles.backButton}
    >
      <ArrowLeft color={colors.text} size={22} />
      <Text style={styles.backText}>Hamilelik araçları</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 40
  },
  backText: { ...typography.label, color: colors.text },
  hero: { ...radii.cardLarge, gap: spacing.sm, padding: spacing.lg },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  heroText: { ...typography.body, color: colors.text },
  waterCard: { gap: spacing.md },
  waterTrackerLoading: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.md,
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.lg
  },
  waterTrackerBox: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md
  },
  waterTrackerHeading: { gap: spacing.xs },
  goalStepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "center"
  },
  goalStepperButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  goalValue: {
    alignItems: "center",
    minWidth: 88
  },
  goalNumber: {
    fontFamily: fonts.dataBold,
    fontSize: 36,
    lineHeight: 42
  },
  goalUnit: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18
  },
  progressHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  progressCount: {
    fontFamily: fonts.dataBold,
    fontSize: 22,
    lineHeight: 28
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  progressFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  waterGlassGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center"
  },
  waterGlassButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 64,
    paddingVertical: spacing.xs,
    width: 52
  },
  waterGlassNumber: {
    color: colors.textMuted,
    fontFamily: fonts.dataBold,
    fontSize: 12,
    lineHeight: 14
  },
  progressMessage: {
    ...typography.bodyStrong,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  changeGoalButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
  },
  cancelGoalButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
  },
  changeGoalText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20
  },
  controlDisabled: { opacity: 0.45 },
  controlPressed: { opacity: 0.68 },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  bodyText: { ...typography.body, color: colors.text },
  reminderBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  smallText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  safetyFinePrint: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 20
  },
  guidanceDisclosure: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 92,
    padding: spacing.lg
  },
  guidanceDisclosureCopy: {
    flex: 1,
    gap: 2
  },
  guidanceDisclosureEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 18,
    textTransform: "uppercase"
  },
  guidanceDisclosureTitle: {
    ...typography.heading3,
    color: colors.text
  },
  guidanceDisclosureBody: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  guidanceDisclosureIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  guidanceContent: { gap: spacing.lg },
  monthRail: { gap: spacing.sm, paddingRight: spacing.md },
  monthChip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  monthChipText: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textAlign: "center"
  },
  monthChipTextSelected: { color: colors.onPrimary },
  pillIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  amountBox: { borderRadius: radii.md, gap: spacing.xs, padding: spacing.md },
  amountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4
  },
  amountText: { ...typography.bodyStrong, color: colors.text },
  warningBox: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  warningText: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 20
  },
  inlineSources: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  inlineSourceText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textDecorationLine: "underline"
  },
  cautionCard: { backgroundColor: colors.accentSoft, gap: spacing.md },
  cautionEyebrow: {
    color: colors.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5
  },
  sourceRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 54,
    paddingVertical: spacing.sm
  },
  sourcePublisher: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  sourceTitle: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20
  }
});
