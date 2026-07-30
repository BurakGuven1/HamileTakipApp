import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { signInFatherWithFamilyCode } from "@/api/familyAccess";
import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { openLegalPage, type LegalPage } from "@/config/legal";
import {
  APP_EULA_VERSION,
  hasAcceptedAppAgreementLocally,
  recordLegalAcceptance,
  setAppAgreementAccepted
} from "@/lib/legalAcceptance";
import {
  AGE_ASSURANCE_VERSION,
  getAdultBirthDateCutoff,
  isAdultBirthDate,
  recordAgeAssurance,
  type AgeAssuranceContext
} from "@/lib/ageAssurance";
import { parseDateOnly } from "@/lib/dates";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type AuthMode = "sign-in" | "sign-up";
type AuthAudience = "mother" | "father";

export default function SignInScreen() {
  const { showError, showInfo, showSuccess } = useFeedback();
  const [audience, setAudience] = useState<AuthAudience>("mother");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isFather = audience === "father";
  const isSignUp = !isFather && mode === "sign-up";
  const adultBirthDateCutoff = getAdultBirthDateCutoff();
  const birthDateError =
    submitAttempted && isSignUp
      ? !birthDate
        ? "Doğum tarihini seç."
        : !isAdultBirthDate(birthDate)
          ? "Anne+ yalnızca 18 yaş ve üzerindeki kullanıcılar içindir."
          : undefined
      : undefined;

  useEffect(() => {
    let active = true;

    hasAcceptedAppAgreementLocally()
      .then((accepted) => {
        if (active) setAcceptedLegal(accepted);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    setSubmitAttempted(true);
    const cleanFamilyCode = familyCode.replace(/\D/g, "");

    if (isSignUp && !isAdultBirthDate(birthDate)) {
      showInfo(
        birthDate
          ? "Anne+ yalnızca 18 yaş ve üzerindeki kullanıcılar içindir."
          : "Hesap oluşturmak için doğum tarihini seç.",
        birthDate ? "Yaş sınırı karşılanmıyor" : "Doğum tarihi gerekli"
      );
      return;
    }

    if (!confirmedAdult) {
      showInfo(
        "Devam etmek için 18 yaşından büyük olduğunu onayla.",
        "18+ onayı gerekli"
      );
      return;
    }

    if (!acceptedLegal) {
      showInfo(
        "Devam etmek için EULA’yı, Kullanım Şartları’nı ve topluluğun sıfır tolerans kurallarını kabul et.",
        "Ortak kuralları kabul et"
      );
      return;
    }

    if (isFather) {
      if (cleanFamilyCode.length !== 7) {
        showInfo("Anneden aldığın 7 haneli aile kodunu yaz.", "Aile kodu gerekli");
        return;
      }

      setLoading(true);
      try {
        await signInFatherWithFamilyCode(cleanFamilyCode);
        await recordRequiredAgeAssurance("family_code");
        await recordLegalAcceptance(APP_EULA_VERSION, "auth").catch(
          () => undefined
        );
        const premiumAccess = await getEffectivePremiumAccess().catch(() => null);
        const successMessage =
          premiumAccess?.accessSource === "family_trial" &&
          premiumAccess.familyTrialExpiresAt
            ? `Aile profiline bağlandın. Premium erişimin ${formatPremiumAccessDate(
                premiumAccess.familyTrialExpiresAt
              )} tarihine kadar aktif.`
            : "Aile profiline bağlandın.";
        showSuccess(successMessage, "Baba girişi hazır");
        router.replace("/");
      } catch (error) {
        showError(error, "Baba girişi yapılamadı");
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@") || password.length < 8) {
      showInfo(
        "Geçerli bir e-posta ve en az 8 karakterli şifre gerekli.",
        "Bilgileri kontrol et"
      );
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              age_assurance_version: AGE_ASSURANCE_VERSION,
              age_over_18_confirmed: true,
              age_assured_at: new Date().toISOString(),
              birth_date: birthDate
            }
          }
        });

        if (error) throw error;

        if (!data.session) {
          showInfo(
            "Kaydını tamamlamak için e-postandaki onay bağlantısına dokun.",
            "E-postanı kontrol et"
          );
          setMode("sign-in");
          setConfirmedAdult(false);
          setSubmitAttempted(false);
          return;
        }

        await recordRequiredAgeAssurance("sign_up", birthDate);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (error) throw error;
        await recordRequiredAgeAssurance("sign_in");
      }

      await recordLegalAcceptance(APP_EULA_VERSION, "auth").catch(
        () => undefined
      );
      router.replace("/");
    } catch (error) {
      showError(error, isSignUp ? "Kayıt tamamlanamadı" : "Giriş yapılamadı");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      showInfo(
        "Şifre sıfırlama bağlantısı için e-posta adresini yaz.",
        "E-posta gerekli"
      );
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      showError(error, "Şifre sıfırlama başlamadı");
      return;
    }

    showSuccess(
      "Şifre sıfırlama bağlantısı e-posta adresine gönderildi.",
      "E-posta gönderildi"
    );
  }

  async function openLegalDocument(page: LegalPage) {
    if (page === "terms") {
      router.push("/legal/community-terms");
      return;
    }

    try {
      await openLegalPage(page);
    } catch (error) {
      showError(error, "Yasal sayfa açılamadı");
    }
  }

  async function toggleLegalAcceptance() {
    const nextValue = !acceptedLegal;
    setAcceptedLegal(nextValue);

    try {
      await setAppAgreementAccepted(nextValue);
    } catch (error) {
      setAcceptedLegal(!nextValue);
      showError(error, "Onay bu cihazda kaydedilemedi");
    }
  }

  async function recordRequiredAgeAssurance(
    context: AgeAssuranceContext,
    assuredBirthDate?: string
  ) {
    try {
      await recordAgeAssurance({
        birthDate: assuredBirthDate,
        context
      });
    } catch (error) {
      await supabase.auth.signOut().catch(() => undefined);
      throw new Error(
        "18+ onayı güvenli biçimde kaydedilemedi. İnternet bağlantını kontrol edip yeniden dene.",
        { cause: error }
      );
    }
  }

  function selectAudience(nextAudience: AuthAudience) {
    setAudience(nextAudience);
    setMode("sign-in");
    setConfirmedAdult(false);
    setSubmitAttempted(false);
  }

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setConfirmedAdult(false);
    setSubmitAttempted(false);
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={typography.eyebrow}>Anne+ Takip</Text>
          <Text style={typography.heading1}>
            {isFather
              ? "Baba girişi"
              : isSignUp
                ? "Hesabını oluştur"
                : "Tekrar hoş geldin"}
          </Text>
          <Text style={styles.heroText}>
            {isFather
              ? "Aile koduyla bağlandıktan sonra anneyle aynı bebek ve bakım akışını gör."
              : "Gebelik haftan, bebek gelişimi, aşı hatırlatmaları ve topluluk desteği tek yerde."}
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.modeSwitch}>
              <ModeButton
                active={!isFather}
                label="Anne"
                onPress={() => selectAudience("mother")}
              />
              <ModeButton
                active={isFather}
                label="Baba"
                onPress={() => selectAudience("father")}
              />
            </View>

            {!isFather ? (
              <>
                <View style={styles.modeSwitch}>
                  <ModeButton
                    active={!isSignUp}
                    label="Giriş"
                    onPress={() => selectMode("sign-in")}
                  />
                  <ModeButton
                    active={isSignUp}
                    label="Kayıt"
                    onPress={() => selectMode("sign-up")}
                  />
                </View>

                <TextField
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  label="E-posta"
                  error={
                    submitAttempted && !email.trim().toLowerCase().includes("@")
                      ? "Geçerli bir e-posta adresi yaz."
                      : undefined
                  }
                  value={email}
                  onChangeText={setEmail}
                />
                <TextField
                  label="Şifre"
                  error={
                    submitAttempted && password.length < 8
                      ? "Şifre en az 8 karakter olmalı."
                      : undefined
                  }
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                {isSignUp ? (
                  <DatePickerField
                    error={birthDateError}
                    label="Doğum tarihi"
                    maximumDate={
                      parseDateOnly(adultBirthDateCutoff) ?? undefined
                    }
                    onChange={setBirthDate}
                    placeholder="Doğum tarihini seç"
                    value={birthDate}
                  />
                ) : null}
              </>
            ) : null}

            {isFather ? (
              <View style={{ gap: spacing.xs }}>
                <TextField
                  keyboardType="number-pad"
                  label="Aile kodu"
                  maxLength={7}
                  value={familyCode}
                  onChangeText={(value) => setFamilyCode(value.replace(/\D/g, ""))}
                />
                <Text style={styles.helperText}>
                  Kayıt oluşturman gerekmez. Kodla bağlandıktan sonra bu cihazda
                  oturum kalır ve anneyle aynı aile ekranlarını görürsün.
                </Text>
              </View>
            ) : null}

            <View>
              <Pressable
                accessibilityLabel="18 yaşından büyük olduğumu onaylıyorum"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: confirmedAdult }}
                onPress={() => setConfirmedAdult((current) => !current)}
                style={[
                  styles.ageConsent,
                  submitAttempted &&
                    !confirmedAdult &&
                    styles.ageConsentError
                ]}
              >
                <View
                  style={[
                    styles.legalCheckbox,
                    confirmedAdult && styles.legalCheckboxAccepted
                  ]}
                >
                  <Text
                    style={[
                      styles.legalCheckboxText,
                      confirmedAdult && styles.legalCheckboxTextAccepted
                    ]}
                  >
                    {confirmedAdult ? "✓" : ""}
                  </Text>
                </View>
                <View style={styles.ageConsentCopy}>
                  <Text style={styles.ageConsentTitle}>
                    18 yaşından büyük olduğumu onaylıyorum
                  </Text>
                  <Text style={styles.ageConsentText}>
                    Anne+ yalnızca 18 yaş ve üzerindeki kullanıcılar içindir.
                  </Text>
                </View>
              </Pressable>
              {submitAttempted && !confirmedAdult ? (
                <Text accessibilityRole="alert" style={styles.ageError}>
                  Devam etmek için 18+ onay kutusunu işaretle.
                </Text>
              ) : null}
            </View>

            <View style={styles.legalConsent}>
              <Pressable
                accessibilityLabel="EULA, kullanım şartları ve topluluk kurallarını kabul et"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedLegal }}
                hitSlop={10}
                onPress={() => void toggleLegalAcceptance()}
                style={[
                  styles.legalCheckbox,
                  acceptedLegal && styles.legalCheckboxAccepted
                ]}
              >
                <Text
                  style={[
                    styles.legalCheckboxText,
                    acceptedLegal && styles.legalCheckboxTextAccepted
                  ]}
                >
                  {acceptedLegal ? "✓" : ""}
                </Text>
              </Pressable>
              <Text style={styles.legalConsentText}>
                Apple Standard EULA’yı, Kullanım Şartları ve Topluluk
                Kuralları’nı okudum. Hakaret, taciz ve uygunsuz içeriğe sıfır
                tolerans politikasını kabul ediyorum.
                {isSignUp
                  ? " Kişisel verilerimin Gizlilik Politikası ve KVKK metinlerinde açıklandığı şekilde işlenmesini kabul ediyorum."
                  : ""}
              </Text>
              <View style={styles.legalLinks}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLegalDocument("appleEula")}
                >
                  <Text style={styles.linkText}>Apple Standard EULA</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLegalDocument("terms")}
                >
                  <Text style={styles.linkText}>Kullanım Şartları</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLegalDocument("privacy")}
                >
                  <Text style={styles.linkText}>Gizlilik Politikası</Text>
                </Pressable>
                {isSignUp ? (
                  <>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openLegalDocument("kvkkDisclosure")}
                    >
                      <Text style={styles.linkText}>KVKK Aydınlatma</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openLegalDocument("explicitConsent")}
                    >
                      <Text style={styles.linkText}>Açık Rıza Metni</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
              {submitAttempted && !acceptedLegal ? (
                <Text accessibilityRole="alert" style={styles.legalError}>
                  Devam etmek için kutuyu işaretle.
                </Text>
              ) : null}
            </View>

            <Button
              disabled={loading || !isSupabaseConfigured}
              label={
                loading
                  ? "Bekle…"
                  : isFather
                    ? "Baba olarak bağlan"
                    : isSignUp
                      ? "Hesap oluştur"
                      : "Giriş yap"
              }
              onPress={submit}
            />

            {!isSupabaseConfigured ? (
              <Text style={styles.warning}>Supabase ortam değerleri eksik.</Text>
            ) : null}

            {!isFather ? (
              <Pressable accessibilityRole="button" onPress={resetPassword}>
                <Text style={styles.linkText}>Şifremi unuttum</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function formatPremiumAccessDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function ModeButton({
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
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    ...radii.cardLarge,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  modeSwitch: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    padding: spacing.xs
  },
  modeButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  modeButtonActive: {
    backgroundColor: colors.surface
  },
  modeText: {
    ...typography.label,
    color: colors.textMuted
  },
  modeTextActive: {
    color: colors.primary
  },
  linkText: {
    ...typography.label,
    color: colors.primary,
    textAlign: "left"
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  ageConsent: {
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 56,
    padding: spacing.md
  },
  ageConsentError: {
    borderColor: colors.danger,
    borderWidth: 1
  },
  ageConsentCopy: {
    flex: 1,
    gap: 2
  },
  ageConsentTitle: {
    ...typography.label,
    color: colors.text
  },
  ageConsentText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  ageError: {
    ...typography.body,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs
  },
  legalCheckbox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    marginTop: 2,
    width: 28
  },
  legalCheckboxText: {
    ...typography.label,
    color: colors.primary
  },
  legalCheckboxAccepted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  legalCheckboxTextAccepted: {
    color: colors.onPrimary
  },
  legalConsent: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md
  },
  legalConsentText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  legalLinks: {
    columnGap: spacing.md,
    flexBasis: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    paddingLeft: 36,
    rowGap: spacing.sm
  },
  legalError: {
    ...typography.label,
    color: colors.danger,
    flexBasis: "100%",
    paddingLeft: 36
  },
  warning: {
    ...typography.body,
    color: colors.danger
  }
});
