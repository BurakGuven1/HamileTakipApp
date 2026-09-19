import { Lock } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

import type { StudioConcept } from "./types";

type ConceptPickerProps = {
  concepts: StudioConcept[];
  isPremium: boolean;
  onSelect: (concept: StudioConcept) => void;
  selectedId: string;
};

/**
 * Kilitli konsept de seçilebilir: anne önce kartın nasıl duracağını görsün,
 * paywall dışa aktarmaya bastığında çıksın. Denemeden gelen kilit, kimseyi
 * premium yapmıyor.
 */
export function ConceptPicker({
  concepts,
  isPremium,
  onSelect,
  selectedId
}: ConceptPickerProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {concepts.map((concept) => {
        const active = concept.id === selectedId;
        const locked = concept.isPremium && !isPremium;

        return (
          <Pressable
            accessibilityHint={concept.description}
            accessibilityLabel={`${concept.title}${locked ? ", premium" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={concept.id}
            onPress={() => onSelect(concept)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? concept.palette.paper : colors.surface,
                borderColor: active ? concept.palette.accent : colors.border
              }
            ]}
          >
            <View style={styles.swatchRow}>
              {[concept.palette.accent, concept.palette.nature, concept.palette.accentSoft].map(
                (color) => (
                  <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
                )
              )}
              {locked ? <Lock color={colors.textMuted} size={13} /> : null}
            </View>
            <Text style={styles.chipTitle}>{concept.title}</Text>
            <Text numberOfLines={2} style={styles.chipHint}>
              {concept.description}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  chip: {
    ...radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
    width: 168
  },
  swatchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  swatch: {
    borderRadius: 999,
    height: 12,
    width: 12
  },
  chipTitle: {
    ...typography.label,
    color: colors.text
  },
  chipHint: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 17
  }
});
