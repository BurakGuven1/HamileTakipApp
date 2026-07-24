import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Baby,
  Bell,
  CalendarHeart,
  Check,
  ChevronLeft,
  Heart,
  Milk,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { createBaby, listBabies, updateBaby } from "@/api/babies";
import {
  getCurrentProfile,
  isNicknameAvailable,
  updateCurrentProfile
} from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { OnboardingThreadMoment } from "@/components/OnboardingThreadMoment";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Thread } from "@/components/Thread";
import { registerAndSavePushToken } from "@/lib/notifications";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import {
  colors,
  getSuggestedThemeForGender,
  radii,
  spacing,
  themeOptions,
  typography
} from "@/theme";
import type { ThemePreference } from "@/theme";

type OnboardingStep =
  | "family"
  | "status"
  | "details"
  | "feeding"
  | "theme"
  | "nickname"
  | "notifications";
type ParentStatus = "pregnant" | "baby" | "skip";
type BabyGender = "kiz" | "erkek" | "belirtilmemis";
type FeedingMode = "breastfeeding" | "pumping" | "mixed" | "formula";

const steps: { id: OnboardingStep; label: string }[] = [
  { id: "family", label: "Aile" },
  { id: "status", label: "Durum" },
  { id: "details", label: "Bilgiler" },
  { id: "feeding", label: "Beslenme" },
  { id: "theme", label: "Tema" },
  { id: "nickname", label: "Forum" },
  { id: "notifications", label: "Bildirim" }
];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const appTheme = useAppTheme();
  const { showError, showInfo } = useFeedback();
  const reducedMotion = useReducedMotion();
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [completionVisible, setCompletionVisible] = useState(false);
  const hasHydrated = useRef(false);
  const [step, setStep] = useState<OnboardingStep>("family");
  const [status, setStatus] = useState<ParentStatus>();
  const [motherName, setMotherName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [babyGender, setBabyGender] = useState<BabyGender>("belirtilmemis");
  const [createdBabyId, setCreatedBabyId] = useState<string>();
  const [feedingMode, setFeedingMode] = useState<FeedingMode>("mixed");
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [nickname, setNickname] = useState("");
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (
      hasHydrated.current ||
      !profileQuery.isFetched ||
      !babiesQuery.isFetched
    ) {
      return;
    }

    hasHydrated.current = true;
    if (!profile) return;

    const baby = babiesQuery.data?.[0];
    const restoredStatus: ParentStatus = profile.is_pregnant
      ? "pregnant"
      : baby
        ? "baby"
        : "skip";

    setStatus(restoredStatus);
    setMotherName(
      profile.mother_name && profile.mother_name !== "Anne"
        ? profile.mother_name
        : profile.display_name ?? ""
    );
    setFatherName(
      profile.father_name && profile.father_name !== "Baba"
        ? profile.father_name
        : ""
    );
    setDueDate(profile.due_date ?? "");
    setFeedingMode(profile.feeding_mode ?? "mixed");
    setThemePreference(profile.theme_preference ?? "auto");
    setNickname(profile.forum_nickname ?? "");

    if (baby) {
      setCreatedBabyId(baby.id);
      setBabyName(baby.name);
      setBirthDate(baby.birth_date);
      setBabyGender((baby.gender as BabyGender) ?? "belirtilmemis");
    }

    const restoredStep: Record<string, OnboardingStep> = {
      family_names_added: "status",
      details_added: "feeding",
      feeding_mode_selected: "theme",
      nickname_set: "notifications",
      theme_selected: "nickname"
    };

    if (profile.onboarding_step === "status_selected") {
      setStep(restoredStatus === "skip" ? "feeding" : "details");
      return;
    }

    setStep(restoredStep[profile.onboarding_step] ?? "family");
  }, [babiesQuery.data, babiesQuery.isFetched, profile, profileQuery.isFetched]);

  useEffect(() => {
    if (step !== "nickname" || nickname.trim().length < 3) {
      setNicknameAvailable(null);
      return;
    }

    const handle = setTimeout(() => {
      isNicknameAvailable(nickname.trim())
        .then(setNicknameAvailable)
        .catch(() => setNicknameAvailable(null));
    }, 300);

    return () => clearTimeout(handle);
  }, [nickname, step]);

  useEffect(
    () => () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    },
    []
  );

  const activeIndex = steps.findIndex((item) => item.id === step);
  const progressValue = useMemo(
    () => (activeIndex + 1) / steps.length,
    [activeIndex]
  );
  const suggestedThemeId =
    status === "baby" ? getSuggestedThemeForGender(babyGender) : "sage";
  const suggestedTheme = themeOptions.find((item) => item.id === suggestedThemeId);

  const updateStepMutation = useMutation({
    mutationFn: updateCurrentProfile,
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(["current-profile"], updatedProfile);
      await queryClient.invalidateQueries({ queryKey: ["current-profile"] });
    }
  });

  async function saveFamilyNames() {
    try {
      const cleanMotherName = motherName.trim();
      const cleanFatherName = fatherName.trim();

      if (cleanMotherName.length < 2 || cleanFatherName.length < 2) {
        showInfo("Anne ve baba adını en az 2 karakter olacak şekilde yazmalısın.", "İsimler gerekli");
        return;
      }

      await updateStepMutation.mutateAsync({
        mother_name: cleanMotherName,
        father_name: cleanFatherName,
        display_name: cleanMotherName,
        onboarding_step: "family_names_added"
      });

      if (profile?.onboarding_completed) {
        router.replace("/home");
        return;
      }

      setStep("status");
    } catch (error) {
      showError(error, "Aile bilgileri kaydedilemedi");
    }
  }

  async function chooseStatus(nextStatus: ParentStatus) {
    try {
      setStatus(nextStatus);

      if (nextStatus === "pregnant") {
        await updateStepMutation.mutateAsync({
          is_pregnant: true,
          onboarding_step: "status_selected"
        });
        setStep("details");
        return;
      }

      if (nextStatus === "baby") {
        await updateStepMutation.mutateAsync({
          is_pregnant: false,
          due_date: null,
          onboarding_step: "status_selected"
        });
        setStep("details");
        return;
      }

      await updateStepMutation.mutateAsync({
        is_pregnant: false,
        due_date: null,
        onboarding_step: "status_selected"
      });
      setStep("feeding");
    } catch (error) {
      showError(error, "Seçim kaydedilemedi");
    }
  }

  async function saveDetails() {
    try {
      if (!profile) {
        showInfo("Kurulum için tekrar giriş yap.", "Oturum gerekli");
        router.replace("/sign-in");
        return;
      }

      if (status === "pregnant") {
        if (!dueDate) {
          showInfo("Tahmini doğum tarihini seçmelisin.", "Tarih seç");
          return;
        }

        await updateStepMutation.mutateAsync({
          is_pregnant: true,
          due_date: dueDate,
          onboarding_step: "details_added"
        });
        setStep("feeding");
        return;
      }

      if (status === "baby") {
        if (!babyName.trim() || !birthDate) {
          showInfo("Bebek adı ve doğum tarihi gerekli.", "Bilgileri kontrol et");
          return;
        }

        if (createdBabyId) {
          await updateBaby(createdBabyId, {
            name: babyName.trim(),
            birth_date: birthDate,
            gender: babyGender
          });
        } else {
          const createdBaby = await createBaby({
            parent_id: profile.id,
            name: babyName.trim(),
            birth_date: birthDate,
            gender: babyGender
          });
          setCreatedBabyId(createdBaby.id);
        }
        await queryClient.invalidateQueries({ queryKey: ["babies"] });
        setThemePreference("auto");
        await updateStepMutation.mutateAsync({ onboarding_step: "details_added" });
        setStep("feeding");
        return;
      }

      setStep("feeding");
    } catch (error) {
      showError(error, "Bilgiler kaydedilemedi");
    }
  }

  async function saveFeedingMode() {
    try {
      await updateStepMutation.mutateAsync({
        feeding_mode: feedingMode,
        onboarding_step: "feeding_mode_selected"
      });
      setStep("theme");
    } catch (error) {
      showError(error, "Beslenme tercihi kaydedilemedi");
    }
  }

  async function saveTheme() {
    try {
      await updateStepMutation.mutateAsync({
        theme_preference: themePreference,
        onboarding_step: "theme_selected"
      });
      setStep("nickname");
    } catch (error) {
      showError(error, "Tema kaydedilemedi");
    }
  }

  async function saveNickname() {
    try {
      const cleanNickname = nickname.trim();

      if (cleanNickname.length < 3) {
        showInfo("Forum takma adı en az 3 karakter olmalı.", "Takma ad kısa");
        return;
      }

      if (nicknameAvailable === false) {
        showInfo("Başka bir takma ad dene.", "Takma ad kullanılıyor");
        return;
      }

      await updateStepMutation.mutateAsync({
        forum_nickname: cleanNickname,
        onboarding_step: "nickname_set"
      });
      setStep("notifications");
    } catch (error) {
      showError(error, "Takma ad kaydedilemedi");
    }
  }

  async function completeOnboarding(requestNotifications: boolean) {
    try {
      if (requestNotifications) {
        await registerAndSavePushToken();
      }

      await updateStepMutation.mutateAsync({
        onboarding_completed: true,
        onboarding_step: "completed"
      });
      setCompletionVisible(true);
      completionTimerRef.current = setTimeout(
        () => router.replace("/home"),
        reducedMotion ? 720 : 1_850
      );
    } catch (error) {
      showError(error, "Kurulum tamamlanamadı");
    }
  }

  function skipCurrentStep() {
    if (step === "family") {
      showInfo("Devam etmek için anne ve baba adını girmelisin.", "İsimler zorunlu");
      return;
    }

    if (step === "status") {
      void chooseStatus("skip");
      return;
    }

    if (step === "details") {
      setStep("feeding");
      return;
    }

    if (step === "feeding") {
      void saveFeedingMode();
      return;
    }

    if (step === "theme") {
      void saveTheme();
      return;
    }

    if (step === "nickname") {
      setStep("notifications");
      return;
    }

    void completeOnboarding(false);
  }

  function goToPreviousStep() {
    if (activeIndex <= 0 || updateStepMutation.isPending) return;

    if (step === "feeding" && status === "skip") {
      setStep("status");
      return;
    }

    const previousStep = steps[activeIndex - 1];
    if (previousStep) setStep(previousStep.id);
  }

  if (completionVisible) {
    const markerPosition =
      status === "pregnant" ? 0.56 : status === "baby" ? 0.68 : 0.32;
    const title =
      status === "pregnant"
        ? "Gebelik ipliğin başladı"
        : status === "baby"
          ? `${babyName.trim() || "Bebeğinin"} ipliği başladı`
          : "Anne+ ipliğin hazır";
    const detail =
      status === "pregnant"
        ? "Haftaların, hazırlıkların ve doğum düğümün bu çizgide birikecek."
        : status === "baby"
          ? "Doğum düğümünden büyüme, aşı ve bakım kayıtlarına aynı çizgide devam edeceksin."
          : "İlk bilgini eklediğinde yaşam çizgin bu noktadan büyümeye başlayacak.";

    return (
      <OnboardingThreadMoment
        detail={detail}
        markerPosition={markerPosition}
        title={title}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.topBarTitle}>
            {activeIndex > 0 ? (
              <Pressable
                accessibilityLabel="Bir önceki adıma dön"
                accessibilityRole="button"
                disabled={updateStepMutation.isPending}
                hitSlop={10}
                onPress={goToPreviousStep}
                style={styles.backButton}
              >
                <ChevronLeft color={appTheme.primary} size={20} />
              </Pressable>
            ) : null}
            <Text style={typography.eyebrow}>Anne+ kurulum</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={skipCurrentStep} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: appTheme.primary }]}>Şimdilik geç</Text>
          </Pressable>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.threadProgress}>
            <Thread
              accessibilityLabel={`Kurulum ilerlemesi: ${steps.length} adımın ${activeIndex + 1}. adımı`}
              color={appTheme.primary}
              height={42}
              mutedColor={colors.border}
              progress={progressValue}
              semantic="progress"
              variant="progress"
            />
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stepDots}>
              {steps.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.stepDot,
                    index <= activeIndex && styles.stepDotActive,
                    index <= activeIndex && {
                      backgroundColor: appTheme.primary,
                      borderColor: appTheme.primary
                    }
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, { color: appTheme.primary }]}>
              Adım {activeIndex + 1}/{steps.length} · {steps[activeIndex]?.label}
            </Text>
          </View>
        </View>

        {step === "family" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<UserRound color={colors.primary} size={26} />}
                title="Anne ve baba adını ekleyelim"
                body="Uygulama içindeki karşılama metinleri, hatırlatmalar ve aileye özel akışlar bu adlarla daha doğal hale gelir."
              />

              <View style={{ gap: spacing.md }}>
                <TextField
                  autoCapitalize="words"
                  label="Anne adı"
                  placeholder="Örn. Elif"
                  value={motherName}
                  onChangeText={setMotherName}
                />
                <TextField
                  autoCapitalize="words"
                  label="Baba adı"
                  placeholder="Örn. Burak"
                  value={fatherName}
                  onChangeText={setFatherName}
                />
              </View>

              <Button
                label={
                  updateStepMutation.isPending
                    ? "Kaydediliyor…"
                    : "Aile bilgilerini kaydet"
                }
                disabled={updateStepMutation.isPending}
                onPress={saveFamilyNames}
              />
            </View>
          </Card>
        ) : null}

        {step === "status" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<Sparkles color={colors.primary} size={26} />}
                title="Deneyimini nasıl kişiselleştirelim?"
                body="Bu bilgiler gizli kalır. Ana sayfa, hatırlatmalar ve forum rozetin buna göre düzenlenir."
              />

              <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
                <ChoiceCard
                  active={status === "pregnant"}
                  icon={<CalendarHeart color={colors.primary} size={24} />}
                  title="Hamileyim"
                  body="Hafta hafta gebelik gelişimi ve doğuma kalan süre gösterilir."
                  onPress={() => chooseStatus("pregnant")}
                />
                <ChoiceCard
                  active={status === "baby"}
                  icon={<Baby color={colors.primary} size={24} />}
                  title="Bebeğim oldu"
                  body="Aşı takvimi, büyüme kaydı ve fotoğraf zaman çizelgesi açılır."
                  onPress={() => chooseStatus("baby")}
                />
                <ChoiceCard
                  active={status === "skip"}
                  icon={<ShieldCheck color={colors.primary} size={24} />}
                  title="Şimdilik bilgi vermek istemiyorum"
                  body="Uygulamayı keşfet, bilgileri sonra Profil veya Bebek sekmesinden ekle."
                  onPress={() => chooseStatus("skip")}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {step === "details" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={
                  status === "pregnant" ? (
                    <CalendarHeart color={colors.primary} size={26} />
                  ) : (
                    <Baby color={colors.primary} size={26} />
                  )
                }
                title={status === "pregnant" ? "Gebelik bilgisi" : "Bebek bilgisi"}
                body="Tarihler forumda açık gösterilmez; sadece sana özel akış ve anonim rozet için kullanılır."
              />

              {status === "pregnant" ? (
                <DatePickerField
                  label="Tahmini doğum tarihi"
                  placeholder="Doğum tarihini seç"
                  value={dueDate}
                  onChange={setDueDate}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <TextField
                    label="Bebek adı"
                    placeholder="Örn. Deniz"
                    value={babyName}
                    onChangeText={setBabyName}
                  />
                  <DatePickerField
                    label="Doğum tarihi"
                    placeholder="Doğum tarihini seç"
                    value={birthDate}
                    onChange={setBirthDate}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <Text style={typography.label}>Cinsiyet</Text>
                    <View accessibilityRole="radiogroup" style={styles.segmentRow}>
                      <SegmentButton
                        active={babyGender === "kiz"}
                        label="Kız"
                        onPress={() => setBabyGender("kiz")}
                      />
                      <SegmentButton
                        active={babyGender === "erkek"}
                        label="Erkek"
                        onPress={() => setBabyGender("erkek")}
                      />
                      <SegmentButton
                        active={babyGender === "belirtilmemis"}
                        label="Belirtmem"
                        onPress={() => setBabyGender("belirtilmemis")}
                      />
                    </View>
                  </View>
                </View>
              )}

              <Button
                label={updateStepMutation.isPending ? "Kaydediliyor…" : "Devam et"}
                disabled={updateStepMutation.isPending}
                onPress={saveDetails}
              />
            </View>
          </Card>
        ) : null}

        {step === "feeding" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<Milk color={colors.primary} size={26} />}
                title="Beslenme akışını sana göre sadeleştirelim"
                body="Bu bir sağlık tercihi değildir; yalnızca bakım günlüğünde en sık kullandığın kayıtları öne çıkarır. Ayarlardan değiştirebilirsin."
              />
              <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
                <ChoiceCard active={feedingMode === "breastfeeding"} icon={<Heart color={colors.primary} size={23} />} title="Emzirme" body="Emzirme tarafı ve süre takibini öne çıkarır." onPress={() => setFeedingMode("breastfeeding")} />
                <ChoiceCard active={feedingMode === "pumping"} icon={<Milk color={colors.primary} size={23} />} title="Sağım" body="Çift taraflı zamanlayıcı ve süt stoğu ana akışta görünür." onPress={() => setFeedingMode("pumping")} />
                <ChoiceCard active={feedingMode === "mixed"} icon={<Sparkles color={colors.primary} size={23} />} title="Karma beslenme" body="Emzirme, sağım ve biberon kısayollarını birlikte gösterir." onPress={() => setFeedingMode("mixed")} />
                <ChoiceCard active={feedingMode === "formula"} icon={<Baby color={colors.primary} size={23} />} title="Mama" body="Biberon miktarı ve mama hatırlatmalarını öne çıkarır." onPress={() => setFeedingMode("formula")} />
              </View>
              <Button label={updateStepMutation.isPending ? "Kaydediliyor…" : "Akışımı kişiselleştir"} disabled={updateStepMutation.isPending} onPress={saveFeedingMode} />
            </View>
          </Card>
        ) : null}

        {step === "theme" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<Sparkles color={colors.primary} size={26} />}
                title="Uygulamanın görünümünü seç"
                body={
                  status === "baby" && suggestedTheme
                    ? `Cinsiyet bilgine göre ${suggestedTheme.label} önerdik. İstersen temel rengi şimdi değiştirebilirsin.`
                    : "Ana ekran, profil ve menü vurguları bu renge göre canlanır. İstersen sonra Profil'den değiştirebilirsin."
                }
              />

              <View accessibilityRole="radiogroup" style={styles.themeGrid}>
                {themeOptions.map((item) => (
                  <ThemeChoice
                    key={item.id}
                    active={themePreference === item.id}
                    color={item.primary}
                    isSuggested={status === "baby" && item.id === suggestedThemeId}
                    label={item.label}
                    onPress={() => setThemePreference(item.id)}
                  />
                ))}
              </View>

              <Button
                label={updateStepMutation.isPending ? "Kaydediliyor…" : "Temamı kaydet"}
                disabled={updateStepMutation.isPending}
                onPress={saveTheme}
              />
            </View>
          </Card>
        ) : null}

        {step === "nickname" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<UserRound color={colors.primary} size={26} />}
                title="Forumda nasıl görünmek istersin?"
                body="Gerçek profilin açılmaz. Forumda sadece takma adın ve anonim rozetin görünür."
              />
              <View style={{ gap: spacing.sm }}>
                <TextField
                  autoCapitalize="none"
                  label="Takma ad"
                  value={nickname}
                  onChangeText={setNickname}
                />
                <Text
                  style={[
                    styles.nicknameHint,
                    nicknameAvailable === false && styles.nicknameBad
                  ]}
                >
                  {nicknameAvailable === null
                    ? "En az 3 karakter yaz."
                    : nicknameAvailable
                      ? "Bu takma ad uygun."
                      : "Bu takma ad kullanılıyor."}
                </Text>
              </View>
              <Button
                label="Takma adımı kaydet"
                disabled={updateStepMutation.isPending}
                onPress={saveNickname}
              />
            </View>
          </Card>
        ) : null}

        {step === "notifications" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<Bell color={colors.primary} size={26} />}
                title="Nazik hatırlatmalar ister misin?"
                body="Aşı takvimi, haftalık gebelik özetleri ve forum etkileşimleri için kaliteli bildirimler göndeririz."
              />
              <View style={{ gap: spacing.sm }}>
                <FeatureRow label="Aşı ve kontrol hatırlatmaları" />
                <FeatureRow label="Gebelik haftana uygun özetler" />
                <FeatureRow label="Forum yorum ve beğeni bildirimleri" />
              </View>
              <Button
                label="Bildirimleri aç ve başla"
                onPress={() => completeOnboarding(true)}
              />
              <Button
                label="Şimdilik bildirim alma"
                variant="ghost"
                onPress={() => completeOnboarding(false)}
              />
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function HeaderBlock({
  icon,
  title,
  body
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>{icon}</View>
      <View style={{ gap: spacing.sm }}>
        <Text style={typography.heading1}>{title}</Text>
        <Text style={typography.body}>{body}</Text>
      </View>
    </View>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  body,
  onPress
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.choiceCard,
        active && styles.choiceCardActive,
        active && {
          backgroundColor: appTheme.tint,
          borderColor: appTheme.primary
        }
      ]}
    >
      <View style={styles.choiceIcon}>{icon}</View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceBody}>{body}</Text>
      </View>
      {active ? <Check color={appTheme.primary} size={22} /> : null}
    </Pressable>
  );
}

