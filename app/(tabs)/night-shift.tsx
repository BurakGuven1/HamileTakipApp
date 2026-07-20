import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlarmClock, ArrowLeft, Baby, BellRing, Clock3, Droplets, Milk,
  Moon, Plus, Sparkles, Square, Trash2
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { listBabies } from "@/api/babies";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { getCurrentProfile } from "@/api/profiles";
import {
  addCareJournalEntry, addCareReminder, cancelCareReminder, finishNightShift,
  getCareHandoverSnapshot, getCurrentCareUserId, getNightShiftState,
  listCareReminders, startNightShift, startSharedCareTimer, stopSharedCareTimer,
  subscribeToCareCoordination, subscribeToNightShift,
  type CareEntryType, type CareJournalEntry, type NightShiftSession
} from "@/api/careJournal";
import { createCareUuid } from "@/features/care-journal/careSync";
import {
  cancelLocalCareReminder, getCareReminderCopy, scheduleNightShiftAlarm,
} from "@/features/care-journal/reminders";
import type { NightShiftActivityInput } from "@/features/care-journal/nightShiftLiveActivity";
import { syncCareQuickWidget } from "@/features/care-journal/widgetSync";
import { useFeedback } from "@/providers/FeedbackProvider";

const palette = {
  background: "#07100E",
  surface: "#101C18",
  surfaceRaised: "#172621",
  border: "#294139",
  text: "#EDF3F0",
  muted: "#9BAEA7",
  sage: "#86AD9D",
  sageSoft: "#213B32",
  gold: "#E2BD7C",
  goldSoft: "#382E1E",
  rose: "#D49A9A"
};

