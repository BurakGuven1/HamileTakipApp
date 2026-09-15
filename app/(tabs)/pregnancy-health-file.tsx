import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, BellRing, CalendarDays, FileHeart, FileText, Minus, NotebookPen, ShieldCheck, Thermometer, Trash2, TrendingDown, TrendingUp } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  cancelPregnancyHealthReminder,
  createPregnancyHealthEntry,
  deletePregnancyHealthEntry,
  listPregnancyHealthTimeline,
  setPregnancyHealthReminder,
  subscribeToPregnancyHealthFile,
  type PregnancyHealthTimelineItem
} from "@/api/pregnancyHealthFile";
import { getFamilyFeatureAccess } from "@/api/familyCoordination";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import {
  PressableScale,
  SkeletonShimmer,
  StaggeredList
} from "@/components/motion";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { TextField } from "@/components/TextField";
import { resolveInterpretationContext } from "@/features/document-insight/pregnancyContext";
import {
  buildProteinuriaFlag,
  combineHypertensionAndProteinuria
} from "@/features/document-insight/redFlags";
import type { DocumentRedFlag, DocumentRedFlagSeverity } from "@/features/document-insight/types";
import { sharePregnancyHealthFilePdf } from "@/features/pregnancy-health/report";
import {
  buildVitalSignTrend,
  evaluateVitalSigns,
  formatTemperature,
  formatVitalSignDate,
  validateVitalSignDraft,
  type VitalSignReading
} from "@/features/pregnancy-health/vitalSigns";
import {
  listVitalSigns,
  saveVitalSign,
  VITAL_SIGNS_QUERY_KEY
} from "@/features/pregnancy-health/vitalSignsStore";
import { getPregnancyWeek } from "@/lib/dates";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

const HEALTH_QUERY_KEY = ["pregnancy-health-file"] as const;

