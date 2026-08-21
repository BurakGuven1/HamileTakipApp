import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BellRing, CalendarDays, FileHeart, FileText, NotebookPen, ShieldCheck, Trash2 } from "lucide-react-native";
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
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { sharePregnancyHealthFilePdf } from "@/features/pregnancy-health/report";
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
  const viewedTrackedRef = useRef(false);

  const healthQuery = useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: listPregnancyHealthTimeline });
  const featureAccessQuery = useQuery({ queryKey: ["family-feature-access"], queryFn: getFamilyFeatureAccess });
  const isPremium = Boolean(featureAccessQuery.data?.is_premium);
  const timeline = healthQuery.data?.timeline ?? [];
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
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.text} size={22} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>GEBELİK KAYITLARIN</Text>
            <Text style={typography.heading1}>Sağlık Dosyam</Text>
          </View>
          <FileHeart color={appTheme.primary} size={30} />
        </View>

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

function Summary({ label, value }: { label: string; value: number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>; }
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { const theme = useAppTheme(); return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choice, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}><Text style={[styles.choiceText, active && { color: colors.onPrimary }]}>{label}</Text></Pressable>; }
function timelineIcon(kind: PregnancyHealthTimelineItem["kind"], color: string) { return kind === "appointment" ? <CalendarDays color={color} size={20} /> : kind === "lab_report" ? <FileText color={color} size={20} /> : <NotebookPen color={color} size={20} />; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

const styles = StyleSheet.create({
  page: { gap: spacing.lg }, stack: { gap: spacing.md }, topBar: { alignItems: "center", flexDirection: "row", gap: spacing.md },
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
