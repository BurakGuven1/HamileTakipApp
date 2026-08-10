import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { History, LockKeyhole, Moon, Plus, Sun } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listBabies } from "@/api/babies";
import { hasFamilyPremiumCareAccess } from "@/api/careJournal";
import { getCurrentProfile } from "@/api/profiles";
import {
  createBabySleepEvent,
  deleteBabySleepEvent,
  listBabySleepEvents,
  subscribeToBabySleepEvents,
  updateBabySleepEvent,
  type BabySleepEvent
} from "@/api/sleepRhythm";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { SleepEventSheet } from "@/features/sleep-rhythm/SleepEventSheet";
import { SleepHistorySheet } from "@/features/sleep-rhythm/SleepHistorySheet";
import {
  createRhythmSegments,
  formatDuration,
  getCurrentSleepState,
  getPredictionSampleCount,
  predictSleepRhythm,
  REQUIRED_SLEEP_SAMPLES,
  validateSleepEventCandidate,
  type SleepEventType
} from "@/features/sleep-rhythm/model";
import { sleepRhythmColors as palette } from "@/features/sleep-rhythm/palette";
import { SleepRhythmRing } from "@/features/sleep-rhythm/SleepRhythmRing";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { trackEvent } from "@/lib/analytics";
import { useFeedback } from "@/providers/FeedbackProvider";
import { radii, spacing, typography } from "@/theme";