export default function NightShiftScreen() {
  const params = useLocalSearchParams<{ babyId?: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [selectedBabyId, setSelectedBabyId] = useState(params.babyId);
  const [shiftEndsAt, setShiftEndsAt] = useState(nextMorning());
  const [alarmAt, setAlarmAt] = useState(nextAlarm(60));
  const [alarmType, setAlarmType] = useState<CareEntryType>("breastfeeding");
  const [alarmTitle, setAlarmTitle] = useState("");
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [showAlarmForm, setShowAlarmForm] = useState(false);
  const [showDiaperPicker, setShowDiaperPicker] = useState(false);

  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const profileQuery = useQuery({ queryKey: ["current-profile"], queryFn: getCurrentProfile });
  const membershipQuery = useQuery({ queryKey: ["current-family-membership"], queryFn: getCurrentFamilyMembership });
  const userQuery = useQuery({ queryKey: ["current-care-user-id"], queryFn: getCurrentCareUserId });
  const babies = Array.isArray(babiesQuery.data) ? babiesQuery.data : [];
  const selectedBaby = babies.find((baby) => baby.id === selectedBabyId) ?? babies[0];
  const caregiverName = membershipQuery.data
    ? profileQuery.data?.father_name || profileQuery.data?.display_name || "Baba"
    : profileQuery.data?.mother_name || profileQuery.data?.display_name || "Anne";

  const shiftQuery = useQuery({
    queryKey: ["night-shift", selectedBaby?.id],
    queryFn: () => getNightShiftState(selectedBaby!.id),
    enabled: Boolean(selectedBaby?.id),
    refetchInterval: 30_000
  });
  const snapshotQuery = useQuery({
    queryKey: ["care-handover", selectedBaby?.id],
    queryFn: () => getCareHandoverSnapshot(selectedBaby!.id),
    enabled: Boolean(selectedBaby?.id),
    refetchInterval: 30_000
  });
  const remindersQuery = useQuery({
    queryKey: ["care-reminders", selectedBaby?.id],
    queryFn: () => listCareReminders(selectedBaby!.id),
    enabled: Boolean(selectedBaby?.id)
  });

  const session = isNightShiftSession(shiftQuery.data) ? shiftQuery.data : null;
  const activeSession = session?.status === "active" ? session : null;
  const isMyShift = Boolean(activeSession && activeSession.caregiver_id === userQuery.data);
  const snapshot = snapshotQuery.data;
  const activeTimers = Array.isArray(snapshot?.active_timers) ? snapshot.active_timers : [];
  const activeSleep = activeTimers.find((timer) => timer.timer_type === "sleep") ?? null;
  const reminders = Array.isArray(remindersQuery.data) ? remindersQuery.data : [];
  const alarms = reminders.filter(
    (reminder) => reminder.alarm_kind === "night_shift" && reminder.target_user_id === userQuery.data
  );
  const latestEntries = useMemo(() => {
    const rows = [snapshot?.last_feed, snapshot?.last_diaper, snapshot?.last_sleep]
      .filter((entry): entry is CareJournalEntry => Boolean(entry?.id));
    return rows.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  }, [snapshot?.last_diaper, snapshot?.last_feed, snapshot?.last_sleep]);
  const need = probableNeed(snapshot?.last_feed ?? null, snapshot?.last_diaper ?? null, activeSleep);
  const nextShiftAlarm = [...alarms]
    .filter((alarm) => Date.parse(alarm.scheduled_for) > Date.now())
    .sort((a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for))[0];

  useEffect(() => {
    if (!selectedBaby?.id) return;
    const refresh = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["night-shift", selectedBaby.id] }),
        queryClient.invalidateQueries({ queryKey: ["care-handover", selectedBaby.id] })
      ]);
    };
    try {
      const removeShift = subscribeToNightShift(selectedBaby.id, refresh);
      const removeCare = subscribeToCareCoordination(selectedBaby.id, refresh);
      return () => {
        removeShift();
        removeCare();
      };
    } catch {
      return;
    }
  }, [queryClient, selectedBaby?.id]);

  useEffect(() => {
    if (!selectedBaby) return;
    syncCareQuickWidget(selectedBaby.id, selectedBaby.name).catch(
      () => undefined
    );
  }, [
    activeSession?.id,
    activeSession?.planned_end_at,
    activeSleep?.id,
    nextShiftAlarm?.id,
    selectedBaby?.id,
    selectedBaby?.name,
    snapshot?.last_feed?.id
  ]);

  async function refreshCare() {
    if (!selectedBaby) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["care-handover", selectedBaby.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-journal", selectedBaby.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-journal-essential", selectedBaby.id] })
    ]);
  }

  const shiftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby) throw new Error("Bebek profili gerekli.");
      if (activeSession && !isMyShift) throw new Error(`${activeSession.caregiver_name} şu anda vardiyada.`);
      if (activeSession?.summary_notification_id) {
        await cancelLocalCareReminder(activeSession.summary_notification_id).catch(() => undefined);
      }
      return startNightShift(
        selectedBaby.id,
        caregiverName,
        shiftEndsAt.toISOString(),
        null
      );
    },
    onSuccess: async (startedSession) => {
      showSuccess("Gece vardiyası sende. Alarmlar yalnızca sana yönlendirilecek.");
      if (selectedBaby && isNightShiftSession(startedSession)) {
        void updateNightShiftLiveActivity("start", buildLiveActivityInput(
          selectedBaby.id,
          selectedBaby.name,
          startedSession,
          activeSleep?.started_at ?? null,
          snapshot?.last_feed?.occurred_at ?? null,
          nextShiftAlarm?.scheduled_for ?? null
        ));
      }
      await queryClient.invalidateQueries({ queryKey: ["night-shift", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Vardiya başlatılamadı")
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("Aktif vardiya bulunamadı.");
      if (activeSession.summary_notification_id) {
        await cancelLocalCareReminder(activeSession.summary_notification_id).catch(() => undefined);
      }
      return finishNightShift(activeSession.id);
    },
    onSuccess: async (completedSession) => {
      showSuccess("Vardiya tamamlandı. Sabah özeti hazır.");
      if (selectedBaby && isNightShiftSession(completedSession)) {
        void updateNightShiftLiveActivity("end", buildLiveActivityInput(
          selectedBaby.id,
          selectedBaby.name,
          completedSession,
          activeSleep?.started_at ?? null,
          snapshot?.last_feed?.occurred_at ?? null,
          nextShiftAlarm?.scheduled_for ?? null
        ));
      }
      await queryClient.invalidateQueries({ queryKey: ["night-shift", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Vardiya bitirilemedi")
  });

  const quickMutation = useMutation({
    mutationFn: async ({ kind, diaperType = "wet" }: { kind: "feed" | "diaper" | "sleep"; diaperType?: "wet" | "dirty" | "both" }) => {
      if (!selectedBaby || !isMyShift) throw new Error("Hızlı kayıt yalnızca vardiyadaki ebeveyn tarafından eklenebilir.");
      if (kind === "sleep") {
        if (activeSleep) return stopSharedCareTimer(activeSleep, caregiverName);
        return startSharedCareTimer({
          actorName: caregiverName,
          babyId: selectedBaby.id,
          breastSide: "both",
          sleepKind: "night",
          timerType: "sleep"
        });
      }
      if (kind === "diaper") {
        return addCareJournalEntry({
          baby_id: selectedBaby.id,
          caregiver_name: caregiverName,
          diaper_type: diaperType,
          entry_type: "diaper",
          occurred_at: new Date().toISOString()
        });
      }
      const useBottle = profileQuery.data?.feeding_mode === "formula";
      return addCareJournalEntry({
        baby_id: selectedBaby.id,
        caregiver_name: caregiverName,
        breast_side: useBottle ? null : "both",
        entry_type: useBottle ? "bottle" : "breastfeeding",
        feeding_content: useBottle ? "formula" : null,
        occurred_at: new Date().toISOString()
      });
    },
    onSuccess: async (_data, { kind }) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showSuccess(kind === "sleep" ? (activeSleep ? "Uyku tamamlandı." : "Uyku başladı.") : "Gece kaydı eklendi.");
      await refreshCare();
    },
    onError: (error) => showError(error, "Kayıt eklenemedi")
  });

  const alarmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby || !userQuery.data || !isMyShift) {
        throw new Error("Alarmı yalnızca vardiyadaki ebeveyn kurabilir.");
      }
      const reminderId = createCareUuid();
      const copy = getCareReminderCopy(alarmType, selectedBaby.name);
      const localId = await scheduleNightShiftAlarm({
        babyId: selectedBaby.id,
        babyName: selectedBaby.name,
        entryType: alarmType,
        reminderId,
        scheduledFor: alarmAt,
        snoozeMinutes,
        title: alarmTitle
      });
      try {
        const { registerAndSavePushToken } = await import("@/lib/notifications");
        const pushToken = await registerAndSavePushToken().catch(() => null);
        return await addCareReminder({
          id: reminderId,
          baby_id: selectedBaby.id,
          created_by: userQuery.data,
          target_user_id: userQuery.data,
          entry_type: alarmType,
          scheduled_for: alarmAt.toISOString(),
          title: alarmTitle.trim() || copy.title,
          body: copy.body,
          local_notification_id: localId,
          creator_push_token: pushToken?.expo_push_token ?? null,
          alarm_kind: "night_shift",
          snooze_minutes: snoozeMinutes
        });
      } catch (error) {
        await cancelLocalCareReminder(localId).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async () => {
      setAlarmTitle("");
      setShowAlarmForm(false);
      setAlarmAt(nextAlarm(60));
      showSuccess("Anne+ alarmı kuruldu. Ertele ve kapat eylemleri hazır.");
      await queryClient.invalidateQueries({ queryKey: ["care-reminders", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Alarm kurulamadı")
  });

  const cancelAlarmMutation = useMutation({
    mutationFn: async (reminder: (typeof alarms)[number]) => {
      await cancelLocalCareReminder(reminder.local_notification_id).catch(() => undefined);
      return cancelCareReminder(reminder.id);
    },
    onSuccess: async () => {
      showSuccess("Alarm iptal edildi.");
      await queryClient.invalidateQueries({ queryKey: ["care-reminders", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Alarm iptal edilemedi")
  });

  if (babiesQuery.isLoading || profileQuery.isLoading || userQuery.isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={palette.sage} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Geri" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.eyebrow}>GECE VARDİYASI</Text>
            <Text style={styles.title}>{selectedBaby?.name ?? "Bebek"}</Text>
          </View>
          <Moon color={palette.gold} size={28} />
        </View>

        {babies.length > 1 ? (
          <View style={styles.chips}>
            {babies.map((baby) => <DarkChip key={baby.id} active={baby.id === selectedBaby?.id} label={baby.name} onPress={() => setSelectedBabyId(baby.id)} />)}
          </View>
        ) : null}

        <View style={[styles.shiftCard, isMyShift && styles.shiftCardActive]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardEyebrow}>{activeSession ? "VARDİYA AÇIK" : "VARDİYA KAPALI"}</Text>
              <Text style={styles.cardTitle}>{activeSession ? `${activeSession.caregiver_name} vardiyada` : "Bu gece kim vardiyada?"}</Text>
              <Text style={styles.meta}>{activeSession ? `${formatClock(activeSession.started_at)} → ${formatClock(activeSession.planned_end_at)}` : "Alarm yalnızca vardiyayı alan ebeveyne gider."}</Text>
            </View>
            <View style={[styles.statusDot, isMyShift && styles.statusDotActive]} />
          </View>
          {!activeSession || isMyShift ? (
            <>
              <Pressable onPress={() => setShowShiftPicker((value) => !value)} style={styles.timeField}>
                <Clock3 color={palette.sage} size={20} />
                <Text style={styles.timeFieldText}>Bitiş: {formatDateTime(shiftEndsAt)}</Text>
              </Pressable>
              {showShiftPicker ? <DateTimePicker value={shiftEndsAt} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} themeVariant="dark" onChange={(_, date) => { if (date) setShiftEndsAt(nextOccurrence(date)); if (Platform.OS !== "ios") setShowShiftPicker(false); }} /> : null}
              <Pressable disabled={shiftMutation.isPending || finishMutation.isPending} onPress={() => isMyShift ? finishMutation.mutate() : shiftMutation.mutate()} style={[styles.primaryButton, isMyShift && styles.endButton]}>
                {isMyShift ? <Square color="#241414" size={18} fill="#241414" /> : <Moon color="#0A1511" size={20} />}
                <Text style={[styles.primaryButtonText, isMyShift && styles.endButtonText]}>{isMyShift ? "Vardiyayı bitir" : "Vardiyayı başlat"}</Text>
              </Pressable>
            </>
          ) : <Text style={styles.notice}>Hızlı kayıtlar ve alarmlar vardiyadaki ebeveynin cihazında açık.</Text>}
        </View>

        <View style={styles.quickGrid}>
          <QuickButton disabled={!isMyShift || quickMutation.isPending} icon={<Milk color="#E7F1EC" size={32} />} label="Beslenme" onPress={() => quickMutation.mutate({ kind: "feed" })} />
          <QuickButton disabled={!isMyShift || quickMutation.isPending} icon={<Droplets color="#E7F1EC" size={32} />} label="Bez" onPress={() => setShowDiaperPicker(true)} />
          <QuickButton active={Boolean(activeSleep)} disabled={!isMyShift || quickMutation.isPending} icon={<Moon color="#E7F1EC" size={32} />} label={activeSleep ? "Uykuyu bitir" : "Uyku"} onPress={() => quickMutation.mutate({ kind: "sleep" })} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}><Clock3 color={palette.sage} size={21} /><Text style={styles.cardTitle}>En son ne oldu?</Text></View>
          {latestEntries.length ? latestEntries.map((entry) => (
            <View key={entry.id} style={styles.lastRow}>
              <Text style={styles.lastLabel}>{entryLabel(entry.entry_type)}</Text>
              <Text style={styles.lastTime}>{relativeTime(entry.occurred_at)}</Text>
            </View>
          )) : <Text style={styles.meta}>Henüz beslenme, bez veya uyku kaydı yok.</Text>}
        </View>

        <View style={[styles.card, styles.needCard]}>
          <View style={styles.cardHeader}><Sparkles color={palette.gold} size={22} /><Text style={styles.cardTitle}>Şimdi muhtemel ihtiyaç</Text></View>
          <Text style={styles.needTitle}>{need.title}</Text>
          <Text style={styles.meta}>{need.body}</Text>
          <Text style={styles.safety}>Bu kart yalnızca kayıt zamanlarına göre pratik bir tahmindir; tıbbi öneri değildir.</Text>
        </View>

        {session?.status === "completed" ? <MorningSummary session={session} /> : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>ANNE+ ALARM</Text><Text style={styles.cardTitle}>Özel gece alarmı</Text></View>
            <BellRing color={palette.gold} size={25} />
          </View>
          <Text style={styles.meta}>Telefonun Alarm uygulamasından bağımsız; özel ses, titreşim, ertele ve kapat eylemleriyle çalışır.</Text>
          {showAlarmForm ? (
            <View style={styles.form}>
              <View style={styles.chips}>
                {(["breastfeeding", "diaper", "sleep"] as CareEntryType[]).map((type) => <DarkChip key={type} active={alarmType === type} label={entryLabel(type)} onPress={() => setAlarmType(type)} />)}
              </View>
              <TextInput placeholder="Alarm başlığı (isteğe bağlı)" placeholderTextColor="#71837C" value={alarmTitle} onChangeText={setAlarmTitle} style={styles.input} />
              <View style={styles.presetRow}>{[20, 40, 60].map((minutes) => <Pressable key={minutes} onPress={() => setAlarmAt(nextAlarm(minutes))} style={styles.preset}><Text style={styles.presetText}>+{minutes} dk</Text></Pressable>)}</View>
              <Pressable onPress={() => setShowAlarmPicker((value) => !value)} style={styles.timeField}><AlarmClock color={palette.sage} size={20} /><Text style={styles.timeFieldText}>{formatDateTime(alarmAt)}</Text></Pressable>
              {showAlarmPicker ? <DateTimePicker value={alarmAt} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} themeVariant="dark" onChange={(_, date) => { if (date) setAlarmAt(nextOccurrence(date)); if (Platform.OS !== "ios") setShowAlarmPicker(false); }} /> : null}
              <View style={styles.chips}>{[5, 10, 15].map((minutes) => <DarkChip key={minutes} active={snoozeMinutes === minutes} label={`${minutes} dk ertele`} onPress={() => setSnoozeMinutes(minutes)} />)}</View>
              <Pressable disabled={!isMyShift || alarmMutation.isPending} onPress={() => alarmMutation.mutate()} style={[styles.primaryButton, !isMyShift && styles.disabled]}><BellRing color="#0A1511" size={20} /><Text style={styles.primaryButtonText}>{alarmMutation.isPending ? "Kuruluyor..." : "Alarmı kur"}</Text></Pressable>
            </View>
          ) : <Pressable disabled={!isMyShift} onPress={() => setShowAlarmForm(true)} style={[styles.secondaryButton, !isMyShift && styles.disabled]}><Plus color={palette.text} size={20} /><Text style={styles.secondaryButtonText}>Yeni alarm kur</Text></Pressable>}
          {alarms.map((alarm) => (
            <View key={alarm.id} style={styles.alarmRow}>
              <AlarmClock color={palette.sage} size={21} />
              <View style={{ flex: 1 }}><Text style={styles.alarmTitle}>{alarm.title}</Text><Text style={styles.meta}>{formatDateTime(new Date(alarm.scheduled_for))} · {alarm.snooze_minutes} dk ertele</Text></View>
              <Pressable accessibilityLabel="Alarmı sil" accessibilityRole="button" hitSlop={12} onPress={() => Alert.alert("Alarm iptal edilsin mi?", alarm.title, [{ text: "Vazgeç", style: "cancel" }, { text: "İptal et", style: "destructive", onPress: () => cancelAlarmMutation.mutate(alarm) }])}><Trash2 color={palette.rose} size={21} /></Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showDiaperPicker} onRequestClose={() => setShowDiaperPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDiaperPicker(false)}>
          <View style={styles.modalCard}>
            <Baby color={palette.sage} size={30} />
            <Text style={styles.cardTitle}>Bez kaydı</Text>
            {([['wet', 'Islak'], ['dirty', 'Kaka'], ['both', 'İkisi']] as const).map(([value, label]) => <Pressable key={value} onPress={() => { setShowDiaperPicker(false); quickMutation.mutate({ kind: "diaper", diaperType: value }); }} style={styles.modalChoice}><Text style={styles.modalChoiceText}>{label}</Text></Pressable>)}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function QuickButton({ active, disabled, icon, label, onPress }: { active?: boolean; disabled: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.quickButton, active && styles.quickButtonActive, disabled && styles.disabled]}>{icon}<Text style={styles.quickLabel}>{label}</Text>{active ? <Text style={styles.quickStatus}>ÇALIŞIYOR</Text> : null}</Pressable>;
}

function DarkChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function MorningSummary({ session }: { session: NightShiftSession }) {
  const summary = parseSummary(session.summary);
  return <View style={[styles.card, styles.summaryCard]}><Text style={styles.cardEyebrow}>VARDİYA TESLİM KARTI</Text><Text style={styles.summaryTitle}>Gece tamamlandı</Text><Text style={styles.handoverText}>{handoverSummaryLine(summary)}</Text><View style={styles.summaryGrid}><SummaryMetric value={summary.feedingCount} label="beslenme" /><SummaryMetric value={summary.diaperCount} label="bez" /><SummaryMetric value={formatDuration(summary.sleepMinutes)} label="uyku" /></View><Text style={styles.meta}>{formatClock(session.started_at)}–{formatClock(session.ended_at ?? session.planned_end_at)} · {session.caregiver_name}</Text></View>;
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function parseSummary(value: unknown) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    feedingCount: typeof item.feeding_count === "number" ? item.feeding_count : 0,
    diaperCount: typeof item.diaper_count === "number" ? item.diaper_count : 0,
    sleepMinutes: typeof item.sleep_minutes === "number" ? item.sleep_minutes : 0,
    lastFeedAt: typeof item.last_feed_at === "string" ? item.last_feed_at : null,
    activeSleepStartedAt:
      typeof item.active_sleep_started_at === "string"
        ? item.active_sleep_started_at
        : null,
    lastSleepEndedAt:
      typeof item.last_sleep_ended_at === "string"
        ? item.last_sleep_ended_at
        : null,
    nextReminderAt:
      typeof item.next_reminder_at === "string" ? item.next_reminder_at : null
  };
}

function isNightShiftSession(value: unknown): value is NightShiftSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Partial<NightShiftSession>;
  return typeof session.id === "string"
    && typeof session.baby_id === "string"
    && typeof session.caregiver_id === "string"
    && typeof session.caregiver_name === "string"
    && typeof session.started_at === "string"
    && typeof session.planned_end_at === "string"
    && (session.status === "active" || session.status === "completed");
}

async function updateNightShiftLiveActivity(
  action: "start" | "end",
  input: NightShiftActivityInput
) {
  const iosVersion = Number.parseFloat(String(Platform.Version));
  if (Platform.OS !== "ios" || !Number.isFinite(iosVersion) || iosVersion < 16.2) return;
  try {
    const activity = await import("@/features/care-journal/nightShiftLiveActivity");
    if (action === "start") {
      await activity.ensureNightShiftLiveActivity(input);
    } else {
      await activity.endNightShiftLiveActivity(input);
    }
  } catch {
    // Live Activity is optional; the night-shift screen must remain usable.
  }
}

function buildLiveActivityInput(
  babyId: string,
  babyName: string,
  session: NightShiftSession,
  activeSleepStartedAt: string | null,
  lastFeedAt: string | null,
  nextReminderAt: string | null
): NightShiftActivityInput {
  const summary = parseSummary(session.summary);
  const completed = session.status === "completed";
  const resolvedSleep = activeSleepStartedAt ?? summary.activeSleepStartedAt;
  const resolvedFeed = lastFeedAt ?? summary.lastFeedAt;
  const resolvedReminder = nextReminderAt ?? summary.nextReminderAt;
  const statusLine = completed
    ? "Teslim özeti hazır"
    : resolvedSleep
      ? `Uyku ${formatClock(resolvedSleep)}’dan beri sürüyor`
      : resolvedFeed
        ? `Son beslenme ${formatClock(resolvedFeed)}`
        : "Vardiya devam ediyor";

  return {
    babyId,
    babyName,
    caregiverName: session.caregiver_name,
    nextReminderLine: resolvedReminder
      ? `Sıradaki alarm ${formatClock(resolvedReminder)}`
      : "Planlı yeni alarm yok",
    plannedEndAt: session.planned_end_at,
    startedAt: session.started_at,
    statusLine
  };
}

function handoverSummaryLine(summary: ReturnType<typeof parseSummary>) {
  const feed = summary.lastFeedAt
    ? `Son beslenme ${formatClock(summary.lastFeedAt)}`
    : "Henüz beslenme kaydı yok";
  const sleep = summary.activeSleepStartedAt
    ? "Uyku hâlâ sürüyor"
    : summary.lastSleepEndedAt
      ? `Son uyku ${formatClock(summary.lastSleepEndedAt)}’da bitti`
      : "Devam eden uyku görünmüyor";
  const reminder = summary.nextReminderAt
    ? `Sıradaki hatırlatma ${formatClock(summary.nextReminderAt)}`
    : "Planlı yeni hatırlatma yok";
  return `${feed} · ${sleep} · ${reminder}`;
}

function probableNeed(lastFeed: CareJournalEntry | null, lastDiaper: CareJournalEntry | null, activeSleep: unknown) {
  if (activeSleep) return { title: "Uyku sürüyor", body: "Bebek uyandığında büyük Uyku butonuyla süreyi tek dokunuşta tamamlayabilirsin." };
  const feedMinutes = minutesSince(lastFeed?.occurred_at);
  const diaperMinutes = minutesSince(lastDiaper?.occurred_at);
  if (feedMinutes !== null && feedMinutes >= 150) return { title: "Beslenme kontrolü yaklaşmış olabilir", body: `Son beslenme ${relativeTime(lastFeed!.occurred_at)} kaydedildi. Bebeğin işaretlerini kontrol et.` };
  if (diaperMinutes !== null && diaperMinutes >= 150) return { title: "Bez kontrolü iyi olabilir", body: `Son bez ${relativeTime(lastDiaper!.occurred_at)} kaydedildi.` };
  return { title: "Şu an acil bir kayıt görünmüyor", body: "Bebeğin işaretlerini izlemeye devam et; ihtiyaç olduğunda büyük butonlar hazır." };
}

function nextMorning() { const date = new Date(); date.setHours(7, 0, 0, 0); if (date.getTime() <= Date.now() + 5 * 60_000) date.setDate(date.getDate() + 1); return date; }
function nextAlarm(minutes: number) { return new Date(Date.now() + minutes * 60_000); }
function nextOccurrence(value: Date) { const date = new Date(); date.setHours(value.getHours(), value.getMinutes(), 0, 0); if (date.getTime() <= Date.now() + 30_000) date.setDate(date.getDate() + 1); return date; }
function minutesSince(value?: string) { if (!value) return null; const time = Date.parse(value); return Number.isFinite(time) ? Math.max(0, Math.round((Date.now() - time) / 60_000)) : null; }
function relativeTime(value: string) { const minutes = minutesSince(value); if (minutes === null) return "zamanı bilinmiyor"; if (minutes < 1) return "şimdi"; if (minutes < 60) return `${minutes} dk önce`; return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk önce`; }
function entryLabel(type: CareEntryType) { return type === "breastfeeding" || type === "bottle" ? "Beslenme" : type === "diaper" ? "Bez" : type === "sleep" ? "Uyku" : "Bakım"; }
function formatClock(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Saat bilinmiyor";
  try {
    return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
}
function formatDateTime(value: Date) {
  if (!Number.isFinite(value.getTime())) return "Zaman bilinmiyor";
  try {
    return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
  } catch {
    return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
}
function formatDuration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours}sa ${rest ? `${rest}dk` : ""}`.trim() : `${rest}dk`; }

const styles = StyleSheet.create({
  alarmRow: { alignItems: "center", borderTopColor: palette.border, borderTopWidth: 1, flexDirection: "row", gap: 12, paddingTop: 16 },
  alarmTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 24, borderWidth: 1, gap: 14, padding: 18 },
  cardEyebrow: { color: palette.sage, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardTitle: { color: palette.text, fontSize: 20, fontWeight: "800", lineHeight: 25 },
  chip: { backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: palette.sageSoft, borderColor: palette.sage },
  chipText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: palette.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  content: { gap: 16, paddingBottom: 44, paddingHorizontal: 16, paddingTop: 10 },
  disabled: { opacity: 0.4 },
  endButton: { backgroundColor: palette.rose },
  endButtonText: { color: "#241414" },
  eyebrow: { color: palette.sage, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
  form: { gap: 14 },
  header: { alignItems: "center", flexDirection: "row", gap: 14 },
  headerTitle: { flex: 1 },
  handoverText: { color: palette.text, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  iconButton: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 18, borderWidth: 1, height: 46, justifyContent: "center", width: 46 },
  input: { backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderRadius: 16, borderWidth: 1, color: palette.text, fontSize: 16, minHeight: 52, paddingHorizontal: 15 },
  lastLabel: { color: palette.text, fontSize: 16, fontWeight: "700" },
  lastRow: { alignItems: "center", borderTopColor: palette.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  lastTime: { color: palette.muted, fontSize: 14 },
  loading: { alignItems: "center", backgroundColor: palette.background, flex: 1, justifyContent: "center" },
  meta: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.72)", flex: 1, justifyContent: "center", padding: 24 },
  modalCard: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 26, borderWidth: 1, gap: 14, padding: 22, width: "100%" },
  modalChoice: { alignItems: "center", backgroundColor: palette.surfaceRaised, borderRadius: 18, minHeight: 56, justifyContent: "center", width: "100%" },
  modalChoiceText: { color: palette.text, fontSize: 18, fontWeight: "800" },
  needCard: { backgroundColor: palette.goldSoft, borderColor: "#604C2C" },
  needTitle: { color: "#F1D9AF", fontSize: 19, fontWeight: "800" },
  notice: { color: palette.gold, fontSize: 14, lineHeight: 21 },
  preset: { alignItems: "center", backgroundColor: palette.surfaceRaised, borderRadius: 14, flex: 1, paddingVertical: 10 },
  presetRow: { flexDirection: "row", gap: 8 },
  presetText: { color: palette.text, fontSize: 13, fontWeight: "800" },
  primaryButton: { alignItems: "center", backgroundColor: palette.sage, borderRadius: 18, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 58, paddingHorizontal: 18 },
  primaryButtonText: { color: "#0A1511", fontSize: 17, fontWeight: "900" },
  quickButton: { alignItems: "center", backgroundColor: palette.sageSoft, borderColor: "#34574A", borderRadius: 23, borderWidth: 1, flex: 1, gap: 8, justifyContent: "center", minHeight: 132, padding: 10 },
  quickButtonActive: { backgroundColor: palette.goldSoft, borderColor: palette.gold },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickLabel: { color: palette.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  quickStatus: { color: palette.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  rowBetween: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  safe: { backgroundColor: palette.background, flex: 1 },
  safety: { color: "#B99F78", fontSize: 11, lineHeight: 16 },
  secondaryButton: { alignItems: "center", backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54 },
  secondaryButtonText: { color: palette.text, fontSize: 16, fontWeight: "800" },
  shiftCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 26, borderWidth: 1, gap: 14, padding: 19 },
  shiftCardActive: { borderColor: palette.sage },
  statusDot: { backgroundColor: "#53615C", borderRadius: 8, height: 12, width: 12 },
  statusDotActive: { backgroundColor: "#74D1A8", shadowColor: "#74D1A8", shadowOpacity: 0.8, shadowRadius: 8 },
  summaryCard: { backgroundColor: "#162923", borderColor: palette.sage },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryLabel: { color: palette.muted, fontSize: 12 },
  summaryMetric: { alignItems: "center", backgroundColor: palette.surface, borderRadius: 16, flex: 1, gap: 2, paddingVertical: 14 },
  summaryTitle: { color: palette.text, fontSize: 24, fontWeight: "900" },
  summaryValue: { color: palette.gold, fontSize: 20, fontWeight: "900" },
  timeField: { alignItems: "center", backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 14 },
  timeFieldText: { color: palette.text, fontSize: 15, fontWeight: "700" },
  title: { color: palette.text, fontSize: 29, fontWeight: "900", lineHeight: 34 }
});