export default function PregnancyHealthFileScreen() {
  const appTheme = useAppTheme();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [composerOpen, setComposerOpen] = useState(false);
  const [kind, setKind] = useState<"appointment" | "note">("appointment");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date(Date.now() + 24 * 60 * 60_000));
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState(() => new Date(Date.now() + 23 * 60 * 60_000));
  const [recipientScope, setRecipientScope] = useState<"self" | "full_family">("self");
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [temperature, setTemperature] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => new Date());
  const viewedTrackedRef = useRef(false);

  const healthQuery = useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: listPregnancyHealthTimeline });
  const vitalsQuery = useQuery({ queryKey: VITAL_SIGNS_QUERY_KEY, queryFn: listVitalSigns });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getCurrentProfile });
  const featureAccessQuery = useQuery({
    queryKey: ["family-feature-access", PREMIUM_FEATURES.documentInsight.source],
    queryFn: () => getFamilyFeatureAccess(PREMIUM_FEATURES.documentInsight.source)
  });
  const isPremium = Boolean(featureAccessQuery.data?.is_premium);
  const timeline = useMemo(() => healthQuery.data?.timeline ?? [], [healthQuery.data?.timeline]);
  const vitals = useMemo(() => vitalsQuery.data ?? [], [vitalsQuery.data]);
  const profile = profileQuery.data;
  const interpretationContext = useMemo(
    () =>
      resolveInterpretationContext({
        isPregnant: profile?.is_pregnant ?? null,
        pregnancyWeek: getPregnancyWeek(profile?.due_date)
      }),
    [profile?.due_date, profile?.is_pregnant]
  );

  /**
   * A raised blood pressure and a urine protein result mean much more together
   * than apart, and this screen is the only place both of them exist: the cuff
   * reading was typed here, the urine protein came from a saved lab report. The
   * two separate cards are therefore merged into one higher-severity card when
   * both are present. It still names no condition — only what was measured and
   * who should look at it.
   */
  const vitalFlags = useMemo(() => {
    const latest = vitals.at(0);
    if (!latest) return [] as DocumentRedFlag[];
    const measurementFlags = evaluateVitalSigns(latest, interpretationContext);
    const proteinuria = findRecentProteinuriaFlag(timeline, interpretationContext);
    return combineHypertensionAndProteinuria(
      proteinuria ? [...measurementFlags, proteinuria] : measurementFlags
    );
  }, [interpretationContext, timeline, vitals]);

  const systolicTrend = useMemo(() => buildVitalSignTrend(vitals, (item) => item.systolic), [vitals]);
  const temperatureTrend = useMemo(
    () => buildVitalSignTrend(vitals, (item) => item.temperatureCelsius),
    [vitals]
  );
  const remindersByEntry = useMemo(
    () => new Map((healthQuery.data?.reminders ?? []).map((reminder) => [reminder.entry_id, reminder])),
    [healthQuery.data?.reminders]
  );

  useEffect(() => {
    if (viewedTrackedRef.current) return;
    viewedTrackedRef.current = true;
    void trackEvent("pregnancy_health_file_viewed", { source: "pregnancy_health_file" });
  }, []);

  useEffect(() => {
    const profileId = healthQuery.data?.profile.id;
    if (!profileId) return undefined;
    return subscribeToPregnancyHealthFile(profileId, () => {
      void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
    });
  }, [healthQuery.data?.profile.id, queryClient]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const entry = await createPregnancyHealthEntry({
        kind,
        notes,
        occurredAt: occurredAt.toISOString(),
        title
      });
      if (kind === "appointment" && reminderEnabled) {
        await setPregnancyHealthReminder({
          entryId: entry.id,
          recipientScope,
          scheduledFor: reminderAt.toISOString()
        });
      }
      return entry;
    },
    onSuccess: async (entry) => {
      await trackEvent("pregnancy_health_entry_created", {
        entry_kind: kind,
        reminder_created: reminderEnabled
      });
      if (reminderEnabled) {
        await trackEvent("pregnancy_health_reminder_created", {
          recipient_scope: recipientScope,
          source: "pregnancy_health_file"
        });
      }
      setComposerOpen(false);
      setTitle("");
      setNotes("");
      setReminderEnabled(false);
      showSuccess(kind === "appointment" ? "Randevu sağlık dosyana eklendi." : "Not sağlık dosyana eklendi.");
      await queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
      return entry;
    },
    onError: (error) => showError(error, "Sağlık kaydı eklenemedi")
  });

  const vitalMutation = useMutation({
    mutationFn: async () => {
      const validation = validateVitalSignDraft({ measuredAt, systolic, diastolic, temperature });
      if (!validation.ok) throw new Error(validation.message);
      return saveVitalSign(validation.reading);
    },
    onSuccess: async (reading) => {
      await trackEvent("pregnancy_vital_sign_recorded", {
        has_blood_pressure: reading.systolic !== null,
        has_temperature: reading.temperatureCelsius !== null,
        source: "pregnancy_health_file"
      });
      setSystolic("");
      setDiastolic("");
      setTemperature("");
      setVitalsOpen(false);
      showSuccess("Ölçümün sağlık dosyana eklendi.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: VITAL_SIGNS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
      ]);
    },
    onError: (error) => showError(error, "Ölçüm kaydedilemedi")
  });

  const deleteMutation = useMutation({
    mutationFn: deletePregnancyHealthEntry,
    onSuccess: async () => {
      showSuccess("Kayıt silindi.");
      await queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
    },
    onError: (error) => showError(error, "Kayıt silinemedi")
  });

  const cancelReminderMutation = useMutation({
    mutationFn: cancelPregnancyHealthReminder,
    onSuccess: async () => {
      showSuccess("Hatırlatma iptal edildi.");
      await queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
    },
    onError: (error) => showError(error, "Hatırlatma iptal edilemedi")
  });

  async function toggleReminder(value: boolean) {
    if (value && !isPremium) {
      await showPaywallIfNeeded(PREMIUM_FEATURES.pregnancyHealthFileReminder.source, {
        feature: "pregnancy_health_file_reminder",
        life_stage: "pregnancy",
        reason: "premium_feature_selected"
      }, { mode: "required" });
      return;
    }
    setReminderEnabled(value);
  }

  async function exportPdf() {
    if (!isPremium) {
      await showPaywallIfNeeded(PREMIUM_FEATURES.pregnancyHealthFilePdf.source, {
        feature: "pregnancy_health_file_pdf",
        life_stage: "pregnancy",
        reason: "premium_feature_selected"
      }, { mode: "required" });
      return;
    }
    if (!healthQuery.data) return;
    try {
      await sharePregnancyHealthFilePdf({
        dueDate: healthQuery.data.profile.due_date,
        motherName: healthQuery.data.profile.mother_name || "Anne",
        timeline
      });
      await trackEvent("pregnancy_health_pdf_shared", { item_count: timeline.length });
    } catch (error) {
      showError(error, "Sağlık dosyası PDF'i hazırlanamadı");
    }
  }

  function confirmDelete(item: PregnancyHealthTimelineItem) {
    Alert.alert("Kaydı sil", "Bu kayıt ve bağlı hatırlatma kalıcı olarak silinecek.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => deleteMutation.mutate(item.sourceId) }
    ]);
  }

  if (healthQuery.isLoading) return <Screen><QueryState loading description="Sağlık dosyan hazırlanıyor…" /></Screen>;
  if (healthQuery.isError) return <Screen><QueryState title="Sağlık dosyası açılamadı" description="Kayıtların şu anda alınamadı." onRetry={() => void healthQuery.refetch()} /></Screen>;

  return (
    <Screen>
      <View style={styles.page}>
        <PageHeader back eyebrow="Gebelik kayıtların" icon={FileHeart} title="Sağlık Dosyam" />

        <Card style={{ backgroundColor: appTheme.tint }}>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Kayıtların tek bir zaman çizelgesinde</Text>
            <Text style={typography.body}>Kilo, görüşme notları, ölçümler, aşılar, randevular ve seçerek kaydettiğin tahlil değerleri burada düzenlenir.</Text>
            <View style={styles.summaryRow}>
              <Summary label="Toplam kayıt" value={timeline.length} />
              <Summary label="Tahlil" value={timeline.filter((item) => item.kind === "lab_report").length} />
              <Summary label="Randevu" value={timeline.filter((item) => item.kind === "appointment").length} />
            </View>
            <View style={styles.actionsRow}>
              <Button label="Yeni kayıt" style={styles.flexButton} onPress={() => setComposerOpen((value) => !value)} />
              <Button label="PDF arşivi" style={styles.flexButton} variant="secondary" onPress={() => void exportPdf()} />
            </View>
          </View>
        </Card>

        {composerOpen ? (
          <Card>
            <View style={styles.stack}>
              <Text style={typography.heading2}>Yeni kayıt</Text>
              <View style={styles.actionsRow}>
                <Choice label="Randevu" active={kind === "appointment"} onPress={() => setKind("appointment")} />
                <Choice label="Not" active={kind === "note"} onPress={() => { setKind("note"); setReminderEnabled(false); }} />
              </View>
              <TextField label={kind === "appointment" ? "Randevu başlığı" : "Not başlığı"} maxLength={140} value={title} onChangeText={setTitle} />
              <TextField label="Açıklama (isteğe bağlı)" maxLength={2000} multiline value={notes} onChangeText={setNotes} />
              <Text style={typography.label}>{kind === "appointment" ? "Randevu zamanı" : "Kayıt zamanı"}</Text>
              <DateTimePicker display="compact" mode="datetime" value={occurredAt} onChange={(_, value) => value && setOccurredAt(value)} />
              {kind === "appointment" ? (
                <>
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: reminderEnabled }} onPress={() => void toggleReminder(!reminderEnabled)} style={styles.premiumRow}>
                    <BellRing color={appTheme.primary} size={21} />
                    <View style={{ flex: 1 }}><Text style={typography.label}>Hatırlatma kur · Premium</Text><Text style={styles.meta}>Telefon değişse bile sunucudan güvenilir bildirim gönderilir.</Text></View>
                    <Text style={[styles.toggleText, { color: appTheme.primary }]}>{reminderEnabled ? "Açık" : "Kapalı"}</Text>
                  </Pressable>
                  {reminderEnabled ? (
                    <>
                      <Text style={typography.label}>Hatırlatma zamanı</Text>
                      <DateTimePicker display="compact" mode="datetime" value={reminderAt} onChange={(_, value) => value && setReminderAt(value)} />
                      <View style={styles.actionsRow}>
                        <Choice label="Sadece ben" active={recipientScope === "self"} onPress={() => setRecipientScope("self")} />
                        <Choice label="Tam erişimli aile" active={recipientScope === "full_family"} onPress={() => setRecipientScope("full_family")} />
                      </View>
                    </>
                  ) : null}
                </>
              ) : null}
              <View style={styles.actionsRow}>
                <Button label="Vazgeç" style={styles.flexButton} variant="ghost" onPress={() => setComposerOpen(false)} />
                <Button disabled={createMutation.isPending || !title.trim()} label={createMutation.isPending ? "Kaydediliyor…" : "Kaydet"} style={styles.flexButton} onPress={() => createMutation.mutate()} />
              </View>
            </View>
          </Card>
        ) : null}

        {vitalFlags.length ? (
          <Card style={styles.warningCard}>
            <View style={styles.stack}>
              <View style={styles.topBar}>
                <AlertTriangle color={colors.dustyRose} size={22} />
                <Text style={[typography.heading2, { flex: 1 }]}>Bunu doktorunla paylaş</Text>
              </View>
              <StaggeredList style={styles.stack}>
                {vitalFlags.map((flag) => (
                  <View key={flag.id} style={styles.stackTight}>
                    <View style={styles.sectionHeader}>
                      <Text style={typography.label}>{flag.testName}</Text>
                      <Text style={styles.severityText}>{SEVERITY_LABEL[flag.severity]}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {flag.source === "manual_measurement" ? "Kendi ölçümün" : "Tahlil raporundan"}
                    </Text>
                    <Text style={typography.body}>{flag.observation}</Text>
                    <Text style={styles.actionText}>{flag.action}</Text>
                  </View>
                ))}
              </StaggeredList>
              <Text style={styles.meta}>
                Bu uyarı bir tanı değildir ve aciliyet değerlendirmesi yapmaz. Kendini kötü hissediyorsan beklemeden sağlık kuruluşuna başvur.
              </Text>
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={styles.stack}>
            <View style={styles.topBar}>
              <Activity color={appTheme.primary} size={24} />
              <Text style={[typography.heading2, { flex: 1 }]}>Tansiyon ve ateş</Text>
            </View>
            <Text style={typography.body}>
              Evde ölçtüğün değerleri buraya yaz. Kayıtların zaman çizelgende ve PDF arşivinde yer alır; bu ekran ölçümü açıklar, tanı koymaz.
            </Text>

            {vitalsQuery.isLoading ? (
              <>
                <SkeletonShimmer height={16} width="60%" />
                <SkeletonShimmer delay={80} height={12} />
              </>
            ) : null}

            {!vitalsQuery.isLoading && vitals.length ? (
              <View style={styles.summaryRow}>
                <TrendTile
                  icon={<Activity color={appTheme.primary} size={18} />}
                  label="Son tansiyon"
                  value={vitals.find((item) => item.systolic !== null)
                    ? `${vitals.find((item) => item.systolic !== null)?.systolic}/${vitals.find((item) => item.systolic !== null)?.diastolic}`
                    : "—"}
                  direction={systolicTrend.direction}
                />
                <TrendTile
                  icon={<Thermometer color={appTheme.primary} size={18} />}
                  label="Son ateş"
                  value={temperatureTrend.latest !== null ? `${formatTemperature(temperatureTrend.latest)} °C` : "—"}
                  direction={temperatureTrend.direction}
                />
              </View>
            ) : null}

            <Button
              label={vitalsOpen ? "Vazgeç" : "Ölçüm ekle"}
              variant={vitalsOpen ? "ghost" : "primary"}
              onPress={() => setVitalsOpen((value) => !value)}
            />

            {vitalsOpen ? (
              <View style={styles.stack}>
                <View style={styles.actionsRow}>
                  <TextField containerStyle={styles.flexButton} keyboardType="number-pad" label="Büyük tansiyon" maxLength={3} value={systolic} onChangeText={setSystolic} />
                  <TextField containerStyle={styles.flexButton} keyboardType="number-pad" label="Küçük tansiyon" maxLength={3} value={diastolic} onChangeText={setDiastolic} />
                </View>
                <TextField
                  helperText="İstersen yalnızca ateş ya da yalnızca tansiyon girebilirsin."
                  keyboardType="decimal-pad"
                  label="Ateş (°C)"
                  maxLength={5}
                  value={temperature}
                  onChangeText={setTemperature}
                />
                <Text style={typography.label}>Ölçüm zamanı</Text>
                <DateTimePicker display="compact" mode="datetime" value={measuredAt} onChange={(_, value) => value && setMeasuredAt(value)} />
                <Button
                  disabled={vitalMutation.isPending}
                  label={vitalMutation.isPending ? "Kaydediliyor…" : "Ölçümü kaydet"}
                  onPress={() => vitalMutation.mutate()}
                />
              </View>
            ) : null}

            {!vitalsQuery.isLoading && !vitals.length ? (
              <Text style={styles.meta}>Henüz ölçüm yok. İlk tansiyon veya ateş ölçümünü ekleyerek başlayabilirsin.</Text>
            ) : null}

            {vitals.length ? (
              <StaggeredList style={styles.stackTight}>
                {vitals.slice(0, 8).map((reading) => (
                  <Text key={reading.measuredAt} style={styles.labValue}>
                    • {formatVitalSignDate(reading.measuredAt)} — {describeReading(reading)}
                  </Text>
                ))}
              </StaggeredList>
            ) : null}
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={typography.heading2}>Zaman çizelgesi</Text>
          <Text style={styles.meta}>Tüm geçmiş ücretsiz</Text>
        </View>
        {!timeline.length ? <EmptyState title="Henüz kayıt yok" description="İlk randevunu veya notunu eklediğinde sağlık dosyan oluşacak." /> : null}
        {timeline.map((item) => {
          const reminder = remindersByEntry.get(item.sourceId);
          return (
            <Card key={item.id}>
              <View style={styles.timelineRow}>
                <View style={[styles.timelineIcon, { backgroundColor: appTheme.tint }]}>{timelineIcon(item.kind, appTheme.primary)}</View>
                <View style={styles.timelineCopy}>
                  <Text style={styles.date}>{formatDateTime(item.occurredAt)}</Text>
                  <Text style={typography.heading3}>{item.title}</Text>
                  {item.details ? <Text style={typography.body}>{item.details}</Text> : null}
                  {item.labValues.map((value) => <Text key={value.id} style={styles.labValue}>• {value.test_name}: {value.result_text}{value.unit ? ` ${value.unit}` : ""}</Text>)}
                  {reminder ? <Text style={styles.reminderText}>Hatırlatma: {formatDateTime(reminder.scheduled_for)} · {reminder.recipient_scope === "full_family" ? "tam erişimli aile" : "sadece sen"}</Text> : null}
                </View>
                <View style={styles.rowActions}>
                  {reminder ? <Button label="İptal" variant="ghost" onPress={() => cancelReminderMutation.mutate(reminder.id)} /> : null}
                  {item.canDelete ? <Pressable accessibilityLabel="Kaydı sil" accessibilityRole="button" onPress={() => confirmDelete(item)} style={styles.iconButton}><Trash2 color={colors.danger} size={19} /></Pressable> : null}
                </View>
              </View>
            </Card>
          );
        })}

        <View style={styles.safetyNote}>
          <ShieldCheck color={appTheme.primary} size={20} />
          <Text style={styles.safetyText}>Sağlık Dosyam yalnızca kendi kayıtlarını düzenler; teşhis, tedavi veya aciliyet değerlendirmesi yapmaz.</Text>
        </View>
      </View>
    </Screen>
  );
}

