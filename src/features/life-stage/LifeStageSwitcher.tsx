import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Baby,
  CalendarHeart,
  Check,
  CheckCircle2,
  ChevronRight,
  X
} from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import {
  completePregnancyWithBirth,
  type Baby as BabyRecord,
  type BabyGender,
  type FeedingMode
} from "@/api/babies";
import { updateCurrentProfile, type Profile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { DatePickerField } from "@/components/DatePickerField";
import { PregnancyAgeField } from "@/components/PregnancyAgeField";
import { TextField } from "@/components/TextField";
import { setWaterRemindersEnabled } from "@/features/pregnancy/waterReminders";
import { trackEvent } from "@/lib/analytics";
import {
  getPregnancyAgeError,
  getPregnancyAgeFromDueDate,
  getPregnancyDueDateFromAge,
  toDateOnly
} from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";
import {
  getExperienceStage,
  lifeStageContent,
  suspendLocalCareNotifications,
  type LifeStage
} from "@/features/life-stage/lifeStage";

type TransitionPhase = "confirm" | "running" | "success" | "error";

type LifeStageSwitcherProps = {
  existingBaby: BabyRecord | null;
  hasBaby: boolean;
  profile: Profile;
};

export function LifeStageSwitcher({
  existingBaby,
  hasBaby,
  profile
}: LifeStageSwitcherProps) {
  const appTheme = useAppTheme().theme;
  const { showInfo } = useFeedback();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const experienceStage = getExperienceStage(profile, hasBaby);
  const activeStage: LifeStage | null =
    experienceStage === "pregnancy"
      ? "pregnancy"
      : experienceStage === "postpartum"
        ? "motherhood"
        : null;
  const [targetStage, setTargetStage] = useState<LifeStage | null>(null);
  const [phase, setPhase] = useState<TransitionPhase>("confirm");
  const initialPregnancyAge = getPregnancyAgeFromDueDate(profile.due_date);
  const [pregnancyWeek, setPregnancyWeek] = useState(
    initialPregnancyAge ? String(initialPregnancyAge.week) : ""
  );
  const [pregnancyDay, setPregnancyDay] = useState(
    initialPregnancyAge ? String(initialPregnancyAge.day) : "0"
  );
  const [babyName, setBabyName] = useState(existingBaby?.name ?? "");
  const [birthDate, setBirthDate] = useState(
    existingBaby?.birth_date ?? toDateOnly(new Date())
  );
  const [babyGender, setBabyGender] = useState<BabyGender>(
    existingBaby?.gender ?? "belirtilmemis"
  );
  const [feedingMode, setFeedingMode] = useState<FeedingMode>(
    profile.feeding_mode ?? "mixed"
  );
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Tercihin hazırlanıyor");
  const [errorMessage, setErrorMessage] = useState("");
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    const pregnancyAge = getPregnancyAgeFromDueDate(profile.due_date);
    setPregnancyWeek(pregnancyAge ? String(pregnancyAge.week) : "");
    setPregnancyDay(pregnancyAge ? String(pregnancyAge.day) : "0");
  }, [profile.due_date]);

  useEffect(() => {
    if (!existingBaby) return;
    setBabyName(existingBaby.name);
    setBirthDate(existingBaby.birth_date);
    setBabyGender(existingBaby.gender ?? "belirtilmemis");
  }, [existingBaby]);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: animatedProgress.value }]
  }));

  function setTransitionProgress(value: number, label: string) {
    setProgress(value);
    setProgressLabel(label);
    animatedProgress.value = withTiming(value, {
      duration: reducedMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic)
    });
  }

  function requestStage(stage: LifeStage) {
    if (stage === activeStage) return;
    if (
      stage === "pregnancy" &&
      getPregnancyAgeError(
        Number.parseInt(pregnancyWeek, 10),
        Number.parseInt(pregnancyDay, 10)
      )
    ) {
      setPregnancyWeek("");
      setPregnancyDay("0");
    }
    setTargetStage(stage);
    setPhase("confirm");
    setProgress(0);
    setProgressLabel("Tercihin hazırlanıyor");
    setErrorMessage("");
    animatedProgress.value = 0;
  }

  function closeModal() {
    if (phase === "running") return;
    setTargetStage(null);
    setPhase("confirm");
    setErrorMessage("");
  }

  async function switchStage() {
    if (!targetStage) return;
    const requiresBirthDetails =
      targetStage === "motherhood" && experienceStage !== "postpartum";
    const week = Number.parseInt(pregnancyWeek, 10);
    const day = Number.parseInt(pregnancyDay, 10);
    const pregnancyAgeError =
      targetStage === "pregnancy" ? getPregnancyAgeError(week, day) : null;
    const dueDate =
      targetStage === "pregnancy"
        ? getPregnancyDueDateFromAge(week, day)
        : profile.due_date;
    if (pregnancyAgeError || (targetStage === "pregnancy" && !dueDate)) {
      setErrorMessage(
        pregnancyAgeError ?? "Gebelik haftanı ve gününü kontrol et."
      );
      return;
    }
    if (requiresBirthDetails && !babyName.trim()) {
      setErrorMessage("Bebeğinin adını yazmalısın.");
      return;
    }
    if (
      requiresBirthDetails &&
      (!birthDate || Date.parse(`${birthDate}T00:00:00`) > Date.now())
    ) {
      setErrorMessage("Doğum tarihi bugün veya daha önce olmalı.");
      return;
    }

    setErrorMessage("");
    setPhase("running");
    setTransitionProgress(
      0.12,
      requiresBirthDetails
        ? existingBaby
          ? "Mevcut çocuk profili doğum bilgileriyle güncelleniyor"
          : "Bebek profili ve doğum kaydı oluşturuluyor"
        : "Yaşam evren kaydediliyor"
    );

    try {
      let updatedProfile: Profile;
      if (requiresBirthDetails) {
        const result = await completePregnancyWithBirth({
          babyId: existingBaby?.id ?? null,
          babyName,
          birthDate,
          gender: babyGender,
          feedingMode
        });
        updatedProfile = result.profile;
        queryClient.setQueryData(
          ["babies"],
          (current: unknown) => {
            if (!Array.isArray(current)) return [result.baby];
            return current.some((baby) => baby?.id === result.baby.id)
              ? current.map((baby) =>
                  baby?.id === result.baby.id ? result.baby : baby
                )
              : [...current, result.baby];
          }
        );
      } else {
        updatedProfile = await updateCurrentProfile({
          is_pregnant: targetStage === "pregnancy",
          due_date: targetStage === "pregnancy" ? dueDate : profile.due_date
        });
      }
      queryClient.setQueryData(["current-profile"], updatedProfile);

      setTransitionProgress(0.48, "Hatırlatmalar yeni evrene uyarlanıyor");
      let notificationAdjustmentFailed = false;
      try {
        if (targetStage === "pregnancy") {
          await suspendLocalCareNotifications();
        } else {
          await setWaterRemindersEnabled(false);
        }
      } catch {
        notificationAdjustmentFailed = true;
      }

      setTransitionProgress(0.76, "Ana ekranın ve menün kişiselleştiriliyor");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["current-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["babies"] }),
        queryClient.invalidateQueries({ queryKey: ["active-vaccine-reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["next-upcoming-vaccination"] }),
        queryClient.invalidateQueries({ queryKey: ["pregnancy-vaccinations"] }),
        queryClient.invalidateQueries({ queryKey: ["baby-vaccinations"] }),
        queryClient.invalidateQueries({ queryKey: ["care-journal"] })
      ]);

      setTransitionProgress(1, "Yeni deneyimin hazır");
      setPhase("success");
      trackEvent("life_stage_changed", {
        from: experienceStage,
        to: targetStage
      }).catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      if (notificationAdjustmentFailed) {
        showInfo(
          "Yaşam evren değişti. Cihaz hatırlatmalarını Profil > Bildirim tercihleri bölümünden kontrol edebilirsin.",
          "Bildirim kontrolü gerekli"
        );
      }

      await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 180 : 650));
      setTargetStage(null);
      router.replace("/home");
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Mod değiştirilemedi. Bağlantını kontrol edip yeniden deneyebilirsin."
      );
    }
  }

  return (
    <>
      <View
        accessibilityLabel={
          activeStage
            ? `Aktif yaşam evresi: ${lifeStageContent[activeStage].label}`
            : "Yaşam evresi henüz seçilmedi"
        }
        style={styles.stageSection}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={typography.heading2}>Yaşam evren</Text>
            <Text style={styles.sectionDescription}>
              Uygulamadaki araçlar ve içerikler seçtiğin evreye göre sadeleşir.
            </Text>
          </View>
          <View style={[styles.activeBadge, { backgroundColor: appTheme.primarySoft }]}>
            {activeStage ? (
              <Check color={appTheme.primary} size={16} strokeWidth={2.8} />
            ) : (
              <ChevronRight color={appTheme.primary} size={16} strokeWidth={2.8} />
            )}
            <Text style={[styles.activeBadgeText, { color: appTheme.primary }]}>
              {activeStage ? "Aktif" : "Seçim gerekli"}
            </Text>
          </View>
        </View>

        <View accessibilityRole="radiogroup" style={styles.options}>
          <StageOption
            active={activeStage === "pregnancy"}
            description={lifeStageContent.pregnancy.shortDescription}
            icon={<CalendarHeart color={appTheme.primary} size={24} />}
            label={lifeStageContent.pregnancy.label}
            onPress={() => requestStage("pregnancy")}
          />
          <StageOption
            active={activeStage === "motherhood"}
            description={lifeStageContent.motherhood.shortDescription}
            icon={<Baby color={appTheme.primary} size={24} />}
            label={lifeStageContent.motherhood.label}
            onPress={() => requestStage("motherhood")}
          />
        </View>

        <View style={[styles.preservationNote, { backgroundColor: appTheme.primarySoft }]}>
          <Text style={[styles.preservationTitle, { color: appTheme.primary }]}>Ortak alanların hep açık kalır</Text>
          <Text style={styles.preservationBody}>
            Geçişlerde mevcut çocuk profilin ve tüm geçmiş kayıtları korunur. Yalnızca henüz çocuk profili yoksa ilk doğum kaydı oluşturulur.
          </Text>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeModal}
        statusBarTranslucent
        transparent
        visible={Boolean(targetStage)}
      >
        {targetStage && phase === "confirm" ? (
          <SafeAreaView style={styles.scrim}>
            <ScrollView
              accessibilityViewIsModal
              contentContainerStyle={styles.confirmationSheetContent}
              keyboardShouldPersistTaps="handled"
              style={styles.confirmationSheet}
            >
              <View style={styles.modalHeader}>
                <View style={[styles.modalIcon, { backgroundColor: appTheme.primarySoft }]}>
                  {targetStage === "pregnancy" ? (
                    <CalendarHeart color={appTheme.primary} size={28} />
                  ) : (
                    <Baby color={appTheme.primary} size={28} />
                  )}
                </View>
                <Pressable
                  accessibilityLabel="Pencereyi kapat"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={closeModal}
                  style={styles.closeButton}
                >
                  <X color={colors.textMuted} size={22} />
                </Pressable>
              </View>

              <View style={styles.confirmationCopy}>
                <Text style={typography.heading1}>
                  {targetStage === "motherhood" && experienceStage !== "postpartum"
                    ? existingBaby
                      ? "Doğum sonrasına geç"
                      : "Doğum gerçekleşti mi?"
                    : `${lifeStageContent[targetStage].label} moduna geç`}
                </Text>
                <Text style={styles.sectionDescription}>
                  {targetStage === "motherhood" && experienceStage !== "postpartum"
                    ? existingBaby
                      ? `${existingBaby.name} profili korunacak; doğum bilgileri aynı kayıt üzerinde güncellenecek.`
                      : "Doğum bilgilerini bir kez gir; bebek profili, aşı takvimi, bakım araçları ve bildirimler birlikte hazırlansın."
                    : "Ana ekranın, menün, bildirimlerin ve kısayolların bu evre için yeniden düzenlenecek."}
                </Text>
              </View>

              <View style={styles.featureList}>
                {lifeStageContent[targetStage].features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <CheckCircle2 color={appTheme.primary} size={19} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {targetStage === "pregnancy" ? (
                <PregnancyAgeField
                  day={pregnancyDay}
                  error={errorMessage || undefined}
                  onDayChange={(value) => {
                    setPregnancyDay(value);
                    setErrorMessage("");
                  }}
                  onWeekChange={(value) => {
                    setPregnancyWeek(value);
                    setErrorMessage("");
                  }}
                  week={pregnancyWeek}
                />
              ) : null}

              {targetStage === "motherhood" && experienceStage !== "postpartum" ? (
                <View style={styles.birthForm}>
                  <TextField
                    autoCapitalize="words"
                    label="Bebeğinin adı"
                    onChangeText={(value) => {
                      setBabyName(value);
                      setErrorMessage("");
                    }}
                    value={babyName}
                  />
                  <DatePickerField
                    label="Doğum tarihi"
                    maximumDate={new Date()}
                    onChange={(value) => {
                      setBirthDate(value);
                      setErrorMessage("");
                    }}
                    value={birthDate}
                  />
                  <ChoiceGroup
                    label="Cinsiyet"
                    options={[
                      { label: "Kız", value: "kiz" },
                      { label: "Erkek", value: "erkek" },
                      { label: "Belirtmek istemiyorum", value: "belirtilmemis" }
                    ]}
                    value={babyGender}
                    onChange={(value) => setBabyGender(value as BabyGender)}
                  />
                  <ChoiceGroup
                    label="Beslenme akışı"
                    options={[
                      { label: "Emzirme", value: "breastfeeding" },
                      { label: "Sağım", value: "pumping" },
                      { label: "Karma", value: "mixed" },
                      { label: "Mama", value: "formula" }
                    ]}
                    value={feedingMode}
                    onChange={(value) => setFeedingMode(value as FeedingMode)}
                  />
                </View>
              ) : null}

              {errorMessage && targetStage !== "pregnancy" ? (
                <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
                  {errorMessage}
                </Text>
              ) : null}

              <View style={styles.modalActions}>
                <Button
                  label={
                    targetStage === "motherhood" && experienceStage !== "postpartum"
                      ? existingBaby
                        ? "Aynı profille doğum sonrasına geç"
                        : "Doğum sonrası akışı başlat"
                      : `${lifeStageContent[targetStage].label} moduna geç`
                  }
                  onPress={() => void switchStage()}
                />
                <Button label="Vazgeç" onPress={closeModal} variant="ghost" />
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={styles.transitionScreen}>
            <View accessibilityViewIsModal style={styles.transitionContent}>
              <View
                style={[
                  styles.transitionIcon,
                  { backgroundColor: appTheme.primarySoft, borderColor: appTheme.primary }
                ]}
              >
                {phase === "success" ? (
                  <Check color={appTheme.primary} size={38} strokeWidth={2.5} />
                ) : targetStage === "pregnancy" ? (
                  <CalendarHeart color={appTheme.primary} size={38} />
                ) : (
                  <Baby color={appTheme.primary} size={38} />
                )}
              </View>

              <View style={styles.transitionCopy}>
                <Text style={[styles.transitionEyebrow, { color: appTheme.primary }]}>Yaşayan İplik</Text>
                <Text style={styles.transitionTitle}>
                  {phase === "success"
                    ? `${lifeStageContent[targetStage ?? "motherhood"].label} deneyimin hazır`
                    : phase === "error"
                      ? "Geçiş tamamlanamadı"
                      : "Uygulaman sana göre hazırlanıyor"}
                </Text>
                <Text accessibilityLiveRegion="polite" style={styles.transitionDescription}>
                  {phase === "error" ? errorMessage : progressLabel}
                </Text>
              </View>

              <View
                accessibilityLabel={`Mod geçişi yüzde ${Math.round(progress * 100)} tamamlandı`}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
                style={styles.progressArea}
              >
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { backgroundColor: appTheme.primary },
                      progressStyle
                    ]}
                  />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressLabel}>Kişiselleştirme</Text>
                  <Text style={[styles.progressValue, { color: appTheme.primary }]}>
                    %{Math.round(progress * 100)}
                  </Text>
                </View>
              </View>

              {phase === "error" ? (
                <View style={styles.errorActions}>
                  <Button label="Yeniden dene" onPress={() => void switchStage()} />
                  <Button label="Profilde kal" onPress={closeModal} variant="ghost" />
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </>
  );
}

