import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Link, useLocalSearchParams } from "expo-router";
import {
  Baby as BabyIcon,
  CalendarCheck,
  CheckCircle2,
  Circle,
  HeartPulse,
  Trash2,
  Syringe
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createBaby, listBabies, updateBaby, type Baby } from "@/api/babies";
import {
  addGrowthRecord,
  deleteGrowthRecord,
  listGrowthRecords,
  updateGrowthRecord,
  type GrowthRecord
} from "@/api/growthRecords";
import { getCurrentProfile } from "@/api/profiles";
import {
  listVaccinationsForBaby,
  markVaccinationDone,
  markVaccinationPending,
  updateVaccinationNotes,
  type BabyVaccinationWithSchedule
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Thread } from "@/components/Thread";
import {
  formatDate,
  getBabyAgeLabel,
  getRelativeDayLabel,
  toDateOnly
} from "@/lib/dates";
import { resolveAccentColor } from "@/hooks/useAccentColor";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type BabyGender = "kiz" | "erkek" | "belirtilmemis";
type BabySection = "profile" | "vaccines" | "growth";

export default function BabyScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [section, setSection] = useState<BabySection>("profile");
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<BabyGender>("belirtilmemis");
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<BabyGender>("belirtilmemis");
  const [growthDate, setGrowthDate] = useState(toDateOnly(new Date()));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [headCircumference, setHeadCircumference] = useState("");
  const [growthNotes, setGrowthNotes] = useState("");
  const [editingVaccinationId, setEditingVaccinationId] = useState<string>();
  const [vaccinationNotes, setVaccinationNotes] = useState("");
  const [editingGrowthRecordId, setEditingGrowthRecordId] = useState<string>();
  const [editGrowthDate, setEditGrowthDate] = useState(toDateOnly(new Date()));
  const [editWeight, setEditWeight] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editHeadCircumference, setEditHeadCircumference] = useState("");
  const [editGrowthNotes, setEditGrowthNotes] = useState("");

  useEffect(() => {
    if (
      params.section === "profile" ||
      params.section === "vaccines" ||
      params.section === "growth"
    ) {
      setSection(params.section);
    }
  }, [params.section]);

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
  const accentColor = useMemo(
    () =>
      resolveAccentColor({
        babies: selectedBaby ? [selectedBaby] : babies,
        profile: profileQuery.data
      }),
    [babies, profileQuery.data, selectedBaby]
  );
  const appTheme = accentColor.theme;

  useEffect(() => {
    if (!selectedBabyId && babies[0]) {
      setSelectedBabyId(babies[0].id);
    }
  }, [babies, selectedBabyId]);

  useEffect(() => {
    if (!selectedBaby) return;
    setEditName(selectedBaby.name);
    setEditBirthDate(selectedBaby.birth_date);
    setEditGender((selectedBaby.gender ?? "belirtilmemis") as BabyGender);
  }, [selectedBaby]);

  const vaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", selectedBaby?.id],
    queryFn: () => listVaccinationsForBaby(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });

  const growthQuery = useQuery({
    queryKey: ["growth-records", selectedBaby?.id],
    queryFn: () => listGrowthRecords(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });

  const createBabyMutation = useMutation({
    mutationFn: async () => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error("Bebek profili için giriş yapmalısın.");
      }

      if (!name.trim() || !birthDate) {
        throw new Error("Bebek adı ve doğum tarihi gerekli.");
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
    onError: (error) => showError(error, "Bebek eklenemedi")
  });

  const updateBabyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby) {
        throw new Error("Bebek profili seçilmedi.");
      }

      if (!editName.trim() || !editBirthDate) {
        throw new Error("Bebek adı ve doğum tarihi gerekli.");
      }

      return updateBaby(selectedBaby.id, {
        name: editName.trim(),
        birth_date: editBirthDate,
        gender: editGender
      });
    },
    onSuccess: async () => {
      setEditOpen(false);
      showSuccess("Bebek bilgileri güncellendi.");
      await queryClient.invalidateQueries({ queryKey: ["babies"] });
    },
    onError: (error) => showError(error, "Bebek güncellenemedi")
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      showSuccess("Aşı durumu güncellendi.");
    },
    onError: (error) => showError(error, "Aşı kaydedilemedi")
  });

  const updateVaccinationNotesMutation = useMutation({
    mutationFn: async () => {
      if (!editingVaccinationId) {
        throw new Error("Aşı seçilmedi.");
      }

      return updateVaccinationNotes(
        editingVaccinationId,
        vaccinationNotes.trim() || null
      );
    },
    onSuccess: async () => {
      setEditingVaccinationId(undefined);
      setVaccinationNotes("");
      showSuccess("Aşı notu kaydedildi.");
      await queryClient.invalidateQueries({
        queryKey: ["baby-vaccinations", selectedBaby?.id]
      });
    },
    onError: (error) => showError(error, "Aşı notu kaydedilemedi")
  });

  const createGrowthMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby) {
        throw new Error("Büyüme kaydı için bebek profili gerekli.");
      }

      const nextWeight = toOptionalNumber(weight);
      const nextHeight = toOptionalNumber(height);
      const nextHead = toOptionalNumber(headCircumference);

      if (!nextWeight && !nextHeight && !nextHead) {
        throw new Error("En az bir ölçüm değeri girmelisin.");
      }

      return addGrowthRecord({
        baby_id: selectedBaby.id,
        record_date: growthDate,
        weight_kg: nextWeight,
        height_cm: nextHeight,
        head_circumference_cm: nextHead,
        notes: growthNotes.trim() || null
      });
    },
    onSuccess: async () => {
      setWeight("");
      setHeight("");
      setHeadCircumference("");
      setGrowthNotes("");
      setGrowthDate(toDateOnly(new Date()));
      showSuccess("Büyüme kaydı eklendi.");
      await queryClient.invalidateQueries({ queryKey: ["growth-records", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Büyüme kaydı eklenemedi")
  });

  const deleteGrowthMutation = useMutation({
    mutationFn: deleteGrowthRecord,
    onSuccess: async () => {
      showSuccess("Büyüme kaydı silindi.");
      await queryClient.invalidateQueries({ queryKey: ["growth-records", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Kayıt silinemedi")
  });

  const updateGrowthMutation = useMutation({
    mutationFn: async () => {
      if (!editingGrowthRecordId) {
        throw new Error("Büyüme kaydı seçilmedi.");
      }

      const nextWeight = toOptionalNumber(editWeight);
      const nextHeight = toOptionalNumber(editHeight);
      const nextHead = toOptionalNumber(editHeadCircumference);

      if (!nextWeight && !nextHeight && !nextHead) {
        throw new Error("En az bir ölçüm değeri girmelisin.");
      }

      return updateGrowthRecord(editingGrowthRecordId, {
        head_circumference_cm: nextHead,
        height_cm: nextHeight,
        notes: editGrowthNotes.trim() || null,
        record_date: editGrowthDate,
        weight_kg: nextWeight
      });
    },
    onSuccess: async () => {
      closeGrowthEditor();
      showSuccess("Büyüme kaydı güncellendi.");
      await queryClient.invalidateQueries({ queryKey: ["growth-records", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Büyüme kaydı güncellenemedi")
  });

  const vaccinations = vaccinationsQuery.data ?? [];
  const completedCount = vaccinations.filter((item) => item.completed).length;
  const growthRecords = growthQuery.data ?? [];
  const latestGrowth = growthRecords[growthRecords.length - 1];

  function openVaccinationNotes(vaccination: BabyVaccinationWithSchedule) {
    setEditingVaccinationId(vaccination.id);
    setVaccinationNotes(vaccination.notes ?? "");
  }

  function closeVaccinationNotes() {
    setEditingVaccinationId(undefined);
    setVaccinationNotes("");
  }

  function openGrowthEditor(record: GrowthRecord) {
    setEditingGrowthRecordId(record.id);
    setEditGrowthDate(record.record_date);
    setEditWeight(record.weight_kg?.toString() ?? "");
    setEditHeight(record.height_cm?.toString() ?? "");
    setEditHeadCircumference(record.head_circumference_cm?.toString() ?? "");
    setEditGrowthNotes(record.notes ?? "");
  }

  function closeGrowthEditor() {
    setEditingGrowthRecordId(undefined);
    setEditGrowthDate(toDateOnly(new Date()));
    setEditWeight("");
    setEditHeight("");
    setEditHeadCircumference("");
    setEditGrowthNotes("");
  }

  if (profileQuery.isLoading || babiesQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Bebek bilgileri hazırlanıyor…" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Profil veya bebek bilgileri alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() => void Promise.all([profileQuery.refetch(), babiesQuery.refetch()])}
          retrying={profileQuery.isFetching || babiesQuery.isFetching}
          title="Bebek ekranı yüklenemedi"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.iconBubble, { backgroundColor: appTheme.accentSoft }]}>
            <BabyIcon color={appTheme.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Bebek ve bakım</Text>
            <Text style={typography.heading1}>Bebek profili</Text>
            <Text style={styles.heroText}>
              Bebek bilgileri, aşı takvimi ve gelişim kayıtları burada tek yerde
              tutulur.
            </Text>
          </View>
        </View>

        {selectedBaby ? (
          <Card style={{ backgroundColor: appTheme.accentSoft }}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.summaryHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.eyebrow}>Premium</Text>
                  <Text style={typography.heading2}>Akıllı bakım günlüğü</Text>
                  <Text style={typography.body}>
                    Emzirme, biberon, uyku, bez, sağım ve ilaç kayıtlarını ailece takip et.
                  </Text>
                </View>
                <HeartPulse color={appTheme.primary} size={28} />
              </View>
              <Link href="/care-journal" asChild>
                <Button label="Bakım günlüğünü aç" />
              </Link>
            </View>
          </Card>
        ) : null}

        <View style={styles.sectionSwitch}>
          <SegmentButton
            active={section === "profile"}
            activeColor={appTheme.primary}
            label="Profil"
            onPress={() => setSection("profile")}
          />
          <SegmentButton
            active={section === "vaccines"}
            activeColor={appTheme.primary}
            label="Aşı takvimi"
            onPress={() => setSection("vaccines")}
          />
          <SegmentButton
            active={section === "growth"}
            activeColor={appTheme.primary}
            label="Büyüme"
            onPress={() => setSection("growth")}
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
                  baby.id === selectedBaby?.id && {
                    backgroundColor: appTheme.primary,
                    borderColor: appTheme.primary
                  }
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
                    <HeartPulse color={appTheme.primary} size={28} />
                  </View>
                  <Thread
                    color={appTheme.primary}
                    height={64}
                    mutedColor={appTheme.primarySoft}
                    progress={0.85}
                    variant="chart"
                  />
                  <View style={styles.infoGrid}>
                    <InfoPill label="Doğum" value={formatDate(selectedBaby.birth_date)} />
                    <InfoPill label="Cinsiyet" value={formatGender(selectedBaby.gender)} />
                    <InfoPill
                      label="Aşı"
                      value={`${completedCount}/${vaccinations.length || 0} tamam`}
                    />
                  </View>
                  <Button
                    label={editOpen ? "Düzenlemeyi kapat" : "Bilgileri düzenle"}
                    variant="secondary"
                    onPress={() => setEditOpen((value) => !value)}
                  />
                </View>
              </Card>
            ) : (
              <EmptyState
                title="Henüz bebek profili yok"
                description="Bebek profilini ekleyince aşı takvimi otomatik oluşur."
              />
            )}

            {selectedBaby && editOpen ? (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Text style={typography.heading2}>Bebek bilgilerini düzenle</Text>
                  <TextField
                    label="Bebek adı"
                    value={editName}
                    onChangeText={setEditName}
                  />
                  <DatePickerField
                    label="Doğum tarihi"
                    value={editBirthDate}
                    onChange={setEditBirthDate}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <Text style={typography.label}>Cinsiyet</Text>
                    <View style={styles.genderRow}>
                      <SegmentButton
                        active={editGender === "kiz"}
                        activeColor={appTheme.primary}
                        label="Kız"
                        onPress={() => setEditGender("kiz")}
                      />
                      <SegmentButton
                        active={editGender === "erkek"}
                        activeColor={appTheme.primary}
                        label="Erkek"
                        onPress={() => setEditGender("erkek")}
                      />
                      <SegmentButton
                        active={editGender === "belirtilmemis"}
                        activeColor={appTheme.primary}
                        label="Belirtmem"
                        onPress={() => setEditGender("belirtilmemis")}
                      />
                    </View>
                  </View>
                  <Button
                    label={updateBabyMutation.isPending ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
                    disabled={updateBabyMutation.isPending}
                    onPress={() => updateBabyMutation.mutate()}
                  />
                </View>
              </Card>
            ) : null}

            {formOpen ? (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Text style={typography.heading2}>Yeni bebek ekle</Text>
                  <TextField
                    label="Bebek adı"
                    placeholder="Örn. Deniz"
                    value={name}
                    onChangeText={setName}
                  />
                  <DatePickerField
                    label="Doğum tarihi"
                    placeholder="Doğum tarihini seç"
                    value={birthDate}
                    onChange={setBirthDate}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <Text style={typography.label}>Cinsiyet</Text>
                    <View style={styles.genderRow}>
                      <SegmentButton
                        active={gender === "kiz"}
                        activeColor={appTheme.primary}
                        label="Kız"
                        onPress={() => setGender("kiz")}
                      />
                      <SegmentButton
                        active={gender === "erkek"}
                        activeColor={appTheme.primary}
                        label="Erkek"
                        onPress={() => setGender("erkek")}
                      />
                      <SegmentButton
                        active={gender === "belirtilmemis"}
                        activeColor={appTheme.primary}
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
                label={babies.length > 0 ? "Başka bebek ekle" : "Bebek profili oluştur"}
                variant={babies.length > 0 ? "secondary" : "primary"}
                onPress={() => setFormOpen(true)}
              />
            )}
          </View>
        ) : section === "vaccines" ? (
          <View style={{ gap: spacing.md }}>
            {vaccinationsQuery.isLoading ? (
              <QueryState compact loading description="Aşı takvimi yükleniyor…" />
            ) : vaccinationsQuery.isError ? (
              <QueryState
                description="Aşı takvimi alınamadı."
                onRetry={() => void vaccinationsQuery.refetch()}
                retrying={vaccinationsQuery.isFetching}
              />
            ) : !selectedBaby ? (
              <EmptyState
                title="Aşı takvimi için bebek profili gerekli"
                description="Bebek doğum tarihi girildiğinde takvim otomatik hesaplanır."
              />
            ) : (
              <>
                <Card style={[styles.vaccineSummary, { backgroundColor: appTheme.primarySoft }]}>
                  <View style={styles.summaryHeader}>
                    <View style={{ gap: spacing.xs }}>
                      <Text style={typography.heading2}>Aşı takvimi</Text>
                      <Text style={typography.body}>
                        {selectedBaby.name} için {completedCount}/{vaccinations.length} aşı
                        tamamlandı.
                      </Text>
                    </View>
                    <Syringe color={appTheme.primary} size={28} />
                  </View>
                </Card>

                {vaccinations.map((vaccination) => (
                  <View key={vaccination.id} style={{ gap: spacing.sm }}>
                    <Pressable
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
                          {vaccination.vaccine_schedule?.vaccine_name ?? "Aşı"}
                        </Text>
                        <Text style={styles.vaccineMeta}>
                          {getVaccineAgeLabel(
                            vaccination.vaccine_schedule?.recommended_age_days ?? 0
                          )}{" "}
                          / {formatDate(vaccination.scheduled_date)} /{" "}
                          {getRelativeDayLabel(vaccination.scheduled_date)}
                        </Text>
                        {vaccination.notes ? (
                          <Text style={styles.vaccineNote}>{vaccination.notes}</Text>
                        ) : null}
                      </View>
                      <CalendarCheck color={appTheme.primary} size={20} />
                    </Pressable>

                    {editingVaccinationId === vaccination.id ? (
                      <View style={styles.inlineEditor}>
                        <TextField
                          label="Aşı notu"
                          multiline
                          value={vaccinationNotes}
                          onChangeText={setVaccinationNotes}
                        />
                        <View style={styles.formActions}>
                          <Button
                            label="Vazgeç"
                            variant="ghost"
                            style={styles.formButton}
                            onPress={closeVaccinationNotes}
                          />
                          <Button
                            label={
                              updateVaccinationNotesMutation.isPending
                                ? "Kaydediliyor..."
                                : "Notu kaydet"
                            }
                            disabled={updateVaccinationNotesMutation.isPending}
                            style={styles.formButton}
                            onPress={() => updateVaccinationNotesMutation.mutate()}
                          />
                        </View>
                      </View>
                    ) : (
                      <Button
                        label={vaccination.notes ? "Notu düzenle" : "Not ekle"}
                        variant="ghost"
                        onPress={() => openVaccinationNotes(vaccination)}
                      />
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {growthQuery.isLoading ? (
              <QueryState compact loading description="Büyüme kayıtları yükleniyor…" />
            ) : growthQuery.isError ? (
              <QueryState
                description="Büyüme kayıtları alınamadı."
                onRetry={() => void growthQuery.refetch()}
                retrying={growthQuery.isFetching}
              />
            ) : !selectedBaby ? (
              <EmptyState
                title="Büyüme takibi için bebek profili gerekli"
                description="Bebek profilini ekledikten sonra kilo, boy ve baş çevresi ölçümlerini izleyebilirsin."
              />
            ) : (
              <>
                <Card style={[styles.vaccineSummary, { backgroundColor: appTheme.primarySoft }]}>
                  <View style={{ gap: spacing.md }}>
                    <View style={styles.summaryHeader}>
                      <View style={{ gap: spacing.xs }}>
                        <Text style={typography.heading2}>Büyüme özeti</Text>
                        <Text style={typography.body}>
                          {latestGrowth
                            ? `${formatDate(latestGrowth.record_date)} tarihli son ölçüm`
                            : "İlk ölçümü eklediğinde gelişim çizgisi burada başlar."}
                        </Text>
                      </View>
                      <HeartPulse color={appTheme.primary} size={28} />
                    </View>
                    <Thread
                      color={appTheme.primary}
                      height={64}
                      mutedColor={appTheme.primarySoft}
                      progress={growthRecords.length > 0 ? 0.9 : 0.35}
                      variant="chart"
                    />
                    {latestGrowth ? (
                      <View style={styles.infoGrid}>
                        <InfoPill label="Kilo" value={formatMetric(latestGrowth.weight_kg, "kg")} />
                        <InfoPill label="Boy" value={formatMetric(latestGrowth.height_cm, "cm")} />
                        <InfoPill label="Baş çevresi" value={formatMetric(latestGrowth.head_circumference_cm, "cm")} />
                      </View>
                    ) : null}
                  </View>
                </Card>

                <Card>
                  <View style={{ gap: spacing.md }}>
                    <Text style={typography.heading2}>Yeni ölçüm ekle</Text>
                    <DatePickerField
                      label="Ölçüm tarihi"
                      value={growthDate}
                      onChange={setGrowthDate}
                    />
                    <View style={styles.measureGrid}>
                      <TextField
                        containerStyle={styles.measureField}
                        keyboardType="decimal-pad"
                        label="Kilo (kg)"
                        value={weight}
                        onChangeText={setWeight}
                      />
                      <TextField
                        containerStyle={styles.measureField}
                        keyboardType="decimal-pad"
                        label="Boy (cm)"
                        value={height}
                        onChangeText={setHeight}
                      />
                    </View>
                    <TextField
                      keyboardType="decimal-pad"
                      label="Baş çevresi (cm)"
                      value={headCircumference}
                      onChangeText={setHeadCircumference}
                    />
                    <TextField
                      label="Not"
                      multiline
                      value={growthNotes}
                      onChangeText={setGrowthNotes}
                    />
                    <Button
                      label={createGrowthMutation.isPending ? "Ekleniyor..." : "Ölçümü kaydet"}
                      disabled={createGrowthMutation.isPending}
                      onPress={() => createGrowthMutation.mutate()}
                    />
                  </View>
                </Card>

                {growthRecords.length === 0 ? (
                  <EmptyState
                    title="Henüz ölçüm yok"
                    description="Kilo, boy veya baş çevresi eklediğinde kayıtların burada görünür."
                  />
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {growthRecords
                      .slice()
                      .reverse()
                      .map((record) => (
                        <View key={record.id} style={{ gap: spacing.sm }}>
                          <GrowthRecordRow
                            record={record}
                            disabled={deleteGrowthMutation.isPending}
                            onDelete={() => deleteGrowthMutation.mutate(record.id)}
                            onEdit={() => openGrowthEditor(record)}
                          />
                          {editingGrowthRecordId === record.id ? (
                            <View style={styles.inlineEditor}>
                              <DatePickerField
                                label="Ölçüm tarihi"
                                value={editGrowthDate}
                                onChange={setEditGrowthDate}
                              />
                              <View style={styles.measureGrid}>
                                <TextField
                                  containerStyle={styles.measureField}
                                  keyboardType="decimal-pad"
                                  label="Kilo (kg)"
                                  value={editWeight}
                                  onChangeText={setEditWeight}
                                />
                                <TextField
                                  containerStyle={styles.measureField}
                                  keyboardType="decimal-pad"
                                  label="Boy (cm)"
                                  value={editHeight}
                                  onChangeText={setEditHeight}
                                />
                              </View>
                              <TextField
                                keyboardType="decimal-pad"
                                label="Baş çevresi (cm)"
                                value={editHeadCircumference}
                                onChangeText={setEditHeadCircumference}
                              />
                              <TextField
                                label="Not"
                                multiline
                                value={editGrowthNotes}
                                onChangeText={setEditGrowthNotes}
                              />
                              <View style={styles.formActions}>
                                <Button
                                  label="Vazgeç"
                                  variant="ghost"
                                  style={styles.formButton}
                                  onPress={closeGrowthEditor}
                                />
                                <Button
                                  label={
                                    updateGrowthMutation.isPending
                                      ? "Kaydediliyor..."
                                      : "Güncelle"
                                  }
                                  disabled={updateGrowthMutation.isPending}
                                  style={styles.formButton}
                                  onPress={() => updateGrowthMutation.mutate()}
                                />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      ))}
                  </View>
                )}
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
  activeColor,
  label,
  onPress
}: {
  active: boolean;
  activeColor: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text
        style={[
          styles.segmentText,
          active && styles.segmentTextActive,
          active && { color: activeColor }
        ]}
      >
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

function GrowthRecordRow({
  disabled,
  onDelete,
  onEdit,
  record
}: {
  disabled: boolean;
  onDelete: () => void;
  onEdit: () => void;
  record: GrowthRecord;
}) {
  return (
    <View style={styles.growthRow}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={typography.label}>{formatDate(record.record_date)}</Text>
        <Text style={styles.vaccineMeta}>
          Kilo {formatMetric(record.weight_kg, "kg")} / Boy{" "}
          {formatMetric(record.height_cm, "cm")} / Baş{" "}
          {formatMetric(record.head_circumference_cm, "cm")}
        </Text>
        {record.notes ? <Text style={typography.body}>{record.notes}</Text> : null}
      </View>
      <View style={styles.rowActions}>
        <Button
          label="Düzenle"
          variant="ghost"
          disabled={disabled}
          style={styles.compactButton}
          onPress={onEdit}
        />
        <Pressable
          accessibilityLabel="Büyüme kaydını sil"
          accessibilityRole="button"
          disabled={disabled}
          onPress={onDelete}
          style={styles.deleteButton}
        >
          <Trash2 color={colors.danger} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function formatGender(gender: Baby["gender"]) {
  if (gender === "kiz") return "Kız";
  if (gender === "erkek") return "Erkek";
  return "Belirtilmedi";
}

function getVaccineAgeLabel(days: number) {
  if (days === 0) return "Doğumda";
  if (days < 56) return `${Math.round(days / 7)}. hafta`;
  if (days < 365) return `${Math.round(days / 30)}. ay`;
  return `${Math.round(days / 365)}. yaş`;
}

function toOptionalNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMetric(value: number | null, unit: string) {
  return value ? `${value} ${unit}` : "-";
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    ...radii.cardLarge,
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
    fontSize: 14
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
    color: colors.onPrimary
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
    ...radii.card,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  infoLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19
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
  measureGrid: {
    flexDirection: "row",
    gap: spacing.md
  },
  measureField: {
    flex: 1
  },
  vaccineSummary: {
    backgroundColor: colors.primarySoft
  },
  vaccineRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  vaccineRowDone: {
    backgroundColor: colors.highlightSoft,
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
    fontSize: 15,
    lineHeight: 21
  },
  vaccineNote: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  inlineEditor: {
    ...radii.card,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.md,
    padding: spacing.md
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  formButton: {
    flex: 1
  },
  growthRow: {
    ...radii.card,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  rowActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  compactButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  }
});