const SEVERITY_LABEL: Record<DocumentRedFlagSeverity, string> = {
  urgent: "Bugün değerlendirilmeli",
  today: "Bugün doktoruna danış",
  soon: "Dikkat"
};

/** Urine protein saved from a lab report within the last two weeks. */
const PROTEINURIA_WINDOW_MS = 14 * 24 * 60 * 60_000;

function findRecentProteinuriaFlag(
  timeline: PregnancyHealthTimelineItem[],
  context: Parameters<typeof buildProteinuriaFlag>[1]
) {
  const cutoff = Date.now() - PROTEINURIA_WINDOW_MS;
  for (const item of timeline) {
    if (Date.parse(item.occurredAt) < cutoff) continue;
    for (const value of item.labValues) {
      const flag = buildProteinuriaFlag(
        { testName: value.test_name, result: value.result_text, unit: value.unit ?? "" },
        context
      );
      if (flag) return flag;
    }
  }
  return null;
}

function describeReading(reading: VitalSignReading) {
  const parts = [
    reading.systolic !== null && reading.diastolic !== null
      ? `${reading.systolic}/${reading.diastolic} mmHg`
      : null,
    reading.temperatureCelsius !== null ? `${formatTemperature(reading.temperatureCelsius)} °C` : null,
    reading.note
  ].filter(Boolean);
  return parts.join(" · ");
}

