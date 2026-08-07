import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  EyeOff,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  isForumModerator,
  listForumModerationQueue,
  listForumSuspensions,
  reinstateForumUser,
  resolveForumReport,
  type ForumModerationQueueItem,
  type ForumReportAction
} from "@/api/forum";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type QueueStatus = ForumModerationQueueItem["status"];

export default function ForumModerationScreen() {
  const appTheme = useAppTheme();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const moderatorQuery = useQuery({
    queryKey: ["forum-moderator"],
    queryFn: isForumModerator
  });
  const queueQuery = useQuery({
    queryKey: ["forum-moderation-queue", status],
    queryFn: () => listForumModerationQueue(status),
    enabled: moderatorQuery.data === true
  });
  const suspensionsQuery = useQuery({
    queryKey: ["forum-suspensions"],
    queryFn: listForumSuspensions,
    enabled: moderatorQuery.data === true
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      action,
      report
    }: {
      action: ForumReportAction;
      report: ForumModerationQueueItem;
    }) => resolveForumReport(report.id, action, notes[report.id]),
    onSuccess: async (_, variables) => {
      setNotes((current) => ({ ...current, [variables.report.id]: "" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-moderation-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["forum-comments"] }),
        queryClient.invalidateQueries({ queryKey: ["forum-suspensions"] })
      ]);
      showSuccess(resolveActionSuccessMessage(variables.action), "Karar kaydedildi");
    },
    onError: (error) => showError(error, "Moderasyon kararı kaydedilemedi")
  });

  const reinstateMutation = useMutation({
    mutationFn: reinstateForumUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-suspensions"] });
      showSuccess("Kullanıcının forum erişimi yeniden açıldı.", "Erişim verildi");
    },
    onError: (error) => showError(error, "Forum erişimi açılamadı")
  });

  if (moderatorQuery.isPending) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Moderatör yetkisi doğrulanıyor…" shape="forum" />
      </Screen>
    );
  }

  if (moderatorQuery.isError || !moderatorQuery.data) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Bu alan yalnızca yetkili forum moderatörlerine açıktır."
          onRetry={() => void moderatorQuery.refetch()}
          retrying={moderatorQuery.isFetching}
          title="Moderatör yetkisi gerekli"
        />
      </Screen>
    );
  }

  const queue = queueQuery.data ?? [];
  const suspensions = suspensionsQuery.data ?? [];

  function confirmAction(
    report: ForumModerationQueueItem,
    action: ForumReportAction
  ) {
    const copy = resolveActionCopy(action, report.target_nickname);
    Alert.alert(copy.title, copy.description, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: copy.confirmLabel,
        style: action === "dismiss" ? "default" : "destructive",
        onPress: () => resolveMutation.mutate({ action, report })
      }
    ]);
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Foruma dön"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <ArrowLeft color={colors.text} size={23} />
          </Pressable>
          <View style={styles.topBarCopy}>
            <Text style={typography.heading2}>Moderasyon merkezi</Text>
            <Text style={styles.topBarMeta}>Raporlar karar verilene kadar burada kalır</Text>
          </View>
          <Pressable
            accessibilityLabel="Moderasyon kuyruğunu yenile"
            accessibilityRole="button"
            onPress={() => void Promise.all([queueQuery.refetch(), suspensionsQuery.refetch()])}
            style={styles.iconButton}
          >
            <RefreshCw color={appTheme.primary} size={21} />
          </Pressable>
        </View>

        <View style={[styles.trustBanner, { backgroundColor: appTheme.theme.primarySoft }]}>
          <ShieldCheck color={appTheme.primary} size={25} />
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>Rapor karar değildir</Text>
            <Text style={styles.trustText}>
              Tek rapor içeriği gizlemez. Üç farklı güncel rapor geçici karantina
              oluşturabilir; kaldırma ve hesap işlemleri yalnız senin kararınla uygulanır.
            </Text>
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.statusTabs}>
          <StatusTab active={status === "pending"} label="Bekleyen" onPress={() => setStatus("pending")} />
          <StatusTab active={status === "reviewed"} label="İşlem yapılan" onPress={() => setStatus("reviewed")} />
          <StatusTab active={status === "dismissed"} label="İhlal yok" onPress={() => setStatus("dismissed")} />
        </View>

        {queueQuery.isPending ? (
          <QueryState compact loading description="Rapor kuyruğu hazırlanıyor…" shape="forum" />
        ) : queueQuery.isError ? (
          <QueryState
            compact
            description="Raporlar alınamadı. Bağlantını kontrol edip yeniden dene."
            onRetry={() => void queueQuery.refetch()}
            retrying={queueQuery.isFetching}
            title="Kuyruk yüklenemedi"
          />
        ) : queue.length === 0 ? (
          <EmptyState
            title={status === "pending" ? "Bekleyen rapor yok" : "Bu görünümde karar yok"}
            description={status === "pending" ? "Topluluk kuyruğu şu anda temiz." : "Farklı bir karar sekmesini kontrol edebilirsin."}
          />
        ) : (
          <View style={styles.queueList}>
            {queue.map((report) => (
              <ModerationItem
                busy={resolveMutation.isPending}
                key={report.id}
                note={notes[report.id] ?? ""}
                onAction={(action) => confirmAction(report, action)}
                onNoteChange={(note) =>
                  setNotes((current) => ({ ...current, [report.id]: note }))
                }
                report={report}
              />
            ))}
          </View>
        )}

        {suspensions.length > 0 ? (
          <View style={styles.suspensionSection}>
            <View style={styles.sectionHeading}>
              <Ban color={colors.danger} size={22} />
              <View style={styles.sectionHeadingCopy}>
                <Text style={typography.heading2}>Forumdan uzaklaştırılanlar</Text>
                <Text style={styles.topBarMeta}>{suspensions.length} aktif hesap işlemi</Text>
              </View>
            </View>
            {suspensions.map((suspension) => (
              <View key={suspension.user_id} style={styles.suspensionRow}>
                <View style={styles.suspensionCopy}>
                  <Text style={typography.label}>{suspension.forum_nickname}</Text>
                  <Text numberOfLines={3} style={styles.topBarMeta}>{suspension.reason}</Text>
                </View>
                <Button
                  disabled={reinstateMutation.isPending}
                  label="Erişimi aç"
                  onPress={() =>
                    Alert.alert(
                      "Forum erişimi açılsın mı?",
                      `${suspension.forum_nickname} yeniden forumu okuyup paylaşım yapabilecek.`,
                      [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Erişimi aç",
                          onPress: () => reinstateMutation.mutate(suspension.user_id)
                        }
                      ]
                    )
                  }
                  variant="secondary"
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ModerationItem({
  busy,
  note,
  onAction,
  onNoteChange,
  report
}: {
  busy: boolean;
  note: string;
  onAction: (action: ForumReportAction) => void;
  onNoteChange: (note: string) => void;
  report: ForumModerationQueueItem;
}) {
  const appTheme = useAppTheme();
  const overdue = report.status === "pending" && Date.parse(report.review_due_at) < Date.now();
  const dismissedRatio = report.reporter_total_reports > 0
    ? report.reporter_dismissed_reports / report.reporter_total_reports
    : 0;

  return (
    <View style={styles.queueItem}>
      <View style={styles.queueMetaRow}>
        <View style={[styles.countBadge, { backgroundColor: appTheme.accentSoft }]}>
          <AlertTriangle color={appTheme.accent} size={16} />
          <Text style={[styles.countText, { color: appTheme.accent }]}>
            {report.pending_report_count} farklı rapor
          </Text>
        </View>
        <View style={styles.deadline}>
          <Clock3 color={overdue ? colors.danger : colors.textMuted} size={15} />
          <Text style={[styles.deadlineText, overdue && { color: colors.danger }]}>
            {overdue ? "Süre aşıldı" : formatDeadline(report.review_due_at)}
          </Text>
        </View>
      </View>

      <View style={styles.targetGroup}>
        <Text style={styles.targetKind}>
          {report.target_type === "post"
            ? report.post_kind === "topic" ? "Forum konusu" : "Akış paylaşımı"
            : "Yanıt / yorum"}
        </Text>
        <Text style={styles.targetTitle}>{report.target_title}</Text>
        <Text style={styles.targetAuthor}>{report.target_nickname}</Text>
        <Text numberOfLines={8} style={styles.targetContent}>{report.target_content}</Text>
      </View>

      <View style={styles.reportEvidence}>
        <Text style={styles.evidenceLabel}>Rapor nedeni</Text>
        <Text style={styles.evidenceText}>{report.reason}</Text>
        <Text style={styles.reporterSignal}>
          Raporlayan: {report.reporter_nickname ?? "Anonim"} · Toplam {report.reporter_total_reports}
          {dismissedRatio >= 0.6 ? ` · İhlal yok oranı %${Math.round(dismissedRatio * 100)}` : ""}
        </Text>
      </View>

      {report.status === "pending" ? (
        <>
          <TextField
            helperText="Karar notu isteğe bağlıdır ve denetim kaydında tutulur."
            label="Moderatör notu"
            maxLength={300}
            onChangeText={onNoteChange}
            value={note}
          />
          <View style={styles.actionGrid}>
            <Button
              disabled={busy}
              label="İhlal yok"
              onPress={() => onAction("dismiss")}
              style={styles.actionButton}
              variant="secondary"
            />
            <Button
              disabled={busy}
              label="İçeriği kaldır"
              onPress={() => onAction("remove_content")}
              style={styles.actionButton}
              variant="secondary"
            />
          </View>
          <Button
            disabled={busy}
            label="İçeriği kaldır ve forumdan uzaklaştır"
            onPress={() => onAction("remove_and_eject")}
            variant="ghost"
          />
        </>
      ) : (
        <View style={styles.resolutionRow}>
          {report.status === "dismissed" ? (
            <CheckCircle2 color={colors.success} size={20} />
          ) : (
            <EyeOff color={colors.danger} size={20} />
          )}
          <Text style={styles.resolutionText}>
            {formatModerationAction(report.moderation_action)}
          </Text>
        </View>
      )}
    </View>
  );
}

function StatusTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const appTheme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.statusTab, active && { backgroundColor: appTheme.primary }]}
    >
      <Text style={[styles.statusTabText, active && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function resolveActionCopy(action: ForumReportAction, nickname: string) {
  if (action === "dismiss") {
    return {
      confirmLabel: "İhlal yok",
      description: "Geçici karantina varsa içerik yeniden yayınlanacak ve aynı içeriğin bekleyen raporları kapatılacak.",
      title: "İçerik kurallara uygun mu?"
    };
  }
  if (action === "remove_content") {
    return {
      confirmLabel: "İçeriği kaldır",
      description: "İçerik forumdan gizlenecek; kullanıcının diğer paylaşımları ve erişimi korunacak.",
      title: "İçerik kaldırılsın mı?"
    };
  }
  return {
    confirmLabel: "Kaldır ve uzaklaştır",
    description: `${nickname} adlı kullanıcının tüm forum içerikleri gizlenecek ve forum erişimi kapatılacak.`,
    title: "Hesap forumdan uzaklaştırılsın mı?"
  };
}

function resolveActionSuccessMessage(action: ForumReportAction) {
  if (action === "dismiss") return "İhlal bulunmadı; içerik görünür durumda.";
  if (action === "remove_content") return "İçerik forumdan kaldırıldı.";
  return "İçerik kaldırıldı ve hesap forumdan uzaklaştırıldı.";
}

function formatDeadline(value: string) {
  const minutes = Math.max(0, Math.round((Date.parse(value) - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes} dk kaldı`;
  return `${Math.ceil(minutes / 60)} sa kaldı`;
}

function formatModerationAction(value: string | null) {
  if (!value) return "Karar kaydedildi";
  const [rawAction, ...noteParts] = value.split(":");
  const action = rawAction ?? "";
  const labels: Record<string, string> = {
    dismiss: "İhlal bulunmadı",
    remove_and_eject: "İçerik kaldırıldı ve hesap uzaklaştırıldı",
    remove_content: "İçerik kaldırıldı"
  };
  const note = noteParts.join(":").trim();
  return note ? `${labels[action] ?? action}: ${note}` : labels[action] ?? action;
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  actionGrid: { flexDirection: "row", gap: spacing.sm },
  container: { gap: spacing.lg },
  countBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md
  },
  countText: { ...typography.label, fontSize: 12, lineHeight: 17 },
  deadline: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  deadlineText: { ...typography.label, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  evidenceLabel: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  evidenceText: { ...typography.bodyStrong, color: colors.text },
  iconButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  queueItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  queueList: { gap: spacing.md },
  queueMetaRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  reportEvidence: { backgroundColor: colors.surfaceMuted, ...radii.card, gap: spacing.xs, padding: spacing.md },
  reporterSignal: { ...typography.body, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  resolutionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  resolutionText: { ...typography.body, color: colors.text, flex: 1 },
  sectionHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  sectionHeadingCopy: { flex: 1 },
  statusTab: { alignItems: "center", borderRadius: radii.pill, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.sm },
  statusTabText: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: "center" },
  statusTabs: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, flexDirection: "row", gap: 4, padding: 4 },
  suspensionCopy: { flex: 1, gap: 2 },
  suspensionRow: { alignItems: "center", backgroundColor: colors.surface, ...radii.card, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  suspensionSection: { gap: spacing.md, marginTop: spacing.lg },
  targetAuthor: { ...typography.label, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  targetContent: { ...typography.body, color: colors.text },
  targetGroup: { gap: spacing.xs },
  targetKind: { ...typography.label, color: colors.primary, fontSize: 12, lineHeight: 17 },
  targetTitle: { ...typography.heading3, color: colors.text },
  topBar: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  topBarCopy: { flex: 1, gap: 2 },
  topBarMeta: { ...typography.body, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  trustBanner: { ...radii.cardLarge, alignItems: "flex-start", flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  trustCopy: { flex: 1, gap: spacing.xs },
  trustText: { ...typography.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  trustTitle: { ...typography.heading3, color: colors.text }
});
