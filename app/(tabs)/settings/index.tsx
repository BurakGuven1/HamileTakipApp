import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as StoreReview from "expo-store-review";
import { Link, router } from "expo-router";
import { ChevronDown, ChevronRight, Copy, Mail, Star, UserRound } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Platform,
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
import { listBabies } from "@/api/babies";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { LifeStageSwitcher } from "@/features/life-stage/LifeStageSwitcher";
import {
  experienceStageLabels,
  getExperienceStage
} from "@/features/life-stage/lifeStage";
import {
  getWaterRemindersEnabled,
  setWaterRemindersEnabled,
  WATER_REMINDER_TIME_LABEL
} from "@/features/pregnancy/waterReminders";
import { reconcileCustomerInfoWithSupabase } from "@/features/subscription/reconcileSubscription";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
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
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [feedingMode, setFeedingMode] = useState<"breastfeeding" | "pumping" | "mixed" | "formula">("mixed");
  const [ownUserId, setOwnUserId] = useState<string>();
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [showMoreProfileSettings, setShowMoreProfileSettings] = useState(false);
  const [showMoreNotificationPreferences, setShowMoreNotificationPreferences] =
    useState(false);
  const [waterRemindersEnabled, setWaterRemindersEnabledState] = useState(false);
  const [updatingWaterReminders, setUpdatingWaterReminders] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const profileEditorYRef = useRef(0);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });
  const familyMembershipQuery = useQuery({
    queryKey: ["current-family-membership"],
    queryFn: getCurrentFamilyMembership
  });

  const profile = profileQuery.data;
  const familyMembership = familyMembershipQuery.data;
  const hasBaby = Boolean(babiesQuery.data?.length);
  const experienceStage = getExperienceStage(profile, hasBaby);
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
    setThemePreference(profile.theme_preference);
    setFeedingMode(profile.feeding_mode ?? "mixed");
  }, [experienceStage, profile, profileEditOpen]);

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

  function updatePremiumNotificationPreference(
    update: ProfileUpdate,
    source: string
  ) {
    if (isLoading) return;

    if (!isPremium) {
      void showPaywallIfNeeded(source, {
        feature: source,
        placement: "notification_preferences"
      });
      return;
    }

    updatePreferenceMutation.mutate(update);
  }

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

      return updateCurrentProfile({
        display_name: cleanMotherName,
        father_name: cleanFatherName,
        forum_nickname: cleanNickname,
        mother_name: cleanMotherName,
        ...(experienceStage === "postpartum"
          ? { feeding_mode: feedingMode }
          : {}),
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

  async function openStoreReview() {
    try {
      const configuredStoreUrl = StoreReview.storeUrl();
      if (configuredStoreUrl) {
        const separator = configuredStoreUrl.includes("?") ? "&" : "?";
        const reviewUrl =
          Platform.OS === "ios"
            ? `${configuredStoreUrl}${separator}action=write-review`
            : `${configuredStoreUrl}${separator}showAllReviews=true`;
        await Linking.openURL(reviewUrl);
        return;
      }

      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        return;
      }

      showInfo(
        "Mağaza değerlendirme ekranı bu cihazda kullanılamıyor.",
        "Değerlendirme açılamadı"
      );
    } catch (error) {
      showError(error, "Mağaza değerlendirmesi açılamadı");
    }
  }

  async function openSupportEmail() {
    try {
      const url =
        "mailto:anneplusapp@gmail.com?subject=" +
        encodeURIComponent("Anne+ destek ve geri bildirim");
      await Linking.openURL(url);
    } catch (error) {
      showError(error, "E-posta uygulaması açılamadı");
    }
  }

  function openProfileEditor() {
    setForumNickname(profile?.forum_nickname ?? "");
    setMotherName(profile?.mother_name ?? profile?.display_name ?? "");
    setFatherName(profile?.father_name ?? "");
    setThemePreference(profile?.theme_preference ?? "auto");
    setFeedingMode(profile?.feeding_mode ?? "mixed");
    setShowMoreProfileSettings(true);
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
          <Text style={typography.heading1}>Profil</Text>
          <Text style={typography.body}>
            Profil, bildirim, abonelik ve hesap güvenliği tek yerde.
          </Text>
        </View>

        <Card style={[styles.profileCard, { backgroundColor: appTheme.primarySoft }]}>
          <View style={{ gap: spacing.md }}>
            {familyMembershipQuery.isPending || familyMembershipQuery.isError ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.heading2}>
                  {familyMembershipQuery.isError
                    ? "Aile hesabı doğrulanamadı"
                    : "Hesap bilgileri hazırlanıyor…"}
                </Text>
                <Text style={typography.body}>
                  {familyMembershipQuery.isError
                    ? "Profil kapsamını güvenle belirlemek için bağlantını kontrol edip yeniden dene."
                    : "Rolün ve erişim kapsamın kontrol ediliyor."}
                </Text>
                {familyMembershipQuery.isError ? (
                  <Button
                    label="Yeniden dene"
                    variant="ghost"
                    onPress={() => void familyMembershipQuery.refetch()}
                  />
                ) : null}
              </View>
            ) : familyMembership ? (
              <>
                <View style={{ gap: spacing.xs }}>
                  <View style={styles.profileHeader}>
                    <Text style={typography.heading2}>Aile hesabın</Text>
                    <UserRound color={appTheme.primary} size={26} />
                  </View>
                  <Text style={[styles.profileName, { color: appTheme.primary }]}>
                    {familyMembership.display_name}
                  </Text>
                  <Text style={typography.body}>
                    {familyMembership.role === "caregiver"
                      ? "Bakıcı olarak ortak bebek bakımı, görev ve vardiya alanlarına bağlısın. Annenin özel sağlık kayıtları paylaşılmaz."
                      : "Baba olarak aile akışına bağlısın. Ortak görevler, alarmlar ve vardiyalar iki cihazda eşitlenir."}
                  </Text>
                </View>
                <View style={[styles.identityDetails, styles.identityDetailsCompact]}>
                  <View style={styles.statusGrid}>
                    <ProfileDetail
                      label="Rol"
                      value={familyMembership.role === "caregiver" ? "Bakıcı" : "Baba"}
                    />
                    <ProfileDetail
                      label="Erişim"
                      value={
                        familyMembership.access_scope === "baby_care_only"
                          ? "Paylaşılan bakım"
                          : "Aile"
                      }
                    />
                    <ProfileDetail
                      label="Premium"
                      value={
                        isLoading
                          ? "Kontrol"
                          : accessSource === "family"
                            ? "Aile Premium"
                            : accessSource === "family_trial"
                              ? "Aile denemesi"
                              : isPremium
                                ? "Aktif"
                                : "Pasif"
                      }
                    />
                  </View>
                </View>
                {accessSource === "family" ? (
                  <Text style={styles.familyPremiumNote}>
                    Aile sahibinin aktif Premium aboneliği bu hesapla paylaşılıyor.
                    Abonelik aktif kaldığı sürece Premium özellikleri birlikte
                    kullanabilirsiniz.
                  </Text>
                ) : null}
                {accessSource === "family_trial" && familyTrialExpirationDate ? (
                  <Text style={styles.familyPremiumNote}>
                    Geçici aile Premium erişimin{" "}
                    {formatPremiumAccessDate(familyTrialExpirationDate)} tarihine kadar
                    aktif.
                  </Text>
                ) : null}
                <Button
                  label="Aile görevlerini aç"
                  onPress={() => router.push("/family-planner")}
                />
              </>
            ) : (
              <>
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
                <View style={styles.identityDetails}>
                  <View style={styles.parentRow}>
                    <ProfileDetail
                      prominent
                      label="Anne"
                      value={profile?.mother_name || "Anne"}
                    />
                    <ProfileDetail
                      prominent
                      label="Baba"
                      value={profile?.father_name || "Baba"}
                    />
                  </View>
                  <View style={styles.identityRule} />
                  <View style={styles.statusGrid}>
                    <ProfileDetail
                      label="Premium"
                      value={isLoading ? "Kontrol" : isPremium ? "Aktif" : "Pasif"}
                    />
                    <ProfileDetail
                      label="Durum"
                      value={
                        babiesQuery.isLoading
                          ? "Kontrol ediliyor"
                          : babiesQuery.isError
                            ? "Kontrol edilemedi"
                            : experienceStageLabels[experienceStage]
                      }
                    />
                    <ProfileDetail label="Tema" value={appTheme.label} />
                  </View>
                </View>
                <Button
                  label="Profil bilgilerini düzenle"
                  variant="ghost"
                  disabled={!profile}
                  onPress={openProfileEditor}
                />
              </>
            )}
            <Button
              label={signOutMutation.isPending ? "Çıkış yapılıyor..." : "Çıkış yap"}
              variant="secondary"
              disabled={signOutMutation.isPending}
              onPress={() => signOutMutation.mutate()}
            />
          </View>
        </Card>

        {profile && profile.id === ownUserId && babiesQuery.isSuccess ? (
          <Card>
            <LifeStageSwitcher
              existingBaby={babiesQuery.data?.[0] ?? null}
              hasBaby={hasBaby}
              profile={profile}
            />
          </Card>
        ) : null}

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
              <Text style={typography.heading2}>Aile bağlantı kodu</Text>
              <Text style={[styles.familyCode, { color: appTheme.primary }]}>
                {profile.family_referral_code}
              </Text>
              <Text style={typography.body}>
                Kodu babayla veya güvendiğin bir bakıcıyla paylaşabilirsin. Kod tek
                aile üyesine bağlanır; aynı kişi cihazını değiştirdiğinde yeniden
                giriş yapabilir. Bakıcı annenin özel sağlık kayıtlarını göremez.
              </Text>
            </View>
            <View style={styles.copyBadge}>
              <Copy color={appTheme.primary} size={20} />
            </View>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityHint="Bildirim, abonelik, gizlilik ve hesap ayarlarını açar veya kapatır"
          accessibilityLabel={
            showMoreProfileSettings
              ? "Daha az profil ayarı göster"
              : "Daha fazla profil ayarı göster"
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: showMoreProfileSettings }}
          onPress={() =>
            setShowMoreProfileSettings((current) => !current)
          }
          style={({ pressed }) => [
            styles.moreSettingsToggle,
            pressed && styles.moreSettingsTogglePressed
          ]}
        >
          <View style={styles.moreSettingsCopy}>
            <Text style={styles.moreSettingsTitle}>
              {showMoreProfileSettings ? "Daha az göster" : "Daha fazla gör"}
            </Text>
            <Text style={styles.moreSettingsDescription}>
              Bildirimler, abonelik, gizlilik ve hesap işlemleri
            </Text>
          </View>
          <ChevronDown
            color={appTheme.primary}
            size={22}
            style={
              showMoreProfileSettings
                ? styles.moreSettingsChevronOpen
                : undefined
            }
          />
        </Pressable>

        <Card>
          <View style={styles.contactSection}>
            <View style={{ gap: spacing.xs }}>
              <Text style={typography.heading2}>Anne+ ile paylaş</Text>
              <Text style={typography.body}>
                Deneyimini mağazada değerlendirebilir veya bize doğrudan yazabilirsin.
              </Text>
            </View>
            <ProfileActionRow
              description="App Store veya Play Store’da yıldız ver ve yorumunu paylaş"
              icon={<Star color={colors.honeyGold} size={23} />}
              label="Bizi değerlendirin"
              onPress={() => void openStoreReview()}
            />
            <ProfileActionRow
              description="anneplusapp@gmail.com"
              icon={<Mail color={appTheme.primary} size={23} />}
              label="Bize ulaşın"
              onPress={() => void openSupportEmail()}
            />
          </View>
        </Card>

        {showMoreProfileSettings ? (
          <>

        {profileEditOpen ? (
          <View onLayout={handleProfileEditorLayout}>
          <Card>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.heading2}>Profil bilgileri</Text>
              <Text style={typography.body}>
                  Anne-baba adını, forum takma adını ve görünüm tercihini buradan güncelle.
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

              {experienceStage === "postpartum" ? (
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
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <Text style={typography.label}>Görünüm ve tema</Text>
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
            {experienceStage !== "general" ? (
              <PreferenceRow
                label="Aşı hatırlatmaları"
                description="Yaklaşan aşı tarihleri için bildirim al."
                value={Boolean(profile?.notify_vaccine_reminders)}
                disabled={!profile || updatePreferenceMutation.isPending}
                onValueChange={(value) =>
                  updatePreferenceMutation.mutate({ notify_vaccine_reminders: value })
                }
              />
            ) : null}
            {showMoreNotificationPreferences ? (
              <>
                {experienceStage === "pregnancy" ? (
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
                ) : null}
                <PreferenceRow
                  label="Günlük kişisel destek"
                  description={
                    experienceStage === "general"
                      ? "Yaşam evreni seçene kadar genel, nazik destek mesajları al."
                      : "Yaşam evrene uygun makale, küçük öneri ve destek mesajı al."
                  }
                  value={Boolean(profile?.notify_daily_support)}
                  disabled={!profile || updatePreferenceMutation.isPending}
                  onValueChange={(value) =>
                    updatePreferenceMutation.mutate({ notify_daily_support: value })
                  }
                />
                <PreferenceRow
                  label="Premium fırsatları"
                  description="Yalnızca özel dönemlerde Anne+ Premium teklif bildirimi al. Varsayılan olarak kapalıdır."
                  value={Boolean(profile?.notify_premium_offers)}
                  disabled={!profile || updatePreferenceMutation.isPending}
                  onValueChange={(value) =>
                    updatePreferenceMutation.mutate({ notify_premium_offers: value })
                  }
                />
                {experienceStage === "pregnancy" ? (
                  <PreferenceRow
                    label="Günlük su hatırlatmaları · Ücretsiz"
                    description={`${WATER_REMINDER_TIME_LABEL} saatlerinde cihazında nazik su molaları planla. İstediğin an kapatabilirsin.`}
                    value={waterRemindersEnabled}
                    disabled={updatingWaterReminders}
                    onValueChange={(value) => void updateWaterReminders(value)}
                  />
                ) : experienceStage === "postpartum" ? (
                  <>
                    <PreferenceRow
                      label="Akıllı uyku tahminleri · Premium"
                      description="Yeterli kayıt oluştuğunda yaklaşan uyku penceresinden haber ver."
                      value={Boolean(isPremium && profile?.notify_sleep_predictions)}
                      disabled={!profile || isLoading || updatePreferenceMutation.isPending}
                      onValueChange={(value) =>
                        updatePremiumNotificationPreference(
                          { notify_sleep_predictions: value },
                          "notification_sleep_prediction"
                        )
                      }
                    />
                    <PreferenceRow
                      label="İlaç ve vitamin güvenlik uyarıları · Premium"
                      description="Başka bir bakıcı doz kaydettiğinde çift doz riskine karşı haber ver."
                      value={Boolean(isPremium && profile?.notify_medicine_safety)}
                      disabled={!profile || isLoading || updatePreferenceMutation.isPending}
                      onValueChange={(value) =>
                        updatePremiumNotificationPreference(
                          { notify_medicine_safety: value },
                          "notification_medicine_safety"
                        )
                      }
                    />
                    <PreferenceRow
                      label="Gelişim dönemi notları · Premium"
                      description="Bebeğin yaşına göre empatik ve güvenli gelişim notları al."
                      value={Boolean(isPremium && profile?.notify_development_periods)}
                      disabled={!profile || isLoading || updatePreferenceMutation.isPending}
                      onValueChange={(value) =>
                        updatePremiumNotificationPreference(
                          { notify_development_periods: value },
                          "notification_development_period"
                        )
                      }
                    />
                    <PreferenceRow
                      label="Anne sütü stok uyarıları · Premium"
                      description="Poşet veya kabın son kullanım süresi yaklaşınca haber ver."
                      value={Boolean(isPremium && profile?.notify_milk_inventory)}
                      disabled={!profile || isLoading || updatePreferenceMutation.isPending}
                      onValueChange={(value) =>
                        updatePremiumNotificationPreference(
                          { notify_milk_inventory: value },
                          "notification_milk_inventory"
                        )
                      }
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <Button
              label={
                showMoreNotificationPreferences
                  ? "Daha az bildirim tercihi göster"
                  : "Diğer bildirim tercihlerini göster"
              }
              variant="ghost"
              onPress={() =>
                setShowMoreNotificationPreferences((current) => !current)
              }
            />

            <Button
              label="Bildirim iznini yenile"
              variant="secondary"
              onPress={refreshNotificationPermission}
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
            {!isLoading && !isPremium ? (
              <Link
                href={{ pathname: "/paywall", params: { source: "settings" } }}
                asChild
              >
                <Button label="Premium'a geç" />
              </Link>
            ) : !isLoading ? (
              <Text style={styles.familyPremiumNote}>
                Premium erişimin aktif. Tüm Premium özellikleri kullanabilirsin.
              </Text>
            ) : null}
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

          </>
        ) : null}
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

function ProfileDetail({
  label,
  prominent = false,
  value
}: {
  label: string;
  prominent?: boolean;
  value: string;
}) {
  return (
    <View style={styles.profileDetail}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={prominent ? styles.parentName : styles.statusValue}>{value}</Text>
    </View>
  );
}

function ProfileActionRow({
  description,
  icon,
  label,
  onPress
}: {
  description: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileActionRow, pressed && styles.profileActionRowPressed]}
    >
      <View style={styles.profileActionIcon}>{icon}</View>
      <View style={styles.profileActionCopy}>
        <Text style={styles.profileActionLabel}>{label}</Text>
        <Text style={styles.profileActionDescription}>{description}</Text>
      </View>
      <ChevronRight color={colors.textMuted} size={21} />
    </Pressable>
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
  profileCard: {
    backgroundColor: colors.primarySoft
  },
  contactSection: {
    gap: spacing.md
  },
  profileActionRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 68,
    paddingTop: spacing.md
  },
  profileActionRowPressed: {
    opacity: 0.72
  },
  profileActionIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  profileActionCopy: {
    flex: 1,
    gap: 2
  },
  profileActionLabel: {
    ...typography.label,
    color: colors.text
  },
  profileActionDescription: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
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
    gap: spacing.lg
  },
  identityDetails: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  identityDetailsCompact: {
    gap: 0
  },
  identityRule: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth
  },
  familyPremiumNote: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    color: colors.text,
    padding: spacing.md
  },
  moreSettingsChevronOpen: {
    transform: [{ rotate: "180deg" }]
  },
  moreSettingsCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  moreSettingsDescription: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  moreSettingsTitle: {
    ...typography.heading3,
    color: colors.text
  },
  moreSettingsToggle: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  moreSettingsTogglePressed: {
    opacity: 0.72
  },
  parentRow: {
    flexDirection: "row",
    gap: spacing.xl
  },
  parentName: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24
  },
  profileDetail: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
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