function ThemeChoice({
  active,
  color,
  isSuggested,
  label,
  onPress
}: {
  active: boolean;
  color: string;
  isSuggested: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={`${label}${isSuggested ? ", önerilen" : ""}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.themeChoice,
        active && styles.themeChoiceActive,
        active && { borderColor: appTheme.primary }
      ]}
    >
      <View style={[styles.themeSwatch, { backgroundColor: color }]}>
        {active ? <Check color={colors.onPrimary} size={20} /> : null}
      </View>
      <Text style={styles.themeLabel}>{label}</Text>
      {isSuggested ? (
        <Text style={[styles.themeSuggested, { color: appTheme.primary }]}>Önerilen</Text>
      ) : null}
    </Pressable>
  );
}

function SegmentButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text
        style={[
          styles.segmentText,
          active && styles.segmentTextActive,
          active && { color: appTheme.primary }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FeatureRow({ label }: { label: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.featureRow}>
      <Heart color={appTheme.accent} size={18} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  topBarTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  skipText: {
    ...typography.label,
    color: colors.primary
  },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  progressWrap: {
    gap: spacing.sm
  },
  threadProgress: {
    justifyContent: "center"
  },
  stepDots: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0
  },
  stepDot: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 14,
    width: 14
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  stepLabels: {
    alignItems: "center"
  },
  stepLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center"
  },
  stepLabelActive: {
    color: colors.primary
  },
  focusCard: {
    backgroundColor: colors.surface
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  choiceCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  choiceCardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  choiceIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  choiceCopy: {
    flex: 1,
    gap: spacing.xs
  },
  choiceTitle: {
    ...typography.label,
    color: colors.text
  },
  choiceBody: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  themeChoice: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 126,
    minWidth: 144,
    padding: spacing.md
  },
  themeChoiceActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary
  },
  themeSwatch: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  themeLabel: {
    ...typography.label,
    color: colors.text,
    textAlign: "center"
  },
  themeSuggested: {
    ...typography.label,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center"
  },
  segmentRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  segmentButtonActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14
  },
  segmentTextActive: {
    color: colors.primary
  },
  nicknameHint: {
    ...typography.body,
    color: colors.success,
    fontSize: 14
  },
  nicknameBad: {
    color: colors.danger
  },
  featureRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  featureText: {
    ...typography.label,
    color: colors.text
  }
});
