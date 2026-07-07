import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDate, parseDateOnly, toDateOnly } from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";

type DatePickerFieldProps = {
  label: string;
  value?: string | null;
  maximumDate?: Date;
  minimumDate?: Date;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function DatePickerField({
  label,
  value,
  maximumDate,
  minimumDate,
  placeholder = "Tarih sec",
  onChange
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateOnly(value) ?? new Date();

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
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        style={styles.trigger}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={[styles.valueText, !value && styles.placeholderText]}>
            {value ? formatDate(value) : placeholder}
          </Text>
          <Text style={styles.isoText}>{value ?? "YYYY-AA-GG"}</Text>
        </View>
        <CalendarDays color={colors.primary} size={22} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
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
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16
  }
});
