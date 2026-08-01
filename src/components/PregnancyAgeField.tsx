import { CalendarHeart, Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  formatDate,
  getPregnancyAgeError,
  getPregnancyDueDateFromAge
} from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

type PregnancyAgeFieldProps = {
  day: string;
  error?: string;
  onDayChange: (value: string) => void;
  onWeekChange: (value: string) => void;
  week: string;
};

function parsePart(value: string) {
  if (!/^\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

export function PregnancyAgeField({
  day,
  error,
  onDayChange,
  onWeekChange,
  week
}: PregnancyAgeFieldProps) {
  const appTheme = useAppTheme();
  const weekNumber = parsePart(week);
  const dayNumber = parsePart(day);
  const dueDate = getPregnancyDueDateFromAge(weekNumber, dayNumber);
  const ageError = getPregnancyAgeError(weekNumber, dayNumber);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={typography.label}>Şu an kaç hafta kaç günlük hamilesin?</Text>
        <Text style={styles.helper}>Hafta 1–42, gün 0–6 arasında olmalı.</Text>
      </View>

      <View style={styles.fields}>
        <AgePartField
          label="Hafta"
          max={42}
          min={1}
          onChange={onWeekChange}
          value={week}
        />
        <AgePartField
          label="Gün"
          max={weekNumber === 42 ? 0 : 6}
          min={0}
          onChange={onDayChange}
          value={day}
        />
      </View>

      {!ageError && dueDate ? (
        <View
          accessibilityLabel={`Hesaplanan tahmini doğum tarihi ${formatDate(dueDate)}`}
          style={[styles.estimate, { backgroundColor: appTheme.theme.primarySoft }]}
        >
          <View style={[styles.estimateIcon, { backgroundColor: appTheme.tint }]}>
            <CalendarHeart color={appTheme.primary} size={22} />
          </View>
          <View style={styles.estimateCopy}>
            <Text style={styles.estimateLabel}>Hesaplanan tahmini doğum tarihi</Text>
            <Text style={styles.estimateValue}>{formatDate(dueDate)}</Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function AgePartField({
  label,
  max,
  min,
  onChange,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  value: string;
}) {
  const appTheme = useAppTheme();
  const parsed = parsePart(value);

  function changeBy(delta: number) {
    const fallback = delta > 0 ? min - 1 : max + 1;
    const next = Math.max(min, Math.min(max, (parsed ?? fallback) + delta));
    onChange(String(next));
  }

  function handleTextChange(nextValue: string) {
    onChange(nextValue.replace(/\D/g, "").slice(0, 2));
  }

  return (
    <View style={styles.part}>
      <Text style={styles.partLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={`${label} değerini azalt`}
          accessibilityRole="button"
          disabled={parsed !== null && parsed <= min}
          onPress={() => changeBy(-1)}
          style={({ pressed }) => [
            styles.stepButton,
            parsed !== null && parsed <= min && styles.disabled,
            pressed && styles.pressed
          ]}
        >
          <Minus color={appTheme.primary} size={20} strokeWidth={2.4} />
        </Pressable>
        <TextInput
          accessibilityLabel={`Gebelik ${label.toLocaleLowerCase("tr-TR")} değeri`}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={handleTextChange}
          selectTextOnFocus
          style={[styles.value, { color: appTheme.primary }]}
          value={value}
        />
        <Pressable
          accessibilityLabel={`${label} değerini artır`}
          accessibilityRole="button"
          disabled={parsed !== null && parsed >= max}
          onPress={() => changeBy(1)}
          style={({ pressed }) => [
            styles.stepButton,
            parsed !== null && parsed >= max && styles.disabled,
            pressed && styles.pressed
          ]}
        >
          <Plus color={appTheme.primary} size={20} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { gap: spacing.xs },
  helper: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19
  },
  fields: {
    flexDirection: "row",
    gap: spacing.md
  },
  part: {
    flex: 1,
    gap: spacing.sm
  },
  partLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  stepper: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56
  },
  stepButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  value: {
    fontFamily: fonts.dataBold,
    fontSize: 25,
    lineHeight: 31,
    minHeight: 48,
    minWidth: 42,
    paddingHorizontal: spacing.xs,
    textAlign: "center"
  },
  estimate: {
    ...radii.card,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  estimateIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  estimateCopy: { flex: 1, gap: 2 },
  estimateLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18
  },
  estimateValue: {
    ...typography.data,
    color: colors.text,
    fontFamily: fonts.dataBold
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.62 }
});
