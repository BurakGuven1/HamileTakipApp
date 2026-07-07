import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Baby,
  Bell,
  CalendarHeart,
  Check,
  Heart,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";

import { createBaby } from "@/api/babies";
import {
  getCurrentProfile,
  isNicknameAvailable,
  updateCurrentProfile
} from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { registerAndSavePushToken } from "@/lib/notifications";
import { colors, radii, spacing, typography } from "@/theme";

type OnboardingStep = "status" | "details" | "nickname" | "notifications";
type ParentStatus = "pregnant" | "baby" | "skip";
type BabyGender = "kiz" | "erkek" | "belirtilmemis";

const steps: { id: OnboardingStep; label: string }[] = [
  { id: "status", label: "Durum" },
  { id: "details", label: "Bilgiler" },
  { id: "nickname", label: "Forum" },
  { id: "notifications", label: "Bildirim" }
];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<OnboardingStep>("status");
  const [status, setStatus] = useState<ParentStatus>();
  const [dueDate, setDueDate] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [babyGender, setBabyGender] = useState<BabyGender>("belirtilmemis");
  const [nickname, setNickname] = useState("");
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile?.forum_nickname && !nickname) {
      setNickname(profile.forum_nickname);
    }
  }, [nickname, profile?.forum_nickname]);

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

  const activeIndex = steps.findIndex((item) => item.id === step);
  const progressPercent = useMemo(
    () => `${((activeIndex + 1) / steps.length) * 100}%`,
    [activeIndex]
  );

  const updateStepMutation = useMutation({
    mutationFn: updateCurrentProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-profile"] });
    },
    onError: (error) => Alert.alert("Kaydedilemedi", error.message)
  });

  async function chooseStatus(nextStatus: ParentStatus) {
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

    await updateStepMutation.mutateAsync({ onboarding_step: "status_selected" });
    setStep("nickname");
  }

  async function saveDetails() {
    if (!profile) {
      Alert.alert("Oturum gerekli", "Onboarding icin tekrar giris yap.");
      router.replace("/sign-in");
      return;
    }

    if (status === "pregnant") {
      if (!dueDate) {
        Alert.alert("Tarih sec", "Tahmini dogum tarihini secmelisin.");
        return;
      }

      await updateStepMutation.mutateAsync({
        is_pregnant: true,
        due_date: dueDate,
        onboarding_step: "details_added"
      });
      setStep("nickname");
      return;
    }

    if (status === "baby") {
      if (!babyName.trim() || !birthDate) {
        Alert.alert("Bilgileri kontrol et", "Bebek adi ve dogum tarihi gerekli.");
        return;
      }

      await createBaby({
        parent_id: profile.id,
        name: babyName.trim(),
        birth_date: birthDate,
        gender: babyGender
      });
      await updateStepMutation.mutateAsync({ onboarding_step: "details_added" });
      setStep("nickname");
      return;
    }

    setStep("nickname");
  }

  async function saveNickname() {
    const cleanNickname = nickname.trim();

    if (cleanNickname.length < 3) {
      Alert.alert("Takma ad kisa", "Forum takma adi en az 3 karakter olmali.");
      return;
    }

    if (nicknameAvailable === false) {
      Alert.alert("Takma ad kullaniliyor", "Baska bir takma ad dene.");
      return;
    }

    await updateStepMutation.mutateAsync({
      forum_nickname: cleanNickname,
      onboarding_step: "nickname_set"
    });
    setStep("notifications");
  }

  async function completeOnboarding(requestNotifications: boolean) {
    if (requestNotifications) {
      await registerAndSavePushToken();
    }

    await updateStepMutation.mutateAsync({
      onboarding_completed: true,
      onboarding_step: "completed"
    });
    router.replace("/home");
  }

  function skipCurrentStep() {
    if (step === "status") {
      chooseStatus("skip").catch((error) => Alert.alert("Gecilemedi", error.message));
      return;
    }

    if (step === "details") {
      setStep("nickname");
      return;
    }

    if (step === "nickname") {
      setStep("notifications");
      return;
    }

    completeOnboarding(false).catch((error) => Alert.alert("Tamamlanamadi", error.message));
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={typography.eyebrow}>Anne+ kurulum</Text>
          <Pressable accessibilityRole="button" onPress={skipCurrentStep}>
            <Text style={styles.skipText}>Simdilik gec</Text>
          </Pressable>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: progressPercent as DimensionValue }
              ]}
            />
          </View>
          <View style={styles.stepLabels}>
            {steps.map((item, index) => (
              <Text
                key={item.id}
                style={[
                  styles.stepLabel,
                  index <= activeIndex && styles.stepLabelActive
                ]}
              >
                {item.label}
              </Text>
            ))}
          </View>
        </View>

        {step === "status" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<Sparkles color={colors.primary} size={26} />}
                title="Deneyimini nasil kisisellestirelim?"
                body="Bu bilgiler gizli kalir. Ana sayfa, hatirlatmalar ve forum rozetin buna gore duzenlenir."
              />

              <View style={{ gap: spacing.md }}>
                <ChoiceCard
                  active={status === "pregnant"}
                  icon={<CalendarHeart color={colors.primary} size={24} />}
                  title="Hamileyim"
                  body="Hafta hafta gebelik gelisimi ve doguma kalan sure gosterilir."
                  onPress={() => chooseStatus("pregnant")}
                />
                <ChoiceCard
                  active={status === "baby"}
                  icon={<Baby color={colors.primary} size={24} />}
                  title="Bebegim oldu"
                  body="Asi takvimi, buyume kaydi ve fotograf zaman cizelgesi acilir."
                  onPress={() => chooseStatus("baby")}
                />
                <ChoiceCard
                  active={status === "skip"}
                  icon={<ShieldCheck color={colors.primary} size={24} />}
                  title="Simdilik bilgi vermek istemiyorum"
                  body="Uygulamayi kesfet, bilgileri sonra Profil veya Bebek sekmesinden ekle."
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
                body="Tarihler forumda acik gosterilmez; sadece sana ozel akis ve anonim rozet icin kullanilir."
              />

              {status === "pregnant" ? (
                <DatePickerField
                  label="Tahmini dogum tarihi"
                  minimumDate={new Date()}
                  placeholder="Dogum tarihini sec"
                  value={dueDate}
                  onChange={setDueDate}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <TextField
                    label="Bebek adi"
                    placeholder="Orn. Deniz"
                    value={babyName}
                    onChangeText={setBabyName}
                  />
                  <DatePickerField
                    label="Dogum tarihi"
                    maximumDate={new Date()}
                    placeholder="Dogum tarihini sec"
                    value={birthDate}
                    onChange={setBirthDate}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <Text style={typography.label}>Cinsiyet</Text>
                    <View style={styles.segmentRow}>
                      <SegmentButton
                        active={babyGender === "kiz"}
                        label="Kiz"
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
                label={updateStepMutation.isPending ? "Kaydediliyor..." : "Devam et"}
                disabled={updateStepMutation.isPending}
                onPress={saveDetails}
              />
            </View>
          </Card>
        ) : null}

        {step === "nickname" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <HeaderBlock
                icon={<UserRound color={colors.primary} size={26} />}
                title="Forumda nasil gorunmek istersin?"
                body="Gercek profilin acilmaz. Forumda sadece takma adin ve anonim rozetin gorunur."
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
                      : "Bu takma ad kullaniliyor."}
                </Text>
              </View>
              <Button
                label="Takma adimi kaydet"
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
                title="Nazik hatirlatmalar ister misin?"
                body="Asi takvimi, haftalik gebelik ozetleri ve forum etkilesimleri icin kaliteli bildirimler gondeririz."
              />
              <View style={{ gap: spacing.sm }}>
                <FeatureRow label="Asi ve kontrol hatirlatmalari" />
                <FeatureRow label="Gebelik haftana uygun ozetler" />
                <FeatureRow label="Forum yorum ve begeni bildirimleri" />
              </View>
              <Button
                label="Bildirimleri ac ve basla"
                onPress={() => completeOnboarding(true)}
              />
              <Button
                label="Simdilik bildirim alma"
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
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.iconBubble}>{icon}</View>
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choiceCard, active && styles.choiceCardActive]}
    >
      <View style={styles.choiceIcon}>{icon}</View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceBody}>{body}</Text>
      </View>
      {active ? <Check color={colors.primary} size={22} /> : null}
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={styles.featureRow}>
      <Heart color={colors.accent} size={18} />
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
  skipText: {
    ...typography.label,
    color: colors.primary
  },
  progressWrap: {
    gap: spacing.sm
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: "100%"
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  stepLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12
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
    borderRadius: radii.md,
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
    fontSize: 14,
    lineHeight: 20
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  segmentButtonActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13
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
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  featureText: {
    ...typography.label,
    color: colors.text
  }
});
