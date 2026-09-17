import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Activity,
  HeartPulse,
  Minus,
  Plus,
  Trash2,
  Weight
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  addPregnancyCounterDelta,
  deletePregnancyWeightRecord,
  listPregnancyDailyCounters,
  listPregnancyWeightRecords,
  savePregnancyWeightRecord,
  type PregnancyDailyCounter,
  type PregnancyWeightRecord
} from "@/api/pregnancyTools";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { StaggeredList } from "@/components/motion";
import { TextField } from "@/components/TextField";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { getExperienceStage } from "@/features/life-stage/lifeStage";
import { getToolCategories } from "@/features/tools/toolCatalog";
import { ToolShortcutCard } from "@/features/tools/ToolShortcutCard";
import { formatDate, toDateOnly } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function PregnancyToolsScreen() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const accentColor = useAppTheme();
  const today = useMemo(() => toDateOnly(new Date()), []);
  const [recordDate, setRecordDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [kickDraft, setKickDraft] = useState(0);
  const [contractionDraft, setContractionDraft] = useState(0);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const profile = profileQuery.data;
  const appTheme = accentColor.theme;
  const enabled = Boolean(profile?.is_pregnant);
  const experienceStage = getExperienceStage(profile, false);
  const toolCategories = getToolCategories(experienceStage);

  const weightsQuery = useQuery({
    queryKey: ["pregnancy-weight-records"],
    queryFn: listPregnancyWeightRecords,
    enabled
  });

  const countersQuery = useQuery({
    queryKey: ["pregnancy-daily-counters"],
    queryFn: () => listPregnancyDailyCounters(30),
    enabled
  });


  const weights = weightsQuery.data ?? [];
  const counters = countersQuery.data ?? [];
  const todayCounter = counters.find((item) => item.counter_date === today);
  const latestWeight = weights[0];

  const saveWeightMutation = useMutation({
    mutationFn: async () => {
      const nextWeight = toNumber(weight);
      if (!nextWeight) {
        throw new Error("Kilo değerini kg olarak girmelisin.");
      }

      return savePregnancyWeightRecord({
        record_date: recordDate,
        weight_kg: nextWeight,
        notes: notes.trim() || null
      });
    },
    onSuccess: async () => {
      setWeight("");
      setNotes("");
      setRecordDate(today);
      showSuccess("Kilo kaydı eklendi.");
      await queryClient.invalidateQueries({ queryKey: ["pregnancy-weight-records"] });
    },
    onError: (error) => showError(error, "Kilo kaydı eklenemedi")
  });

  const deleteWeightMutation = useMutation({
    mutationFn: deletePregnancyWeightRecord,
    onSuccess: async () => {
      showSuccess("Kilo kaydı silindi.");
      await queryClient.invalidateQueries({ queryKey: ["pregnancy-weight-records"] });
    },
    onError: (error) => showError(error, "Kilo kaydı silinemedi")
  });

  const saveCounterMutation = useMutation({
    mutationFn: async () => {
      if (kickDraft + contractionDraft <= 0) {
        throw new Error("Kaydetmek için en az bir sayaç artırmalısın.");
      }

      return addPregnancyCounterDelta({
        counterDate: today,
        kickDelta: kickDraft,
        contractionDelta: contractionDraft
      });
    },
    onSuccess: async () => {
      setKickDraft(0);
      setContractionDraft(0);
      showSuccess("Bugünkü sayaçlara eklendi.");
      await queryClient.invalidateQueries({ queryKey: ["pregnancy-daily-counters"] });
    },
    onError: (error) => showError(error, "Sayaç kaydedilemedi")
  });

  function bumpCounter(type: "kick" | "contraction", delta: 1 | -1) {
    Haptics.selectionAsync().catch(() => undefined);
    if (type === "kick") {
      setKickDraft((value) => Math.max(0, value + delta));
      return;
    }
    setContractionDraft((value) => Math.max(0, value + delta));
  }

  if (profileQuery.isLoading) {
    return <Screen scroll={false}><QueryState loading description="Hamilelik araçları hazırlanıyor…" /></Screen>;
  }

  const toolQueries = [weightsQuery, countersQuery];
  const toolQueriesLoading = enabled && toolQueries.some((query) => query.isLoading);
  const toolQueriesError = enabled && toolQueries.some((query) => query.isError);

  if (profileQuery.isError || toolQueriesError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Hamilelik kayıtların şu anda alınamadı."
          onRetry={() => void Promise.all([profileQuery.refetch(), weightsQuery.refetch(), countersQuery.refetch()])}
          retrying={toolQueries.some((query) => query.isFetching) || profileQuery.isFetching}
          title="Hamilelik araçları yüklenemedi"
        />
      </Screen>
    );
  }

  if (toolQueriesLoading) {
    return <Screen scroll={false}><QueryState loading description="Hamilelik kayıtların yükleniyor…" /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Reveal>
          <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
            <View style={[styles.heroIcon, { backgroundColor: appTheme.accentSoft }]}>
              <HeartPulse color={appTheme.primary} size={28} />
            </View>
            <Text style={typography.eyebrow}>Tüm araçlar</Text>
            <Text style={typography.heading1}>Araç merkezi</Text>
            <Text numberOfLines={3} style={styles.heroText}>
              Takip, sağlık, doğum ve aile araçları kategorilere ayrıldı. Aradığını
              tek bakışta bul, ana sayfan sade kalsın.
            </Text>
          </View>
        </Reveal>

        <StaggeredList delay={60} interval={60} style={styles.catalog}>
          {toolCategories.map((category) => (
            <View key={category.key} style={styles.catalogCategory}>
              <View style={styles.sectionTitleCopy}>
                <Text style={typography.heading2}>{category.title}</Text>
                <Text style={styles.sectionHint}>{category.hint}</Text>
              </View>
              <StaggeredList style={styles.catalogItems}>
                {category.items.map((tool, index) => (
                  <ToolShortcutCard key={tool.key} featured={index === 0} tool={tool} />
                ))}
              </StaggeredList>
            </View>
          ))}
        </StaggeredList>

        {!enabled ? (
          <EmptyState
            title="Gebelik sayaçları hamilelik profiline özel"
            description="Profilinde Hamileyim seçili olduğunda kilo, tekme ve kasılma sayaçları da burada açılır."
            actionLabel="Profili aç"
            onActionPress={() => router.push("/settings")}
          />
        ) : (
          <>
            <Card>
              <View style={{ gap: spacing.lg }}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={typography.heading2}>Kilo takibi</Text>
                    <Text style={typography.body}>
                      Her tarih için bir kayıt tutulur; aynı tarihi kaydedersen güncellenir.
                    </Text>
                  </View>
                  <Weight color={appTheme.primary} size={28} />
                </View>

                {latestWeight ? (
                  <View style={[styles.latestBox, { backgroundColor: appTheme.primarySoft }]}>
                    <Text style={styles.latestLabel}>Son kayıt</Text>
                    <Text style={styles.latestValue}>{latestWeight.weight_kg} kg</Text>
                    <Text style={typography.body}>{formatDate(latestWeight.record_date)}</Text>
                  </View>
                ) : null}

                <DatePickerField
                  label="Kayıt tarihi"
                  value={recordDate}
                  onChange={setRecordDate}
                />
                <TextField
                  keyboardType="decimal-pad"
                  label="Kilo (kg)"
                  placeholder="Örn. 68.5"
                  value={weight}
                  onChangeText={setWeight}
                />
                <TextField
                  label="Not"
                  multiline
                  placeholder="Örn. Sabah aç karnına ölçüldü"
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  label={saveWeightMutation.isPending ? "Kaydediliyor..." : "Kilo kaydını kaydet"}
                  disabled={saveWeightMutation.isPending}
                  onPress={() => saveWeightMutation.mutate()}
                />
              </View>
            </Card>

            <Card>
              <View style={{ gap: spacing.lg }}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={typography.heading2}>Tekme ve kasılma sayacı</Text>
                    <Text style={typography.body}>
                      Zikirmatik gibi artır, kaydet dediğinde bugünkü toplamın üzerine eklenir.
                    </Text>
                  </View>
                  <Activity color={appTheme.primary} size={28} />
                </View>

                <View style={styles.todayTotals}>
                  <CounterTotal label="Bugün tekme" value={todayCounter?.kick_count ?? 0} />
                  <CounterTotal
                    label="Bugün kasılma"
                    value={todayCounter?.contraction_count ?? 0}
                  />
                </View>

                <View style={styles.counterGrid}>
                  <CounterPad
                    color={appTheme.primary}
                    label="Tekme"
                    value={kickDraft}
                    onMinus={() => bumpCounter("kick", -1)}
                    onPlus={() => bumpCounter("kick", 1)}
                  />
                  <CounterPad
                    color={appTheme.accent}
                    label="Kasılma"
                    value={contractionDraft}
                    onMinus={() => bumpCounter("contraction", -1)}
                    onPlus={() => bumpCounter("contraction", 1)}
                  />
                </View>

                <View style={styles.formActions}>
                  <Button
                    label="Sıfırla"
                    variant="ghost"
                    style={styles.formButton}
                    onPress={() => {
                      setKickDraft(0);
                      setContractionDraft(0);
                    }}
                  />
                  <Button
                    label={saveCounterMutation.isPending ? "Kaydediliyor..." : "Bugüne ekle"}
                    disabled={saveCounterMutation.isPending}
                    style={styles.formButton}
                    onPress={() => saveCounterMutation.mutate()}
                  />
                </View>
              </View>
            </Card>

            <HistorySection
              counters={counters}
              weights={weights}
              onDeleteWeight={(id) => deleteWeightMutation.mutate(id)}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function CounterPad({
  color,
  label,
  onMinus,
  onPlus,
  value
}: {
  color: string;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  value: number;
}) {
  return (
    <View style={styles.counterPad}>
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={[styles.counterValue, { color }]}>{value}</Text>
      <View style={styles.counterActions}>
        <Pressable accessibilityLabel={`${label} değerini azalt`} accessibilityRole="button" onPress={onMinus} style={styles.roundButton}>
          <Minus color={colors.text} size={22} />
        </Pressable>
        <Pressable
          accessibilityLabel={`${label} değerini artır`}
          accessibilityRole="button"
          onPress={onPlus}
          style={[styles.roundButton, { backgroundColor: color }]}
        >
          <Plus color={colors.onPrimary} size={26} />
        </Pressable>
      </View>
    </View>
  );
}

function CounterTotal({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.counterTotal}>
      <Text style={styles.latestLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

function HistorySection({
  counters,
  onDeleteWeight,
  weights
}: {
  counters: PregnancyDailyCounter[];
  onDeleteWeight: (id: string) => void;
  weights: PregnancyWeightRecord[];
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={typography.heading2}>Geçmiş kayıtlar</Text>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text style={typography.heading3}>Kilo geçmişi</Text>
          {weights.length === 0 ? (
            <Text style={typography.body}>Henüz kilo kaydı yok.</Text>
          ) : (
            weights.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.historyTitle}>{item.weight_kg} kg</Text>
                  <Text style={typography.body}>{formatDate(item.record_date)}</Text>
                  {item.notes ? <Text style={styles.historyNote}>{item.notes}</Text> : null}
                </View>
                <Pressable
                  accessibilityLabel="Kilo kaydını sil"
                  accessibilityRole="button"
                  onPress={() => onDeleteWeight(item.id)}
                  style={styles.iconButton}
                >
                  <Trash2 color={colors.danger} size={20} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text style={typography.heading3}>Sayaç geçmişi</Text>
          {counters.length === 0 ? (
            <Text style={typography.body}>Henüz tekme veya kasılma kaydı yok.</Text>
          ) : (
            counters.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.historyTitle}>{formatDate(item.counter_date)}</Text>
                  <Text style={typography.body}>
                    {item.kick_count} tekme / {item.contraction_count} kasılma
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </Card>
    </View>
  );
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const styles = StyleSheet.create({
  catalog: {
    gap: spacing.xl
  },
  catalogCategory: {
    gap: spacing.md
  },
  catalogItems: {
    gap: spacing.sm
  },
  container: {
    gap: spacing.lg
  },
  hero: {
    ...radii.cardLarge,
    gap: spacing.sm,
    padding: spacing.lg
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  sectionTitleCopy: {
    flex: 1,
    gap: spacing.xs
  },
  sectionHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  latestBox: {
    ...radii.card,
    gap: spacing.xs,
    padding: spacing.md
  },
  latestLabel: {
    ...typography.label,
    color: colors.textMuted
  },
  latestValue: {
    ...typography.dataStrong,
    color: colors.text
  },
  todayTotals: {
    flexDirection: "row",
    gap: spacing.sm
  },
  counterTotal: {
    ...radii.card,
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  totalValue: {
    ...typography.dataStrong,
    color: colors.text
  },
  counterGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  counterPad: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  counterLabel: {
    ...typography.label,
    color: colors.text
  },
  counterValue: {
    ...typography.dataStrong,
    fontSize: 44,
    lineHeight: 50
  },
  counterActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  roundButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  formButton: {
    flex: 1
  },
  historyRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  historyTitle: {
    ...typography.label,
    color: colors.text
  },
  historyNote: {
    ...typography.body,
    color: colors.text
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  }
});
