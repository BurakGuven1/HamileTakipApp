import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby as BabyIcon,
  CalendarCheck,
  CheckCircle2,
  Circle,
  HeartPulse,
  Syringe
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { createBaby, listBabies, type Baby } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import {
  listVaccinationsForBaby,
  markVaccinationDone,
  markVaccinationPending,
  type BabyVaccinationWithSchedule
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { formatDate, getBabyAgeLabel, getRelativeDayLabel } from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";

type BabyGender = "kiz" | "erkek" | "belirtilmemis";
type BabySection = "profile" | "vaccines";

export default function BabyScreen() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<BabySection>("profile");
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<BabyGender>("belirtilmemis");

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const babies = babiesQuery.data ?? [];
  const selectedBaby = useMemo(
    () => babies.find((baby) => baby.id === selectedBabyId) ?? babies[0],
    [babies, selectedBabyId]
  );

  useEffect(() => {
    if (!selectedBabyId && babies[0]) {
      setSelectedBabyId(babies[0].id);
    }
  }, [babies, selectedBabyId]);

  const vaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", selectedBaby?.id],
    queryFn: () => listVaccinationsForBaby(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });

  const createBabyMutation = useMutation({
    mutationFn: async () => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error("Bebek profili icin giris yapmalisin.");
      }

      if (!name.trim() || !birthDate) {
        throw new Error("Bebek adi ve dogum tarihi gerekli.");
      }

      return createBaby({
        parent_id: profile.id,
        name: name.trim(),
        birth_date: birthDate,
        gender
      });
    },
    onSuccess: async (baby) => {
      setName("");
      setBirthDate("");
      setGender("belirtilmemis");
      setFormOpen(false);
      setSelectedBabyId(baby.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["babies"] }),
        queryClient.invalidateQueries({ queryKey: ["current-profile"] })
      ]);
    },
    onError: (error) => Alert.alert("Bebek eklenemedi", error.message)
  });

  const toggleVaccinationMutation = useMutation({
    mutationFn: async (vaccination: BabyVaccinationWithSchedule) => {
      if (vaccination.completed) {
        return markVaccinationPending(vaccination.id);
      }

      return markVaccinationDone(vaccination.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["baby-vaccinations", selectedBaby?.id]
      });
    },
    onError: (error) => Alert.alert("Asi kaydedilemedi", error.message)
  });

  const vaccinations = vaccinationsQuery.data ?? [];
  const completedCount = vaccinations.filter((item) => item.completed).length;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconBubble}>
            <BabyIcon color={colors.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Bebek ve bakim</Text>
            <Text style={typography.heading1}>Bebek profili</Text>
            <Text style={styles.heroText}>
              Bebek bilgileri, asi takvimi ve gelisim kayitlari burada tek yerde
              tutulur.
            </Text>
          </View>
        </View>

        <View style={styles.sectionSwitch}>
          <SegmentButton
            active={section === "profile"}
            label="Profil"
            onPress={() => setSection("profile")}
          />
          <SegmentButton
            active={section === "vaccines"}
            label="Asi takvimi"
            onPress={() => setSection("vaccines")}
          />
        </View>

        {babies.length > 0 ? (
          <View style={styles.babyChips}>
            {babies.map((baby) => (
              <Pressable
                key={baby.id}
                accessibilityRole="button"
                onPress={() => setSelectedBabyId(baby.id)}
                style={[
                  styles.babyChip,
                  baby.id === selectedBaby?.id && styles.babyChipActive
                ]}
              >
                <Text
                  style={[
                    styles.babyChipText,
                    baby.id === selectedBaby?.id && styles.babyChipTextActive
                  ]}
                >
                  {baby.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {section === "profile" ? (
          <View style={{ gap: spacing.lg }}>
            {selectedBaby ? (
              <Card style={styles.summaryCard}>
                <View style={{ gap: spacing.md }}>
                  <View style={styles.summaryHeader}>
                    <View>
                      <Text style={typography.heading2}>{selectedBaby.name}</Text>
                      <Text style={styles.summaryText}>
                        {getBabyAgeLabel(selectedBaby.birth_date)}
                      </Text>
                    </View>
                    <HeartPulse color={colors.accent} size={28} />
                  </View>
                  <View style={styles.infoGrid}>
                    <InfoPill label="Dogum" value={formatDate(selectedBaby.birth_date)} />
                    <InfoPill label="Cinsiyet" value={formatGender(selectedBaby.gender)} />
                    <InfoPill
                      label="Asi"
                      value={`${completedCount}/${vaccinations.length || 0} tamam`}
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <EmptyState
                title="Henuz bebek profili yok"
                description="Bebek profilini ekleyince asi takvimi otomatik olusur."
              />
            )}

            {formOpen ? (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Text style={typography.heading2}>Yeni bebek ekle</Text>
                  <TextField
                    label="Bebek adi"
                    placeholder="Orn. Deniz"
                    value={name}
                    onChangeText={setName}
                  />
                  <DatePickerField
                    label="Dogum tarihi"
                    maximumDate={new Date()}
                    placeholder="Dogum tarihini sec"
                    value={birthDate}
                    onChange={setBirthDate}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <Text style={typography.label}>Cinsiyet</Text>
                    <View style={styles.genderRow}>
                      <SegmentButton
                        active={gender === "kiz"}
                        label="Kiz"
                        onPress={() => setGender("kiz")}
                      />
                      <SegmentButton
                        active={gender === "erkek"}
                        label="Erkek"
                        onPress={() => setGender("erkek")}
                      />
                      <SegmentButton
                        active={gender === "belirtilmemis"}
                        label="Belirtmem"
                        onPress={() => setGender("belirtilmemis")}
                      />
                    </View>
                  </View>
                  <Button
                    label={
                      createBabyMutation.isPending
                        ? "Kaydediliyor..."
                        : "Bebek profilini kaydet"
                    }
                    disabled={createBabyMutation.isPending}
                    onPress={() => createBabyMutation.mutate()}
                  />
                </View>
              </Card>
            ) : (
              <Button
                label={babies.length > 0 ? "Baska bebek ekle" : "Bebek profili olustur"}
                variant={babies.length > 0 ? "secondary" : "primary"}
                onPress={() => setFormOpen(true)}
              />
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {!selectedBaby ? (
              <EmptyState
                title="Asi takvimi icin bebek profili gerekli"
                description="Bebek dogum tarihi girildiginde takvim otomatik hesaplanir."
              />
            ) : (
              <>
                <Card style={styles.vaccineSummary}>
                  <View style={styles.summaryHeader}>
                    <View style={{ gap: spacing.xs }}>
                      <Text style={typography.heading2}>Asi takvimi</Text>
                      <Text style={typography.body}>
                        {selectedBaby.name} icin {completedCount}/{vaccinations.length} asi
                        tamamlandi.
                      </Text>
                    </View>
                    <Syringe color={colors.primary} size={28} />
                  </View>
                </Card>

                {vaccinations.map((vaccination) => (
                  <Pressable
                    key={vaccination.id}
                    accessibilityRole="button"
                    disabled={toggleVaccinationMutation.isPending}
                    onPress={() => toggleVaccinationMutation.mutate(vaccination)}
                    style={[
                      styles.vaccineRow,
                      vaccination.completed && styles.vaccineRowDone
                    ]}
                  >
                    {vaccination.completed ? (
                      <CheckCircle2 color={colors.success} size={24} />
                    ) : (
                      <Circle color={colors.textMuted} size={24} />
                    )}
                    <View style={styles.vaccineCopy}>
                      <Text style={styles.vaccineTitle}>
                        {vaccination.vaccine_schedule?.vaccine_name ?? "Asi"}
                      </Text>
                      <Text style={styles.vaccineMeta}>
                        {getVaccineAgeLabel(
                          vaccination.vaccine_schedule?.recommended_age_days ?? 0
                        )}{" "}
                        / {formatDate(vaccination.scheduled_date)} /{" "}
                        {getRelativeDayLabel(vaccination.scheduled_date)}
                      </Text>
                    </View>
                    <CalendarCheck color={colors.primary} size={20} />
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

function SegmentButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatGender(gender: Baby["gender"]) {
  if (gender === "kiz") return "Kiz";
  if (gender === "erkek") return "Erkek";
  return "Belirtilmedi";
}

function getVaccineAgeLabel(days: number) {
  if (days === 0) return "Dogumda";
  if (days < 56) return `${Math.round(days / 7)}. hafta`;
  if (days < 365) return `${Math.round(days / 30)}. ay`;
  return `${Math.round(days / 365)}. yas`;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  sectionSwitch: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  segmentButtonActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13
  },
  segmentTextActive: {
    color: colors.primary
  },
  babyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  babyChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  babyChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  babyChipText: {
    ...typography.label,
    color: colors.textMuted
  },
  babyChipTextActive: {
    color: colors.surface
  },
  summaryCard: {
    backgroundColor: colors.surface
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryText: {
    ...typography.body,
    color: colors.primary
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  infoLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12
  },
  infoValue: {
    ...typography.label,
    color: colors.text
  },
  genderRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs
  },
  vaccineSummary: {
    backgroundColor: colors.primarySoft
  },
  vaccineRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  vaccineRowDone: {
    backgroundColor: "#F6FBF7",
    borderColor: colors.success
  },
  vaccineCopy: {
    flex: 1,
    gap: spacing.xs
  },
  vaccineTitle: {
    ...typography.label,
    color: colors.text
  },
  vaccineMeta: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  }
});
