import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { AlertTriangle, Phone, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  deleteContraction,
  listContractions,
  startContraction,
  stopContraction,
  type ContractionRecord
} from "@/api/contractions";
import { getCurrentProfile } from "@/api/profiles";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { createCareUuid } from "@/features/care-journal/careSync";
import {
  CONTRACTION_RED_FLAGS,
  evaluateLaborPattern,
  formatDuration,
  type LaborPatternStatus
} from "@/features/pregnancy/contractionPattern";
import { trackEvent } from "@/lib/analytics";
import { getPregnancyWeek } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

const CONTRACTIONS_QUERY_KEY = ["pregnancy-contractions"];

export default function ContractionTimerScreen() {
  const appTheme = useAppTheme();
  const queryClient = useQueryClient();
  const { showError } = useFeedback();

  const [runningOperationId, setRunningOperationId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ruleReportedRef = useRef(false);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const contractionsQuery = useQuery({
    queryKey: CONTRACTIONS_QUERY_KEY,
    queryFn: () => listContractions(24)
  });

  const contractions = useMemo(
    () => contractionsQuery.data ?? [],
    [contractionsQuery.data]
  );

  // A contraction that is still running when the screen reopens has to stay
  // running, or a woman who backgrounded the app loses the one she is in.
  useEffect(() => {
    const open = contractions.find((entry) => entry.ended_at === null);
    setRunningOperationId(open?.client_operation_id ?? null);
  }, [contractions]);

  // The live timer only needs to tick while something is actually running.
  useEffect(() => {
    if (!runningOperationId) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningOperationId]);

  const gestationalWeek = getPregnancyWeek(profileQuery.data?.due_date);

  const assessment = useMemo(
    () =>
      evaluateLaborPattern({
        contractions: contractions.map((entry) => ({
          endedAt: entry.ended_at,
          id: entry.id,
          startedAt: entry.started_at
        })),
        gestationalWeek,
        now
      }),
    [contractions, gestationalWeek, now]
  );

  useEffect(() => {
    if (assessment.status !== "call_now" || ruleReportedRef.current) return;

    ruleReportedRef.current = true;
    void trackEvent("contraction_pattern_reached_rule", {
      contraction_count: assessment.summary.count,
      gestational_week: gestationalWeek,
      interval_sec: assessment.summary.averageIntervalSec
        ? Math.round(assessment.summary.averageIntervalSec)
        : null
    });
  }, [assessment, gestationalWeek]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: CONTRACTIONS_QUERY_KEY }),
    [queryClient]
  );

  const startMutation = useMutation({
    mutationFn: async () => {
      const operationId = createCareUuid();
      await startContraction(operationId);
      return operationId;
    },
    onSuccess: async (operationId) => {
      setRunningOperationId(operationId);
      setNow(Date.now());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await refresh();
    },
    onError: (error) => showError(error, "Kasılma başlatılamadı")
  });

  const stopMutation = useMutation({
    mutationFn: (operationId: string) => stopContraction(operationId),
    onSuccess: async () => {
      setRunningOperationId(null);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refresh();
    },
    onError: (error) => showError(error, "Kasılma bitirilemedi")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContraction(id),
    onSuccess: refresh,
    onError: (error) => showError(error, "Kayıt silinemedi")
  });

  const runningEntry = contractions.find(
    (entry) => entry.client_operation_id === runningOperationId && entry.ended_at === null
  );
  const runningSeconds = runningEntry
    ? Math.max(0, Math.round((now - Date.parse(runningEntry.started_at)) / 1000))
    : 0;

  const isBusy = startMutation.isPending || stopMutation.isPending;
  const statusTheme = getStatusTheme(assessment.status, appTheme.primary);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.eyebrow}>Kasılma sayacı</Text>
          <Text style={typography.heading1}>Ne kadar sürüyor, ne kadar arayla</Text>
          <Text style={styles.muted}>
            Her kasılma başladığında tek düğmeye bas, bittiğinde tekrar bas.
            Süreyi, aralığı ve düzeni uygulama hesaplar.
          </Text>
        </View>

        {/* One large target, because this is used mid-contraction, one-handed. */}
        <Pressable
          accessibilityHint={
            runningEntry
              ? "Kasılmanın bittiğini kaydeder"
              : "Kasılmanın başladığını kaydeder"
          }
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => {
            if (runningEntry) {
              stopMutation.mutate(runningEntry.client_operation_id);
              return;
            }
            startMutation.mutate();
          }}
          style={[
            styles.bigButton,
            {
              backgroundColor: runningEntry ? appTheme.accent : appTheme.primary,
              opacity: isBusy ? 0.7 : 1
            }
          ]}
        >
          <Text style={styles.bigButtonLabel}>
            {runningEntry ? "Kasılma bitti" : "Kasılma başladı"}
          </Text>
          {runningEntry ? (
            <Text style={styles.bigButtonTimer}>{formatDuration(runningSeconds)}</Text>
          ) : null}
        </Pressable>

        <Card style={[styles.status, { borderColor: statusTheme.border }]}>
          <View style={styles.statusHeader}>
            {assessment.status === "call_now" ? (
              <Phone color={statusTheme.border} size={22} />
            ) : null}
            <Text style={[typography.heading2, { color: statusTheme.text }]}>
              {assessment.headline}
            </Text>
          </View>
          <Text style={styles.statusDetail}>{assessment.detail}</Text>

          <View style={styles.metrics}>
            <Metric label="Son 1 saat" value={`${assessment.summary.count} kasılma`} />
            <Metric
              label="Ortalama süre"
              value={formatDuration(assessment.summary.averageDurationSec)}
            />
            <Metric
              label="Ortalama aralık"
              value={formatDuration(assessment.summary.averageIntervalSec)}
            />
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.statusHeader}>
            <AlertTriangle color={colors.danger} size={20} />
            <Text style={typography.heading2}>Sayaçtan bağımsız, hemen ara</Text>
          </View>
          {CONTRACTION_RED_FLAGS.map((flag) => (
            <Text key={flag} style={styles.flagItem}>
              {`• ${flag}`}
            </Text>
          ))}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.heading2}>Kayıtlar</Text>
          {contractions.length === 0 ? (
            <Text style={styles.muted}>
              Henüz kasılma kaydı yok. İlk kasılmada yukarıdaki düğmeye bas.
            </Text>
          ) : (
            contractions
              .slice(0, 30)
              .map((entry, index) => (
                <ContractionRow
                  disabled={deleteMutation.isPending}
                  entry={entry}
                  key={entry.id}
                  next={contractions[index + 1]}
                  onDelete={() => deleteMutation.mutate(entry.id)}
                />
              ))
          )}
        </Card>

        <Text style={styles.disclaimer}>
          Bu sayaç tıbbi bir değerlendirme değildir. 5-1-1 kuralı yaygın bir yol
          göstericidir; senin için geçerli plan hekiminin verdiği plandır.
          Tereddüt ettiğin her an aramakta serbestsin.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ContractionRow({
  disabled,
  entry,
  next,
  onDelete
}: {
  disabled: boolean;
  entry: ContractionRecord;
  next?: ContractionRecord;
  onDelete: () => void;
}) {
  const durationSec = entry.ended_at
    ? (Date.parse(entry.ended_at) - Date.parse(entry.started_at)) / 1000
    : null;
  // The list is newest first, so the previous contraction is the next row down.
  const intervalSec = next
    ? (Date.parse(entry.started_at) - Date.parse(next.started_at)) / 1000
    : null;

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTime}>
          {new Date(entry.started_at).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </Text>
        <Text style={styles.rowDetail}>
          {entry.ended_at
            ? `${formatDuration(durationSec)} sürdü`
            : "Sürüyor"}
          {intervalSec !== null ? ` · ${formatDuration(intervalSec)} sonra` : ""}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Kaydı sil"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={onDelete}
      >
        <Trash2 color={colors.textMuted} size={18} />
      </Pressable>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function getStatusTheme(status: LaborPatternStatus, primary: string) {
  if (status === "call_now") {
    return { border: colors.danger, text: colors.danger };
  }
  if (status === "monitor") {
    return { border: primary, text: colors.text };
  }
  return { border: colors.border, text: colors.text };
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl
  },
  muted: {
    ...typography.body,
    color: colors.textMuted
  },
  bigButton: {
    alignItems: "center",
    ...radii.button,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 148,
    padding: spacing.lg
  },
  bigButtonLabel: {
    ...typography.heading1,
    color: colors.surface,
    textAlign: "center"
  },
  bigButtonTimer: {
    ...typography.dataStrong,
    color: colors.surface,
    fontSize: 34,
    lineHeight: 40
  },
  status: {
    borderWidth: 2,
    gap: spacing.md
  },
  statusHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  statusDetail: {
    ...typography.body,
    color: colors.text
  },
  metrics: {
    flexDirection: "row",
    gap: spacing.md
  },
  metric: {
    flex: 1,
    gap: 2
  },
  metricLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12
  },
  metricValue: {
    ...typography.data,
    color: colors.text
  },
  flagItem: {
    ...typography.body,
    color: colors.text,
    lineHeight: 21
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  rowTime: {
    ...typography.data,
    color: colors.text
  },
  rowDetail: {
    ...typography.data,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  disclaimer: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  }
});
