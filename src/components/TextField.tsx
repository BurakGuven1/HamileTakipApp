import type { ComponentProps } from "react";
import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing, typography } from "@/theme";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  helperText?: string;
  label: string;
};

export function TextField({
  containerStyle,
  error,
  helperText,
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
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.wrapper,
          focused && { borderBottomColor: appTheme.primary },
          error && styles.wrapperError
        ]}
      >
        <Text
          style={[
            styles.label,
            floating && styles.labelFloating,
            floating && { color: error ? colors.danger : appTheme.primary }
          ]}
        >
          {label}
        </Text>
        <TextInput
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityHint={
            inputProps.accessibilityHint ?? error ?? helperText
          }
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
      {error || helperText ? (
        <Text accessibilityLiveRegion={error ? "polite" : "none"} style={[styles.supportingText, error && styles.errorText]}>
          {error ?? helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  wrapper: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    minHeight: 64,
    paddingTop: spacing.md
  },
  wrapperError: {
    borderBottomColor: colors.danger
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
  },
  supportingText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  errorText: {
    color: colors.danger
  }
});
