import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  ShieldCheck,
  Syringe
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import {
  listPregnancyVaccinations,
  listVaccinationsForBaby,
  setVaccinationCompleted,
  updateVaccinationNotesForSource,
  type VaccinationSource
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Thread } from "@/components/Thread";
import { formatDate, getRelativeDayLabel } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type VaccinationItem = {
  completed: boolean;
  id: string;
  name: string;
  notes: string | null;
  periodLabel: string;
  scheduledDate: string;
  source: VaccinationSource;
};

type NotesEditor = Pick<VaccinationItem, "id" | "source">;

export default function VaccinesScreen() {
  const queryClient = useQueryClient();
  const appTheme = useAppTheme().theme;
  const { showError, showSuccess } = useFeedback();
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [notesEditor, setNotesEditor] = useState<NotesEditor>();
  const [notes, setNotes] = useState("");

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });
  const babies = babiesQuery.data ?? [];
  const selectedBaby = useMemo(
    () => babies.find((baby) => baby.id === selectedBabyId) ?? babies[0],
    [babies, selectedBabyId]
  );

  useEffect(() => {
    if (!selectedBabyId && babies[0]) setSelectedBabyId(babies[0].id);
  }, [babies, selectedBabyId]);

  const pregnancyVaccinationsQuery = useQuery({
    queryKey: ["pregnancy-vaccinations", profileQuery.data?.id],
    queryFn: () => listPregnancyVaccinations(profileQuery.data?.id as string),
    enabled: Boolean(profileQuery.data?.id && profileQuery.data.is_pregnant)
  });
  const babyVaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", selectedBaby?.id],
    queryFn: () => listVaccinationsForBaby(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });

  const pregnancyItems: VaccinationItem[] = (pregnancyVaccinationsQuery.data ?? []).map(
    (vaccination) => ({
      completed: vaccination.completed,
      id: vaccination.id,
      name: vaccination.vaccine_name,
      notes: vaccination.notes,
      periodLabel: `${vaccination.recommended_week_start}–${vaccination.recommended_week_end}. hafta öneri aralığı`,
      scheduledDate: vaccination.scheduled_date,
      source: "pregnancy"
    })
  );
  const babyItems: VaccinationItem[] = (babyVaccinationsQuery.data ?? []).map(
    (vaccination) => ({
      completed: vaccination.completed,
      id: vaccination.id,
      name: vaccination.vaccine_schedule?.vaccine_name ?? "Bebek aşısı",
      notes: vaccination.notes,
      periodLabel: getVaccineAgeLabel(
        vaccination.vaccine_schedule?.recommended_age_days ?? 0
      ),
      scheduledDate: vaccination.scheduled_date,
      source: "baby"
    })
  );

  const toggleMutation = useMutation({
    mutationFn: (item: VaccinationItem) =>
      setVaccinationCompleted({
        completed: !item.completed,
        source: item.source,
        vaccinationId: item.id
      }),
    onSuccess: async (_result, item) => {
      await invalidateVaccinationQueries(queryClient, item.source);
      showSuccess(item.completed ? "Aşı yeniden bekliyor olarak işaretlendi." : "Aşı tamamlandı olarak işaretlendi.");
    },
    onError: (error) => showError(error, "Aşı durumu güncellenemedi")
  });

  const notesMutation = useMutation({
    mutationFn: async () => {
      if (!notesEditor) throw new Error("Aşı seçilmedi.");
      return updateVaccinationNotesForSource({
        notes: notes.trim() || null,
        source: notesEditor.source,
        vaccinationId: notesEditor.id
      });
    },
    onSuccess: async () => {
      const source = notesEditor?.source;
      setNotesEditor(undefined);
      setNotes("");
      if (source) {
        await invalidateVaccinationQueries(queryClient, source);
      }
      showSuccess("Aşı notu kaydedildi.");
    },
    onError: (error) => showError(error, "Aşı notu kaydedilemedi")
  });
  const vaccinationUpdatePending =
    toggleMutation.isPending || notesMutation.isPending;

  function openNotes(item: VaccinationItem) {
    setNotesEditor({ id: item.id, source: item.source });
    setNotes(item.notes ?? "");
  }

  function closeNotes() {
    setNotesEditor(undefined);
    setNotes("");
  }

  if (profileQuery.isLoading || babiesQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Aşı merkezi hazırlanıyor…" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError || !profileQuery.data) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Aşı planları şu anda alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() => void Promise.all([profileQuery.refetch(), babiesQuery.refetch()])}
          retrying={profileQuery.isFetching || babiesQuery.isFetching}
          title="Aşı merkezi açılamadı"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
            <Syringe color={appTheme.primary} size={29} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[typography.eyebrow, { color: appTheme.primary }]}>Ortak aile alanı</Text>
            <Text style={typography.heading1}>Aşı merkezi</Text>
            <Text style={styles.heroText}>
              Gebelik ve bebek aşı planlarını yaşam evrenden bağımsız olarak aynı yerde takip et.
            </Text>
          </View>
        </View>

        <View style={[styles.medicalNote, { backgroundColor: appTheme.accentSoft }]}>
          <ShieldCheck color={appTheme.primary} size={22} />
          <Text style={styles.medicalNoteText}>
            Tarihleri ve sana ya da bebeğine uygun aşı planını aile hekiminle doğrula.
          </Text>
        </View>

        {profileQuery.data.is_pregnant ? (
          <VaccinationSection
            error={pregnancyVaccinationsQuery.isError}
            items={pregnancyItems}
            loading={pregnancyVaccinationsQuery.isLoading}
            notes={notes}
            notesEditor={notesEditor}
            primaryColor={appTheme.primary}
            retrying={pregnancyVaccinationsQuery.isFetching}
            subject="Gebelik"
            title="Gebelik aşıları"
            togglePending={vaccinationUpdatePending}
            updatingNotes={notesMutation.isPending}
            onChangeNotes={setNotes}
            onCloseNotes={closeNotes}
            onOpenNotes={openNotes}
            onRetry={() => void pregnancyVaccinationsQuery.refetch()}
            onSaveNotes={() => notesMutation.mutate()}
            onToggle={(item) => toggleMutation.mutate(item)}
          />
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={typography.heading2}>Bebek aşıları</Text>
          <Text style={styles.sectionDescription}>
            Mevcut bebek profillerinin aşı takvimi her iki yaşam evresinde de açık kalır.
          </Text>
        </View>

        {babies.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.babyChips}>
            {babies.map((baby) => {
              const active = baby.id === selectedBaby?.id;
              return (
                <Pressable
                  key={baby.id}
                  accessibilityLabel={`${baby.name} aşı takvimi`}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: active,
                    disabled: vaccinationUpdatePending
                  }}
                  disabled={vaccinationUpdatePending}
                  onPress={() => {
                    closeNotes();
                    setSelectedBabyId(baby.id);
                  }}
                  style={[
                    styles.babyChip,
                    active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary },
                    vaccinationUpdatePending && styles.controlDisabled
                  ]}
                >
                  <Text style={[styles.babyChipText, active && styles.babyChipTextActive]}>
                    {baby.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!selectedBaby ? (
          <EmptyState
            actionHint="Bebek profili oluşturma ekranını açar"
            actionLabel="Bebek profili ekle"
            description="Doğum tarihi eklendiğinde bebeğin önerilen aşı takvimi otomatik hazırlanır."
            onActionPress={() =>
              router.push({ pathname: "/baby", params: { section: "profile" } })
            }
            title="Bebek aşı takvimi için profil gerekli"
          />
        ) : (
          <VaccinationSection
            error={babyVaccinationsQuery.isError}
            items={babyItems}
            loading={babyVaccinationsQuery.isLoading}
            notes={notes}
            notesEditor={notesEditor}
            primaryColor={appTheme.primary}
            retrying={babyVaccinationsQuery.isFetching}
            subject={selectedBaby.name}
            title={`${selectedBaby.name} için aşı takvimi`}
            togglePending={vaccinationUpdatePending}
            updatingNotes={notesMutation.isPending}
            onChangeNotes={setNotes}
            onCloseNotes={closeNotes}
            onOpenNotes={openNotes}
            onRetry={() => void babyVaccinationsQuery.refetch()}
            onSaveNotes={() => notesMutation.mutate()}
            onToggle={(item) => toggleMutation.mutate(item)}
          />
        )}
      </View>
    </Screen>
  );
}

function VaccinationSection({
  error,
  items,
  loading,
  notes,
  notesEditor,
  onChangeNotes,
  onCloseNotes,
  onOpenNotes,
  onRetry,
  onSaveNotes,
  onToggle,
  primaryColor,
  retrying,
  subject,
  title,
  togglePending,
  updatingNotes
}: {
  error: boolean;
  items: VaccinationItem[];
  loading: boolean;
  notes: string;
  notesEditor?: NotesEditor;
  onChangeNotes: (value: string) => void;
  onCloseNotes: () => void;
  onOpenNotes: (item: VaccinationItem) => void;
  onRetry: () => void;
  onSaveNotes: () => void;
  onToggle: (item: VaccinationItem) => void;
  primaryColor: string;
  retrying: boolean;
  subject: string;
  title: string;
  togglePending: boolean;
  updatingNotes: boolean;
}) {
  const completedCount = items.filter((item) => item.completed).length;

  if (loading) {
    return <QueryState compact loading description={`${title} hazırlanıyor…`} />;
  }
  if (error) {
    return (
      <QueryState
        description={`${title} alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin.`}
        onRetry={onRetry}
        retrying={retrying}
        title="Aşı takvimi yüklenemedi"
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        actionLabel="Takvimi yenile"
        description="Planlanan aşılar geldiğinde bu yaşam ipliğine yerleşecek."
        onActionPress={onRetry}
        title={`${subject} için aşı kaydı yok`}
      />
    );
  }

  return (
    <View style={styles.vaccinationSection}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text style={typography.heading2}>{title}</Text>
            <Text style={typography.body}>
              {completedCount}/{items.length} aşı tamamlandı.
            </Text>
          </View>
          <CalendarCheck color={primaryColor} size={26} />
        </View>
        <Thread
          accessibilityLabel={`${subject} için ${items.length} aşının ${completedCount} tanesi tamamlandı`}
          color={primaryColor}
          height={64}
          markers={items.map((item, index) => ({
            kind: item.completed ? ("knot" as const) : ("loop" as const),
            position: (index + 1) / (items.length + 1)
          }))}
          mutedColor={colors.border}
          progress={completedCount / items.length}
          variant="progress"
        />
      </Card>

      {items.map((item) => {
        const editing = notesEditor?.id === item.id && notesEditor.source === item.source;
        return (
          <View key={`${item.source}:${item.id}`} style={styles.itemBlock}>
            <Pressable
              accessibilityHint="Aşının tamamlanma durumunu değiştirir"
              accessibilityLabel={`${item.name}, ${item.completed ? "tamamlandı" : "bekliyor"}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.completed, disabled: togglePending }}
              disabled={togglePending}
              onPress={() => onToggle(item)}
              style={({ pressed }) => [
                styles.vaccineRow,
                item.completed && styles.vaccineRowDone,
                pressed && styles.vaccineRowPressed
              ]}
            >
              {item.completed ? (
                <CheckCircle2 color={colors.success} size={24} />
              ) : (
                <Circle color={colors.textMuted} size={24} />
              )}
              <View style={styles.vaccineCopy}>
                <Text style={styles.vaccineTitle}>{item.name}</Text>
                <Text style={styles.vaccineMeta}>
                  {item.periodLabel} · {formatDate(item.scheduledDate)} · {getRelativeDayLabel(item.scheduledDate)}
                </Text>
                {item.notes ? <Text style={styles.vaccineNote}>{item.notes}</Text> : null}
              </View>
            </Pressable>

            {editing ? (
              <View style={styles.notesEditor}>
                <TextField
                  label="Aşı notu"
                  maxLength={500}
                  multiline
                  onChangeText={onChangeNotes}
                  value={notes}
                />
                <View style={styles.notesActions}>
                  <Button label="Vazgeç" onPress={onCloseNotes} variant="ghost" />
                  <Button
                    disabled={updatingNotes}
                    label={updatingNotes ? "Kaydediliyor…" : "Notu kaydet"}
                    onPress={onSaveNotes}
                  />
                </View>
              </View>
            ) : (
              <Button
                disabled={togglePending || updatingNotes}
                label={item.notes ? "Notu düzenle" : "Not ekle"}
                onPress={() => onOpenNotes(item)}
                variant="ghost"
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

async function invalidateVaccinationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  source: VaccinationSource
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: source === "pregnancy"
        ? ["pregnancy-vaccinations"]
        : ["baby-vaccinations"]
    }),
    queryClient.invalidateQueries({ queryKey: ["active-vaccine-reminders"] }),
    queryClient.invalidateQueries({ queryKey: ["next-upcoming-vaccination"] })
  ]);
}

function getVaccineAgeLabel(days: number) {
  if (days === 0) return "Doğumda";
  if (days < 56) return `${Math.round(days / 7)}. hafta`;
  if (days < 365) return `${Math.round(days / 30)}. ay`;
  return `${Math.round(days / 365)}. yaş`;
}

const styles = StyleSheet.create({
  babyChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  babyChipText: { ...typography.label, color: colors.text },
  babyChipTextActive: { color: colors.onPrimary },
  babyChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  container: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  controlDisabled: { opacity: 0.56 },
  hero: {
    ...radii.cardLarge,
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.xl
  },
  heroCopy: { flex: 1, gap: spacing.sm, minWidth: 0 },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  heroText: { ...typography.body, color: colors.text },
  itemBlock: { gap: spacing.sm },
  medicalNote: {
    ...radii.card,
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  medicalNoteText: { ...typography.body, color: colors.text, flex: 1, minWidth: 0 },
  notesActions: { gap: spacing.sm },
  notesEditor: {
    ...radii.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  sectionDescription: { ...typography.body, color: colors.textMuted },
  sectionHeading: { gap: spacing.xs },
  summaryCard: { gap: spacing.md },
  summaryCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  summaryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  vaccinationSection: { gap: spacing.md },
  vaccineCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  vaccineMeta: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  vaccineNote: { ...typography.body, color: colors.text, fontSize: 15, lineHeight: 22 },
  vaccineRow: {
    ...radii.card,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.lg
  },
  vaccineRowDone: { backgroundColor: colors.primarySoft },
  vaccineRowPressed: { opacity: 0.78 },
  vaccineTitle: { ...typography.label, color: colors.text }
});
