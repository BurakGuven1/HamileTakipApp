import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlarmClock,
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Crown,
  HandHeart,
  Plus,
  RefreshCw,
  Stethoscope,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  cancelFamilyTaskAlarm,
  completeFamilyTask,
  createFamilyTask,
  getFamilyCoordinationContext,
  getFamilyFeatureAccess,
  getPregnancySupportSnapshot,
  listFamilyTasks,
  snoozeFamilyTaskAlarm,
  subscribeToFamilyCoordination,
  takeOverPregnancySupport,
  type FamilyLifeStage,
  type FamilyTask,
  type FamilyTaskAssigneeScope,
  type PregnancySupportSnapshot
} from "@/api/familyCoordination";
import {
  getCareHandoverSnapshot,
  subscribeToCareCoordination,
  takeOverBabyCare,
  type CareHandoverSnapshot
} from "@/api/careJournal";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Reveal } from "@/components/Reveal";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { createCareUuid } from "@/features/care-journal/careSync";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type PlannerSection = "today" | "create" | "handover";

type TaskPreset = {
  key: string;
  label: string;
  title: string;
};

const PREGNANCY_PRESETS: TaskPreset[] = [
  { key: "prepare_water", label: "Suyu hazırla", title: "Su şişesini hazırla" },
  { key: "prepare_visit_notes", label: "Randevu notları", title: "Doktor sorularını birlikte gözden geçir" },
  { key: "check_birth_bag", label: "Doğum çantası", title: "Doğum çantası listesini kontrol et" },
  { key: "rest_support", label: "Dinlenme desteği", title: "Dinlenme alanını hazırla" },
  { key: "meal_support", label: "Öğün desteği", title: "Bir sonraki öğünü hazırla" },
  { key: "appointment_companion", label: "Randevu", title: "Randevu için ulaşım planını kontrol et" }
];

const POSTPARTUM_PRESETS: TaskPreset[] = [
  { key: "change_diaper", label: "Altını değiştir", title: "Bebeğin altını değiştir" },
  { key: "store_milk", label: "Sütü dolaba koy", title: "Sağılan sütü dolaba yerleştir" },
  { key: "prepare_bottle", label: "Biberon hazırla", title: "Biberonu bir sonraki beslenmeye hazırla" },
  { key: "clean_pump", label: "Pompayı temizle", title: "Pompa parçalarını temizle" },
  { key: "sleep_support", label: "Uyku desteği", title: "Bebeğin uyku rutinini devral" },
  { key: "medicine_reminder", label: "İlaç/vitamin", title: "Planlanan ilaç veya vitamin kaydını kontrol et" }
];

const SECTION_ITEMS: { id: PlannerSection; label: string }[] = [
  { id: "today", label: "Bugün" },
  { id: "create", label: "Görev ekle" },
  { id: "handover", label: "Devir özeti" }
];

