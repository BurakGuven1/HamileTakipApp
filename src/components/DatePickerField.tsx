import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDate, parseDateOnly, toDateOnly } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing, typography } from "@/theme";

type DatePickerFieldProps = {
  error?: string;
  label: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onChange: (value: string) => void;
  placeholder?: string;
  value?: string | null;
};

export function DatePickerField({
  error,
  label,
  maximumDate,
  minimumDate,
  value,
  placeholder = "Tarih seç",
  onChange
}: DatePickerFieldProps) {
  const appTheme = useAppTheme();
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateOnly(value) ?? maximumDate ?? new Date();

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
    }

    if (event.type === "dismissed" || !date) {
      return;
    }

    onChange(toDateOnly(date));
  }

  return (
    <View style={styles.wrapper}>
      <Text style={typography.label}>{label}</Text>
      <Pressable
        accessibilityHint="Tarih seçiciyi açar"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        style={[styles.trigger, error && styles.triggerError]}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={[styles.valueText, !value && styles.placeholderText]}>
            {value ? formatDate(value) : placeholder}
          </Text>
          <Text style={styles.isoText}>{value ?? "YYYY-AA-GG"}</Text>
        </View>
        <CalendarDays color={appTheme.primary} size={22} />
      </Pressable>

      {open && (
        <DateTimePicker
          display={Platform.OS === "ios" ? "compact" : "default"}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode="date"
          value={selectedDate}
          onChange={handleChange}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.transparent,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  triggerError: {
    borderBottomColor: colors.danger
  },
  triggerTextWrap: {
    flex: 1,
    gap: 2
  },
  valueText: {
    ...typography.label,
    color: colors.text
  },
  placeholderText: {
    color: colors.textMuted
  },
  isoText: {
    ...typography.data,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
