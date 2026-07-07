import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { UserRound } from "lucide-react-native";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";

import { getCurrentProfile, updateCurrentProfile, type ProfileUpdate } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { registerAndSavePushToken } from "@/lib/notifications";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { colors, radii, spacing, typography } from "@/theme";

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { isPremium, isLoading } = useSubscriptionStatus();

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      const updated = await updateCurrentProfile(update);

      if (Object.values(update).some((value) => value === true)) {
        const token = await registerAndSavePushToken();
        if (!token) {
          Alert.alert(
            "Bildirim izni kapali",
            "Telefon ayarlarindan bildirim izni verirsen bu tercih aktif calisir."
          );
        }
      }

      return updated;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-profile"] });
    },
    onError: (error) => Alert.alert("Ayar kaydedilemedi", error.message)
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("delete-account");

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/sign-in");
    },
    onError: (error) => Alert.alert("Hesap silinemedi", error.message)
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/sign-in");
    },
    onError: (error) => Alert.alert("Cikis yapilamadi", error.message)
  });

  const profile = profileQuery.data;

  function confirmDeleteAccount() {
    Alert.alert(
      "Hesabi kalici olarak sil",
      "Bu islem geri alinamaz. Profilin, bebek kayitlarin, fotograflarin ve forum iceriklerin kalici olarak silinir.",
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Kalici olarak sil",
          style: "destructive",
          onPress: () => deleteAccountMutation.mutate()
        }
      ]
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Profil</Text>
          <Text style={typography.body}>
            Profil, bildirim, abonelik ve hesap guvenligi tek yerde.
          </Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <View style={styles.profileHeader}>
                <Text style={typography.heading2}>Forum kimligin</Text>
                <UserRound color={colors.primary} size={26} />
              </View>
              <Text style={styles.profileName}>
                {profile?.forum_nickname ?? "Forum takma adi bekleniyor"}
              </Text>
              <Text style={typography.body}>
                Forumda gercek profilin degil, sadece bu takma ad ve anonim rozetin
                gorunur.
              </Text>
            </View>
            <View style={styles.statusGrid}>
              <StatusPill label="Supabase" value={isSupabaseConfigured ? "Hazir" : "Env eksik"} />
              <StatusPill
                label="Premium"
                value={isLoading ? "Kontrol" : isPremium ? "Aktif" : "Pasif"}
              />
            </View>
            <Button
              label={signOutMutation.isPending ? "Cikis yapiliyor..." : "Cikis yap"}
              variant="secondary"
              disabled={signOutMutation.isPending}
              onPress={() => signOutMutation.mutate()}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={typography.heading2}>Bildirim tercihleri</Text>
              <Text style={typography.body}>
                Push izinleri cihaz ayarindan, icerik tercihleri buradan yonetilir.
              </Text>
            </View>

            <PreferenceRow
              label="Gonderime yorum gelince"
              description="Forum gonderine biri yorum yazarsa haber ver."
              value={Boolean(profile?.notify_forum_comments)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_forum_comments: value })
              }
            />
            <PreferenceRow
              label="Gonderi veya yorumum begenilince"
              description="Topluluktan gelen begenileri kacirma."
              value={Boolean(profile?.notify_forum_likes)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_forum_likes: value })
              }
            />
            <PreferenceRow
              label="Asi hatirlatmalari"
              description="Yaklasan asi tarihleri icin bildirim al."
              value={Boolean(profile?.notify_vaccine_reminders)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_vaccine_reminders: value })
              }
            />
            <PreferenceRow
              label="Haftalik gebelik guncellemesi"
              description="Gebelik haftana gore ozet bildirimler al."
              value={Boolean(profile?.notify_weekly_pregnancy_updates)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({
                  notify_weekly_pregnancy_updates: value
                })
              }
            />

            <Button
              label="Bildirim iznini yenile"
              variant="secondary"
              onPress={() => registerAndSavePushToken()}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Abonelik</Text>
            <Text style={typography.body}>
              Premium icerikler ve reklamsiz deneyim icin RevenueCat akisi burada
              acilir.
            </Text>
            <Link href="/paywall" asChild>
              <Button label="Premium'a gec" />
            </Link>
          </View>
        </Card>

        <Card style={styles.dangerCard}>
          <View style={{ gap: spacing.md }}>
            <Text style={styles.dangerTitle}>Hesap islemleri</Text>
            <Text style={typography.body}>
              App Store ve Play Store uyumlulugu icin hesap silme uygulama icinden
              kalici olarak yapilabilir.
            </Text>
            <Button
              label={
                deleteAccountMutation.isPending
                  ? "Hesap siliniyor..."
                  : "Hesabimi kalici olarak sil"
              }
              variant="ghost"
              disabled={deleteAccountMutation.isPending}
              onPress={confirmDeleteAccount}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function PreferenceRow({
  label,
  description,
  value,
  disabled,
  onValueChange
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={typography.label}>{label}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch
        disabled={disabled}
        ios_backgroundColor={colors.border}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  profileCard: {
    backgroundColor: colors.primarySoft
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileName: {
    ...typography.heading2,
    color: colors.primary
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statusLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12
  },
  statusValue: {
    ...typography.label,
    color: colors.text
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  preferenceCopy: {
    flex: 1,
    gap: spacing.xs
  },
  preferenceDescription: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20
  },
  dangerCard: {
    borderColor: colors.danger
  },
  dangerTitle: {
    ...typography.heading2,
    color: colors.danger
  }
});
