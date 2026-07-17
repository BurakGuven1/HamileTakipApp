import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  ArrowLeft,
  BellRing,
  Droplets,
  ExternalLink,
  Info,
  Pill,
  ShieldAlert
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import {
  getGuidanceForMonth,
  getPregnancyMonth,
  getPregnancyMonthRange,
  getSourcesByIds,
  pregnancyGuidanceSources,
  pregnancyMonths,
  type PregnancySupplementGuidance
} from "@/features/pregnancy/nutritionGuidance";
import {
  getWaterRemindersEnabled,
  setWaterRemindersEnabled,
  WATER_REMINDER_TIME_LABEL
} from "@/features/pregnancy/waterReminders";
import { getPregnancyWeek } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

export default function PregnancyNutritionScreen() {
  const appTheme = useAppTheme();
  const { showError, showSuccess } = useFeedback();
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const currentWeek = getPregnancyWeek(profileQuery.data?.due_date) ?? 1;
  const currentMonth = getPregnancyMonth(currentWeek);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [waterRemindersEnabled, setWaterRemindersEnabledState] = useState(false);
  const [updatingReminders, setUpdatingReminders] = useState(false);

  useEffect(() => {
    setSelectedMonth(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    getWaterRemindersEnabled()
      .then(setWaterRemindersEnabledState)
      .catch(() => setWaterRemindersEnabledState(false));
  }, []);

  async function toggleWaterReminders() {
    setUpdatingReminders(true);
    try {
      const enabled = await setWaterRemindersEnabled(!waterRemindersEnabled);
      setWaterRemindersEnabledState(enabled);
      showSuccess(
        enabled
          ? `${WATER_REMINDER_TIME_LABEL} saatlerinde günlük hatırlatmalar planlandı.`
          : "Planlanmış su hatırlatmaları kaldırıldı.",
        enabled ? "Su hatırlatmaları açık" : "Su hatırlatmaları kapalı"
      );
    } catch (error) {
      showError(error, "Su hatırlatmaları güncellenemedi");
    } finally {
      setUpdatingReminders(false);
    }
  }

  async function openSource(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("Kaynak bağlantısı açılamıyor.");
      await Linking.openURL(url);
    } catch (error) {
      showError(error, "Kaynak açılamadı");
    }
  }

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <Text style={typography.body}>Gebelik bilgileri yükleniyor…</Text>
        </View>
      </Screen>
    );
  }

  if (profileQuery.data && !profileQuery.data.is_pregnant) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <EmptyState
            title="Takviye rehberi hamilelik profiline özel"
            description="Su hatırlatmalarını Profil > Bildirim tercihleri alanından ücretsiz kullanabilirsin. Gebelik rehberi için profilinde Hamileyim seçeneğini açmalısın."
          />
        </View>
      </Screen>
    );
  }

  const range = getPregnancyMonthRange(selectedMonth);
  const guidance = getGuidanceForMonth(selectedMonth);

  return (
    <Screen>
      <View style={styles.container}>
        <BackButton />

        <View style={[styles.hero, { backgroundColor: appTheme.theme.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: appTheme.tint }]}>
            <Droplets color={appTheme.primary} size={30} />
          </View>
          <Text style={typography.eyebrow}>Ücretsiz gebelik desteği</Text>
          <Text style={typography.heading1}>Su ve takviye rehberi</Text>
          <Text style={styles.heroText}>
            Şu an hesaplanan dönem: {currentMonth}. ay, {currentWeek}. hafta.
            Bilgiler genel halk sağlığı rehberidir; reçete veya kişisel tedavi planı
            değildir.
          </Text>
        </View>

        <Card style={[styles.waterCard, { backgroundColor: appTheme.theme.primarySoft }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={typography.eyebrow}>Günlük su</Text>
              <Text style={typography.heading2}>Genel hedef: yaklaşık 2–2,5 litre</Text>
            </View>
            <Droplets color={appTheme.primary} size={30} />
          </View>
          <Text style={styles.bodyText}>
            Suyu gün içine yay. Sıcak hava, egzersiz, ateş, kusma veya ishalde ihtiyaç
            artabilir. WHO Avrupa sıcak havalarda gebeler için günde 2–3 litre suyu,
            sıcakta biraz daha fazlasını hatırlatır.
          </Text>
          <View style={styles.reminderBox}>
            <BellRing color={appTheme.primary} size={24} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.label}>Nazik su molaları</Text>
              <Text style={styles.smallText}>{WATER_REMINDER_TIME_LABEL}</Text>
            </View>
          </View>
          <Button
            disabled={updatingReminders}
            label={
              updatingReminders
                ? "Güncelleniyor…"
                : waterRemindersEnabled
                  ? "Su hatırlatmalarını kapat"
                  : "Su hatırlatmalarını aç"
            }
            onPress={toggleWaterReminders}
            variant={waterRemindersEnabled ? "secondary" : "primary"}
          />
          <Text style={styles.safetyFinePrint}>
            Kalp/böbrek hastalığı, ciddi ödem, preeklampsi takibi veya sıvı kısıtlaması
            varsa genel hedef yerine doktorunun verdiği miktarı uygula.
          </Text>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Gebelik ayını seç</Text>
                <Text style={typography.body}>
                  {selectedMonth}. ay yaklaşık {range.startWeek}–{range.endWeek}. haftaları
                  kapsar.
                </Text>
              </View>
              <Pill color={appTheme.primary} size={28} />
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={styles.monthRail}
              showsHorizontalScrollIndicator={false}
            >
              {pregnancyMonths.map((item) => {
                const selected = item.month === selectedMonth;
                return (
                  <Pressable
                    key={item.month}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMonth(item.month)}
                    style={[
                      styles.monthChip,
                      selected && {
                        backgroundColor: appTheme.primary,
                        borderColor: appTheme.primary
                      }
                    ]}
                  >
                    <Text style={[styles.monthChipText, selected && styles.monthChipTextSelected]}>
                      {item.month}. ay
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Card>

        {guidance.length > 0 ? (
          guidance.map((item) => (
            <GuidanceCard key={item.id} item={item} onOpenSource={openSource} />
          ))
        ) : (
          <Card>
            <Text style={typography.body}>
              Bu ay başlayan yeni bir rutin takviye bulunmuyor. Daha önce doktorunla
              planlanan desteği aynı şekilde sürdür.
            </Text>
          </Card>
        )}

        <Card style={styles.cautionCard}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.cautionEyebrow}>KENDİ KENDİNE BAŞLAMA</Text>
              <Text style={typography.heading2}>Her vitamin herkese gerekli değildir</Text>
            </View>
            <ShieldAlert color={colors.danger} size={30} />
          </View>
          <Text style={styles.bodyText}>
            Kalsiyum desteği WHO’ya göre özellikle besinle kalsiyum alımının düşük
            olduğu topluluklarda ve klinik değerlendirmeyle düşünülür. İyot ve B12;
            beslenme, tiroit durumu, vegan beslenme, emilim sorunu ve kan sonuçlarına
            göre değerlendirilir.
          </Text>
          <Text style={styles.bodyText}>
            Rutin yüksek doz A vitamini kullanma; prenatal ürünleri üst üste alma.
            WHO, rutin A vitamini desteğini yalnızca ciddi toplum düzeyi eksiklikte
            önerir; C+E, B6 ve çoklu mikrobesin ürünleri de herkese otomatik öneri
            değildir.
          </Text>
          <Text style={styles.safetyFinePrint}>
            Demir ve kalsiyum takviyeleri birbirinin emilimini etkileyebilir. İkisi de
            reçetelendiyse kullanım saatini doktor veya eczacıyla netleştir.
          </Text>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>Resmî kaynaklar</Text>
                <Text style={typography.body}>
                  İçerik özetlenmiştir; bağlantılar belgenin aslına gider.
                </Text>
              </View>
              <Info color={appTheme.primary} size={26} />
            </View>
            {pregnancyGuidanceSources.map((source) => (
              <Pressable
                key={source.id}
                accessibilityRole="link"
                onPress={() => void openSource(source.url)}
                style={styles.sourceRow}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.sourcePublisher}>{source.publisher}</Text>
                  <Text style={styles.sourceTitle}>{source.title}</Text>
                </View>
                <ExternalLink color={appTheme.primary} size={18} />
              </Pressable>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function GuidanceCard({
  item,
  onOpenSource
}: {
  item: PregnancySupplementGuidance;
  onOpenSource: (url: string) => Promise<void>;
}) {
  const appTheme = useAppTheme();
  const sources = getSourcesByIds(item.sourceIds);

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={typography.eyebrow}>{item.timing}</Text>
            <Text style={typography.heading2}>{item.title}</Text>
          </View>
          <View style={[styles.pillIcon, { backgroundColor: appTheme.tint }]}>
            <Pill color={appTheme.primary} size={24} />
          </View>
        </View>
        <View style={[styles.amountBox, { backgroundColor: appTheme.theme.primarySoft }]}>
          <Text style={styles.amountLabel}>GENEL PROGRAM BİLGİSİ</Text>
          <Text style={styles.amountText}>{item.amount}</Text>
        </View>
        <Text style={styles.bodyText}>{item.body}</Text>
        <View style={styles.warningBox}>
          <ShieldAlert color={colors.danger} size={20} />
          <Text style={styles.warningText}>{item.warning}</Text>
        </View>
        <View style={styles.inlineSources}>
          {sources.map((source) => (
            <Pressable
              key={source.id}
              accessibilityRole="link"
              onPress={() => void onOpenSource(source.url)}
            >
              <Text style={[styles.inlineSourceText, { color: appTheme.primary }]}>
                {source.publisher} ↗
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityLabel="Geri"
      accessibilityRole="button"
      onPress={() => router.back()}
      style={styles.backButton}
    >
      <ArrowLeft color={colors.text} size={22} />
      <Text style={styles.backText}>Hamilelik araçları</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 40
  },
  backText: { ...typography.label, color: colors.text },
  hero: { ...radii.cardLarge, gap: spacing.sm, padding: spacing.lg },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  heroText: { ...typography.body, color: colors.text },
  waterCard: { gap: spacing.md },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  bodyText: { ...typography.body, color: colors.text },
  reminderBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  smallText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  safetyFinePrint: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 20
  },
  monthRail: { gap: spacing.sm, paddingRight: spacing.md },
  monthChip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  monthChipText: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textAlign: "center"
  },
  monthChipTextSelected: { color: colors.background },
  pillIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  amountBox: { borderRadius: radii.md, gap: spacing.xs, padding: spacing.md },
  amountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4
  },
  amountText: { ...typography.bodyStrong, color: colors.text },
  warningBox: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  warningText: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 20
  },
  inlineSources: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  inlineSourceText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textDecorationLine: "underline"
  },
  cautionCard: { backgroundColor: colors.accentSoft, gap: spacing.md },
  cautionEyebrow: {
    color: colors.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5
  },
  sourceRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 54,
    paddingVertical: spacing.sm
  },
  sourcePublisher: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  sourceTitle: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20
  }
});
