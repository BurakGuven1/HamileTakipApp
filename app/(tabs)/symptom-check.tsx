import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { AlertTriangle, Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import {
  evaluateTriage,
  getCallChecklist,
  getSymptomsForStage,
  TRIAGE_STAGE_LABELS,
  type TriageStage,
  type TriageUrgency
} from "@/features/triage/triageRules";
import { trackEvent } from "@/lib/analytics";
import { getPregnancyWeek } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

const EMERGENCY_NUMBER = "112";

export default function SymptomCheckScreen() {
  const appTheme = useAppTheme();
  const { showError } = useFeedback();

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });

  const isPregnant = Boolean(profileQuery.data?.is_pregnant);
  const hasBaby = (babiesQuery.data ?? []).length > 0;
  const gestationalWeek = getPregnancyWeek(profileQuery.data?.due_date);

  const availableStages = useMemo(() => {
    const stages: TriageStage[] = [];
    if (isPregnant) stages.push("pregnancy");
    if (hasBaby || !isPregnant) {
      stages.push("postpartum_mother", "baby");
    }
    return stages;
  }, [hasBaby, isPregnant]);

  const [stage, setStage] = useState<TriageStage>("pregnancy");
  const [selected, setSelected] = useState<string[]>([]);

  // The default has to follow the profile, which loads after the first render.
  useEffect(() => {
    if (availableStages.length === 0) return;
    if (availableStages.includes(stage)) return;
    setStage(availableStages[0]!);
    setSelected([]);
  }, [availableStages, stage]);

  const symptoms = getSymptomsForStage(stage, gestationalWeek);
  const outcome = evaluateTriage(selected);
  const urgencyTheme = getUrgencyTheme(outcome.urgency, appTheme.primary);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function callEmergency() {
    try {
      await trackEvent("symptom_check_emergency_call_tapped", { stage });
      await Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
    } catch (error) {
      showError(error, "Arama başlatılamadı");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.eyebrow}>Bu normal mi?</Text>
          <Text style={typography.heading1}>Beklemeli mi, aramalı mısın</Text>
          <Text style={styles.muted}>
            Yaşadığın belirtileri işaretle. Uygulama teşhis koymaz; sadece bu
            belirtilerin beklemeye mi yoksa aramaya mı işaret ettiğini söyler.
          </Text>
        </View>

        <View style={styles.stageTabs}>
          {availableStages.map((item) => {
            const isActive = item === stage;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={item}
                onPress={() => {
                  setStage(item);
                  setSelected([]);
                }}
                style={[
                  styles.stageTab,
                  {
                    backgroundColor: isActive ? appTheme.tint : "transparent",
                    borderColor: isActive ? appTheme.primary : colors.border
                  }
                ]}
              >
                <Text
                  style={[
                    styles.stageTabLabel,
                    isActive ? { color: appTheme.primary, fontWeight: "700" } : null
                  ]}
                >
                  {TRIAGE_STAGE_LABELS[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.heading2}>Şu an yaşadıkların</Text>
          {symptoms.map((symptom) => {
            const isSelected = selected.includes(symptom.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                key={symptom.id}
                onPress={() => toggle(symptom.id)}
                style={[
                  styles.symptomRow,
                  isSelected
                    ? { backgroundColor: appTheme.tint, borderColor: appTheme.primary }
                    : null
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? appTheme.primary : "transparent",
                      borderColor: isSelected ? appTheme.primary : colors.border
                    }
                  ]}
                >
                  {isSelected ? <Check color={colors.surface} size={14} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.symptomLabel}>{symptom.label}</Text>
                  {symptom.note ? (
                    <Text style={styles.symptomNote}>{symptom.note}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card style={[styles.outcome, { borderColor: urgencyTheme.border }]}>
          <View style={styles.outcomeHeader}>
            {outcome.urgency === "emergency" ? (
              <AlertTriangle color={urgencyTheme.border} size={22} />
            ) : null}
            <Text style={[typography.heading2, { color: urgencyTheme.text }]}>
              {outcome.headline}
            </Text>
          </View>
          <Text style={styles.outcomeAction}>{outcome.action}</Text>

          {outcome.urgency === "emergency" ? (
            <Button
              label={`${EMERGENCY_NUMBER} ara`}
              onPress={() => void callEmergency()}
            />
          ) : null}

          {outcome.urgency && outcome.urgency !== "monitor" ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={typography.label}>Ararken hazır olsun</Text>
              {getCallChecklist(stage).map((item) => (
                <Text key={item} style={styles.checklistItem}>
                  {`• ${item}`}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        <Text style={styles.disclaimer}>
          Bu ekran bir tanı aracı değildir ve hekim muayenesinin yerini tutmaz.
          Listede olmayan ya da seni endişelendiren her durumda hekimini aramak
          doğru olandır.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function getUrgencyTheme(urgency: TriageUrgency | null, primary: string) {
  if (urgency === "emergency") {
    return { border: colors.danger, text: colors.danger };
  }
  if (urgency === "same_day") {
    return { border: primary, text: colors.text };
  }
  return { border: colors.border, text: colors.text };
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl
  },
  muted: {
    ...typography.body,
    color: colors.textMuted
  },
  stageTabs: {
    flexDirection: "row",
    gap: spacing.xs
  },
  stageTab: {
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  stageTabLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center"
  },
  symptomRow: {
    alignItems: "flex-start",
    borderColor: "transparent",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm
  },
  checkbox: {
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22
  },
  symptomLabel: {
    ...typography.body,
    color: colors.text
  },
  symptomNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  outcome: {
    borderWidth: 2,
    gap: spacing.md
  },
  outcomeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  outcomeAction: {
    ...typography.body,
    color: colors.text
  },
  checklistItem: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  disclaimer: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  }
});