function ChoiceGroup({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const appTheme = useAppTheme().theme;

  return (
    <View style={styles.choiceGroup}>
      <Text style={typography.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.choiceRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choiceButton,
                active && {
                  backgroundColor: appTheme.primarySoft,
                  borderColor: appTheme.primary
                },
                pressed && styles.stageOptionPressed
              ]}
            >
              <Text
                style={[
                  styles.choiceButtonText,
                  active && { color: appTheme.primary }
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StageOption({
  active,
  description,
  icon,
  label,
  onPress
}: {
  active: boolean;
  description: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme().theme;

  return (
    <Pressable
      accessibilityHint={active ? "Şu anda seçili" : `${label} moduna geçişi açar`}
      accessibilityLabel={`${label}: ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled: active }}
      disabled={active}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stageOption,
        active && { backgroundColor: appTheme.primarySoft, borderColor: appTheme.primary },
        pressed && styles.stageOptionPressed
      ]}
    >
      <View style={[styles.stageOptionIcon, { backgroundColor: colors.surface }]}>{icon}</View>
      <View style={styles.stageOptionCopy}>
        <Text style={styles.stageOptionTitle}>{label}</Text>
        <Text style={styles.stageOptionDescription}>{description}</Text>
      </View>
      {active ? (
        <Check color={appTheme.primary} size={21} strokeWidth={2.7} />
      ) : (
        <ChevronRight color={colors.textMuted} size={21} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  activeBadgeText: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18
  },
  closeButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48
  },
  birthForm: { gap: spacing.lg },
  choiceButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  choiceButtonText: { ...typography.label, color: colors.text },
  choiceGroup: { gap: spacing.sm },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  confirmationCopy: { gap: spacing.sm },
  confirmationSheet: {
    ...radii.cardLarge,
    backgroundColor: colors.surface,
    maxHeight: "92%",
    maxWidth: 540,
    width: "100%"
  },
  confirmationSheetContent: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  errorActions: { gap: spacing.sm, width: "100%" },
  errorText: {
    ...typography.body,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  },
  featureList: { gap: spacing.sm },
  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 28
  },
  featureText: { ...typography.body, color: colors.text, flex: 1 },
  headingCopy: { flex: 1, gap: spacing.xs },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  modalActions: { gap: spacing.sm },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  options: { gap: spacing.sm },
  preservationBody: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  preservationNote: {
    ...radii.card,
    gap: spacing.xs,
    padding: spacing.md
  },
  preservationTitle: { ...typography.label },
  progressArea: { gap: spacing.sm, width: "100%" },
  progressFill: {
    borderRadius: radii.pill,
    height: "100%",
    transformOrigin: "left"
  },
  progressLabel: { ...typography.label, color: colors.textMuted },
  progressMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden",
    width: "100%"
  },
  progressValue: { ...typography.data },
  scrim: {
    alignItems: "center",
    backgroundColor: "rgba(39, 33, 36, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  sectionDescription: { ...typography.body, color: colors.textMuted },
  stageOption: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 84,
    padding: spacing.md
  },
  stageOptionCopy: { flex: 1, gap: spacing.xs },
  stageOptionDescription: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  stageOptionIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  stageOptionPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  stageOptionTitle: { ...typography.heading3, color: colors.text },
  stageSection: { gap: spacing.lg },
  transitionContent: {
    alignItems: "center",
    gap: spacing.xxl,
    maxWidth: 520,
    paddingHorizontal: spacing.xl,
    width: "100%"
  },
  transitionCopy: { alignItems: "center", gap: spacing.sm },
  transitionDescription: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center"
  },
  transitionEyebrow: { ...typography.eyebrow },
  transitionIcon: {
    alignItems: "center",
    borderRadius: 44,
    borderWidth: 1,
    height: 88,
    justifyContent: "center",
    width: 88
  },
  transitionScreen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  },
  transitionTitle: {
    ...typography.heading1,
    color: colors.text,
    textAlign: "center"
  }
});
