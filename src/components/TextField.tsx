import type { ComponentProps } from "react";
import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing, typography } from "@/theme";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
};

export function TextField({
  containerStyle,
  label,
  onBlur,
  onFocus,
  style,
  ...inputProps
}: TextFieldProps) {
  const appTheme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const hasValue =
    typeof inputProps.value === "string" && inputProps.value.trim().length > 0;
  const floating = focused || hasValue || Boolean(inputProps.placeholder);

  return (
    <View
      style={[
        styles.wrapper,
        focused && { borderBottomColor: appTheme.primary },
        containerStyle
      ]}
    >
      <Text
        style={[
          styles.label,
          floating && styles.labelFloating,
          floating && { color: appTheme.primary }
        ]}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={appTheme.primary}
        style={[styles.input, inputProps.multiline && styles.multiline, style]}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    minHeight: 64,
    paddingTop: spacing.md
  },
  label: {
    ...typography.body,
    color: colors.textMuted,
    left: 0,
    position: "absolute",
    top: spacing.lg
  },
  labelFloating: {
    ...typography.label,
    fontSize: 14,
    lineHeight: 19,
    top: 0
  },
  input: {
    ...typography.body,
    backgroundColor: colors.transparent,
    color: colors.text,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: spacing.sm
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.sm
  }
});
