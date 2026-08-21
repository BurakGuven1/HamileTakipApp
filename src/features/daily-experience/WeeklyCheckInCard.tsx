import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, ChevronLeft, Sparkles, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { WeeklyCheckInContext } from "@/api/dailyExperience";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getWeeklyCardState } from "@/features/daily-experience/dailyExperiencePolicy";
import { colors, spacing, typography, vibrantColors } from "@/theme";

type Props = {
  context: WeeklyCheckInContext;
  pending: boolean;
  profileId: string;
  onSubmit: (input: { answers: Record<string, string>; optionalNote: string }) => void;
};

export function WeeklyCheckInCard({ context, onSubmit, pending, profileId }: Props) {
  const storageKey = useMemo(
    () => `weekly-checkin-dismissed:${profileId}:${context.weekKey}`,
    [context.weekKey, profileId]
  );
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active) setDismissed(value === "1");
      })
      .catch(() => {
        if (active) setDismissed(false);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  if (dismissed === null) return null;

  const cardState = getWeeklyCardState({
    dismissed,
    needsCheckin: context.needsCheckIn
  });
  if (cardState === "hidden") return null;

  if (cardState === "collapsed") {
    return (
      <Pressable
        accessibilityHint="Bu haftanın kısa sorularını açar"
        accessibilityLabel="Bu hafta seni tanıyalım"
        accessibilityRole="button"
        onPress={() => setDismissed(false)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card style={styles.collapsedCard}>
          <View style={styles.row}>
            <View style={styles.iconBubble}>
              <Sparkles color={colors.primary} size={20} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>HAFTALIK · 1 DAKİKA</Text>
              <Text style={styles.collapsedTitle}>Bu haftayı sana göre hazırlayalım</Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  }

  const question = context.questions[Math.min(step, context.questions.length - 1)]!;
  const isReviewStep = step >= context.questions.length;
  const progress = `${Math.min(step + 1, context.questions.length + 1)}/${context.questions.length + 1}`;

  function dismissForWeek() {
    setDismissed(true);
    AsyncStorage.setItem(storageKey, "1").catch(() => undefined);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>BU HAFTAKİ ODAĞIN</Text>
          <Text style={styles.title}>{context.title}</Text>
        </View>
        <Pressable
          accessibilityLabel="Bu hafta için küçült"
          accessibilityRole="button"
          hitSlop={10}
          onPress={dismissForWeek}
          style={styles.closeButton}
        >
          <X color={colors.textMuted} size={20} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View
          accessibilityLabel={`İlerleme ${progress}`}
          style={[
            styles.progressFill,
            { width: `${((step + 1) / (context.questions.length + 1)) * 100}%` }
          ]}
        />
      </View>

      {isReviewStep ? (
        <View style={styles.content}>
          <Text style={styles.question}>Eklemek istediğin bir şey var mı?</Text>
          <Text style={styles.helper}>İsteğe bağlı; en fazla 160 karakter.</Text>
          <TextInput
            accessibilityLabel="Bu haftaya dair isteğe bağlı not"
            editable={!pending}
            maxLength={160}
            multiline
            onChangeText={setNote}
            placeholder="Örn. Bu hafta sabahları daha zorlanıyorum"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={note}
          />
          <View style={styles.footerRow}>
            <Button
              accessibilityLabel="Önceki soruya dön"
              disabled={pending}
              label="Geri"
              onPress={() => setStep(Math.max(0, step - 1))}
              style={styles.backButton}
              variant="ghost"
            />
            <Button
              disabled={pending}
              label={pending ? "Hazırlanıyor…" : "Haftamı hazırla"}
              onPress={() => onSubmit({ answers, optionalNote: note })}
              style={styles.submitButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.question}>{question.text}</Text>
          <View style={styles.options}>
            {question.options.map((option) => {
              const selected = answers[question.id] === option.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => {
                    setAnswers((current) => ({ ...current, [question.id]: option.id }));
                    setStep((current) => Math.min(context.questions.length, current + 1));
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected ? <Check color={colors.primary} size={19} /> : null}
                </Pressable>
              );
            })}
          </View>
          {step > 0 ? (
            <Pressable
              accessibilityLabel="Önceki soruya dön"
              accessibilityRole="button"
              onPress={() => setStep((current) => Math.max(0, current - 1))}
              style={styles.inlineBack}
            >
              <ChevronLeft color={colors.primary} size={18} />
              <Text style={styles.inlineBackText}>Geri</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  backButton: { flex: 0.35 },
  card: { backgroundColor: vibrantColors.primaryLight, gap: spacing.lg },
  closeButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  collapsedCard: { backgroundColor: vibrantColors.primaryLight, paddingVertical: spacing.md },
  collapsedTitle: { ...typography.bodyStrong, fontSize: 16 },
  content: { gap: spacing.md },
  eyebrow: { ...typography.eyebrow, fontSize: 12 },
  flex: { flex: 1 },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  header: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  helper: { ...typography.body, fontSize: 14, lineHeight: 20 },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  inlineBack: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", minHeight: 44 },
  inlineBackText: { ...typography.label, color: colors.primary, fontSize: 14 },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 92,
    padding: spacing.md,
    textAlignVertical: "top"
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  optionSelected: { borderColor: colors.primary, borderWidth: 2 },
  optionText: { ...typography.label, flex: 1, fontSize: 15 },
  optionTextSelected: { color: colors.primary },
  options: { gap: spacing.sm },
  pressed: { opacity: 0.78 },
  progressFill: { backgroundColor: colors.primary, borderRadius: 3, height: 5 },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: 3, height: 5, overflow: "hidden" },
  question: { ...typography.heading3 },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  submitButton: { flex: 1 },
  title: { ...typography.heading2, marginTop: spacing.xs }
});
