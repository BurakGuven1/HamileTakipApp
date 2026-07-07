import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { createBaby } from "@/api/babies";
import {
  getCurrentProfile,
  isNicknameAvailable,
  updateCurrentProfile
} from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { registerAndSavePushToken } from "@/lib/notifications";
import { colors, radii, spacing, typography } from "@/theme";

type OnboardingStep = "status" | "details" | "nickname" | "notifications";
type ParentStatus = "pregnant" | "baby" | "skip";

const steps: OnboardingStep[] = ["status", "details", "nickname", "notifications"];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<OnboardingStep>("status");
  const [status, setStatus] = useState<ParentStatus>();
  const [dueDate, setDueDate] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
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

  const activeIndex = steps.indexOf(step);
  const progress = useMemo(() => `${activeIndex + 1}/${steps.length}`, [activeIndex]);

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
      if (!isIsoDate(dueDate)) {
        Alert.alert("Tarih formati", "Tahmini dogum tarihini YYYY-AA-GG formatinda yaz.");
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
      if (!babyName.trim() || !isIsoDate(birthDate)) {
        Alert.alert("Bilgileri kontrol et", "Bebek adi ve dogum tarihi gerekli.");
        return;
      }

      await createBaby({
        parent_id: profile.id,
        name: babyName.trim(),
        birth_date: birthDate,
        gender: "belirtilmemis"
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
          <Text style={typography.eyebrow}>Baslangic</Text>
          <Pressable accessibilityRole="button" onPress={skipCurrentStep}>
            <Text style={styles.skipText}>Simdilik gec</Text>
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((activeIndex + 1) / steps.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}</Text>

        {step === "status" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.heading1}>Sen neredesin?</Text>
                <Text style={typography.body}>
                  Deneyimi haftana veya bebegine gore kisisellestirelim. Istersen
                  simdilik atlayabilirsin.
                </Text>
              </View>
              <View style={{ gap: spacing.sm }}>
                <Button label="Hamileyim" onPress={() => chooseStatus("pregnant")} />
                <Button
                  label="Bebegim oldu"
                  variant="secondary"
                  onPress={() => chooseStatus("baby")}
                />
                <Button label="Simdilik atla" variant="ghost" onPress={() => chooseStatus("skip")} />
              </View>
            </View>
          </Card>
        ) : null}

        {step === "details" ? (
          <Card style={styles.focusCard}>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.heading1}>
                  {status === "pregnant" ? "Gebelik bilgisi" : "Bebek bilgisi"}
                </Text>
                <Text style={typography.body}>
                  Bu tarihler forumda hicbir zaman acik gosterilmez; sadece anonim
                  rozet hesaplamak icin kullanilir.
                </Text>
              </View>

              {status === "pregnant" ? (
                <TextField
                  label="Tahmini dogum tarihi"
                  placeholder="2026-10-15"
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <TextField
                    label="Bebek adi"
                    placeholder="Orn. Deniz"
                    value={babyName}
                    onChangeText={setBabyName}
                  />
                  <TextField
                    label="Dogum tarihi"
                    placeholder="2026-07-01"
                    value={birthDate}
                    onChangeText={setBirthDate}
                  />
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
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.heading1}>Forum takma adin</Text>
                <Text style={typography.body}>
                  Baska kullanicilar profilini acamaz; forumda sadece bu ad ve anonim
                  rozet gorunur.
                </Text>
              </View>
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
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.heading1}>Bildirimleri acalim mi?</Text>
                <Text style={typography.body}>
                  Asi hatirlatmalari, haftalik gebelik ozetleri ve forum etkilesimleri
                  icin nazik bildirimler gondeririz. Ayarlardan her zaman kapatabilirsin.
                </Text>
              </View>
              <Button
                label="Bildirim izni ver ve basla"
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

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  progressText: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: "right"
  },
  focusCard: {
    backgroundColor: colors.surface
  },
  nicknameHint: {
    ...typography.body,
    color: colors.success,
    fontSize: 14
  },
  nicknameBad: {
    color: colors.danger
  }
});
