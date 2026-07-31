import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Syringe, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AppStateStatus
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  dismissVaccineReminders,
  listActiveVaccineReminders
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { formatDate, toDateOnly } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

export function VaccineReminderGate() {
  const queryClient = useQueryClient();
  const accent = useAppTheme();
  const [userId, setUserId] = useState<string>();
  const [hiddenForEntry, setHiddenForEntry] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user.id))
      .catch(() => undefined);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id);
      setHiddenForEntry(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const remindersQuery = useQuery({
    queryKey: ["active-vaccine-reminders", userId],
    queryFn: listActiveVaccineReminders,
    enabled: Boolean(userId),
    staleTime: 0,
    retry: 2
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const enteredForeground =
        appState.current !== "active" && nextState === "active";
      appState.current = nextState;

      if (enteredForeground) {
        setHiddenForEntry(false);
        remindersQuery.refetch().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [remindersQuery.refetch]);

  const reminders = remindersQuery.data ?? [];
  const visible = Boolean(userId) && reminders.length > 0 && !hiddenForEntry;
  const hasTodayReminder = reminders.some(
    (reminder) => reminder.scheduled_date === toDateOnly(new Date())
  );

  const dismissMutation = useMutation({
    mutationFn: () => dismissVaccineReminders(reminders),
    onSuccess: async () => {
      setHiddenForEntry(true);
      await queryClient.invalidateQueries({
        queryKey: ["active-vaccine-reminders", userId]
      });
    }
  });

  function openSchedule() {
    setHiddenForEntry(true);
    router.push("/vaccines");
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => setHiddenForEntry(true)}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.icon,
                { backgroundColor: accent.theme.primarySoft }
              ]}
            >
              <Syringe color={accent.primary} size={28} />
            </View>
            <Pressable
              accessibilityLabel="Şimdilik kapat"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setHiddenForEntry(true)}
              style={styles.closeButton}
            >
              <X color={colors.textMuted} size={22} />
            </Pressable>
          </View>

          <View style={styles.copy}>
            <Text style={[typography.eyebrow, { color: accent.primary }]}>Aşı hatırlatması</Text>
            <Text style={typography.heading1}>
              {hasTodayReminder ? "Bugün aşı günü" : "Yarın aşı günü"}
            </Text>
            <Text style={styles.description}>
              Bu pencereyi kapatırsanız uygulamaya bir sonraki girişinizde iki günlük hatırlatma dönemi bitene kadar yeniden gösteririz.
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.reminderList}
            style={styles.scrollArea}
          >
            {reminders.map((reminder) => (
              <View
                key={reminder.reminder_key}
                style={[
                  styles.reminderCard,
                  { borderColor: accent.tint, backgroundColor: accent.theme.primarySoft }
                ]}
              >
                <Text style={styles.subject}>{reminder.subject_name}</Text>
                <Text style={styles.vaccine}>{reminder.vaccine_name}</Text>
                <Text style={styles.date}>
                  {formatDate(reminder.scheduled_date)}
                  {reminder.source === "pregnancy" && reminder.recommended_week_start
                    ? ` · ${reminder.recommended_week_start}-${reminder.recommended_week_end}. hafta aralığı`
                    : ""}
                </Text>
              </View>
            ))}
          </ScrollView>

          {dismissMutation.error ? (
            <Text style={styles.error}>
              Tercih kaydedilemedi. İnternet bağlantınızı kontrol edip yeniden deneyin.
            </Text>
          ) : null}

          <Text style={styles.medicalNote}>
            Tarihi ve size uygun aşı planını aile hekiminizle doğrulayın.
          </Text>

          <View style={styles.actions}>
            <Button label="Aşı merkezini aç" onPress={openSchedule} />
            <Button
              disabled={dismissMutation.isPending}
              label={
                dismissMutation.isPending
                  ? "Kaydediliyor..."
                  : "Bu 2 gün tekrar gösterme"
              }
              onPress={() => dismissMutation.mutate()}
              variant="secondary"
            />
            <Button
              label="Şimdilik kapat"
              onPress={() => setHiddenForEntry(true)}
              variant="ghost"
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(39, 33, 36, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  dialog: {
    ...radii.cardLarge,
    backgroundColor: colors.surface,
    gap: spacing.md,
    maxHeight: "92%",
    maxWidth: 520,
    padding: spacing.lg,
    width: "100%"
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44
  },
  copy: { gap: spacing.xs },
  description: {
    ...typography.body,
    color: colors.textMuted
  },
  scrollArea: { flexGrow: 0 },
  reminderList: { gap: spacing.sm },
  reminderCard: {
    ...radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  subject: { ...typography.eyebrow, color: colors.textMuted },
  vaccine: { ...typography.heading3, color: colors.text },
  date: { ...typography.label, color: colors.textMuted },
  medicalNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  error: {
    ...typography.body,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18
  },
  actions: { gap: spacing.sm }
});
