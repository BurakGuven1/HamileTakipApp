import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Plus,
  Sparkles
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { listBabies } from "@/api/babies";
import { listBabyTeeth, setBabyToothErupted } from "@/api/teething";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import {
  getNextExpectedTooth,
  primaryTeethQuadrants,
  type PrimaryTooth
} from "@/features/teething/primaryTeeth";
import { getBabyAgeLabel } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function TeethingScreen() {
  const queryClient = useQueryClient();
  const accentColor = useAppTheme();
  const { showError, showSuccess } = useFeedback();
  const appTheme = accentColor.theme;
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const babies = babiesQuery.data ?? [];
  const selectedBaby = babies.find((baby) => baby.id === selectedBabyId) ?? babies[0];

  useEffect(() => {
    if (!selectedBabyId && babies[0]) setSelectedBabyId(babies[0].id);
  }, [babies, selectedBabyId]);

  const teethQuery = useQuery({
    queryKey: ["baby-teeth", selectedBaby?.id],
    queryFn: () => listBabyTeeth(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });
  const eruptedCodes = useMemo(
    () => new Set((teethQuery.data ?? []).map((record) => record.tooth_code)),
    [teethQuery.data]
  );
  const nextExpected = getNextExpectedTooth(eruptedCodes);
  const progress = eruptedCodes.size / 20;

  const toothMutation = useMutation({
    mutationFn: ({ tooth, erupted }: { tooth: PrimaryTooth; erupted: boolean }) => {
      if (!selectedBaby) throw new Error("Önce bebek profili eklemelisin.");
      return setBabyToothErupted({
        babyId: selectedBaby.id,
        toothCode: tooth.code,
        erupted
      });
    },
    onSuccess: async (_, variables) => {
      Haptics.selectionAsync().catch(() => undefined);
      showSuccess(variables.erupted ? `${variables.tooth.name} kaydedildi.` : "Diş işareti geri alındı.");
      await queryClient.invalidateQueries({ queryKey: ["baby-teeth", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Diş kaydı güncellenemedi")
  });

  if (babiesQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Diş takibi hazırlanıyor…" />
      </Screen>
    );
  }

  if (babiesQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Bebek bilgileri alınamadı. Bağlantını kontrol edip yeniden dene."
          onRetry={() => void babiesQuery.refetch()}
          retrying={babiesQuery.isFetching}
          title="Diş takibi açılamadı"
        />
      </Screen>
    );
  }

  if (!selectedBaby) {
    return (
      <Screen>
        <View style={styles.container}>
          <Header />
          <EmptyState
            actionLabel="Bebek profili ekle"
            description="Dişleri bebeğinin profiline bağlı ve aileyle ortak takip edebilirsin."
            onActionPress={() => router.push("/baby")}
            title="Önce bebek profili gerekli"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Header />

        {babies.length > 1 ? (
          <View style={styles.babySelector}>
            {babies.map((baby) => {
              const active = selectedBaby.id === baby.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={baby.id}
                  onPress={() => setSelectedBabyId(baby.id)}
                  style={[
                    styles.babyChip,
                    active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }
                  ]}
                >
                  <Text style={[styles.babyChipText, active && styles.babyChipTextActive]}>{baby.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {teethQuery.isLoading ? (
          <QueryState loading description={`${selectedBaby.name} için diş kayıtları hazırlanıyor…`} />
        ) : teethQuery.isError ? (
          <QueryState
            description="Diş kayıtları alınamadı. Bağlantını kontrol edip yeniden dene."
            onRetry={() => void teethQuery.refetch()}
            retrying={teethQuery.isFetching}
            title="Diş kayıtları yüklenemedi"
          />
        ) : (
          <>
            <View style={[styles.progressCard, { backgroundColor: appTheme.accentSoft }]}>
              <View style={styles.progressHeader}>
                <View style={[styles.progressIcon, { backgroundColor: colors.surfaceStrong }]}>
                  <ToothGlyph color={appTheme.accent} selected={false} />
                </View>
                <View style={styles.progressCopy}>
                  <Text style={styles.progressTitle}>{eruptedCodes.size} / 20 diş çıktı</Text>
                  <Text style={styles.progressBody}>{selectedBaby.name} · {getBabyAgeLabel(selectedBaby.birth_date)}</Text>
                </View>
              </View>
              <View accessibilityLabel={`Diş ilerlemesi yüzde ${Math.round(progress * 100)}`} style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: appTheme.accent,
                      width: `${Math.round(progress * 100)}%` as DimensionValue
                    }
                  ]}
                />
              </View>
              <View style={styles.nextExpected}>
                <Sparkles color={appTheme.accent} size={19} />
                <View style={styles.nextExpectedCopy}>
                  <Text style={styles.nextExpectedLabel}>
                    {nextExpected ? "Sıradaki yaklaşık aralık" : "Süt dişi kaydı tamamlandı"}
                  </Text>
                  <Text style={styles.nextExpectedValue}>
                    {nextExpected
                      ? `${nextExpected.name} · ${nextExpected.minMonth}–${nextExpected.maxMonth} ay`
                      : `${selectedBaby.name} için 20 süt dişinin tamamı işaretli.`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.toothBoard}>
              <View style={styles.boardHeading}>
                <Text style={typography.heading2}>Diş haritası</Text>
                <Text style={styles.boardHint}>Çıkan dişe dokun</Text>
              </View>
              {primaryTeethQuadrants.map((quadrant) => (
                <View key={quadrant.id} style={styles.quadrant}>
                  <Text style={styles.quadrantLabel}>{quadrant.label}</Text>
                  <View style={styles.toothRow}>
                    {quadrant.teeth.map((tooth) => {
                      const selected = eruptedCodes.has(tooth.code);
                      const changing =
                        toothMutation.isPending && toothMutation.variables?.tooth.code === tooth.code;
                      return (
                        <Pressable
                          accessibilityHint={selected ? "İşareti geri alır" : "Dişi çıktı olarak kaydeder"}
                          accessibilityLabel={`${tooth.name}, beklenen ${tooth.minMonth} ile ${tooth.maxMonth} ay`}
                          accessibilityRole="button"
                          accessibilityState={{ busy: changing, selected }}
                          disabled={toothMutation.isPending}
                          key={tooth.code}
                          onPress={() => toothMutation.mutate({ tooth, erupted: !selected })}
                          style={({ pressed }) => [
                            styles.toothButton,
                            {
                              backgroundColor: selected ? appTheme.accent : appTheme.accentSoft,
                              borderColor: selected ? appTheme.accent : colors.border
                            },
                            pressed && styles.pressed
                          ]}
                        >
                          <View style={styles.toothGlyphWrap}>
                            <ToothGlyph color={selected ? colors.surfaceStrong : appTheme.accent} selected={selected} />
                            {selected ? (
                              <Check color={appTheme.accent} size={13} strokeWidth={3} style={styles.toothStateIcon} />
                            ) : (
                              <Plus color={colors.surfaceStrong} size={13} strokeWidth={3} style={styles.toothStateIcon} />
                            )}
                          </View>
                          <Text numberOfLines={2} style={[styles.toothLabel, selected && styles.toothLabelSelected]}>
                            {tooth.shortName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.infoStrip}>
              <CircleHelp color={colors.textMuted} size={21} />
              <Text style={styles.infoText}>
                Çıkma ayları ADA süt dişi gelişim tablosundaki yaklaşık aralıklardır; her bebek farklı
                ilerler. Ağrı, şişlik veya gelişimle ilgili endişende çocuk diş hekimine danış.
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityLabel="Geri dön"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ArrowLeft color={colors.text} size={24} />
      </Pressable>
      <Text style={styles.screenTitle}>Diş takibi</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function ToothGlyph({ color, selected }: { color: string; selected: boolean }) {
  return (
    <Svg accessibilityElementsHidden height={36} viewBox="0 0 34 40" width={32}>
      <Path
        d="M8.2 3.4C4.3 5.2 3.4 10.2 4.5 15.1c.8 3.6 2.5 5.3 3.6 8.7 1 3.2 1.4 11.5 4.4 11.5 2.1 0 2.3-5.7 4.5-5.7s2.4 5.7 4.5 5.7c3 0 3.4-8.3 4.4-11.5 1.1-3.4 2.8-5.1 3.6-8.7 1.1-4.9.2-9.9-3.7-11.7-3.3-1.5-5.7.8-8.8.8s-5.5-2.3-8.8-.8Z"
        fill={color}
        stroke={selected ? color : colors.surfaceStrong}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.pill, height: 48, justifyContent: "center", width: 48 },
  headerSpacer: { height: 48, width: 48 },
  screenTitle: { ...typography.heading2, color: colors.text },
  babySelector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  babyChip: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  babyChipText: { ...typography.label, color: colors.text },
  babyChipTextActive: { color: colors.onPrimary },
  progressCard: { ...radii.cardLarge, gap: spacing.lg, padding: spacing.lg },
  progressHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  progressIcon: { alignItems: "center", borderRadius: radii.pill, height: 64, justifyContent: "center", width: 64 },
  progressCopy: { flex: 1, gap: spacing.xs },
  progressTitle: { ...typography.heading2, color: colors.text, fontSize: 24, lineHeight: 30 },
  progressBody: { ...typography.body, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  progressTrack: { backgroundColor: colors.surfaceStrong, borderRadius: radii.pill, height: 10, overflow: "hidden" },
  progressFill: { borderRadius: radii.pill, height: "100%" },
  nextExpected: { ...radii.card, alignItems: "flex-start", backgroundColor: colors.surfaceStrong, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  nextExpectedCopy: { flex: 1, gap: 2 },
  nextExpectedLabel: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  nextExpectedValue: { ...typography.label, color: colors.text, lineHeight: 21 },
  toothBoard: { ...radii.cardLarge, backgroundColor: colors.surface, gap: spacing.lg, padding: spacing.lg },
  boardHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  boardHint: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  quadrant: { gap: spacing.sm },
  quadrantLabel: { ...typography.eyebrow, color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  toothRow: { flexDirection: "row", gap: spacing.sm },
  toothButton: { alignItems: "center", borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: 2, justifyContent: "center", minHeight: 84, minWidth: 48, paddingHorizontal: 2, paddingVertical: spacing.xs },
  toothGlyphWrap: { alignItems: "center", height: 38, justifyContent: "center", position: "relative", width: 34 },
  toothStateIcon: { position: "absolute" },
  toothLabel: { ...typography.label, color: colors.text, fontSize: 11, lineHeight: 14, textAlign: "center", width: "100%" },
  toothLabelSelected: { color: colors.onPrimary },
  infoStrip: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xs },
  infoText: { ...typography.body, color: colors.textMuted, flex: 1, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 }
});
