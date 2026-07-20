import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, Pause, Play, RotateCcw, SkipForward } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { QueryState } from "@/components/QueryState";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type ProgramId = "movement" | "breathing";
type Phase = {
  cue: string;
  duration: number;
  name: string;
  type: "exercise" | "rest";
};
type ExerciseStep = {
  cue: string;
  duration: number;
  name: string;
  rest: number;
};

const movementSteps: ExerciseStep[] = [
  {
    name: "Omuz ve boyun açma",
    cue: "Omuzlarını geriye doğru yumuşak dairelerle çevir. Nefesi tutma.",
    duration: 40,
    rest: 18
  },
  {
    name: "Kedi-deve mobilizasyonu",
    cue: "Sırtını nazikçe yuvarla ve bırak. Belini zorlamadan akıcı kal.",
    duration: 45,
    rest: 20
  },
  {
    name: "Yan esneme",
    cue: "Bir kol yukarıda, gövdeni yana doğru kontrollü uzat.",
    duration: 40,
    rest: 18
  },
  {
    name: "Pelvik tilt",
    cue: "Leğen kemiğini küçük hareketlerle öne ve arkaya yuvarla.",
    duration: 45,
    rest: 20
  },
  {
    name: "Duvar destekli squat",
    cue: "Dizlerini zorlamadan küçük aralıkta inip kalk. Dengeyi duvardan al.",
    duration: 35,
    rest: 22
  },
  {
    name: "Ayakta kalça açma",
    cue: "Desteğe tutun, dizini yana doğru küçük ve kontrollü aç.",
    duration: 40,
    rest: 18
  },
  {
    name: "Bebek nefesiyle gevşeme",
    cue: "Burnundan al, ağzından yavaşça ver. Omuzlarını yumuşat.",
    duration: 60,
    rest: 0
  }
];

const breathingSteps: ExerciseStep[] = [
  {
    name: "Hazırlan",
    cue: "Rahat otur. Bir elini göğsüne, bir elini karnına koy.",
    duration: 25,
    rest: 8
  },
  {
    name: "4 saniye nefes al",
    cue: "Burnundan sakin bir nefes al. Omuzların yükselmesin.",
    duration: 32,
    rest: 6
  },
  {
    name: "6 saniye nefes ver",
    cue: "Ağzından uzun ve kontrollü ver. Çeneni gevşet.",
    duration: 48,
    rest: 8
  },
  {
    name: "Doğum nefesi ritmi",
    cue: "Dalgayı takip eder gibi yavaş al, daha uzun ver.",
    duration: 70,
    rest: 0
  }
];

const programs: Record<ProgramId, { label: string; steps: ExerciseStep[] }> = {
  movement: { label: "Hamile egzersizi", steps: movementSteps },
  breathing: { label: "Nefes egzersizi", steps: breathingSteps }
};