export default function FamilyPlannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId?: string }>();
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
  const appTheme = useAppTheme().theme;
  const [section, setSection] = useState<PlannerSection>(
    params.taskId ? "today" : "today"
  );
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [presetKey, setPresetKey] = useState<string>();
  const [assigneeScope, setAssigneeScope] =
    useState<FamilyTaskAssigneeScope>("mother");
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmAt, setAlarmAt] = useState(() => nextRoundedHour());
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [draftOperationId, setDraftOperationId] = useState(createCareUuid);

  const contextQuery = useQuery({
    queryKey: ["family-coordination-context"],
    queryFn: getFamilyCoordinationContext
  });
  const context = contextQuery.data;
  const selectedBaby =
    context?.babies.find((baby) => baby.id === selectedBabyId) ??
    context?.babies[0];
  const lifeStage: FamilyLifeStage =
    context?.profile.is_pregnant === true ||
    (context?.profile.is_pregnant == null && !selectedBaby)
      ? "pregnancy"
      : "postpartum";

  useEffect(() => {
    if (!selectedBabyId && context?.babies[0]) {
      setSelectedBabyId(context.babies[0].id);
    }
  }, [context?.babies, selectedBabyId]);

  const tasksQuery = useQuery({
    queryKey: ["family-tasks", lifeStage, selectedBaby?.id ?? null],
    queryFn: () =>
      listFamilyTasks({
        babyId: lifeStage === "postpartum" ? selectedBaby?.id ?? null : null,
        includeCompleted: true,
        lifeStage
      }),
    enabled: Boolean(
      context && (lifeStage === "pregnancy" || selectedBaby?.id)
    )
  });

  const featureAccessQuery = useQuery({
    queryKey: ["family-feature-access"],
    queryFn: getFamilyFeatureAccess,
    enabled: Boolean(context)
  });

  const pregnancySnapshotQuery = useQuery({
    queryKey: ["pregnancy-support-snapshot", context?.owner_id],
    queryFn: getPregnancySupportSnapshot,
    enabled: Boolean(context && lifeStage === "pregnancy")
  });

  const postpartumSnapshotQuery = useQuery({
    queryKey: ["care-handover", selectedBaby?.id],
    queryFn: () => getCareHandoverSnapshot(selectedBaby?.id as string),
    enabled: Boolean(lifeStage === "postpartum" && selectedBaby?.id),
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (!context?.owner_id) return;
    return subscribeToFamilyCoordination(context.owner_id, () => {
      queryClient.invalidateQueries({ queryKey: ["family-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["family-feature-access"] });
      queryClient.invalidateQueries({ queryKey: ["pregnancy-support-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["family-coordination-context"] });
    });
  }, [context?.owner_id, queryClient]);

  useEffect(() => {
    if (!selectedBaby?.id || lifeStage !== "postpartum") return;
    return subscribeToCareCoordination(selectedBaby.id, () => {
      queryClient.invalidateQueries({ queryKey: ["care-handover", selectedBaby.id] });
    });
  }, [lifeStage, queryClient, selectedBaby?.id]);

  const currentParticipant = context?.participants.find(
    (participant) => participant.user_id === context.current_user_id
  );
  const memberParticipant = context?.participants.find(
    (participant) => participant.role !== "mother"
  );
  const tasks = tasksQuery.data ?? [];
  const openTasks = tasks
    .filter((task) => !task.completed_at)
    .sort((left, right) => taskSortValue(left) - taskSortValue(right));
  const completedTasks = tasks
    .filter((task) => Boolean(task.completed_at))
    .sort((left, right) =>
      String(right.completed_at).localeCompare(String(left.completed_at))
    );
  const featureAccess = featureAccessQuery.data ?? context?.feature_access;
  const presets =
    lifeStage === "pregnancy" ? PREGNANCY_PRESETS : POSTPARTUM_PRESETS;
  const selectedAssignees = useMemo(() => {
    if (!context) return [];
    if (assigneeScope === "mother") {
      return context.participants.filter((item) => item.role === "mother");
    }
    if (assigneeScope === "member") {
      return context.participants.filter((item) => item.role !== "mother");
    }
    return context.participants;
  }, [assigneeScope, context]);
  const notificationsMissing =
    alarmEnabled && selectedAssignees.some((item) => !item.notifications_ready);

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createFamilyTask({
        alarmAt: alarmEnabled ? alarmAt : null,
        assigneeScope,
        babyId: lifeStage === "postpartum" ? selectedBaby?.id ?? null : null,
        dueAt: alarmEnabled ? alarmAt : null,
        lifeStage,
        notes,
        operationId: draftOperationId,
        presetKey,
        title
      }),
    onSuccess: async (result) => {
      if (!result.allowed) {
        if (isPremiumRequiredReason(result.reason)) {
          await showPaywallIfNeeded("premium_feature", {
            feature: "family_task_alarm",
            life_stage: lifeStage,
            reason: "free_credits_exhausted",
            remaining: result.remaining ?? 0
          });
        } else {
          showError(
            new Error("Görev işlemi güvenle tamamlanamadı. Lütfen yeniden dene."),
            "Görev eklenemedi"
          );
        }
        return;
      }

      setTitle("");
      setNotes("");
      setPresetKey(undefined);
      setAlarmEnabled(false);
      setAlarmAt(nextRoundedHour());
      setDraftOperationId(createCareUuid());
      setSection("today");
      showSuccess(
        result.remaining == null
          ? "Görev iki cihazla eşitlendi."
          : alarmEnabled
            ? `Görev ve alarm hazır. ${result.remaining} akıllı kullanım hakkın kaldı.`
            : "Görev iki cihazla eşitlendi.",
        "Aile görevi eklendi"
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["family-feature-access"] }),
        queryClient.invalidateQueries({ queryKey: ["family-coordination-context"] })
      ]);
    },
    onError: (error) => showError(error, "Görev eklenemedi")
  });

  const completeTaskMutation = useMutation({
    mutationFn: (task: FamilyTask) =>
      completeFamilyTask(task.id, !task.completed_at),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["family-tasks"] });
    },
    onError: (error) => showError(error, "Görev güncellenemedi")
  });

  const snoozeMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      snoozeFamilyTaskAlarm(
        assignmentId,
        new Date(Date.now() + 10 * 60_000)
      ),
    onSuccess: async () => {
      showSuccess("Alarm 10 dakika ertelendi.");
      await queryClient.invalidateQueries({ queryKey: ["family-tasks"] });
    },
    onError: (error) => showError(error, "Alarm ertelenemedi")
  });

  const cancelAlarmMutation = useMutation({
    mutationFn: cancelFamilyTaskAlarm,
    onSuccess: async () => {
      showSuccess("Sana ait görev alarmı iptal edildi.");
      await queryClient.invalidateQueries({ queryKey: ["family-tasks"] });
    },
    onError: (error) => showError(error, "Alarm iptal edilemedi")
  });

  const pregnancyTakeoverMutation = useMutation({
    mutationFn: () =>
      takeOverPregnancySupport({
        caregiverName: currentParticipant?.display_name
      }),
    onSuccess: async (result) => {
      if (!result.allowed) {
        if (isPremiumRequiredReason(result.reason)) {
          await showPaywallIfNeeded("premium_feature", {
            feature: "pregnancy_support_handover",
            life_stage: "pregnancy",
            reason: "free_credits_exhausted",
            remaining: result.remaining ?? 0
          });
        } else {
          showError(
            new Error("Devir işlemi güvenle tamamlanamadı. Lütfen yeniden dene."),
            "Destek devralınamadı"
          );
        }
        return;
      }
      showSuccess(
        result.remaining == null
          ? "Gebelik desteği sende."
          : `Destek devralındı. ${result.remaining} akıllı kullanım hakkın kaldı.`,
        "Devir tamamlandı"
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pregnancy-support-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["family-feature-access"] })
      ]);
    },
    onError: (error) => showError(error, "Destek devralınamadı")
  });

  const postpartumTakeoverMutation = useMutation({
    mutationFn: () => {
      if (!selectedBaby?.id || !currentParticipant) {
        throw new Error("Bebek ve bakım sorumlusu bilgisi gerekli.");
      }
      return takeOverBabyCare(selectedBaby.id, currentParticipant.display_name);
    },
    onSuccess: async () => {
      showSuccess("Bakım sırası sende. Diğer cihazda da canlı güncellendi.");
      await queryClient.invalidateQueries({ queryKey: ["care-handover", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Bakım devralınamadı")
  });

  function submitTask() {
    if (!title.trim()) {
      showInfo("Hazır görevlerden birini seç veya görevi yaz.", "Görev gerekli");
      return;
    }
    if (assigneeScope !== "mother" && !memberParticipant) {
      showInfo("Önce profil alanındaki aile koduyla bir baba veya bakıcı bağlanmalı.", "Aile üyesi bağlı değil");
      return;
    }
    if (alarmEnabled && alarmAt.getTime() <= Date.now() + 60_000) {
      showInfo("Alarm saatini en az bir dakika ileri seç.", "Alarm saatini kontrol et");
      return;
    }
    createTaskMutation.mutate();
  }

  function choosePreset(preset: TaskPreset) {
    setPresetKey(preset.key);
    setTitle(preset.title);
  }

  function onPickerChange(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS !== "ios" || event.type === "dismissed") {
      setPickerMode(null);
    }
    if (!value || event.type === "dismissed") return;
    const next = new Date(alarmAt);
    if (pickerMode === "date") {
      next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
    } else {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    setAlarmAt(next);
    if (Platform.OS === "ios") setPickerMode(null);
  }

  if (contextQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Aile görevlerin iki cihazla eşitleniyor…" />
      </Screen>
    );
  }

  if (contextQuery.isError || !context) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Aile koordinasyon bilgileri alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() => void contextQuery.refetch()}
          retrying={contextQuery.isFetching}
          title="Aile alanı açılamadı"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Geri dön"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed
            ]}
          >
            <ArrowLeft color={colors.text} size={24} />
          </Pressable>
          <View style={styles.topBarCopy}>
            <Text style={typography.heading2}>Aile görevleri</Text>
            <Text style={styles.topBarMeta}>
              {lifeStage === "pregnancy" ? "Gebelik desteği" : `${selectedBaby?.name ?? "Bebek"} bakımı`}
            </Text>
          </View>
        </View>

        <Reveal>
          <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
            <View style={styles.heroTopRow}>
              <View style={[styles.heroIcon, { backgroundColor: appTheme.accentSoft }]}>
                <Users color={appTheme.primary} size={27} />
              </View>
              <CreditBadge
                isPremium={Boolean(featureAccess?.is_premium)}
                remaining={featureAccess?.remaining ?? null}
              />
            </View>
            <Text style={typography.heading1}>Kimin sırası belli olsun</Text>
            <Text style={styles.heroText}>
              Görev ve alarm yalnız seçtiğin kişilere gider; tamamlandığında iki cihazda da aynı anda görünür.
            </Text>
            <View style={styles.participantRow}>
              {context.participants.map((participant) => (
                <View key={participant.user_id} style={styles.participantItem}>
                  <View
                    style={[
                      styles.presenceDot,
                      {
                        backgroundColor: participant.notifications_ready
                          ? colors.success
                          : colors.highlight
                      }
                    ]}
                  />
                  <Text numberOfLines={1} style={styles.participantName}>
                    {participant.display_name}
                  </Text>
                  <Text style={styles.participantStatus}>
                    {participant.notifications_ready ? "alarm açık" : "alarm izni bekliyor"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Reveal>

        {lifeStage === "postpartum" && context.babies.length > 1 ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.chipRail}
            showsHorizontalScrollIndicator={false}
          >
            {context.babies.map((baby) => (
              <ChoiceChip
                key={baby.id}
                active={baby.id === selectedBaby?.id}
                label={baby.name}
                onPress={() => setSelectedBabyId(baby.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View accessibilityRole="tablist" style={styles.sectionNav}>
          {SECTION_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === item.id }}
              onPress={() => setSection(item.id)}
              style={({ pressed }) => [
                styles.sectionButton,
                section === item.id && {
                  backgroundColor: appTheme.primary
                },
                pressed && styles.pressed
              ]}
            >
              <Text
                style={[
                  styles.sectionButtonText,
                  section === item.id && styles.sectionButtonTextActive
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {section === "today" ? (
          <Reveal delay={70} style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={typography.heading2}>Açık görevler</Text>
                <Text style={styles.sectionDescription}>
                  Tamamlama ücretsizdir ve diğer cihazda anında görünür.
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: appTheme.primarySoft }]}>
                <Text style={[styles.countBadgeText, { color: appTheme.primary }]}>
                  {openTasks.length}
                </Text>
              </View>
            </View>

            {tasksQuery.isLoading ? (
              <QueryState compact loading description="Görevler yükleniyor…" />
            ) : tasksQuery.isError ? (
              <QueryState
                compact
                description="Görevler alınamadı."
                onRetry={() => void tasksQuery.refetch()}
                retrying={tasksQuery.isFetching}
              />
            ) : openTasks.length ? (
              <View style={styles.taskList}>
                {openTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    currentUserId={context.current_user_id}
                    highlighted={params.taskId === task.id}
                    onCancelAlarm={(assignmentId) => cancelAlarmMutation.mutate(assignmentId)}
                    onComplete={() => completeTaskMutation.mutate(task)}
                    onSnooze={(assignmentId) => snoozeMutation.mutate(assignmentId)}
                    task={task}
                    updating={
                      completeTaskMutation.isPending ||
                      snoozeMutation.isPending ||
                      cancelAlarmMutation.isPending
                    }
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="Açık görev yok"
                description="Yeni bir ortak görev eklediğinde burada, en yakın zamanlı görev en üstte görünür."
              />
            )}

            {completedTasks.length ? (
              <Card style={styles.completedCard}>
                <View style={styles.compactHeader}>
                  <ClipboardCheck color={colors.success} size={22} />
                  <Text style={typography.heading3}>Son tamamlananlar</Text>
                </View>
                {completedTasks.slice(0, 3).map((task) => (
                  <Pressable
                    key={task.id}
                    accessibilityLabel={`${task.title} görevini yeniden aç`}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: true,
                      disabled: completeTaskMutation.isPending
                    }}
                    disabled={completeTaskMutation.isPending}
                    onPress={() => completeTaskMutation.mutate(task)}
                    style={({ pressed }) => [
                      styles.completedRow,
                      pressed && styles.pressed
                    ]}
                  >
                    <Check color={colors.success} size={18} />
                    <Text numberOfLines={2} style={styles.completedText}>
                      {task.title}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </Reveal>
        ) : null}

        {section === "create" ? (
          <Reveal delay={70} style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={typography.heading2}>Yeni görev</Text>
                <Text style={styles.sectionDescription}>
                  Hazır bir görev seçebilir veya kendi cümleni yazabilirsin.
                </Text>
              </View>
              <Plus color={appTheme.primary} size={25} />
            </View>

            <View style={styles.presetWrap}>
              {presets.map((preset) => (
                <ChoiceChip
                  key={preset.key}
                  active={presetKey === preset.key}
                  label={preset.label}
                  onPress={() => choosePreset(preset)}
                />
              ))}
            </View>

            <Card style={styles.formCard}>
              <View style={styles.formContent}>
                <TextField
                  label="Görev"
                  maxLength={120}
                  value={title}
                  onChangeText={(value) => {
                    setTitle(value);
                    if (presetKey) setPresetKey(undefined);
                  }}
                />
                <TextField
                  label="Kısa not (isteğe bağlı)"
                  maxLength={500}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />

                <View style={styles.fieldGroup}>
                  <Text style={typography.label}>Görevli</Text>
                  <View style={styles.scopeRow}>
                    <ScopeButton
                      active={assigneeScope === "mother"}
                      label={context.participants.find((item) => item.role === "mother")?.display_name ?? "Anne"}
                      onPress={() => setAssigneeScope("mother")}
                    />
                    <ScopeButton
                      active={assigneeScope === "member"}
                      disabled={!memberParticipant}
                      label={memberParticipant?.display_name ?? "Baba / Bakıcı"}
                      onPress={() => setAssigneeScope("member")}
                    />
                    <ScopeButton
                      active={assigneeScope === "both"}
                      disabled={!memberParticipant}
                      label="İkisi"
                      onPress={() => setAssigneeScope("both")}
                    />
                  </View>
                </View>

                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: alarmEnabled }}
                  onPress={() => setAlarmEnabled((value) => !value)}
                  style={({ pressed }) => [
                    styles.alarmToggle,
                    pressed && styles.pressed
                  ]}
                >
                  <View
                    style={[
                      styles.alarmToggleIcon,
                      alarmEnabled && { backgroundColor: appTheme.primary }
                    ]}
                  >
                    <BellRing
                      color={alarmEnabled ? colors.onPrimary : colors.textMuted}
                      size={20}
                    />
                  </View>
                  <View style={styles.alarmToggleCopy}>
                    <Text style={typography.label}>Zamanlı alarm ekle</Text>
                    <Text style={styles.alarmToggleHint}>
                      Alarm yalnız seçilen kişilerin cihazlarına gider.
                    </Text>
                  </View>
                  <Text style={[styles.alarmToggleState, { color: appTheme.primary }]}>
                    {alarmEnabled ? "Açık" : "Kapalı"}
                  </Text>
                </Pressable>

                {alarmEnabled ? (
                  <View style={styles.alarmFields}>
                    <Pressable
                      accessibilityLabel="Alarm gününü seç"
                      accessibilityRole="button"
                      onPress={() => setPickerMode("date")}
                      style={({ pressed }) => [
                        styles.dateButton,
                        pressed && styles.pressed
                      ]}
                    >
                      <Clock3 color={appTheme.primary} size={20} />
                      <View style={styles.dateButtonCopy}>
                        <Text style={styles.dateButtonLabel}>Gün</Text>
                        <Text style={styles.dateButtonValue}>{formatDay(alarmAt)}</Text>
                      </View>
                      <ChevronRight color={colors.textMuted} size={20} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Alarm saatini seç"
                      accessibilityRole="button"
                      onPress={() => setPickerMode("time")}
                      style={({ pressed }) => [
                        styles.dateButton,
                        pressed && styles.pressed
                      ]}
                    >
                      <AlarmClock color={appTheme.primary} size={20} />
                      <View style={styles.dateButtonCopy}>
                        <Text style={styles.dateButtonLabel}>Saat</Text>
                        <Text style={styles.dateButtonValue}>{formatTime(alarmAt)}</Text>
                      </View>
                      <ChevronRight color={colors.textMuted} size={20} />
                    </Pressable>
                    {pickerMode ? (
                      <DateTimePicker
                        display={Platform.OS === "ios" ? "compact" : "default"}
                        minimumDate={new Date()}
                        mode={pickerMode}
                        onChange={onPickerChange}
                        value={alarmAt}
                      />
                    ) : null}
                    {notificationsMissing ? (
                      <View style={styles.warningBox}>
                        <BellRing color={colors.highlight} size={19} />
                        <Text style={styles.warningText}>
                          Seçilen kişilerden en az birinde bildirim izni kapalı. Görev eşitlenir; fakat o cihazda alarm sesi garanti edilemez.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Button
                  disabled={createTaskMutation.isPending}
                  label={
                    createTaskMutation.isPending
                      ? "İki cihazla eşitleniyor…"
                      : alarmEnabled
                        ? "Görev ve alarmı oluştur"
                        : "Görevi oluştur"
                  }
                  onPress={submitTask}
                />
                <Text style={styles.creditNote}>
                  Zamanlı ortak alarm, doktor PDF’i ve gebelikte akıllı destek devri ortak kullanım hakkından düşer. Görev oluşturmak ve tamamlamak ücretsizdir.
                </Text>
              </View>
            </Card>
          </Reveal>
        ) : null}

        {section === "handover" ? (
          <Reveal delay={70} style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={typography.heading2}>
                  {lifeStage === "pregnancy" ? "Gebelik desteği" : "Canlı bakım devri"}
                </Text>
                <Text style={styles.sectionDescription}>
                  Kimde kaldığını ve sıradaki kaydedilmiş işi tek bakışta gör.
                </Text>
              </View>
              <HandHeart color={appTheme.primary} size={25} />
            </View>

            {lifeStage === "pregnancy" ? (
              <PregnancyHandover
                loading={pregnancySnapshotQuery.isLoading}
                onRetry={() => void pregnancySnapshotQuery.refetch()}
                onTakeOver={() => pregnancyTakeoverMutation.mutate()}
                snapshot={pregnancySnapshotQuery.data ?? null}
                takingOver={pregnancyTakeoverMutation.isPending}
              />
            ) : (
              <PostpartumHandover
                loading={postpartumSnapshotQuery.isLoading}
                onRetry={() => void postpartumSnapshotQuery.refetch()}
                onTakeOver={() => postpartumTakeoverMutation.mutate()}
                snapshot={postpartumSnapshotQuery.data ?? null}
                takingOver={postpartumTakeoverMutation.isPending}
              />
            )}

            {lifeStage === "postpartum" || context.can_access_maternal ? (
            <Card style={styles.doctorLinkCard}>
              <View style={styles.doctorLinkRow}>
                <View style={[styles.doctorIcon, { backgroundColor: appTheme.accentSoft }]}>
                  <Stethoscope color={appTheme.primary} size={23} />
                </View>
                <View style={styles.doctorLinkCopy}>
                  <Text style={typography.heading3}>Doktor görüşmesine hazırlan</Text>
                  <Text style={styles.sectionDescription}>
                    {lifeStage === "pregnancy"
                      ? "Gebelik kayıtların ve soruların"
                      : "Bebek ile anne için ayrı özetler"}
                  </Text>
                </View>
                <ChevronRight color={colors.textMuted} size={22} />
              </View>
              <Button
                label="Görüşme dosyasını aç"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/doctor-visit",
                    params: {
                      babyId: selectedBaby?.id,
                      subject: lifeStage === "pregnancy" ? "pregnancy" : "baby"
                    }
                  })
                }
              />
            </Card>
            ) : null}
          </Reveal>
        ) : null}
      </View>
    </Screen>
  );
}

function CreditBadge({
  isPremium,
  remaining
}: {
  isPremium: boolean;
  remaining: number | null;
}) {
  return (
    <View style={styles.creditBadge}>
      <Crown color={isPremium ? colors.highlight : colors.primary} size={17} />
      <Text style={styles.creditBadgeText}>
        {isPremium ? "Premium · sınırsız" : `${remaining ?? 0}/3 akıllı hak`}
      </Text>
    </View>
  );
}

function TaskRow({
  currentUserId,
  highlighted,
  onCancelAlarm,
  onComplete,
  onSnooze,
  task,
  updating
}: {
  currentUserId: string;
  highlighted: boolean;
  onCancelAlarm: (assignmentId: string) => void;
  onComplete: () => void;
  onSnooze: (assignmentId: string) => void;
  task: FamilyTask;
  updating: boolean;
}) {
  const ownAssignment = task.assignments.find(
    (assignment) => assignment.user_id === currentUserId
  );
  const activeOwnAlarm =
    ownAssignment?.alarm_at &&
    ["scheduled", "sent", "snoozed"].includes(ownAssignment.alarm_status);

  return (
    <View style={[styles.taskRow, highlighted && styles.taskRowHighlighted]}>
      <Pressable
        accessibilityLabel={`${task.title} görevini tamamla`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false, disabled: updating }}
        disabled={updating}
        hitSlop={8}
        onPress={onComplete}
        style={({ pressed }) => [
          styles.taskCheck,
          pressed && styles.pressed
        ]}
      >
        <Check color={colors.textMuted} size={18} />
      </Pressable>
      <View style={styles.taskCopy}>
        <Text style={typography.label}>{task.title}</Text>
        {task.notes ? <Text style={styles.taskNotes}>{task.notes}</Text> : null}
        <View style={styles.taskMetaWrap}>
          <View style={styles.metaPill}>
            <Users color={colors.textMuted} size={14} />
            <Text style={styles.metaText}>
              {task.assignments.map((item) => item.display_name_snapshot).join(" · ") || task.assigned_to_name || "Aile"}
            </Text>
          </View>
          {task.due_at ? (
            <View style={styles.metaPill}>
              <Clock3 color={colors.textMuted} size={14} />
              <Text style={styles.metaText}>{formatDateTime(task.due_at)}</Text>
            </View>
          ) : null}
        </View>
        {activeOwnAlarm && ownAssignment ? (
          <View style={styles.taskActions}>
            <Button
              disabled={updating}
              label="10 dk ertele"
              variant="ghost"
              onPress={() => onSnooze(ownAssignment.id)}
              style={styles.smallAction}
            />
            <Button
              disabled={updating}
              label="Alarmımı kapat"
              variant="ghost"
              onPress={() => onCancelAlarm(ownAssignment.id)}
              style={styles.smallAction}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PregnancyHandover({
  loading,
  onRetry,
  onTakeOver,
  snapshot,
  takingOver
}: {
  loading: boolean;
  onRetry: () => void;
  onTakeOver: () => void;
  snapshot: PregnancySupportSnapshot | null;
  takingOver: boolean;
}) {
  if (loading) return <QueryState compact loading description="Gebelik desteği özeti hazırlanıyor…" />;
  if (!snapshot) {
    return (
      <QueryState
        compact
        description="Destek özeti alınamadı."
        onRetry={onRetry}
      />
    );
  }

  return (
    <Card style={styles.handoverCard}>
      <View style={styles.handoverOwnerRow}>
        <View style={styles.handoverPulse} />
        <View style={styles.handoverOwnerCopy}>
          <Text style={styles.handoverLabel}>Destek şu anda</Text>
          <Text style={typography.heading2}>
            {snapshot.active_session?.caregiver_name ?? "Henüz devralan yok"}
          </Text>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        <SummaryValue label="Açık ortak görev" value={String(snapshot.open_task_count ?? 0)} />
        <SummaryValue label="Hazırlık adımı" value={String(snapshot.birth_preparation_open_count ?? 0)} />
      </View>
      <View style={styles.nextStepBox}>
        <Text style={styles.nextStepLabel}>Sıradaki planlanan adım</Text>
        <Text style={typography.label}>
          {snapshot.next_task?.title ?? "Tarihli bir aile görevi eklenmedi"}
        </Text>
        {snapshot.next_alarm?.alarm_at ? (
          <Text style={styles.nextStepHint}>
            En yakın ortak alarm: {formatDateTime(snapshot.next_alarm.alarm_at)}
          </Text>
        ) : null}
        <Text style={styles.nextStepHint}>
          Bu yalnızca sizin görev ve tarih kayıtlarınıza göre sıralanır; doğum veya sağlık sonucu tahmini değildir.
        </Text>
      </View>
      <Button
        disabled={takingOver}
        label={takingOver ? "Devir eşitleniyor…" : "Desteği ben devralıyorum"}
        onPress={onTakeOver}
      />
    </Card>
  );
}

function PostpartumHandover({
  loading,
  onRetry,
  onTakeOver,
  snapshot,
  takingOver
}: {
  loading: boolean;
  onRetry: () => void;
  onTakeOver: () => void;
  snapshot: CareHandoverSnapshot | null;
  takingOver: boolean;
}) {
  if (loading) return <QueryState compact loading description="Bakım devri özeti hazırlanıyor…" />;
  if (!snapshot) {
    return (
      <QueryState compact description="Bakım özeti alınamadı." onRetry={onRetry} />
    );
  }

  return (
    <Card style={styles.handoverCard}>
      <View style={styles.handoverOwnerRow}>
        <View style={styles.handoverPulse} />
        <View style={styles.handoverOwnerCopy}>
          <Text style={styles.handoverLabel}>Bakım şu anda</Text>
          <Text style={typography.heading2}>
            {snapshot.handover?.caregiver_name ?? "Henüz devralan yok"}
          </Text>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        <SummaryValue label="Açık görev" value={String(snapshot.open_task_count ?? 0)} />
        <SummaryValue label="Aktif alarm" value={String(snapshot.active_reminder_count ?? 0)} />
      </View>
      <View style={styles.nextStepBox}>
        <Text style={styles.nextStepLabel}>Son kayıtlardan güvenli devir notu</Text>
        <Text style={styles.nextStepHint}>
          {buildPostpartumHandoverText(snapshot)}
        </Text>
      </View>
      <Button
        disabled={takingOver}
        label={takingOver ? "Devir eşitleniyor…" : "Bakımı ben devralıyorum"}
        onPress={onTakeOver}
      />
    </Card>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryValue}>
      <Text style={styles.summaryValueNumber}>{value}</Text>
      <Text style={styles.summaryValueLabel}>{label}</Text>
    </View>
  );
}

function ScopeButton({
  active,
  disabled,
  label,
  onPress
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme().theme;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.scopeButton,
        active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary },
        disabled && styles.scopeButtonDisabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Text style={[styles.scopeButtonText, active && styles.scopeButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceChip({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme().theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary },
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function buildPostpartumHandoverText(snapshot: CareHandoverSnapshot) {
  const parts: string[] = [];
  if (snapshot.last_feed?.occurred_at) {
    parts.push(`Son beslenme ${formatRelative(snapshot.last_feed.occurred_at)}`);
  }
  if (snapshot.last_diaper?.occurred_at) {
    parts.push(`son bez kaydı ${formatRelative(snapshot.last_diaper.occurred_at)}`);
  }
  if (snapshot.last_medicine?.occurred_at) {
    parts.push(`son ilaç/vitamin kaydı ${formatRelative(snapshot.last_medicine.occurred_at)}`);
  }
  return parts.length
    ? `${parts.join("; ")}. Bunlar aile tarafından girilmiş kayıtlardır.`
    : "Henüz devir özetine girecek bakım kaydı yok. Bu alan tıbbi yorum üretmez.";
}

function isPremiumRequiredReason(reason: string | null | undefined) {
  return reason === "premium_required" || reason === "free_credits_exhausted";
}

function nextRoundedHour() {
  const next = new Date(Date.now() + 60 * 60_000);
  next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
  return next;
}

function taskSortValue(task: FamilyTask) {
  const time = Date.parse(task.due_at ?? task.created_at);
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "short"
  }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Saat belirtilmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function formatRelative(value: string) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return "kayıtlı";
  const minutes = Math.max(0, Math.round((Date.now() - date) / 60_000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return formatDateTime(value);
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  topBarCopy: { flex: 1, gap: 2 },
  topBarMeta: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  hero: {
    ...radii.cardLarge,
    gap: spacing.md,
    padding: spacing.xl
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: { ...typography.body, color: colors.text },
  creditBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md
  },
  creditBadgeText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  participantRow: { gap: spacing.sm },
  participantItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 32
  },
  presenceDot: { borderRadius: radii.pill, height: 9, width: 9 },
  participantName: {
    ...typography.label,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20
  },
  participantStatus: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: "auto"
  },
  chipRail: { gap: spacing.sm, paddingRight: spacing.lg },
  sectionNav: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    padding: spacing.xs
  },
  sectionButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.sm
  },
  sectionButtonText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center"
  },
  sectionButtonTextActive: { color: colors.onPrimary },
  sectionContent: { gap: spacing.lg },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  sectionHeadingCopy: { flex: 1, gap: spacing.xs },
  sectionDescription: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  countBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    minWidth: 42,
    paddingHorizontal: spacing.sm
  },
  countBadgeText: { ...typography.dataStrong, fontSize: 18, lineHeight: 23 },
  taskList: { gap: spacing.md },
  taskRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  taskRowHighlighted: { borderColor: colors.primary, borderWidth: 1 },
  taskCheck: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  taskCopy: { flex: 1, gap: spacing.sm },
  taskNotes: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  taskMetaWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaPill: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm
  },
  metaText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  taskActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallAction: { minHeight: 44, paddingHorizontal: spacing.sm },
  completedCard: { gap: spacing.md },
  compactHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  completedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44
  },
  completedText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    textDecorationLine: "line-through"
  },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choiceChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  choiceChipText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19
  },
  choiceChipTextActive: { color: colors.onPrimary },
  formCard: { padding: spacing.xl },
  formContent: { gap: spacing.xl },
  fieldGroup: { gap: spacing.sm },
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  scopeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.sm
  },
  scopeButtonDisabled: { opacity: 0.42 },
  scopeButtonText: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  scopeButtonTextActive: { color: colors.onPrimary },
  alarmToggle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md
  },
  alarmToggleIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  alarmToggleCopy: { flex: 1, gap: 2 },
  alarmToggleHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  alarmToggleState: { ...typography.label, fontSize: 13, lineHeight: 18 },
  alarmFields: { gap: spacing.sm },
  dateButton: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm
  },
  dateButtonCopy: { flex: 1, gap: 2 },
  dateButtonLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  dateButtonValue: { ...typography.label, color: colors.text },
  warningBox: {
    alignItems: "flex-start",
    backgroundColor: colors.highlightSoft,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  warningText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  creditNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  handoverCard: { gap: spacing.lg, padding: spacing.xl },
  handoverOwnerRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  handoverPulse: {
    backgroundColor: colors.success,
    borderColor: colors.primarySoft,
    borderRadius: radii.pill,
    borderWidth: 6,
    height: 24,
    width: 24
  },
  handoverOwnerCopy: { flex: 1, gap: 2 },
  handoverLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  summaryGrid: { flexDirection: "row", gap: spacing.md },
  summaryValue: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  summaryValueNumber: { ...typography.dataStrong, fontSize: 21, lineHeight: 27 },
  summaryValueLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  nextStepBox: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingTop: spacing.lg
  },
  nextStepLabel: {
    ...typography.label,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18
  },
  nextStepHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  doctorLinkCard: { gap: spacing.lg },
  doctorLinkRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  doctorIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  doctorLinkCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.72 }
});