const EVENTS_QUERY_KEY = "baby-sleep-events";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SleepRhythmScreen() {
  const { babyId, premium: previewPremiumParam, preview } = useLocalSearchParams<{ babyId?: string; premium?: string; preview?: string }>();
  const previewMode = __DEV__ && preview === "1";
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { showError, showInfo, showSuccess } = useFeedback();
  const { isPremium: accountPremium } = useSubscriptionStatus();
  const [now, setNow] = useState(Date.now());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BabySleepEvent | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [lastQuickEvent, setLastQuickEvent] = useState<BabySleepEvent | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const trackedRef = useRef(false);

  const babiesQuery = useQuery({ enabled: !previewMode, queryKey: ["babies"], queryFn: listBabies });
  const profileQuery = useQuery({ enabled: !previewMode, queryKey: ["current-profile"], queryFn: getCurrentProfile });
  const babies = previewMode ? [{ id: "preview-baby", name: "Mira" }] : (babiesQuery.data ?? []);
  const requestedBaby = babies.find((baby) => baby.id === babyId);
  const selectedBaby = requestedBaby ?? babies[0];
  const premiumFamilyQuery = useQuery({
    enabled: Boolean(!previewMode && !accountPremium && selectedBaby?.id),
    queryFn: () => hasFamilyPremiumCareAccess(selectedBaby?.id as string),
    queryKey: ["family-premium-care", selectedBaby?.id]
  });
  const isPremium = previewMode ? previewPremiumParam === "1" : accountPremium || Boolean(premiumFamilyQuery.data);
  const eventsQuery = useQuery({
    enabled: Boolean(!previewMode && selectedBaby?.id),
    queryFn: () => listBabySleepEvents(selectedBaby?.id as string),
    queryKey: [EVENTS_QUERY_KEY, selectedBaby?.id]
  });
  const previewEvents = useMemo(() => createPreviewEvents(), []);
  const events = previewMode ? previewEvents : (eventsQuery.data ?? []);
  const currentState = useMemo(() => getCurrentSleepState(events, now), [events, now]);
  const completedSleepCount = useMemo(() => getPredictionSampleCount(events, now), [events, now]);
  const prediction = useMemo(() => predictSleepRhythm(events, now), [events, now]);
  const ringSegments = useMemo(() => createRhythmSegments(events, now), [events, now]);
  const todayEvents = useMemo(
    () => [...events].filter((event) => isToday(event.occurred_at)).sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)),
    [events]
  );
  const ringSize = Math.min(370, Math.max(286, width - 36));

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (previewMode) return;
    if (trackedRef.current) return;
    trackedRef.current = true;
    void trackEvent("sleep_rhythm_opened", { life_stage: "postpartum" });
  }, [previewMode]);

  useEffect(() => {
    if (previewMode || !selectedBaby?.id || !eventsQuery.isSuccess) return;
    return subscribeToBabySleepEvents(selectedBaby.id, () => {
      void queryClient.invalidateQueries({ queryKey: [EVENTS_QUERY_KEY, selectedBaby.id] });
    });
  }, [eventsQuery.isSuccess, previewMode, queryClient, selectedBaby?.id]);

  useEffect(() => {
    if (!lastQuickEvent) return;
    const timeout = setTimeout(() => setLastQuickEvent(null), 5_000);
    return () => clearTimeout(timeout);
  }, [lastQuickEvent]);

  useEffect(() => {
    if (!highlightedEventId) return;
    const timeout = setTimeout(() => setHighlightedEventId(null), 900);
    return () => clearTimeout(timeout);
  }, [highlightedEventId]);

  const quickMutation = useMutation({
    mutationFn: async (eventType: SleepEventType) => {
      if (!selectedBaby) throw new Error("Önce bir bebek profili oluşturmalısın.");
      const occurredAt = new Date();
      const error = validateSleepEventCandidate(events, {
        event_type: eventType,
        occurred_at: occurredAt.toISOString()
      });
      if (error) throw new InvalidSleepActionError(error);
      return createBabySleepEvent({
        babyId: selectedBaby.id,
        eventType,
        occurredAt: occurredAt.toISOString(),
        source: "quick",
        timezoneOffsetMinutes: occurredAt.getTimezoneOffset()
      });
    },
    onError: (error) => {
      if (error instanceof InvalidSleepActionError) {
        setInlineMessage(error.message);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      showError(error, "Uyku kaydı eklenemedi");
    },
    onSuccess: async (event) => {
      setInlineMessage(null);
      setLastQuickEvent(event);
      setHighlightedEventId(event.id);
      queryClient.setQueryData<BabySleepEvent[]>([EVENTS_QUERY_KEY, selectedBaby?.id], (current) =>
        [...(current ?? []), event].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await trackEvent("sleep_rhythm_event_created", { event_type: event.event_type, source: "quick" });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (input: { eventId: string | null; eventType: SleepEventType; occurredAt: string; timezoneOffsetMinutes: number }) => {
      if (!selectedBaby) throw new Error("Bebek profili bulunamadı.");
      return input.eventId
        ? updateBabySleepEvent({
            eventId: input.eventId,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            timezoneOffsetMinutes: input.timezoneOffsetMinutes
          })
        : createBabySleepEvent({
            babyId: selectedBaby.id,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            source: "manual",
            timezoneOffsetMinutes: input.timezoneOffsetMinutes
          });
    },
    onError: (error) => showError(error, editingEvent ? "Uyku kaydı güncellenemedi" : "Uyku kaydı eklenemedi"),
    onSuccess: async (event) => {
      const wasEditing = Boolean(editingEvent);
      setSheetVisible(false);
      setEditingEvent(null);
      setHighlightedEventId(event.id);
      showSuccess(wasEditing ? "Uyku kaydı güncellendi." : "Uyku kaydı eklendi.");
      await queryClient.invalidateQueries({ queryKey: [EVENTS_QUERY_KEY, selectedBaby?.id] });
      await trackEvent(wasEditing ? "sleep_rhythm_event_updated" : "sleep_rhythm_event_created", {
        event_type: event.event_type,
        source: "manual"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBabySleepEvent,
    onError: (error) => showError(error, "Uyku kaydı silinemedi"),
    onSuccess: async () => {
      setSheetVisible(false);
      setEditingEvent(null);
      showSuccess("Uyku kaydı silindi.");
      await queryClient.invalidateQueries({ queryKey: [EVENTS_QUERY_KEY, selectedBaby?.id] });
    }
  });

  async function undoQuickEvent() {
    if (!lastQuickEvent) return;
    const latest = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)).at(-1);
    if (latest?.id !== lastQuickEvent.id) {
      setLastQuickEvent(null);
      showInfo("Aileden yeni bir kayıt geldiği için eski hızlı işlem güvenle geri alınamadı.", "Kayıt değişti");
      return;
    }
    try {
      await deleteBabySleepEvent(lastQuickEvent.id);
      setLastQuickEvent(null);
      await queryClient.invalidateQueries({ queryKey: [EVENTS_QUERY_KEY, selectedBaby?.id] });
      showSuccess("Son hızlı kayıt geri alındı.");
    } catch (error) {
      showError(error, "Kayıt geri alınamadı");
    }
  }

  async function openPredictionPaywall(source: "next_sleep" | "next_wake") {
    await trackEvent("sleep_rhythm_prediction_locked_tapped", {
      prediction_type: source,
      sample_count: completedSleepCount
    });
    await showPaywallIfNeeded(PREMIUM_FEATURES.sleepPrediction.source, {
      feature: `sleep_rhythm_${source}`,
      life_stage: "postpartum",
      reason: "sleep_prediction_locked",
      sample_count: completedSleepCount
    });
  }

  function openAddSheet() {
    saveMutation.reset();
    setEditingEvent(null);
    setSheetVisible(true);
  }

  function editEvent(event: BabySleepEvent) {
    saveMutation.reset();
    setHistoryVisible(false);
    setEditingEvent(event);
    setTimeout(() => setSheetVisible(true), 180);
  }

  if (!previewMode && (babiesQuery.isLoading || profileQuery.isLoading)) {
    return <Screen scroll={false}><QueryState loading description="Uyku ritmi hazırlanıyor…" /></Screen>;
  }
  if (!previewMode && (babiesQuery.isError || profileQuery.isError)) {
    return <Screen scroll={false}><QueryState title="Uyku ritmi açılamadı" description="Bebek bilgileri alınamadı." onRetry={() => void Promise.all([babiesQuery.refetch(), profileQuery.refetch()])} /></Screen>;
  }
  if (!previewMode && profileQuery.data?.is_pregnant) {
    return <Screen><EmptyState title="Uyku Ritmi doğum sonrası açılır" description="Bebeğinin uyku ve uyanıklık geçişlerini doğum sonrası profiline geçtiğinde takip edebilirsin." onActionPress={() => router.replace("/pregnancy-tools")} actionLabel="Gebelik araçlarına dön" /></Screen>;
  }
  if (!selectedBaby) {
    return <Screen><EmptyState title="Bebek profili gerekli" description="Uyku ritmini kullanmak için Bebek sekmesinden bir profil oluştur." onActionPress={() => router.push("/baby")} actionLabel="Bebek profiline git" /></Screen>;
  }
  if (!previewMode && eventsQuery.isLoading) {
    return <Screen scroll={false}><QueryState loading description={`${selectedBaby.name} için kayıtlar hazırlanıyor…`} /></Screen>;
  }
  if (!previewMode && eventsQuery.isError) {
    return <Screen scroll={false}><QueryState title="Uyku kayıtları alınamadı" description="Kayıtların silinmedi; bağlantını kontrol edip tekrar dene." onRetry={() => void eventsQuery.refetch()} /></Screen>;
  }

  const validQuickType: SleepEventType | null = currentState
    ? currentState.isSleeping ? "wake" : "sleep"
    : null;

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.navigationBar}>
          <Pressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>Uyku Ritmi</Text>
          <Pressable accessibilityLabel="Tüm uyku kayıtlarını aç" accessibilityRole="button" onPress={() => setHistoryVisible(true)} style={styles.iconButton}>
            <History color={palette.text} size={24} />
          </Pressable>
        </View>

        <Animated.View entering={reducedMotion ? undefined : FadeInUp.duration(260)} style={styles.summaryCard}>
          <View style={styles.currentRow}>
            <View style={[styles.heroIcon, { backgroundColor: currentState?.isSleeping ? palette.sleepSoft : palette.awakeSoft }]}>
              {currentState?.isSleeping ? <Moon color={palette.navy} fill={palette.navy} size={38} /> : <Sun color={palette.awake} size={40} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentLabel}>
                {currentState
                  ? `${selectedBaby.name} şu an ${currentState.isSleeping ? "uyuyor" : "uyanık"}`
                  : `${selectedBaby.name} için ilk kaydı ekle`}
              </Text>
              <Animated.Text key={currentState ? Math.floor(currentState.sinceMs / 60_000) : "empty"} entering={reducedMotion ? FadeIn.duration(100) : FadeInUp.duration(220)} style={styles.duration}>
                {currentState ? formatDuration(currentState.sinceMs) : "—"}
              </Animated.Text>
              <Text style={styles.since}>{currentState ? `${formatClock(currentState.event.occurred_at)}'den beri` : "Uyudu veya Uyandı ile başla"}</Text>
            </View>
          </View>

          <View style={styles.predictionGrid}>
            <PredictionTile
              enoughData={completedSleepCount >= REQUIRED_SLEEP_SAMPLES}
              isPremium={isPremium}
              label="Tahmini uyku"
              onLockedPress={() => void openPredictionPaywall("next_sleep")}
              prediction={prediction?.nextSleep ?? null}
              sampleCount={completedSleepCount}
              type="sleep"
            />
            <PredictionTile
              enoughData={completedSleepCount >= REQUIRED_SLEEP_SAMPLES}
              isPremium={isPremium}
              label="Tahmini uyanma"
              onLockedPress={() => void openPredictionPaywall("next_wake")}
              prediction={prediction?.nextWake ?? null}
              sampleCount={completedSleepCount}
              type="wake"
            />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(260).delay(180)} style={styles.ringSection}>
          <SleepRhythmRing events={events} reducedMotion={Boolean(reducedMotion)} segments={ringSegments} size={ringSize} />
          <View style={styles.legend}>
            <Legend color={palette.navy} label="Uyku" />
            <Legend color={palette.awake} label="Uyanık" />
          </View>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bugünün kayıtları</Text>
          <Pressable accessibilityLabel="Geçmiş uyku kaydı ekle" accessibilityRole="button" onPress={openAddSheet} style={styles.addButton}>
            <Plus color={palette.mintText} size={19} />
            <Text style={styles.addButtonText}>Kayıt ekle</Text>
          </Pressable>
        </View>

        <View style={styles.recordsCard}>
          {!todayEvents.length ? (
            <Text style={styles.emptyRecords}>Bugün henüz kayıt yok. Aşağıdan tek dokunuşla başlayabilirsin.</Text>
          ) : (
            <View style={styles.recordGrid}>
              {todayEvents.map((event, index) => (
                <EventCell
                  event={event}
                  highlighted={highlightedEventId === event.id}
                  index={index}
                  key={event.id}
                  onPress={() => editEvent(event)}
                  reducedMotion={Boolean(reducedMotion)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.quickSection}>
          <Text style={styles.quickTitle}>Şimdi tek dokunuşla kaydet</Text>
          <Text style={styles.quickHint}>Saat otomatik olarak cihazının yerel saatinden alınır.</Text>
          <View style={styles.quickControl}>
            <QuickAction
              active={validQuickType === "wake" || validQuickType === null}
              busy={quickMutation.isPending}
              color={palette.awake}
              icon={<Sun color="#FFFFFF" size={23} />}
              label="Uyandı"
              onPress={() => quickMutation.mutate("wake")}
              reducedMotion={Boolean(reducedMotion)}
            />
            <QuickAction
              active={validQuickType === "sleep" || validQuickType === null}
              busy={quickMutation.isPending}
              color={palette.navy}
              icon={<Moon color="#FFFFFF" fill="#FFFFFF" size={22} />}
              label="Uyudu"
              onPress={() => quickMutation.mutate("sleep")}
              reducedMotion={Boolean(reducedMotion)}
            />
          </View>
          {inlineMessage ? <Text accessibilityLiveRegion="polite" style={styles.inlineMessage}>{inlineMessage}</Text> : null}
        </View>

        <Pressable accessibilityRole="button" onPress={() => setHistoryVisible(true)} style={styles.historyButton}>
          <Text style={styles.historyButtonText}>Tüm kayıtları gör</Text>
          <Text style={styles.historyChevron}>›</Text>
        </Pressable>

        <Text style={styles.safetyText}>Tahminler yalnızca kaydettiğin ritimden üretilir; tıbbi öneri veya uyku güvenliği değerlendirmesi değildir.</Text>

        {lastQuickEvent ? (
          <Animated.View entering={reducedMotion ? FadeIn.duration(100) : FadeInDown.springify().damping(18)} style={styles.undoBar}>
            <Text style={styles.undoText}>Kayıt eklendi</Text>
            <Pressable accessibilityRole="button" onPress={() => void undoQuickEvent()} style={styles.undoButton}>
              <Text style={styles.undoButtonText}>Geri al</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      <SleepEventSheet
        deleting={deleteMutation.isPending}
        editingEvent={editingEvent}
        events={events}
        onClose={() => { setSheetVisible(false); setEditingEvent(null); }}
        onDelete={(event) => deleteMutation.mutate(event.id)}
        onSave={(input) => saveMutation.mutate(input)}
        saving={saveMutation.isPending}
        serverError={saveMutation.error instanceof Error ? saveMutation.error.message : null}
        visible={sheetVisible}
      />
      <SleepHistorySheet events={events} onClose={() => setHistoryVisible(false)} onSelect={editEvent} visible={historyVisible} />
    </Screen>
  );
}

function PredictionTile({ enoughData, isPremium, label, onLockedPress, prediction, sampleCount, type }: {
  enoughData: boolean;
  isPremium: boolean;
  label: string;
  onLockedPress: () => void;
  prediction: ReturnType<typeof predictSleepRhythm> extends infer R ? R extends { nextSleep: infer P } ? P | null : never : never;
  sampleCount: number;
  type: SleepEventType;
}) {
  const content = !enoughData ? (
    <><Text style={styles.predictionLearning}>{Math.min(sampleCount, REQUIRED_SLEEP_SAMPLES)}/{REQUIRED_SLEEP_SAMPLES} kayıt</Text><Text style={styles.predictionHelp}>Tahmin için birkaç uyku daha gerekli</Text></>
  ) : !isPremium ? (
    <><View style={styles.lockRow}><LockKeyhole color={palette.mintText} size={17} /><Text style={styles.lockText}>Premium</Text></View><Text style={styles.maskedTime}>••:•• – ••:••</Text><Text style={styles.predictionHelp}>Görmek için dokun</Text></>
  ) : prediction ? (
    <><Text style={styles.predictionTime}>{formatClock(prediction.startAt)}–{formatClock(prediction.endAt)}</Text><Text style={styles.predictionUncertainty}>±{prediction.uncertaintyMinutes} dk</Text></>
  ) : (
    <><Text style={styles.predictionLearning}>Örüntü gelişiyor</Text><Text style={styles.predictionHelp}>Bir sonraki geçişle yenilenecek</Text></>
  );
  return (
    <Pressable
      accessibilityLabel={`${label}. ${!enoughData ? `${sampleCount} / ${REQUIRED_SLEEP_SAMPLES} kayıt` : !isPremium ? "Premium kilitli, açmak için dokun" : prediction ? `${formatClock(prediction.startAt)} ile ${formatClock(prediction.endAt)} arası` : "Hesaplanıyor"}`}
      accessibilityRole={!isPremium && enoughData ? "button" : "text"}
      disabled={isPremium || !enoughData}
      onPress={onLockedPress}
      style={[styles.predictionTile, type === "sleep" && styles.predictionTileSleep]}
    >
      <View style={styles.predictionHeader}>
        {type === "sleep" ? <Moon color={palette.navy} size={17} /> : <Sun color={palette.awake} size={18} />}
        <Text style={styles.predictionLabel}>{label}</Text>
      </View>
      {content}
    </Pressable>
  );
}

function QuickAction({ active, busy, color, icon, label, onPress, reducedMotion }: { active: boolean; busy: boolean; color: string; icon: React.ReactNode; label: string; onPress: () => void; reducedMotion: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityHint={active ? `Şimdiki saati ${label} olarak kaydeder` : "Bu durum zaten kayıtlı"}
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      onPressIn={() => { scale.value = reducedMotion ? 1 : withTiming(0.97, { duration: 90 }); }}
      onPressOut={() => { scale.value = reducedMotion ? 1 : withSpring(1, { damping: 18, stiffness: 260 }); }}
      style={[styles.quickAction, { backgroundColor: color }, !active && styles.quickActionInactive, animatedStyle]}
    >
      {icon}
      <Text style={styles.quickActionText}>{label}</Text>
    </AnimatedPressable>
  );
}

function EventCell({ event, highlighted, index, onPress, reducedMotion }: { event: BabySleepEvent; highlighted: boolean; index: number; onPress: () => void; reducedMotion: boolean }) {
  const sleeping = event.event_type === "sleep";
  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(100) : FadeInDown.duration(260).delay(Math.min(index, 5) * 35)}
      layout={reducedMotion ? undefined : LinearTransition.springify().damping(19)}
      style={[styles.eventCell, highlighted && styles.eventCellHighlighted]}
    >
      <Pressable accessibilityLabel={`${formatClock(event.occurred_at)} ${sleeping ? "uyudu" : "uyandı"}, düzenle`} accessibilityRole="button" onPress={onPress} style={styles.eventCellPressable}>
        <View style={[styles.eventIcon, { backgroundColor: sleeping ? palette.sleepSoft : palette.awakeSoft }]}>
          {sleeping ? <Moon color={palette.navy} size={21} /> : <Sun color={palette.awake} size={22} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTime}>{formatClock(event.occurred_at)}</Text>
          <Text style={styles.eventType}>{sleeping ? "Uyudu" : "Uyandı"}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", hour12: false, minute: "2-digit" }).format(new Date(value));
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function createPreviewEvents(): BabySleepEvent[] {
  const now = new Date();
  const definitions: Array<[number, number, number, SleepEventType]> = [];
  for (let dayOffset = 7; dayOffset >= 1; dayOffset -= 1) {
    definitions.push([dayOffset, 7, 30, "wake"], [dayOffset, 11, 55, "sleep"], [dayOffset, 14, 5, "wake"]);
  }
  definitions.push(
    [0, 3, 7, "wake"],
    [0, 5, 8, "sleep"]
  );
  return definitions.map(([dayOffset, hour, minute, type], index) => {
    const occurred = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, hour, minute, 0, 0);
    return {
      baby_id: "preview-baby",
      created_at: occurred.toISOString(),
      created_by: "preview-user",
      event_type: type,
      id: `preview-${index}`,
      occurred_at: occurred.toISOString(),
      source: "manual",
      timezone_offset_minutes: occurred.getTimezoneOffset(),
      updated_at: occurred.toISOString()
    };
  });
}

class InvalidSleepActionError extends Error {}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  navigationBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  iconButton: { alignItems: "center", borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  backGlyph: { color: palette.text, fontFamily: "Manrope_400Regular", fontSize: 42, lineHeight: 44 },
  navTitle: { ...typography.heading2, color: palette.text, fontSize: 25 },
  summaryCard: { backgroundColor: palette.ivory, borderColor: palette.border, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, gap: spacing.lg, padding: spacing.lg, shadowColor: palette.text, shadowOffset: { height: 12, width: 0 }, shadowOpacity: 0.07, shadowRadius: 24 },
  currentRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  heroIcon: { alignItems: "center", borderRadius: 28, height: 78, justifyContent: "center", width: 78 },
  currentLabel: { ...typography.heading3, color: palette.text },
  duration: { color: palette.text, fontFamily: "Manrope_700Bold", fontSize: 34, lineHeight: 42, minWidth: 190 },
  since: { ...typography.body, color: palette.muted },
  predictionGrid: { flexDirection: "row", gap: spacing.sm },
  predictionTile: { backgroundColor: palette.mint, borderColor: palette.mintBorder, borderRadius: radii.lg, borderWidth: 1, flex: 1, gap: 4, minHeight: 128, padding: spacing.md },
  predictionTileSleep: { backgroundColor: "#F2F2FA", borderColor: "#DCDDEF" },
  predictionHeader: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  predictionLabel: { color: palette.mintText, fontFamily: "Manrope_600SemiBold", fontSize: 14 },
  predictionLearning: { color: palette.text, fontFamily: "Manrope_700Bold", fontSize: 17, marginTop: spacing.xs },
  predictionHelp: { color: palette.muted, fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 17 },
  lockRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  lockText: { color: palette.mintText, fontFamily: "Manrope_700Bold", fontSize: 14 },
  maskedTime: { color: palette.text, fontFamily: "SpaceMono_700Bold", fontSize: 15 },
  predictionTime: { color: palette.mintText, fontFamily: "SpaceMono_700Bold", fontSize: 16, marginTop: spacing.xs },
  predictionUncertainty: { color: palette.mintText, fontFamily: "Manrope_600SemiBold", fontSize: 13 },
  ringSection: { alignItems: "center", marginHorizontal: -spacing.md },
  legend: { flexDirection: "row", gap: spacing.xl, justifyContent: "center" },
  legendItem: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  legendLine: { borderRadius: radii.pill, height: 10, width: 42 },
  legendText: { ...typography.body, color: palette.muted },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { ...typography.heading2, color: palette.text },
  addButton: { alignItems: "center", backgroundColor: palette.mint, borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.md },
  addButtonText: { ...typography.label, color: palette.mintText, fontSize: 14 },
  recordsCard: { backgroundColor: palette.ivory, borderColor: palette.border, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, minHeight: 96, padding: spacing.md },
  emptyRecords: { ...typography.body, color: palette.muted, padding: spacing.sm, textAlign: "center" },
  recordGrid: { flexDirection: "row", flexWrap: "wrap" },
  eventCell: { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, width: "50%" },
  eventCellHighlighted: { backgroundColor: palette.mint },
  eventCellPressable: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 72, padding: spacing.sm },
  eventIcon: { alignItems: "center", borderRadius: radii.pill, height: 42, justifyContent: "center", width: 42 },
  eventTime: { color: palette.text, fontFamily: "Manrope_700Bold", fontSize: 17 },
  eventType: { color: palette.muted, fontFamily: "Manrope_400Regular", fontSize: 14 },
  quickSection: { gap: spacing.sm },
  quickTitle: { ...typography.heading2, color: palette.text },
  quickHint: { ...typography.body, color: palette.muted, fontSize: 14, lineHeight: 20 },
  quickControl: { backgroundColor: "#EFEAE6", borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  quickAction: { alignItems: "center", borderRadius: radii.pill, flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 56 },
  quickActionInactive: { opacity: 0.32 },
  quickActionText: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 17 },
  inlineMessage: { ...typography.bodyStrong, color: palette.awake, fontSize: 14, lineHeight: 20 },
  historyButton: { alignItems: "center", backgroundColor: palette.ivory, borderColor: palette.border, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 64, paddingHorizontal: spacing.lg },
  historyButtonText: { ...typography.label, color: palette.mintText },
  historyChevron: { color: palette.mintText, fontFamily: "Manrope_400Regular", fontSize: 34 },
  safetyText: { ...typography.body, color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  undoBar: { alignItems: "center", backgroundColor: palette.text, borderRadius: radii.lg, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  undoText: { ...typography.label, color: "#FFFFFF" },
  undoButton: { alignItems: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  undoButtonText: { ...typography.label, color: "#AEE2D1" }
});