export default function PregnancyExerciseScreen() {
  const accentColor = useAppTheme();
  const [programId, setProgramId] = useState<ProgramId>("movement");
  const sequence = useMemo(
    () => buildSequence(programs[programId].steps),
    [programId]
  );
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(sequence[0]?.duration ?? 0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const profile = profileQuery.data;
  const appTheme = accentColor.theme;
  const currentPhase = sequence[phaseIndex];
  const isRest = currentPhase?.type === "rest";
  const progress = currentPhase
    ? 1 - remaining / currentPhase.duration
    : 1;

  useEffect(() => {
    resetProgram();
  }, [programId]);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = withTiming(1, { duration: 120 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(isRest ? 1.08 : 1.18, {
          duration: isRest ? 1600 : 1100,
          easing: Easing.inOut(Easing.ease)
        }),
        withTiming(1, {
          duration: isRest ? 1600 : 1100,
          easing: Easing.inOut(Easing.ease)
        })
      ),
      -1,
      false
    );
  }, [isRest, pulse, phaseIndex, reducedMotion]);

  useEffect(() => {
    if (!running || completed || !currentPhase) return;

    const handle = setInterval(() => {
      setRemaining((value) => {
        if (value > 1) return value - 1;
        return 0;
      });
    }, 1000);

    return () => clearInterval(handle);
  }, [completed, currentPhase, running]);

  useEffect(() => {
    if (remaining === 0 && running && !completed) {
      goNext();
    }
  }, [remaining, running, completed]);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  function resetProgram() {
    setPhaseIndex(0);
    setRemaining(sequence[0]?.duration ?? 0);
    setRunning(false);
    setCompleted(false);
  }

  function goNext() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );

    if (phaseIndex >= sequence.length - 1) {
      setRunning(false);
      setCompleted(true);
      setRemaining(0);
      return;
    }

    const nextIndex = phaseIndex + 1;
    const nextPhase = sequence[nextIndex];
    if (!nextPhase) {
      setRunning(false);
      setCompleted(true);
      setRemaining(0);
      return;
    }

    setPhaseIndex(nextIndex);
    setRemaining(nextPhase.duration);
  }

  function toggleRunning() {
    if (completed) {
      resetProgram();
      setRunning(true);
      return;
    }
    setRunning((value) => !value);
  }

  if (profile && !profile.is_pregnant) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton />
          <EmptyState
            title="Egzersiz hamilelik profiline özel"
            description="Profilinde Hamileyim seçili olduğunda bu güvenli hareket ve nefes akışı açılır."
          />
        </View>
      </Screen>
    );
  }

  if (profileQuery.isLoading) {
    return <Screen scroll={false}><QueryState loading description="Egzersiz planı hazırlanıyor…" /></Screen>;
  }

  if (profileQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Hamilelik profilin alınamadı."
          onRetry={() => void profileQuery.refetch()}
          retrying={profileQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <BackButton />

        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <Text style={typography.eyebrow}>Kontrollü egzersiz</Text>
          <Text style={typography.heading1}>{programs[programId].label}</Text>
          <Text style={styles.heroText}>
            Hareketler genel hamilelik konforu için nazik tutuldu. Riskli gebelik,
            ağrı, kanama, baş dönmesi veya doktor kısıtlaması varsa başlamadan önce
            doktor onayı almalısın.
          </Text>
        </View>

        <View style={styles.segmentRow}>
          <SegmentButton
            active={programId === "movement"}
            label="Hareket"
            onPress={() => setProgramId("movement")}
          />
          <SegmentButton
            active={programId === "breathing"}
            label="Nefes"
            onPress={() => setProgramId("breathing")}
          />
        </View>

        <Card style={styles.playerCard}>
          <View style={{ gap: spacing.lg }}>
            <View style={styles.phaseTop}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.eyebrow}>
                  {completed
                    ? "Tamamlandı"
                    : isRest
                      ? "Mola"
                      : `${phaseIndex + 1}/${sequence.length}`}
                </Text>
                <Text style={styles.phaseTitle}>
                  {completed ? "Bugünkü akış bitti" : currentPhase?.name}
                </Text>
              </View>
              <Text style={[styles.timer, { color: appTheme.primary }]}>
                {formatSeconds(remaining)}
              </Text>
            </View>

            <View style={styles.stage}>
              <Animated.View
                style={[
                  styles.orb,
                  {
                    backgroundColor: isRest
                      ? appTheme.accentSoft
                      : appTheme.primarySoft,
                    borderColor: isRest ? appTheme.accent : appTheme.primary
                  },
                  animatedOrbStyle
                ]}
              >
                <View
                  style={[
                    styles.innerOrb,
                    { backgroundColor: isRest ? appTheme.accent : appTheme.primary }
                  ]}
                />
              </Animated.View>
              <Text style={styles.cueText}>
                {completed
                  ? "Harika. Bugünlük bu kadar yeterli; su içmeyi ve bedenini dinlemeyi unutma."
                  : currentPhase?.cue}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: appTheme.primary,
                    width: `${Math.min(100, Math.max(0, progress * 100))}%` as DimensionValue
                  }
                ]}
              />
            </View>

            <View style={styles.controls}>
              <Pressable accessibilityLabel="Egzersizi baştan başlat" accessibilityRole="button" onPress={resetProgram} style={styles.controlButton}>
                <RotateCcw color={colors.text} size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel={running ? "Egzersizi duraklat" : "Egzersizi başlat"}
                accessibilityRole="button"
                onPress={toggleRunning}
                style={[styles.playButton, { backgroundColor: appTheme.primary }]}
              >
                {running ? (
                  <Pause color={colors.onPrimary} size={28} />
                ) : (
                  <Play color={colors.onPrimary} size={28} />
                )}
              </Pressable>
              <Pressable accessibilityLabel="Sonraki harekete geç" accessibilityRole="button" onPress={goNext} style={styles.controlButton}>
                <SkipForward color={colors.text} size={22} />
              </Pressable>
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Akış planı</Text>
            {sequence.map((phase, index) => (
              <View
                key={`${phase.name}-${index}`}
                style={[
                  styles.planRow,
                  index === phaseIndex && !completed && {
                    backgroundColor: appTheme.primarySoft
                  }
                ]}
              >
                <View style={styles.planIndex}>
                  <Text style={styles.planIndexText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.planTitle}>{phase.name}</Text>
                  <Text style={typography.body}>{formatSeconds(phase.duration)}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function buildSequence(steps: ExerciseStep[]) {
  return steps.flatMap<Phase>((step, index) => {
    const phases: Phase[] = [
      {
        cue: step.cue,
        duration: step.duration,
        name: step.name,
        type: "exercise"
      }
    ];

    if (step.rest > 0 && index < steps.length - 1) {
      phases.push({
        cue: "Nefesini düzenle, su içmek istersen kısa bir yudum al.",
        duration: step.rest,
        name: "Kısa mola",
        type: "rest"
      });
    }

    return phases;
  });
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = `${total % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function BackButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.back()}>
      <View style={styles.backRow}>
        <ArrowLeft color={colors.primary} size={20} />
        <Text style={styles.backText}>Hamilelik araçlarına dön</Text>
      </View>
    </Pressable>
  );
}

function SegmentButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  backText: {
    ...typography.label,
    color: colors.primary
  },
  hero: {
    ...radii.cardLarge,
    gap: spacing.sm,
    padding: spacing.lg
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  segmentRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  segmentButtonActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: "center"
  },
  segmentTextActive: {
    color: colors.primary
  },
  playerCard: {
    overflow: "hidden"
  },
  phaseTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  phaseTitle: {
    ...typography.heading2,
    color: colors.text
  },
  timer: {
    ...typography.dataStrong,
    fontSize: 42,
    lineHeight: 48
  },
  stage: {
    alignItems: "center",
    gap: spacing.lg,
    minHeight: 270,
    justifyContent: "center"
  },
  orb: {
    alignItems: "center",
    borderRadius: 88,
    borderWidth: 2,
    height: 176,
    justifyContent: "center",
    width: 176
  },
  innerOrb: {
    borderRadius: 42,
    height: 84,
    opacity: 0.78,
    width: 84
  },
  cueText: {
    ...typography.bodyStrong,
    color: colors.text,
    textAlign: "center"
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  progressFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "center"
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  playButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 74,
    justifyContent: "center",
    width: 74
  },
  planRow: {
    ...radii.card,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  planIndex: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  planIndexText: {
    ...typography.label,
    color: colors.text
  },
  planTitle: {
    ...typography.label,
    color: colors.text
  }
});
