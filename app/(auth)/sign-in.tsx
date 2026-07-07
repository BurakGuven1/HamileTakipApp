import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors, radii, spacing, typography } from "@/theme";

type AuthMode = "sign-in" | "sign-up";

function toFriendlyAuthError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email veya sifre hatali.";
  }

  if (message.toLowerCase().includes("password")) {
    return "Sifre en az 8 karakter olmali.";
  }

  if (message.toLowerCase().includes("email")) {
    return "Gecerli bir email adresi gir.";
  }

  return message;
}

export default function SignInScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "sign-up";

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@") || password.length < 8) {
      Alert.alert("Bilgileri kontrol et", "Email gecerli, sifre en az 8 karakter olmali.");
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
          Alert.alert(
            "Emailini kontrol et",
            "Kaydini tamamlamak icin emailindeki onay baglantisina dokun."
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
      Alert.alert(
        isSignUp ? "Kayit tamamlanamadi" : "Giris yapilamadi",
        toFriendlyAuthError(error instanceof Error ? error.message : String(error))
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      Alert.alert("Email gerekli", "Sifre sifirlama baglantisi icin email adresini yaz.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      Alert.alert("Sifre sifirlama baslamadi", toFriendlyAuthError(error.message));
      return;
    }

    Alert.alert("Email gonderildi", "Sifre sifirlama baglantisi email adresine gonderildi.");
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={typography.eyebrow}>Anne+ Takip</Text>
          <Text style={typography.heading1}>
            {isSignUp ? "Hesabini olustur" : "Tekrar hos geldin"}
          </Text>
          <Text style={styles.heroText}>
            Gebelik haftan, bebek gelisimi, asi hatirlatmalari ve topluluk destegi
            tek yerde.
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.modeSwitch}>
              <ModeButton
                active={!isSignUp}
                label="Giris"
                onPress={() => setMode("sign-in")}
              />
              <ModeButton
                active={isSignUp}
                label="Kayit"
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
              label="Sifre"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Button
              disabled={loading || !isSupabaseConfigured}
              label={
                loading
                  ? "Bekle..."
                  : isSignUp
                    ? "Hesap olustur"
                    : "Giris yap"
              }
              onPress={submit}
            />

            {!isSupabaseConfigured ? (
              <Text style={styles.warning}>Supabase env degerleri eksik.</Text>
            ) : null}

            <Pressable accessibilityRole="button" onPress={resetPassword}>
              <Text style={styles.linkText}>Sifremi unuttum</Text>
            </Pressable>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button
            label="Apple ile devam et"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "Yakinda",
                "Apple girisi icin App Store capability ve Supabase OAuth ayarlarini tamamlayinca aktif edecegiz."
              )
            }
          />
          <Button
            label="Google ile devam et"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "Yakinda",
                "Google OAuth ayarlarini tamamlayinca bu butonu aktif edecegiz."
              )
            }
          />
        </View>
      </View>
    </Screen>
  );
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
    borderRadius: radii.lg,
    gap: spacing.sm,
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
  warning: {
    ...typography.body,
    color: colors.danger
  }
});
