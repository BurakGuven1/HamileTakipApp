import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
};

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  input: {
    minHeight: 48,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  }
});
