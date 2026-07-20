import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  Droplets,
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
import { listBirthPreparationItems } from "@/api/birthPreparation";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { QueryState } from "@/components/QueryState";
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

  const preparationItemsQuery = useQuery({
    queryKey: ["birth-preparation-items"],
    queryFn: listBirthPreparationItems,
    enabled
  });

  const weights = weightsQuery.data ?? [];
  const counters = countersQuery.data ?? [];
  const todayCounter = counters.find((item) => item.counter_date === today);
  const latestWeight = weights[0];
  const preparationItems = preparationItemsQuery.data ?? [];
  const preparationCompleted = preparationItems.filter(
    (item) => item.is_completed
  ).length;
  const preparationProgress = preparationItems.length
    ? preparationCompleted / preparationItems.length
    : 0;

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

  const toolQueries = [weightsQuery, countersQuery, preparationItemsQuery];
  const toolQueriesLoading = enabled && toolQueries.some((query) => query.isLoading);
  const toolQueriesError = enabled && toolQueries.some((query) => query.isError);

  if (profileQuery.isError || toolQueriesError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Hamilelik kayıtların şu anda alınamadı."
          onRetry={() => void Promise.all([profileQuery.refetch(), weightsQuery.refetch(), countersQuery.refetch(), preparationItemsQuery.refetch()])}
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
        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: appTheme.accentSoft }]}>
            <HeartPulse color={appTheme.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>Hamilelik araçları</Text>
          <Text style={typography.heading1}>Günlük takip merkezi</Text>
          <Text style={styles.heroText}>
            Kilo değişimi, tekme sayısı, kasılma sayısı ve güvenli egzersiz akışı
            hamilelik profilinde birlikte tutulur.
          </Text>
        </View>

        {!enabled ? (
          <EmptyState
            title="Bu alan hamilelik profiline özel"
            description="Profilinde Hamileyim seçili olduğunda kilo, tekme, kasılma ve egzersiz araçları burada görünür."
          />
        ) : (
          <>
            <Card style={[styles.preparationCard, { backgroundColor: appTheme.primarySoft }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.eyebrow}>Anne + baba ortak</Text>
                  <Text style={typography.heading2}>Doğuma hazırlık</Text>
                  <Text style={typography.body}>
                    Doğum çantası ve doğum planını tek, sade listede birlikte tamamlayın.
                  </Text>
                </View>
                <View style={[styles.preparationIcon, { backgroundColor: appTheme.accentSoft }]}>
                  <ClipboardCheck color={appTheme.primary} size={28} />
                </View>
              </View>
              <View style={styles.preparationSummary}>
                <Text style={styles.preparationSummaryText}>
                  {preparationItems.length
                    ? `${preparationCompleted}/${preparationItems.length} hazır`
                    : "Liste ilk açılışta hazır olacak"}
                </Text>
                <Text style={[styles.preparationPercent, { color: appTheme.primary }]}>
                  %{Math.round(preparationProgress * 100)}
                </Text>
              </View>
              <View style={styles.preparationTrack}>
                <View
                  style={[
                    styles.preparationFill,
                    {
                      backgroundColor: appTheme.primary,
                      width: `${preparationProgress * 100}%`
                    }
                  ]}
                />
              </View>
              <Link href="/birth-preparation" asChild>
                <Button label="Ortak listeyi aç" />
              </Link>
            </Card>

            <Card style={[styles.exerciseCard, { backgroundColor: appTheme.accentSoft }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.heading2}>Hamile egzersizi</Text>
                  <Text style={typography.body}>
                    7 hareket, otomatik mola, nefes ritmi ve duraklatılabilir sayaç.
                  </Text>
                </View>
                <Dumbbell color={appTheme.primary} size={30} />
              </View>
              <Link href="/pregnancy-exercise" asChild>
                <Button breathing label="Egzersizi başlat" />
              </Link>
            </Card>

            <Card>
              <View style={{ gap: spacing.md }}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={typography.eyebrow}>Ücretsiz</Text>
                    <Text style={typography.heading2}>Su ve takviye rehberi</Text>
                    <Text style={typography.body}>
                      Günlük su hatırlatmalarını aç; gebelik ayına göre Sağlık
                      Bakanlığı ve WHO kaynaklı genel takviye zamanlarını incele.
                    </Text>
                  </View>
                  <Droplets color={appTheme.primary} size={30} />
                </View>
                <Link href="/pregnancy-nutrition" asChild>
                  <Button label="Su ve takviye rehberini aç" variant="secondary" />
                </Link>
              </View>
            </Card>

            <Card>
              <View style={{ gap: spacing.md }}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={typography.heading2}>Hamilelik çizelgesi</Text>
                    <Text style={typography.body}>
                      Haftalık gelişim, folik asit dönemi, hareket farkındalığı ve
                      kontrol pencereleri tek timeline üzerinde.
                    </Text>
                  </View>
                  <CalendarDays color={appTheme.primary} size={30} />
                </View>
                <Link href="/pregnancy-timeline" asChild>
                  <Button label="Çizelgeyi aç" variant="secondary" />
                </Link>
              </View>
            </Card>

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
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  exerciseCard: {
    gap: spacing.md
  },
  preparationCard: {
    gap: spacing.md
  },
  preparationIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  preparationSummary: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  preparationSummaryText: {
    ...typography.label,
    color: colors.text
  },
  preparationPercent: {
    ...typography.label
  },
  preparationTrack: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 7,
    overflow: "hidden"
  },
  preparationFill: {
    borderRadius: radii.pill,
    height: "100%"
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