/** The arrow says the number moved, never whether the movement is good. */
function TrendTile({
  direction,
  icon,
  label,
  value
}: {
  direction: "up" | "down" | "flat" | null;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summary}>
      {icon}
      <Text style={styles.summaryValue}>{value}</Text>
      <View style={styles.topBar}>
        {direction === "up" ? <TrendingUp color={colors.textMuted} size={14} />
          : direction === "down" ? <TrendingDown color={colors.textMuted} size={14} />
          : direction === "flat" ? <Minus color={colors.textMuted} size={14} />
          : null}
        <Text style={styles.meta}>{label}</Text>
      </View>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>; }
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { const theme = useAppTheme(); return <PressableScale accessibilityRole="button" onPress={onPress} style={[styles.choice, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}><Text style={[styles.choiceText, active && { color: colors.onPrimary }]}>{label}</Text></PressableScale>; }
function timelineIcon(kind: PregnancyHealthTimelineItem["kind"], color: string) { return kind === "appointment" ? <CalendarDays color={color} size={20} /> : kind === "lab_report" ? <FileText color={color} size={20} /> : <NotebookPen color={color} size={20} />; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

const styles = StyleSheet.create({
  page: { gap: spacing.lg }, stack: { gap: spacing.md }, stackTight: { gap: spacing.xs },
  warningCard: { backgroundColor: colors.accentSoft, borderColor: colors.dustyRose, borderWidth: 1 },
  severityText: { ...typography.label, color: colors.text },
  actionText: { ...typography.body, color: colors.text, fontWeight: "700" }, topBar: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  iconButton: { alignItems: "center", borderRadius: radii.pill, justifyContent: "center", minHeight: 44, minWidth: 44 },
  summaryRow: { flexDirection: "row", gap: spacing.sm }, summary: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, padding: spacing.md }, summaryValue: { ...typography.heading2, color: colors.primary },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, flexButton: { flex: 1 },
  choice: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md }, choiceText: { ...typography.label },
  premiumRow: { alignItems: "center", borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.md }, toggleText: { ...typography.label },
  sectionHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }, meta: { ...typography.body, color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  timelineRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md }, timelineIcon: { alignItems: "center", borderRadius: radii.pill, height: 40, justifyContent: "center", width: 40 }, timelineCopy: { flex: 1, gap: spacing.xs }, date: { ...typography.body, color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 19 }, rowActions: { alignItems: "center", gap: spacing.xs },
  labValue: { ...typography.body, color: colors.text }, reminderText: { ...typography.body, color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  safetyNote: { alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radii.lg, flexDirection: "row", gap: spacing.sm, padding: spacing.md }, safetyText: { ...typography.body, color: colors.text, flex: 1, fontSize: 14, lineHeight: 19 }
});
