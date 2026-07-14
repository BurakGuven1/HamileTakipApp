import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Thread } from "@/components/Thread";
import { signInFatherWithFamilyCode } from "@/api/familyAccess";
import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { openLegalPage } from "@/config/legal";
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
  const [loading, setLoading] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const isFather = audience === "father";
  const isSignUp = !isFather && mode === "sign-up";

  async function submit() {
    const cleanFamilyCode = familyCode.replace(/\D/g, "");

    if (isFather) {
      if (cleanFamilyCode.length !== 7) {
        showInfo("Anneden aldığın 7 haneli aile kodunu yaz.", "Aile kodu gerekli");
        return;
      }

      setLoading(true);
      try {
        await signInFatherWithFamilyCode(cleanFamilyCode);
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

    if (isSignUp && !acceptedLegal) {
      showInfo(
        "Hesap oluşturmadan önce gizlilik politikasını ve kullanım şartlarını onaylamalısın.",
        "Onay gerekli"
      );
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password
        });

        if (error) throw error;

        if (!data.session) {
          showInfo(
            "Kaydını tamamlamak için e-postandaki onay bağlantısına dokun.",
            "E-postanı kontrol et"
          );
          setMode("sign-in");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (error) throw error;
      }

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

  async function openLegalDocument(page: "privacy" | "terms") {
    try {
      await openLegalPage(page);
    } catch (error) {
      showError(error, "Yasal sayfa açılamadı");
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroThread}>
            <Thread height={108} progress={0.72} variant="decorative" />
          </View>
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
                onPress={() => setAudience("mother")}
              />
              <ModeButton
                active={isFather}
                label="Baba"
                onPress={() => {
                  setAudience("father");
                  setMode("sign-in");
                }}
              />
            </View>

            {!isFather ? (
              <>
                <View style={styles.modeSwitch}>
                  <ModeButton
                    active={!isSignUp}
                    label="Giriş"
                    onPress={() => setMode("sign-in")}
                  />
                  <ModeButton
                    active={isSignUp}
                    label="Kayıt"
                    onPress={() => setMode("sign-up")}
                  />
                </View>

                <TextField
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  label="E-posta"
                  value={email}
                  onChangeText={setEmail}
                />
                <TextField
                  label="Şifre"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                {isSignUp ? (
                  <View style={styles.legalConsent}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: acceptedLegal }}
                      onPress={() => setAcceptedLegal((value) => !value)}
                      style={styles.legalCheckbox}
                    >
                      <Text style={styles.legalCheckboxText}>
                        {acceptedLegal ? "✓" : ""}
                      </Text>
                    </Pressable>
                    <Text style={styles.legalConsentText}>
                      Gizlilik Politikası ve Kullanım Şartları’nı okudum, kişisel
                      verilerimin bu metinlerde açıklandığı şekilde işlenmesini kabul
                      ediyorum.
                    </Text>
                    <View style={styles.legalLinks}>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => openLegalDocument("privacy")}
                      >
                        <Text style={styles.linkText}>Gizlilik Politikası</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => openLegalDocument("terms")}
                      >
                        <Text style={styles.linkText}>Kullanım Şartları</Text>
                      </Pressable>
                    </View>
                  </View>
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

            <Button
              disabled={loading || !isSupabaseConfigured}
              label={
                loading
                  ? "Bekle..."
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
  heroThread: {
    bottom: -28,
    left: spacing.lg,
    opacity: 0.3,
    position: "absolute",
    right: -spacing.lg
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
    textAlign: "center"
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  legalCheckbox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24
  },
  legalCheckboxText: {
    ...typography.label,
    color: colors.primary
  },
  legalConsent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  legalConsentText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  legalLinks: {
    flexDirection: "row",
    gap: spacing.md,
    marginLeft: 32,
    width: "100%"
  },
  warning: {
    ...typography.body,
    color: colors.danger
  }
});
