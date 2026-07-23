import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing, typography } from "@/theme";

type ExpandableTextProps = {
  collapsedLines?: number;
  lessLabel?: string;
  moreLabel?: string;
  style?: StyleProp<TextStyle>;
  text: string;
};

export function ExpandableText({
  collapsedLines = 3,
  lessLabel = "Daha az göster",
  moreLabel = "Devamını gör",
  style,
  text
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotion();
  const appTheme = useAppTheme();

  return (
    <View style={styles.container}>
      <Animated.View
        key={expanded ? "expanded" : "collapsed"}
        entering={reducedMotion ? undefined : FadeIn.duration(180)}
        exiting={reducedMotion ? undefined : FadeOut.duration(120)}
      >
        <Text
          accessibilityHint={expanded ? undefined : "Metnin tamamını görmek için aşağıdaki düğmeyi kullan"}
          numberOfLines={expanded ? undefined : collapsedLines}
          style={[styles.text, style]}
        >
          {text}
        </Text>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={8}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Text style={[styles.toggleText, { color: appTheme.primary }]}>
          {expanded ? lessLabel : moreLabel}
        </Text>
        {expanded ? (
          <ChevronUp color={appTheme.primary} size={17} strokeWidth={2.4} />
        ) : (
          <ChevronDown color={appTheme.primary} size={17} strokeWidth={2.4} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  text: {
    ...typography.body,
    color: colors.text
  },
  toggle: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingRight: spacing.sm
  },
  togglePressed: {
    opacity: 0.64
  },
  toggleText: {
    ...typography.label,
    fontSize: 14,
    lineHeight: 20
  }
});
