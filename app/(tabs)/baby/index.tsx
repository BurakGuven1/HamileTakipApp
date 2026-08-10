import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Link, router, useLocalSearchParams } from "expo-router";
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
  const [growthFormOpen, setGrowthFormOpen] = useState(false);
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["baby-vaccinations", selectedBaby?.id]
        }),
        queryClient.invalidateQueries({ queryKey: ["active-vaccine-reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["next-upcoming-vaccination"] })
      ]);
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
      setGrowthFormOpen(false);
      showSuccess("Büyüme kaydı eklendi.", "Eklendi");
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
        <QueryState loading description="Bebeğinin yaşam ipliği hazırlanıyor…" shape="baby" />
      </Screen>
    );
  }

  if (profileQuery.isError || babiesQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Profil veya bebek bilgileri alınamadı. Bağlantını kontrol et ve yeniden dene."
          onRetry={() => void Promise.all([profileQuery.refetch(), babiesQuery.refetch()])}
          retrying={profileQuery.isFetching || babiesQuery.isFetching}
          title="Bebek ekranı yüklenemedi"
        />
      </Screen>
    );
  }

  if (profileQuery.data?.is_pregnant) {
    return (
      <Screen>
        <EmptyState
          actionHint="Gebelik araçları ekranına gider"
          actionLabel="Gebelik araçlarına dön"
          description="Bebek profili, bakım ve büyüme araçları doğum bilgilerini kaydettiğinde açılır. Profil ekranından doğum sonrası geçişi tamamlayabilirsin."
          onActionPress={() => router.replace("/pregnancy-tools")}
          title="Bu alan doğum sonrasında açılır"
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
                  <Text style={typography.eyebrow}>Temel kayıtlar ücretsiz</Text>
                  <Text style={typography.heading2}>Akıllı bakım günlüğü</Text>
                  <Text style={typography.body}>
                    Emzirme, biberon, uyku, bez ve sağım kayıtlarını ailece takip et; Premium ile öngörü ve eğilimleri aç.
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

        <View accessibilityRole="tablist" style={styles.sectionSwitch}>
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
                accessibilityLabel={`${baby.name} profilini göster`}
                accessibilityRole="button"
                accessibilityState={{ selected: baby.id === selectedBaby?.id }}
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
                    accessibilityLabel={`${selectedBaby.name} için doğumdan bugüne yaşam ipliği`}
                    color={appTheme.primary}
                    height={72}
                    markers={[
                      { kind: "knot", position: 0.08 },
                      { kind: "loop", position: 0.88 }
                    ]}
                    mutedColor={appTheme.primarySoft}
                    progress={1}
                    semantic="timeline"
                    variant="progress"
                  />
                  <View style={styles.threadLegend}>
                    <Text style={styles.threadLegendText}>Doğum düğümü</Text>
                    <Text style={styles.threadLegendText}>Bugün</Text>
                  </View>
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
                actionHint="Bebek adı ve doğum tarihini ekleme formunu açar"
                actionLabel="Bebek profili oluştur"
                description="Doğum bilgisi ilk düğümü oluşturur; aşı ve büyüme kayıtları aynı iplikte devam eder."
                title="İlk düğümü birlikte atalım"
                onActionPress={() => setFormOpen(true)}
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
                    <View accessibilityRole="radiogroup" style={styles.genderRow}>
                      <SegmentButton
                        active={editGender === "kiz"}
                        activeColor={appTheme.primary}
                        label="Kız"
                        role="radio"
                        onPress={() => setEditGender("kiz")}
                      />
                      <SegmentButton
                        active={editGender === "erkek"}
                        activeColor={appTheme.primary}
                        label="Erkek"
                        role="radio"
                        onPress={() => setEditGender("erkek")}
                      />
                      <SegmentButton
                        active={editGender === "belirtilmemis"}
                        activeColor={appTheme.primary}
                        label="Belirtmem"
                        role="radio"
                        onPress={() => setEditGender("belirtilmemis")}
                      />
                    </View>
                  </View>
                  <Button
                    label={updateBabyMutation.isPending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
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
                    <View accessibilityRole="radiogroup" style={styles.genderRow}>
                      <SegmentButton
                        active={gender === "kiz"}
                        activeColor={appTheme.primary}
                        label="Kız"
                        role="radio"
                        onPress={() => setGender("kiz")}
                      />
                      <SegmentButton
                        active={gender === "erkek"}
                        activeColor={appTheme.primary}
                        label="Erkek"
                        role="radio"
                        onPress={() => setGender("erkek")}
                      />
                      <SegmentButton
                        active={gender === "belirtilmemis"}
                        activeColor={appTheme.primary}
                        label="Belirtmem"
                        role="radio"
                        onPress={() => setGender("belirtilmemis")}
                      />
                    </View>
                  </View>
                  <Button
                    label={
                      createBabyMutation.isPending
                        ? "Kaydediliyor…"
                        : "Bebek profilini kaydet"
                    }
                    disabled={createBabyMutation.isPending}
                    onPress={() => createBabyMutation.mutate()}
                  />
                </View>
              </Card>
            ) : babies.length > 0 ? (
              <Button
                label="Başka bebek ekle"
                variant="secondary"
                onPress={() => setFormOpen(true)}
              />
            ) : null}
          </View>
        ) : section === "vaccines" ? (
          <View style={{ gap: spacing.md }}>
            {vaccinationsQuery.isLoading ? (
              <QueryState compact loading description="Aşı ipliği hazırlanıyor…" shape="baby" />
            ) : vaccinationsQuery.isError ? (
              <QueryState
                description="Aşı takvimi alınamadı. Bağlantını kontrol et ve yeniden dene."
                onRetry={() => void vaccinationsQuery.refetch()}
                retrying={vaccinationsQuery.isFetching}
              />
            ) : !selectedBaby ? (
              <EmptyState
                actionLabel="Bebek profili oluştur"
                description="Doğum tarihi eklendiğinde önerilen aşı ilmekleri otomatik yerleşir."
                title="Aşı ipliğini başlat"
                onActionPress={() => {
                  setSection("profile");
                  setFormOpen(true);
                }}
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
                  <Thread
                    accessibilityLabel={`${selectedBaby.name} için ${vaccinations.length} aşının ${completedCount} tanesi tamamlandı`}
                    color={appTheme.primary}
                    height={68}
                    markers={vaccinations.map((vaccination, index) => ({
                      kind: vaccination.completed ? ("knot" as const) : ("loop" as const),
                      position: (index + 1) / (vaccinations.length + 1)
                    }))}
                    mutedColor={colors.border}
                    progress={
                      vaccinations.length > 0 ? completedCount / vaccinations.length : 0
                    }
                    variant="progress"
                  />
                </Card>

                {vaccinations.length === 0 ? (
                  <EmptyState
                    actionLabel="Takvimi yenile"
                    description="Bebeğinin doğum tarihine uygun aşı düğümleri geldiğinde bu ipliğe yerleşir."
                    onActionPress={() => void vaccinationsQuery.refetch()}
                    title="Aşı düğümleri hazırlanıyor"
                  />
                ) : vaccinations.map((vaccination) => (
                  <View key={vaccination.id} style={{ gap: spacing.sm }}>
                    <Pressable
                      accessibilityHint="Aşının tamamlandı durumunu değiştirir"
                      accessibilityLabel={`${vaccination.vaccine_schedule?.vaccine_name ?? "Aşı"}, ${vaccination.completed ? "tamamlandı" : "bekliyor"}`}
                      accessibilityRole="button"
                      accessibilityState={{
                        checked: vaccination.completed,
                        disabled: toggleVaccinationMutation.isPending
                      }}
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
                                ? "Kaydediliyor…"
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
              <QueryState compact loading description="Büyüme ipliği hazırlanıyor…" shape="baby" />
            ) : growthQuery.isError ? (
              <QueryState
                description="Büyüme kayıtları alınamadı. Bağlantını kontrol et ve yeniden dene."
                onRetry={() => void growthQuery.refetch()}
                retrying={growthQuery.isFetching}
              />
            ) : !selectedBaby ? (
              <EmptyState
                actionLabel="Bebek profili oluştur"
                description="Bebek profilini eklediğinde ilk ölçüm düğümünü oluşturabilirsin."
                title="Büyüme ipliğini başlat"
                onActionPress={() => {
                  setSection("profile");
                  setFormOpen(true);
                }}
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
                    {latestGrowth ? (
                      <View style={styles.infoGrid}>
                        <InfoPill label="Kilo" value={formatMetric(latestGrowth.weight_kg, "kg")} />
                        <InfoPill label="Boy" value={formatMetric(latestGrowth.height_cm, "cm")} />
                        <InfoPill label="Baş çevresi" value={formatMetric(latestGrowth.head_circumference_cm, "cm")} />
                      </View>
                    ) : null}
                  </View>
                </Card>

                {growthFormOpen ? (
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
                      <View style={styles.formActions}>
                        <Button
                          label="Vazgeç"
                          style={styles.formButton}
                          variant="ghost"
                          onPress={() => setGrowthFormOpen(false)}
                        />
                        <Button
                          label={createGrowthMutation.isPending ? "Ekleniyor…" : "Ölçümü ekle"}
                          disabled={createGrowthMutation.isPending}
                          style={styles.formButton}
                          onPress={() => createGrowthMutation.mutate()}
                        />
                      </View>
                    </View>
                  </Card>
                ) : null}

                {growthRecords.length === 0 ? (
                  <EmptyState
                    actionLabel="İlk ölçümü ekle"
                    description="Kilo, boy veya baş çevresi değerlerinden biri ilk büyüme düğümünü oluşturur."
                    title="İlk ölçümle ipliği başlat"
                    onActionPress={() => setGrowthFormOpen(true)}
                  />
                ) : (
                  <View style={{ gap: spacing.md }}>
                    {!growthFormOpen ? (
                      <Button
                        label="Yeni ölçüm ekle"
                        variant="secondary"
                        onPress={() => setGrowthFormOpen(true)}
                      />
                    ) : null}
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
                                      ? "Kaydediliyor…"
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
  role = "tab",
  onPress
}: {
  active: boolean;
  activeColor: string;
  label: string;
  role?: "radio" | "tab";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === "radio" ? { checked: active } : { selected: active }}
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
    justifyContent: "center",
    minHeight: 48,
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
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
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
  threadLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -spacing.md
  },
  threadLegendText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
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
    flexWrap: "wrap",
    gap: spacing.md
  },
  measureField: {
    flexBasis: 136,
    flexGrow: 1,
    minWidth: 132
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
