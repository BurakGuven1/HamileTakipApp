import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Link, router } from "expo-router";
import { Copy, UserRound } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollView
} from "react-native";

import {
  getCurrentProfile,
  isNicknameAvailable,
  updateCurrentProfile,
  type ProfileUpdate
} from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Thread } from "@/components/Thread";
import {
  getWaterRemindersEnabled,
  setWaterRemindersEnabled,
  WATER_REMINDER_TIME_LABEL
} from "@/features/pregnancy/waterReminders";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import {
  getSubscriptionStatusFromCustomerInfo,
  hasPremiumEntitlement,
  restorePremiumPurchases,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";
import {
  registerAndSavePushToken,
  unregisterPushTokenForCurrentUser
} from "@/lib/notifications";
import {
  appStoreSubscriptionsUrl,
  openLegalPage,
  type LegalPage
} from "@/config/legal";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import {
  colors,
  radii,
  spacing,
  themeOptions,
  typography
} from "@/theme";
import type { ThemePreference } from "@/theme";

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
  const accentColor = useAppTheme();
  const {
    accessSource,
    familyTrialExpirationDate,
    isPremium,
    isLoading
  } = useSubscriptionStatus();
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [motherName, setMotherName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [forumNickname, setForumNickname] = useState("");
  const [isPregnant, setIsPregnant] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [feedingMode, setFeedingMode] = useState<"breastfeeding" | "pumping" | "mixed" | "formula">("mixed");
  const [ownUserId, setOwnUserId] = useState<string>();
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [sendingTestNotification, setSendingTestNotification] = useState(false);
  const [waterRemindersEnabled, setWaterRemindersEnabledState] = useState(false);
  const [updatingWaterReminders, setUpdatingWaterReminders] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const profileEditorYRef = useRef(0);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const profile = profileQuery.data;
  const appTheme = accentColor.theme;

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setOwnUserId(data.user?.id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getWaterRemindersEnabled()
      .then(setWaterRemindersEnabledState)
      .catch(() => setWaterRemindersEnabledState(false));
  }, []);

  useEffect(() => {
    if (!profile || profileEditOpen) {
      return;
    }

    setForumNickname(profile.forum_nickname ?? "");
    setMotherName(profile.mother_name ?? "");
    setFatherName(profile.father_name ?? "");
    setIsPregnant(profile.is_pregnant);
    setDueDate(profile.due_date ?? "");
    setThemePreference(profile.theme_preference);
    setFeedingMode(profile.feeding_mode ?? "mixed");
  }, [profile, profileEditOpen]);

  const updatePreferenceMutation = useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      const updated = await updateCurrentProfile(update);

      if (Object.values(update).some((value) => value === true)) {
        const token = await registerAndSavePushToken();
        if (!token) {
          showInfo(
            "Telefon ayarlarından bildirim izni verirsen bu tercih aktif çalışır.",
            "Bildirim izni kapalı"
          );
        }
      }

      return updated;
    },
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(["current-profile"], updatedProfile);
      await queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      showSuccess("Tercihin kaydedildi.");
    },
    onError: (error) => showError(error, "Ayar kaydedilemedi")
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const cleanNickname = forumNickname.trim();
      const cleanMotherName = motherName.trim();
      const cleanFatherName = fatherName.trim();

      if (cleanMotherName.length < 2 || cleanFatherName.length < 2) {
        throw new Error("Anne ve baba adı en az 2 karakter olmalı.");
      }

      if (cleanNickname.length < 3) {
        throw new Error("Forum takma adı en az 3 karakter olmalı.");
      }

      if (profile?.forum_nickname !== cleanNickname) {
        const available = await isNicknameAvailable(cleanNickname);
        if (!available) {
          throw new Error("Bu takma ad kullanılıyor. Başka bir takma ad dene.");
        }
      }

      if (isPregnant && !dueDate) {
        throw new Error("Tahmini doğum tarihini seçmelisin.");
      }

      return updateCurrentProfile({
        due_date: isPregnant ? dueDate : null,
        display_name: cleanMotherName,
        father_name: cleanFatherName,
        forum_nickname: cleanNickname,
        is_pregnant: isPregnant,
        mother_name: cleanMotherName,
        feeding_mode: feedingMode,
        theme_preference: themePreference
      });
    },
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(["current-profile"], updatedProfile);
      setProfileEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      showSuccess("Profil bilgilerin güncellendi.");
    },
    onError: (error) => showError(error, "Profil güncellenemedi")
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
    onError: (error) => showError(error, "Hesap silinemedi")
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await unregisterPushTokenForCurrentUser().catch(() => undefined);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/sign-in");
    },
    onError: (error) => showError(error, "Çıkış yapılamadı")
  });

  function confirmDeleteAccount() {
    const subscriptionNote = isPremium
      ? " Aktif App Store aboneliğin hesabın silinse de Apple tarafından otomatik iptal edilmez; devam etmeden önce aboneliğini yönetip iptal et."
      : "";

    Alert.alert(
      "Hesabı kalıcı olarak sil",
      `Bu işlem geri alınamaz. Profilin, bebek kayıtların, fotoğrafların ve forum içeriklerin kalıcı olarak silinir.${subscriptionNote}`,
      [
        { text: "Vazgeç", style: "cancel" },
        ...(isPremium
          ? [
              {
                text: "Aboneliği yönet",
                onPress: () => {
                  Linking.openURL(appStoreSubscriptionsUrl).catch((error) =>
                    showError(error, "Abonelik sayfası açılamadı")
                  );
                }
              }
            ]
          : []),
        {
          text: "Kalıcı olarak sil",
          style: "destructive",
          onPress: () => deleteAccountMutation.mutate()
        }
      ]
    );
  }

  async function refreshNotificationPermission() {
    try {
      const token = await registerAndSavePushToken();
      if (token) {
        showSuccess("Bildirim izni güncellendi.");
        return;
      }

      showInfo(
        "Telefon ayarlarından bildirim izni verirsen hatırlatmalar aktif çalışır.",
        "Bildirim izni kapalı"
      );
    } catch (error) {
      showError(error, "Bildirim izni yenilenemedi");
    }
  }

  async function updateWaterReminders(enabled: boolean) {
    setUpdatingWaterReminders(true);
    try {
      const nextEnabled = await setWaterRemindersEnabled(enabled);
      setWaterRemindersEnabledState(nextEnabled);
      if (nextEnabled) {
        showSuccess(
          `${WATER_REMINDER_TIME_LABEL} saatlerinde nazik hatırlatmalar planlandı.`,
          "Su hatırlatmaları açık"
        );
      } else {
        showSuccess("Planlanmış su hatırlatmaları kaldırıldı.", "Hatırlatmalar kapalı");
      }
    } catch (error) {
      setWaterRemindersEnabledState(false);
      showError(error, "Su hatırlatmaları güncellenemedi");
    } finally {
      setUpdatingWaterReminders(false);
    }
  }

  async function sendTestNotification() {
    setSendingTestNotification(true);
    try {
      const token = await registerAndSavePushToken();
      if (!token) {
        showInfo(
          "Önce telefon ayarlarından Anne+ bildirimlerine izin verin.",
          "Bildirim izni gerekli"
        );
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "send-test-notification",
        { body: {} }
      );
      if (error) throw error;
      if (!data?.success) throw new Error("Test bildirimi gönderilemedi.");

      showSuccess("Test push bildirimi gönderildi. Birkaç saniye içinde görünmeli.");
    } catch (error) {
      showError(error, "Test bildirimi gönderilemedi");
    } finally {
      setSendingTestNotification(false);
    }
  }

  async function restorePurchases() {
    setRestoringPurchases(true);
    try {
      const customerInfo = await restorePremiumPurchases();
      const status = getSubscriptionStatusFromCustomerInfo(customerInfo);

      queryClient.setQueryData<PremiumSubscriptionStatus>(
        SUBSCRIPTION_STATUS_QUERY_KEY,
        status
      );
      await reconcileCustomerInfoWithSupabase(customerInfo);
      await queryClient.invalidateQueries({
        queryKey: SUBSCRIPTION_STATUS_QUERY_KEY
      });

      if (hasPremiumEntitlement(customerInfo)) {
        showSuccess("Premium erişimin geri yüklendi.", "Satın alma bulundu");
        return;
      }

      showInfo(
        "Bu mağaza hesabında geri yüklenecek aktif Premium satın alımı bulunamadı.",
        "Satın alma bulunamadı"
      );
    } catch (error) {
      showError(error, "Satın alma geri yüklenemedi");
    } finally {
      setRestoringPurchases(false);
    }
  }

  async function openLegalDocument(page: LegalPage) {
    try {
      await openLegalPage(page);
    } catch (error) {
      showError(error, "Yasal sayfa açılamadı");
    }
  }

  function openProfileEditor() {
    setForumNickname(profile?.forum_nickname ?? "");
    setMotherName(profile?.mother_name ?? profile?.display_name ?? "");
    setFatherName(profile?.father_name ?? "");
    setIsPregnant(Boolean(profile?.is_pregnant));
    setDueDate(profile?.due_date ?? "");
    setThemePreference(profile?.theme_preference ?? "auto");
    setProfileEditOpen(true);
    requestAnimationFrame(() => scrollToProfileEditor());
  }

  function handleProfileEditorLayout(event: LayoutChangeEvent) {
    const y = event.nativeEvent.layout.y;
    profileEditorYRef.current = y;
    scrollToProfileEditor(y);
  }

  function scrollToProfileEditor(y = profileEditorYRef.current) {
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(y - spacing.md, 0)
    });
  }

  async function copyFamilyCode() {
    if (!profile?.family_referral_code) {
      return;
    }

    try {
      await Clipboard.setStringAsync(profile.family_referral_code);
      showSuccess("Aile kodu panoya kopyalandı.");
    } catch (error) {
      showError(error, "Kod kopyalanamadı");
    }
  }

  return (
    <Screen ref={scrollRef}>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={styles.heroThread}>
            <Thread height={96} progress={0.76} variant="decorative" />
          </View>
          <Text style={typography.heading1}>Profil</Text>
          <Text style={typography.body}>
            Profil, bildirim, abonelik ve hesap güvenliği tek yerde.
          </Text>
        </View>

        <Card style={[styles.profileCard, { backgroundColor: appTheme.primarySoft }]}>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <View style={styles.profileHeader}>
                <Text style={typography.heading2}>Forum kimliğin</Text>
                <UserRound color={appTheme.primary} size={26} />
              </View>
              <Text style={[styles.profileName, { color: appTheme.primary }]}>
                {profile?.forum_nickname ?? "Forum takma adı bekleniyor"}
              </Text>
              <Text style={typography.body}>
                Forumda gerçek profilin değil, sadece bu takma ad ve anonim rozetin
                görünür.
              </Text>
            </View>
            <View style={styles.parentRow}>
              <ParentNamePill label="Anne" value={profile?.mother_name || "Anne"} />
              <ParentNamePill label="Baba" value={profile?.father_name || "Baba"} />
            </View>
            <View style={styles.statusGrid}>
              <StatusPill
                label="Premium"
                value={
                  isLoading
                    ? "Kontrol"
                    : accessSource === "family_trial"
                      ? "Aile hakkı"
                      : isPremium
                        ? "Aktif"
                        : "Pasif"
                }
              />
              <StatusPill
                label="Durum"
                value={profile?.is_pregnant ? "Hamilelik" : "Genel takip"}
              />
              <StatusPill label="Tema" value={appTheme.label} />
            </View>
            {accessSource === "family_trial" && familyTrialExpirationDate ? (
              <Text style={styles.familyPremiumNote}>
                Aile Premium erişimin {formatPremiumAccessDate(familyTrialExpirationDate)}{" "}
                tarihine kadar aktif. Sonrasında Premium özelliklere devam etmek için
                kendi aboneliğini başlatman gerekir.
              </Text>
            ) : null}
            <Button
              label="Profil bilgilerini düzenle"
              variant="ghost"
              disabled={!profile}
              onPress={openProfileEditor}
            />
            <Button
              label={signOutMutation.isPending ? "Çıkış yapılıyor..." : "Çıkış yap"}
              variant="secondary"
              disabled={signOutMutation.isPending}
              onPress={() => signOutMutation.mutate()}
            />
          </View>
        </Card>

        {profile?.family_referral_code && profile.id === ownUserId ? (
          <Pressable
            accessibilityRole="button"
            onPress={copyFamilyCode}
            style={[
              styles.familyCodeCard,
              {
                backgroundColor: appTheme.accentSoft,
                borderColor: appTheme.primary
              }
            ]}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={typography.heading2}>Baba giriş kodu</Text>
              <Text style={[styles.familyCode, { color: appTheme.primary }]}>
                {profile.family_referral_code}
              </Text>
              <Text style={typography.body}>
                Bu kod yalnızca bir baba hesabına bir kez bağlanabilir. Baba kodla
                giriş yaptıktan sonra oturumu bu cihazda kalıcı tutulur; kod başka
                bir hesapta yeniden kullanılamaz.
              </Text>
            </View>
            <View style={styles.copyBadge}>
              <Copy color={appTheme.primary} size={20} />
            </View>
          </Pressable>
        ) : null}

        {profileEditOpen ? (
          <View onLayout={handleProfileEditorLayout}>
          <Card>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.heading2}>Profil bilgileri</Text>
              <Text style={typography.body}>
                  Anne-baba adını, forum takma adını ve gebelik durumunu buradan güncelle.
                </Text>
              </View>

              <TextField
                autoCapitalize="words"
                label="Anne adı"
                value={motherName}
                onChangeText={setMotherName}
              />

              <TextField
                autoCapitalize="words"
                label="Baba adı"
                value={fatherName}
                onChangeText={setFatherName}
              />

              <TextField
                autoCapitalize="none"
                label="Forum takma adı"
                value={forumNickname}
                onChangeText={setForumNickname}
              />

              <View style={{ gap: spacing.sm }}>
                <Text style={typography.label}>Takip durumu</Text>
                <View style={styles.segmentRow}>
                  <SegmentButton
                    active={isPregnant}
                    label="Hamileyim"
                    onPress={() => setIsPregnant(true)}
                  />
                  <SegmentButton
                    active={!isPregnant}
                    label="Hamile değilim"
                    onPress={() => setIsPregnant(false)}
                  />
                </View>
              </View>

              {isPregnant ? (
                <DatePickerField
                  label="Tahmini doğum tarihi"
                  placeholder="Doğum tarihini seç"
                  value={dueDate}
                  onChange={setDueDate}
                />
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <Text style={typography.label}>Beslenme akışı</Text>
                <Text style={typography.body}>Bakım günlüğünde en sık kullandığın kayıtları öne çıkarır; sağlık önerisi değildir.</Text>
                <View style={styles.segmentRow}>
                  <SegmentButton active={feedingMode === "breastfeeding"} label="Emzirme" onPress={() => setFeedingMode("breastfeeding")} />
                  <SegmentButton active={feedingMode === "pumping"} label="Sağım" onPress={() => setFeedingMode("pumping")} />
                  <SegmentButton active={feedingMode === "mixed"} label="Karma" onPress={() => setFeedingMode("mixed")} />
                  <SegmentButton active={feedingMode === "formula"} label="Mama" onPress={() => setFeedingMode("formula")} />
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text style={typography.label}>Tema rengi</Text>
                <View style={styles.themeGrid}>
                  {themeOptions.map((item) => (
                    <ThemeChip
                      key={item.id}
                      active={themePreference === item.id}
                      color={item.primary}
                      label={item.label}
                      onPress={() => {
                        if (updatePreferenceMutation.isPending) return;
                        setThemePreference(item.id);
                        updatePreferenceMutation.mutate({
                          theme_preference: item.id
                        });
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.formActions}>
                <Button
                  label="Vazgeç"
                  variant="ghost"
                  style={styles.formButton}
                  onPress={() => setProfileEditOpen(false)}
                />
                <Button
                  label={
                    updateProfileMutation.isPending
                      ? "Kaydediliyor..."
                      : "Kaydet"
                  }
                  disabled={updateProfileMutation.isPending}
                  style={styles.formButton}
                  onPress={() => updateProfileMutation.mutate()}
                />
              </View>
            </View>
          </Card>
          </View>
        ) : null}

        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={typography.heading2}>Bildirim tercihleri</Text>
              <Text style={typography.body}>
                Bildirim izinleri cihaz ayarından, içerik tercihleri buradan yönetilir.
              </Text>
            </View>

            <PreferenceRow
              label="Gönderime yorum gelince"
              description="Forum gönderine biri yorum yazarsa haber ver."
              value={Boolean(profile?.notify_forum_comments)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_forum_comments: value })
              }
            />
            <PreferenceRow
              label="Gönderi veya yorumum beğenilince"
              description="Topluluktan gelen beğenileri kaçırma."
              value={Boolean(profile?.notify_forum_likes)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_forum_likes: value })
              }
            />
            <PreferenceRow
              label="Aşı hatırlatmaları"
              description="Yaklaşan aşı tarihleri için bildirim al."
              value={Boolean(profile?.notify_vaccine_reminders)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_vaccine_reminders: value })
              }
            />
            <PreferenceRow
              label="Haftalık gebelik güncellemesi"
              description="Gebelik haftana göre özet bildirimler al."
              value={Boolean(profile?.notify_weekly_pregnancy_updates)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({
                  notify_weekly_pregnancy_updates: value
                })
              }
            />
            <PreferenceRow
              label="Günlük kişisel destek"
              description="Gebelik haftana veya doğum sonrası dönemine uygun makale, küçük öneri ve destek mesajı al."
              value={Boolean(profile?.notify_daily_support)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_daily_support: value })
              }
            />
            <PreferenceRow
              label="Günlük su hatırlatmaları · Ücretsiz"
              description={`${WATER_REMINDER_TIME_LABEL} saatlerinde cihazında nazik su molaları planla. İstediğin an kapatabilirsin.`}
              value={waterRemindersEnabled}
              disabled={updatingWaterReminders}
              onValueChange={(value) => void updateWaterReminders(value)}
            />
            <PreferenceRow
              label="Akıllı uyku tahminleri"
              description="Yeterli kayıt oluştuğunda yaklaşan uyku penceresinden haber ver."
              value={Boolean(profile?.notify_sleep_predictions)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_sleep_predictions: value })
              }
            />
            <PreferenceRow
              label="İlaç ve vitamin güvenlik uyarıları"
              description="Başka bir bakıcı doz kaydettiğinde çift doz riskine karşı haber ver."
              value={Boolean(profile?.notify_medicine_safety)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_medicine_safety: value })
              }
            />
            <PreferenceRow
              label="Gelişim dönemi notları"
              description="Bebeğin yaşına göre empatik ve güvenli gelişim notları al."
              value={Boolean(profile?.notify_development_periods)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_development_periods: value })
              }
            />
            <PreferenceRow
              label="Anne sütü stok uyarıları"
              description="Poşet veya kabın son kullanım süresi yaklaşınca haber ver."
              value={Boolean(profile?.notify_milk_inventory)}
              disabled={!profile || updatePreferenceMutation.isPending}
              onValueChange={(value) =>
                updatePreferenceMutation.mutate({ notify_milk_inventory: value })
              }
            />

            <Button
              label="Bildirim iznini yenile"
              variant="secondary"
              onPress={refreshNotificationPermission}
            />
            <Button
              disabled={sendingTestNotification}
              label={
                sendingTestNotification
                  ? "Test bildirimi gönderiliyor..."
                  : "Test push bildirimi gönder"
              }
              variant="secondary"
              onPress={sendTestNotification}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Abonelik</Text>
            <Text style={typography.body}>
              Premium içerikler ve gelişmiş takip özellikleri için satın alma sayfası
              burada açılır.
            </Text>
            <Link href="/paywall" asChild>
              <Button label="Premium'a geç" />
            </Link>
            <Button
              label={
                restoringPurchases
                  ? "Satın alımlar kontrol ediliyor..."
                  : "Satın alımları geri yükle"
              }
              variant="secondary"
              disabled={restoringPurchases}
              onPress={restorePurchases}
            />
          </View>
        </Card>

        <Card style={styles.dangerCard}>
          <View style={{ gap: spacing.md }}>
            <Text style={styles.dangerTitle}>Hesap işlemleri</Text>
            <Text style={typography.body}>
              App Store ve Play Store uyumluluğu için hesap silme uygulama içinden
              kalıcı olarak yapılabilir.
            </Text>
            <Button
              label={
                deleteAccountMutation.isPending
                  ? "Hesap siliniyor..."
                  : "Hesabımı kalıcı olarak sil"
              }
              variant="ghost"
              disabled={deleteAccountMutation.isPending}
              onPress={confirmDeleteAccount}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Gizlilik ve yasal bilgiler</Text>
            <Text style={typography.body}>
              Verilerinin nasıl işlendiğini, kullanım koşullarını ve tıbbi içerik
              sınırlarını istediğin zaman inceleyebilirsin.
            </Text>
            <Button
              label="Gizlilik politikasını aç"
              variant="secondary"
              onPress={() => openLegalDocument("privacy")}
            />
            <Button
              label="KVKK aydınlatma metnini aç"
              variant="secondary"
              onPress={() => openLegalDocument("kvkkDisclosure")}
            />
            <Button
              label="Açık rıza metnini aç"
              variant="secondary"
              onPress={() => openLegalDocument("explicitConsent")}
            />
            <Button
              label="Kullanım şartlarını aç"
              variant="secondary"
              onPress={() => openLegalDocument("terms")}
            />
            <Button
              label="Sorumluluk reddini aç"
              variant="ghost"
              onPress={() => openLegalDocument("disclaimer")}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function formatPremiumAccessDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
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
  const accentColor = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text
        style={[
          styles.segmentText,
          active && styles.segmentTextActive,
          active && { color: accentColor.primary }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ThemeChip({
  active,
  color,
  label,
  onPress
}: {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.themeChip,
        active && styles.themeChipActive,
        active && { borderColor: color }
      ]}
    >
      <View style={[styles.themeSwatch, { backgroundColor: color }]} />
      <Text
        style={[
          styles.themeChipText,
          active && styles.themeChipTextActive,
          active && { color }
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  const accentColor = useAppTheme();

  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={typography.label}>{label}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        ios_backgroundColor={colors.border}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: accentColor.primary }}
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

function ParentNamePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.parentNamePill}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.parentName}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    ...radii.cardLarge,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  heroThread: {
    bottom: -22,
    left: spacing.lg,
    opacity: 0.3,
    position: "absolute",
    right: -spacing.lg
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
  familyCodeCard: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.highlightSoft,
    borderColor: colors.primary,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  familyCode: {
    ...typography.data,
    color: colors.primary,
    fontSize: 30,
    letterSpacing: 4,
    lineHeight: 38
  },
  copyBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  familyPremiumNote: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.md
  },
  parentRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  parentNamePill: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  parentName: {
    ...typography.label,
    color: colors.text
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
    fontSize: 14,
    lineHeight: 19
  },
  statusValue: {
    ...typography.label,
    color: colors.text
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
    fontSize: 14,
    textAlign: "center"
  },
  segmentTextActive: {
    color: colors.primary
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  formButton: {
    flex: 1
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  themeChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  themeChipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary
  },
  themeSwatch: {
    borderRadius: radii.pill,
    height: 18,
    width: 18
  },
  themeChipText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  themeChipTextActive: {
    color: colors.primary
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
    fontSize: 15,
    lineHeight: 21
  },
  dangerCard: {
    borderColor: colors.danger
  },
  dangerTitle: {
    ...typography.heading2,
    color: colors.danger
  }
});
