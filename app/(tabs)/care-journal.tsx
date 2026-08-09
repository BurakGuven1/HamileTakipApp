import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type ErrorBoundaryProps } from "expo-router";
import { Baby, BellRing, Check, Clock3, Droplets, HandHeart, LockKeyhole, Milk, Moon, Pill, RefreshCw, ShieldAlert, Sparkles, Thermometer, Trash2, Undo2, Users, WifiOff } from "lucide-react-native";
import { Component, useEffect, useMemo, useState } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import {
  addCareJournalEntry,
  addMedicineCareEntrySafely,
  addCareReminder,
  deleteCareJournalEntry,
  discardCareSyncConflict,
  cancelCareReminder,
  hasFamilyPremiumCareAccess,
  getCurrentCareUserId,
  getCareSyncConflicts,
  getCareHandoverSnapshot,
  getRecentMedicineDose,
  getSleepPrediction,
  listCareJournalActivity,
  listCareJournalEntries,
  listCareJournalEntriesSince,
  listAllCareJournalEntries,
  listCareReminders,
  retryCareSyncConflict,
  saveMotherWellbeingCheckin,
  startSharedCareTimer,
  stopSharedCareTimer,
  subscribeToCareCoordination,
  subscribeToCareJournalEntries,
  takeOverBabyCare,
  undoCareJournalOperation,
  type CareActiveTimer,
  type CareEntryType,
  type CareHandoverSnapshot,
  type CareJournalActivity,
  type CareJournalEntry,
  type CareJournalViewEntry,
  type CareReminder,
  type CareSyncResult,
  type RecentMedicineDose,
  type SleepPrediction,
  RecentMedicineDoseError
} from "@/api/careJournal";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import type { ReportPeriod } from "@/features/care-journal/report";
import { syncCareQuickWidget } from "@/features/care-journal/widgetSync";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useCareSyncStatus } from "@/hooks/useCareSync";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type MilkInventoryProps = { actorName: string | null; babyId: string };
type CareJournalSection = "record" | "plan" | "family" | "insights";

const CARE_JOURNAL_SECTIONS: { label: string; section: CareJournalSection }[] = [
  { label: "Kayıt", section: "record" },
  { label: "Plan", section: "plan" },
  { label: "Aile", section: "family" },
  { label: "Özet", section: "insights" }
];

const ENTRY_TYPES: { label: string; type: CareEntryType }[] = [
  { label: "Emzirme", type: "breastfeeding" },
  { label: "Biberon", type: "bottle" },
  { label: "Uyku", type: "sleep" },
  { label: "Bez", type: "diaper" },
  { label: "Sağım", type: "pumping" },
  { label: "İlaç", type: "medicine" },
  { label: "Ek gıda", type: "solid_food" },
  { label: "Ateş", type: "temperature" }
];

export default function CareJournalScreen() {
  return <AdvancedCareJournalContent />;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen scroll={false}>
      <QueryState
        description={error.message || "Bakım günlüğü beklenmeyen bir nedenle açılamadı."}
        onRetry={retry}
        title="Bakım günlüğü açılamadı"
      />
    </Screen>
  );
}

type EssentialEntryType = CareEntryType;

function CareJournalScreenContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [entryType, setEntryType] = useState<EssentialEntryType>("breastfeeding");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [breastSide, setBreastSide] = useState<"left" | "right" | "both">("left");
  const [diaperType, setDiaperType] = useState<"wet" | "dirty" | "both">("wet");
  const [feedingContent, setFeedingContent] = useState<"breast_milk" | "formula" | "water">("breast_milk");
  const [sleepKind, setSleepKind] = useState<"day" | "night">("day");
  const [medicineName, setMedicineName] = useState("");
  const [medicineDose, setMedicineDose] = useState("");
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [firstTry, setFirstTry] = useState(false);
  const [temperature, setTemperature] = useState("");
  const [temperatureSite, setTemperatureSite] = useState<"armpit" | "ear" | "forehead" | "oral" | "other" | "rectal">("armpit");
  const [notes, setNotes] = useState("");
  const [reportDays, setReportDays] = useState<ReportPeriod>(7);

  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babies = Array.isArray(babiesQuery.data)
    ? babiesQuery.data.filter(
        (baby) => baby && typeof baby.id === "string" && typeof baby.name === "string"
      )
    : [];
  const selectedBaby =
    babies.find((baby) => baby.id === selectedBabyId) ?? babies[0];
  const caregiverName =
    profileQuery.data?.mother_name ?? profileQuery.data?.display_name ?? null;
  const feedingMode = normalizeFeedingMode(profileQuery.data?.feeding_mode);
  const visibleEntryTypes = useMemo(
    () => orderEntryTypesForFeedingMode(feedingMode),
    [feedingMode]
  );

  useEffect(() => {
    if (!selectedBabyId && babies[0]) setSelectedBabyId(babies[0].id);
  }, [babies, selectedBabyId]);

  const entriesQuery = useQuery({
    queryKey: ["care-journal-essential", selectedBaby?.id],
    queryFn: () => listCareJournalEntries(selectedBaby?.id as string, 300),
    enabled: Boolean(selectedBaby?.id)
  });
  const entries = normalizeCareEntries(entriesQuery.data);

  useEffect(() => {
    if (params.entry && isCareEntryType(params.entry)) {
      setEntryType(params.entry);
    }
  }, [params.entry]);

  useEffect(() => {
    if (!selectedBaby || !entriesQuery.isSuccess) return;
    syncCareQuickWidget(selectedBaby.id, selectedBaby.name, entries).catch(
      () => undefined
    );
  }, [entriesQuery.data, entriesQuery.isSuccess, selectedBaby?.id, selectedBaby?.name]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby) throw new Error("Önce bir bebek profili oluşturmalısın.");
      const durationMinutes = duration.trim() ? Number(duration) : null;
      const amountMl = amount.trim() ? Number(amount.replace(",", ".")) : null;
      if (
        durationMinutes !== null &&
        (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
      ) {
        throw new Error("Süreyi dakika olarak doğru girmelisin.");
      }
      if (
        (entryType === "bottle" || entryType === "pumping") &&
        (amountMl === null || !Number.isFinite(amountMl) || amountMl <= 0)
      ) {
        throw new Error("Miktarı ml olarak doğru girmelisin.");
      }
      if (entryType === "medicine" && !medicineName.trim()) {
        throw new Error("İlaç veya vitamin adını girmelisin.");
      }
      if (entryType === "solid_food" && !foodName.trim()) {
        throw new Error("Besin adını girmelisin.");
      }
      const temperatureC = temperature.trim()
        ? Number(temperature.replace(",", "."))
        : null;
      if (
        entryType === "temperature" &&
        (temperatureC === null ||
          !Number.isFinite(temperatureC) ||
          temperatureC < 30 ||
          temperatureC > 45)
      ) {
        throw new Error("Ateşi 30,0–45,0 °C arasında girmelisin.");
      }

      const now = Date.now();
      const occurredAt = durationMinutes
        ? new Date(now - durationMinutes * 60_000).toISOString()
        : new Date(now).toISOString();

      if (entryType === "medicine") {
        return addMedicineCareEntrySafely({
          babyId: selectedBaby.id,
          caregiverName,
          medicineDose: medicineDose.trim() || null,
          medicineName: medicineName.trim(),
          notes: notes.trim() || null,
          occurredAt,
          overrideRecent: false
        });
      }

      return addCareJournalEntry({
        amount_ml:
          entryType === "bottle" || entryType === "pumping" ? amountMl : null,
        baby_id: selectedBaby.id,
        breast_side: entryType === "breastfeeding" ? breastSide : null,
        caregiver_name: caregiverName,
        diaper_type: entryType === "diaper" ? diaperType : null,
        ended_at:
          durationMinutes && (entryType === "breastfeeding" || entryType === "sleep")
            ? new Date(now).toISOString()
            : null,
        entry_type: entryType,
        feeding_content: entryType === "bottle" ? feedingContent : null,
        food_amount: entryType === "solid_food" ? foodAmount.trim() || null : null,
        food_name: entryType === "solid_food" ? foodName.trim() : null,
        is_first_try: entryType === "solid_food" && firstTry,
        medicine_dose: null,
        medicine_name: null,
        notes: notes.trim() || null,
        occurred_at: occurredAt,
        sleep_kind: entryType === "sleep" ? sleepKind : null,
        temperature_c: entryType === "temperature" ? temperatureC : null,
        temperature_site: entryType === "temperature" ? temperatureSite : null
      });
    },
    onSuccess: async () => {
      setAmount("");
      setDuration("");
      setMedicineName("");
      setMedicineDose("");
      setFoodName("");
      setFoodAmount("");
      setFirstTry(false);
      setTemperature("");
      setNotes("");
      showSuccess("Bakım kaydı eklendi.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["care-journal-essential", selectedBaby?.id]
        }),
        queryClient.invalidateQueries({ queryKey: ["care-journal"] })
      ]);
    },
    onError: (mutationError) => showError(mutationError, "Bakım kaydı eklenemedi")
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: CareJournalViewEntry) =>
      deleteCareJournalEntry(entry, caregiverName),
    onSuccess: async () => {
      showSuccess("Bakım kaydı silindi.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["care-journal-essential", selectedBaby?.id]
        }),
        queryClient.invalidateQueries({ queryKey: ["care-journal"] })
      ]);
    },
    onError: (mutationError) => showError(mutationError, "Bakım kaydı silinemedi")
  });

  async function shareEssentialReport() {
    if (!selectedBaby) return;
    try {
      const { shareCareJournalReport } = await import("@/features/care-journal/report");
      const since = Date.now() - reportDays * 86_400_000;
      await shareCareJournalReport(
        selectedBaby,
        entries.filter((entry) => Date.parse(entry.occurred_at) >= since),
        reportDays
      );
    } catch (reportError) {
      showError(reportError, "PDF oluşturulamadı");
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconBubble}>
            <Baby color={colors.sageGreen} size={28} />
          </View>
          <Text style={typography.eyebrow}>Anne + bebek</Text>
          <Text style={typography.heading1}>Akıllı bakım günlüğü</Text>
          <Text style={styles.heroText}>
            Beslenme, uyku ve bez kayıtlarını ekle; geçmişini görüntüle ve doktorun
            için PDF oluştur.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/night-shift", params: selectedBaby?.id ? { babyId: selectedBaby.id } : undefined })}
          style={styles.nightShiftLaunch}
        >
          <View style={styles.nightShiftIcon}><Moon color="#E8C381" size={27} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.nightShiftEyebrow}>TEK ELLE · GÖZ ALMAYAN EKRAN</Text>
            <Text style={styles.nightShiftTitle}>Gece Vardiyası Modu</Text>
            <Text style={styles.nightShiftText}>Beslenme, bez, uyku ve yalnızca vardiyadaki ebeveyne özel alarm.</Text>
          </View>
        </Pressable>

        {babies.length > 1 ? (
          <View style={styles.chips}>
            {babies.map((baby) => (
              <ChoiceChip
                key={baby.id}
                active={baby.id === selectedBaby?.id}
                label={baby.name}
                onPress={() => setSelectedBabyId(baby.id)}
              />
            ))}
          </View>
        ) : null}

        {!selectedBaby ? (
          <EmptyState
            title="Bebek profili gerekli"
            description="Bakım günlüğünü kullanmak için Bebek sekmesinden profil oluştur."
          />
        ) : (
          <>
            <Card>
              <View style={{ gap: spacing.md }}>
                <Text style={typography.heading2}>Şimdi kaydet</Text>
                <View style={styles.chips}>
                  {visibleEntryTypes.map((item) => (
                    <ChoiceChip
                      key={item.type}
                      active={entryType === item.type}
                      label={item.label}
                      onPress={() => setEntryType(item.type)}
                    />
                  ))}
                </View>
                {entryType === "breastfeeding" ? (
                  <View style={styles.chips}>
                    <ChoiceChip active={breastSide === "left"} label="Sol" onPress={() => setBreastSide("left")} />
                    <ChoiceChip active={breastSide === "right"} label="Sağ" onPress={() => setBreastSide("right")} />
                    <ChoiceChip active={breastSide === "both"} label="İkisi" onPress={() => setBreastSide("both")} />
                  </View>
                ) : null}
                {entryType === "diaper" ? (
                  <View style={styles.chips}>
                    <ChoiceChip active={diaperType === "wet"} label="Islak" onPress={() => setDiaperType("wet")} />
                    <ChoiceChip active={diaperType === "dirty"} label="Kaka" onPress={() => setDiaperType("dirty")} />
                    <ChoiceChip active={diaperType === "both"} label="İkisi" onPress={() => setDiaperType("both")} />
                  </View>
                ) : null}
                {entryType === "bottle" ? (
                  <View style={styles.chips}>
                    <ChoiceChip active={feedingContent === "breast_milk"} label="Anne sütü" onPress={() => setFeedingContent("breast_milk")} />
                    <ChoiceChip active={feedingContent === "formula"} label="Mama" onPress={() => setFeedingContent("formula")} />
                    <ChoiceChip active={feedingContent === "water"} label="Su" onPress={() => setFeedingContent("water")} />
                  </View>
                ) : null}
                {entryType === "sleep" ? (
                  <View style={styles.chips}>
                    <ChoiceChip active={sleepKind === "day"} label="Gündüz uykusu" onPress={() => setSleepKind("day")} />
                    <ChoiceChip active={sleepKind === "night"} label="Gece uykusu" onPress={() => setSleepKind("night")} />
                  </View>
                ) : null}
                {entryType === "bottle" || entryType === "pumping" ? (
                  <TextField
                    keyboardType="decimal-pad"
                    label="Miktar (ml)"
                    value={amount}
                    onChangeText={setAmount}
                  />
                ) : null}
                {entryType === "medicine" ? (
                  <>
                    <TextField label="İlaç / vitamin adı" value={medicineName} onChangeText={setMedicineName} />
                    <TextField label="Doz (örn. 3 damla)" value={medicineDose} onChangeText={setMedicineDose} />
                  </>
                ) : null}
                {entryType === "solid_food" ? (
                  <>
                    <TextField label="Besin" value={foodName} onChangeText={setFoodName} />
                    <TextField label="Miktar (örn. 3 kaşık)" value={foodAmount} onChangeText={setFoodAmount} />
                    <ChoiceChip active={firstTry} label={firstTry ? "İlk deneme ✓" : "İlk deneme"} onPress={() => setFirstTry((value) => !value)} />
                  </>
                ) : null}
                {entryType === "temperature" ? (
                  <>
                    <TextField keyboardType="decimal-pad" label="Ateş (°C)" placeholder="36,7" value={temperature} onChangeText={setTemperature} />
                    <View style={styles.chips}>
                      <ChoiceChip active={temperatureSite === "armpit"} label="Koltuk altı" onPress={() => setTemperatureSite("armpit")} />
                      <ChoiceChip active={temperatureSite === "forehead"} label="Alın" onPress={() => setTemperatureSite("forehead")} />
                      <ChoiceChip active={temperatureSite === "ear"} label="Kulak" onPress={() => setTemperatureSite("ear")} />
                      <ChoiceChip active={temperatureSite === "other"} label="Diğer" onPress={() => setTemperatureSite("other")} />
                    </View>
                  </>
                ) : null}
                {entryType === "breastfeeding" || entryType === "sleep" ? (
                  <TextField
                    keyboardType="number-pad"
                    label="Süre (dakika, isteğe bağlı)"
                    value={duration}
                    onChangeText={setDuration}
                  />
                ) : null}
                <TextField
                  label="Not (isteğe bağlı)"
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  disabled={addMutation.isPending}
                  label={addMutation.isPending ? "Kaydediliyor..." : "Bakım kaydını ekle"}
                  onPress={() => addMutation.mutate()}
                />
              </View>
            </Card>

            <DoctorReportCard
              onOpen={() =>
                router.push({
                  pathname: "/doctor-visit",
                  params: { babyId: selectedBaby.id, subject: "baby" }
                })
              }
            />

            <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>Bakım geçmişi</Text>
              {entriesQuery.isLoading ? (
                <Text style={typography.body}>Kayıtlar yükleniyor...</Text>
              ) : null}
              {!entriesQuery.isLoading && entries.length === 0 ? (
                <EmptyState
                  title="Henüz kayıt yok"
                  description="İlk bakım kaydını eklediğinde burada görünecek."
                />
              ) : null}
              {entries.slice(0, 100).map((entry) => (
                <EssentialEntryCard
                  key={entry.id}
                  deleting={deleteMutation.isPending}
                  entry={entry}
                  onDelete={() => deleteMutation.mutate(entry)}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function EssentialEntryCard({
  deleting,
  entry,
  onDelete
}: {
  deleting: boolean;
  entry: CareJournalViewEntry;
  onDelete: () => void;
}) {
  const note = typeof entry.notes === "string" ? entry.notes : null;
  return (
    <Card>
      <View style={styles.entryRow}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={typography.heading3}>{entryLabel(entry.entry_type)}</Text>
          <Text style={styles.entryMeta}>{formatTime(entry.occurred_at)}</Text>
          {note ? <Text style={typography.body}>{note}</Text> : null}
        </View>
        <Pressable
          accessibilityLabel="Bakım kaydını sil"
          disabled={deleting}
          hitSlop={10}
          onPress={onDelete}
        >
          <Trash2 color={colors.danger} size={20} />
        </Pressable>
      </View>
    </Card>
  );
}

class CareSectionBoundary extends Component<
  { children: ReactNode; title: string },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Care journal section failed: ${this.props.title}`, error, info);
  }

  override render() {
    if (this.state.failed) {
      return (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading3}>{this.props.title} hazırlanamadı</Text>
            <Text style={typography.body}>
              Günlüğün geri kalanı kullanılabilir. Bu bölümü yeniden hazırlayabilirsin.
            </Text>
            <Button
              label="Bu bölümü tekrar dene"
              variant="secondary"
              onPress={() => this.setState({ failed: false })}
            />
          </View>
        </Card>
      );
    }

    return this.props.children;
  }
}

function AdvancedCareJournalContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const appTheme = useAppTheme();
  const { showError, showInfo, showSuccess } = useFeedback();
  const params = useLocalSearchParams<{ entry?: string; section?: string }>();
  const { isPremium: hasRevenueCatPremium } = useSubscriptionStatus();
  const [activeSection, setActiveSection] = useState<CareJournalSection>(() =>
    isCareJournalSection(params.section) ? params.section : "record"
  );
  const [selectedBabyId, setSelectedBabyId] = useState<string>();
  const [entryType, setEntryType] = useState<CareEntryType>("breastfeeding");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [breastSide, setBreastSide] = useState<"left" | "right" | "both">("left");
  const [diaperType, setDiaperType] = useState<"wet" | "dirty" | "both">("wet");
  const [medicineName, setMedicineName] = useState("");
  const [medicineLookupName, setMedicineLookupName] = useState("");
  const [medicineDose, setMedicineDose] = useState("");
  const [reminderTime, setReminderTime] = useState(createDefaultReminderTime);
  const [notes, setNotes] = useState("");
  const [entrySubmitAttempted, setEntrySubmitAttempted] = useState(false);
  const [feedingContent, setFeedingContent] = useState<"breast_milk" | "formula" | "water">("breast_milk");
  const [sleepKind, setSleepKind] = useState<"day" | "night">("day");
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [temperature, setTemperature] = useState("");
  const [temperatureSite, setTemperatureSite] = useState<"armpit" | "ear" | "forehead" | "oral" | "other" | "rectal">("armpit");
  const [firstTry, setFirstTry] = useState(false);
  const [trendDays, setTrendDays] = useState<ReportPeriod>(7);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [pumpLeftAmount, setPumpLeftAmount] = useState("");
  const [pumpRightAmount, setPumpRightAmount] = useState("");
  const [mood, setMood] = useState(3);
  const [rest, setRest] = useState(3);
  const [selfCare, setSelfCare] = useState("");
  const [timerNow, setTimerNow] = useState(Date.now());
  const [predictionNow, setPredictionNow] = useState(Date.now());
  const [undoAction, setUndoAction] = useState<{ expiresAt: number; label: string; operationId: string } | null>(null);
  const [MilkInventoryComponent, setMilkInventoryComponent] = useState<ComponentType<MilkInventoryProps> | null>(null);
  const [milkInventoryLoading, setMilkInventoryLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPredictionNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMedicineLookupName(medicineName.trim()), 450);
    return () => clearTimeout(timer);
  }, [medicineName]);

  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const profileQuery = useQuery({ queryKey: ["current-profile"], queryFn: getCurrentProfile });
  const membershipQuery = useQuery({ queryKey: ["current-family-membership"], queryFn: getCurrentFamilyMembership });
  const currentUserQuery = useQuery({ queryKey: ["current-care-user-id"], queryFn: getCurrentCareUserId });
  const caregiverName = membershipQuery.data ? profileQuery.data?.father_name : profileQuery.data?.mother_name;
  const babies = Array.isArray(babiesQuery.data)
    ? babiesQuery.data.filter(
        (baby) =>
          baby &&
          typeof baby.id === "string" &&
          typeof baby.name === "string"
      )
    : [];
  const familyPremiumQuery = useQuery({ queryKey: ["family-premium-care", babies[0]?.id], queryFn: () => hasFamilyPremiumCareAccess(babies[0]?.id as string), enabled: Boolean(!hasRevenueCatPremium && babies[0]?.id) });
  const isPremium = hasRevenueCatPremium || Boolean(familyPremiumQuery.data);
  const selectedBaby = isPremium
    ? babies.find((item) => item.id === selectedBabyId) ?? babies[0]
    : babies[0];
  const syncStatusQuery = useCareSyncStatus(selectedBaby?.id);

  useEffect(() => {
    if (isCareJournalSection(params.section)) {
      setActiveSection(params.section);
    }
  }, [params.section]);

  useEffect(() => {
    if (
      params.entry &&
      isCareEntryType(params.entry) &&
      (isPremium || isFreeType(params.entry))
    ) {
      setEntryType(params.entry);
      if (!isCareJournalSection(params.section)) setActiveSection("record");
    }
  }, [isPremium, params.entry, params.section]);

  const entriesQuery = useQuery({
    queryKey: ["care-journal", selectedBaby?.id, isPremium, historyLimit],
    queryFn: () => listCareJournalEntries(selectedBaby?.id as string, isPremium ? historyLimit : 100),
    enabled: Boolean(selectedBaby?.id)
  });
  const entries = normalizeCareEntries(entriesQuery.data);
  const reportQuery = useQuery({ queryKey: ["care-journal-report", selectedBaby?.id], queryFn: () => listCareJournalEntriesSince(selectedBaby?.id as string, 30), enabled: Boolean(selectedBaby?.id) });
  const reportEntries = normalizeCareEntries(reportQuery.data);
  const remindersQuery = useQuery({ queryKey: ["care-reminders", selectedBaby?.id], queryFn: () => listCareReminders(selectedBaby?.id as string), enabled: Boolean(selectedBaby?.id) });
  const sleepPredictionQuery = useQuery({ queryKey: ["sleep-prediction", selectedBaby?.id], queryFn: () => getSleepPrediction(selectedBaby?.id as string), enabled: Boolean(isPremium && selectedBaby?.id) });
  const recentMedicineQuery = useQuery({ queryKey: ["recent-medicine-dose", selectedBaby?.id, medicineLookupName.toLocaleLowerCase("tr-TR")], queryFn: () => getRecentMedicineDose(selectedBaby?.id as string, medicineLookupName), enabled: Boolean(isPremium && selectedBaby?.id && entryType === "medicine" && medicineLookupName.length >= 2), staleTime: 15_000 });
  const handoverQuery = useQuery({ queryKey: ["care-handover", selectedBaby?.id], queryFn: () => getCareHandoverSnapshot(selectedBaby?.id as string), enabled: Boolean(selectedBaby?.id), refetchInterval: 30_000 });
  const activityQuery = useQuery({ queryKey: ["care-activity", selectedBaby?.id], queryFn: () => listCareJournalActivity(selectedBaby?.id as string, 8), enabled: Boolean(selectedBaby?.id) });
  const handoverSnapshot = normalizeHandoverSnapshot(handoverQuery.data);
  const activeTimers = handoverSnapshot?.active_timers ?? [];
  const activeTimer = activeTimers.find((timer) => timer.timer_type !== "pumping") ?? null;
  const activePumpLeft = activeTimers.find((timer) => timer.timer_type === "pumping" && timer.breast_side === "left") ?? null;
  const activePumpRight = activeTimers.find((timer) => timer.timer_type === "pumping" && timer.breast_side === "right") ?? null;
  const feedingMode = normalizeFeedingMode(profileQuery.data?.feeding_mode);
  const visibleEntryTypes = useMemo(() => orderEntryTypesForFeedingMode(feedingMode), [feedingMode]);
  const todayEntries = useMemo(
    () => entries.filter((entry) => isToday(entry.occurred_at)),
    [entries]
  );
  const completedSleepCount = useMemo(
    () =>
      entries.filter((entry) => {
        if (entry.entry_type !== "sleep" || !entry.ended_at) return false;
        const durationMs = Date.parse(entry.ended_at) - Date.parse(entry.occurred_at);
        return (
          durationMs > 5 * 60_000 &&
          durationMs <= 16 * 60 * 60_000 &&
          Date.parse(entry.occurred_at) >= Date.now() - 21 * 86_400_000
        );
      }).length,
    [entries]
  );

  useEffect(() => {
    if (activeTimers.length === 0) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimers.length]);

  useEffect(() => {
    if (!undoAction) return;
    const timeout = setTimeout(() => setUndoAction(null), Math.max(0, undoAction.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [undoAction]);

  async function invalidateCareEntries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["care-journal", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-journal-report", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-journal-home", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-handover", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-activity", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["care-sync-status", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["sleep-prediction", selectedBaby?.id] }),
      queryClient.invalidateQueries({ queryKey: ["recent-medicine-dose", selectedBaby?.id] })
    ]);
  }

  useEffect(() => {
    if (!selectedBaby?.id || !entriesQuery.isSuccess) return;
    return subscribeToCareJournalEntries(
      selectedBaby.id,
      (entry) => {
        if (
          entry.entry_type === "medicine" &&
          entry.created_by !== currentUserQuery.data
        ) {
          showInfo(
            `${entry.caregiver_name || "Başka bir bakıcı"} az önce ilaç/vitamin kaydı ekledi. Yeni bir doz vermeden önce kaydı kontrol et.`,
            "Doz kaydedildi"
          );
        }
      },
      () => {
        invalidateCareEntries().catch(() => undefined);
      }
    );
  }, [currentUserQuery.data, entriesQuery.isSuccess, selectedBaby?.id]);

  useEffect(() => {
    if (!selectedBaby?.id) return;
    return subscribeToCareCoordination(selectedBaby.id, () => {
      invalidateCareEntries().catch(() => undefined);
    });
  }, [selectedBaby?.id]);

  const addMutation = useMutation<CareSyncResult<CareJournalViewEntry>, Error, boolean>({
    mutationFn: async (overrideRecent) => {
      if (!selectedBaby) throw new Error("Önce bir bebek profili oluşturmalısın.");

      const amountMl = amount ? Number(amount.replace(",", ".")) : null;
      const durationMinutes = duration ? Number(duration) : null;
      if (amountMl !== null && (!Number.isFinite(amountMl) || amountMl <= 0)) {
        throw new Error("Miktarı ml olarak doğru girmelisin.");
      }
      if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
        throw new Error("Süreyi dakika olarak doğru girmelisin.");
      }
      if (entryType === "medicine" && !medicineName.trim()) {
        throw new Error("İlaç veya vitamin adını girmelisin.");
      }
      if (entryType === "solid_food" && !foodName.trim()) throw new Error("Besin adını girmelisin.");
      const temperatureC = temperature ? Number(temperature.replace(",", ".")) : null;
      if (
        entryType === "temperature" &&
        (temperatureC === null || !Number.isFinite(temperatureC) || temperatureC < 30 || temperatureC > 45)
      ) {
        throw new Error("Ateşi 30,0–45,0 °C arasında girmelisin.");
      }

      const now = Date.now();
      const occurredAt = durationMinutes
        ? new Date(now - durationMinutes * 60_000).toISOString()
        : new Date(now).toISOString();
      const endedAt = durationMinutes ? new Date(now).toISOString() : null;

      if (entryType === "medicine") {
        return addMedicineCareEntrySafely({
          babyId: selectedBaby.id,
          caregiverName: caregiverName || null,
          medicineDose: medicineDose.trim() || null,
          medicineName: medicineName.trim(),
          notes: notes.trim() || null,
          occurredAt,
          overrideRecent
        });
      }

      const saved = await addCareJournalEntry({
        amount_ml: entryType === "bottle" || entryType === "pumping" ? amountMl : null,
        baby_id: selectedBaby.id,
        caregiver_name: caregiverName || null,
        breast_side: entryType === "breastfeeding" ? breastSide : null,
        diaper_type: entryType === "diaper" ? diaperType : null,
        ended_at: entryType === "breastfeeding" || entryType === "sleep" ? endedAt : null,
        entry_type: entryType,
        feeding_content: entryType === "bottle" ? feedingContent : null,
        food_amount: entryType === "solid_food" ? foodAmount.trim() || null : null,
        food_name: entryType === "solid_food" ? foodName.trim() : null,
        is_first_try: entryType === "solid_food" && firstTry,
        medicine_dose: null,
        medicine_name: null,
        notes: notes.trim() || null,
        occurred_at: occurredAt,
        sleep_kind: entryType === "sleep" ? sleepKind : null,
        temperature_c: entryType === "temperature" ? temperatureC : null,
        temperature_site: entryType === "temperature" ? temperatureSite : null
      });
      return saved;
    },
    onSuccess: async (result) => {
      setAmount("");
      setDuration("");
      setMedicineName("");
      setMedicineDose("");
      setNotes("");
      setFoodName("");
      setFoodAmount("");
      setTemperature("");
      setFirstTry(false);
      setEntrySubmitAttempted(false);
      setUndoAction({ expiresAt: Date.now() + 15_000, label: "Kayıt eklendi", operationId: result.operationId });
      showSuccess(result.queued ? "İnternet gelince aile günlüğüyle eşitlenecek." : "Bakım kaydı aile günlüğüne eklendi.");
      await invalidateCareEntries();
    },
    onError: (error) => {
      if (error instanceof RecentMedicineDoseError) {
        showRecentMedicineConfirmation(error.recentDose, () => addMutation.mutate(true));
        return;
      }
      showError(error, "Bakım kaydı eklenemedi");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: CareJournalEntry) => deleteCareJournalEntry(entry, caregiverName || null),
    onSuccess: async (result) => {
      setUndoAction({ expiresAt: Date.now() + 15_000, label: "Kayıt silindi", operationId: result.operationId });
      showSuccess(result.queued ? "Silme işlemi bağlantı gelince eşitlenecek." : "Kayıt silindi.");
      await invalidateCareEntries();
    },
    onError: (error) => showError(error, "Kayıt silinemedi")
  });

  const checkinMutation = useMutation({ mutationFn: async () => {
    if (!profileQuery.data) throw new Error("Profil bulunamadı.");
    return saveMotherWellbeingCheckin({ profile_id: profileQuery.data.id, mood, rest, self_care_note: selfCare.trim() || null, checkin_date: new Date().toISOString().slice(0, 10) });
  }, onSuccess: () => { setSelfCare(""); showSuccess("Bugünkü anne check-in’i kaydedildi."); }, onError: (e) => showError(e, "Check-in kaydedilemedi") });
  const timerMutation = useMutation({
    mutationFn: async (command: { action: "start"; type: "breastfeeding" | "sleep" | "pumping"; side?: "left" | "right" } | { action: "stop"; timer: CareActiveTimer; amountMl?: number | null }) => {
      if (!selectedBaby) throw new Error("Bebek profili gerekli.");
      if (command.action === "stop") {
        return { action: "stop" as const, result: await stopSharedCareTimer(command.timer, caregiverName || null, command.amountMl ?? null) };
      }
      return {
        action: "start" as const,
        result: await startSharedCareTimer({
          actorName: caregiverName || null,
          babyId: selectedBaby.id,
          breastSide: command.side ?? breastSide,
          sleepKind,
          timerType: command.type
        })
      };
    },
    onSuccess: async ({ action, result }) => {
      setTimerNow(Date.now());
      if (action === "stop" && result.data.timer_type === "pumping") {
        if (result.data.breast_side === "left") setPumpLeftAmount("");
        if (result.data.breast_side === "right") setPumpRightAmount("");
      }
      showSuccess(
        result.queued
          ? "Zamanlayıcı cihazda başladı; bağlantı gelince aileyle eşitlenecek."
          : action === "start"
            ? "Zamanlayıcı aileyle paylaşıldı."
            : "Zamanlayıcı bitirildi ve günlüğe eklendi."
      );
      await invalidateCareEntries();
    },
    onError: (e) => showError(e, "Ortak zamanlayıcı güncellenemedi")
  });
  const handoverMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby || !caregiverName) throw new Error("Bakımı devralmak için profil adı gerekli.");
      return takeOverBabyCare(selectedBaby.id, caregiverName);
    },
    onSuccess: async (result) => {
      showSuccess(result.queued ? "Devralma bağlantı gelince aileyle eşitlenecek." : "Bakım sende. Aile özeti güncellendi.");
      await invalidateCareEntries();
    },
    onError: (e) => showError(e, "Bakım devralınamadı")
  });
  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!undoAction) throw new Error("Geri alınacak işlem yok.");
      return undoCareJournalOperation(undoAction.operationId, caregiverName || null);
    },
    onSuccess: async () => {
      setUndoAction(null);
      showSuccess("Son işlem geri alındı.");
      await invalidateCareEntries();
    },
    onError: (e) => showError(e, "İşlem geri alınamadı")
  });
  const reminderMutation = useMutation({ mutationFn: async () => {
    if (!selectedBaby) throw new Error("Bebek profili gerekli.");
    const scheduledFor = normalizeNextReminderTime(reminderTime);
    const {
      cancelLocalCareReminder,
      getCareReminderCopy,
      scheduleCareReminderAt
    } = await import("@/features/care-journal/reminders");
    const copy = getCareReminderCopy(entryType, selectedBaby.name);
    const localId = await scheduleCareReminderAt(entryType, scheduledFor, selectedBaby.name);
    try {
      const { registerAndSavePushToken } = await import("@/lib/notifications");
      const pushTokenRow = await registerAndSavePushToken().catch(() => null);
      return await addCareReminder({ baby_id: selectedBaby.id, entry_type: entryType, scheduled_for: scheduledFor.toISOString(), title: copy.title, body: copy.body, local_notification_id: localId, creator_push_token: pushTokenRow?.expo_push_token ?? null });
    } catch (error) {
      await cancelLocalCareReminder(localId).catch(() => undefined);
      throw error;
    }
  }, onSuccess: async () => { setReminderTime(createDefaultReminderTime()); showSuccess("Alarm kuruldu. Uygulama kapalıyken de bildirim gelecek."); await queryClient.invalidateQueries({ queryKey: ["care-reminders", selectedBaby?.id] }); }, onError: (e) => showError(e, "Alarm kurulamadı") });
  const cancelReminderMutation = useMutation({ mutationFn: async (reminder: CareReminder) => { const { cancelLocalCareReminder } = await import("@/features/care-journal/reminders"); await cancelLocalCareReminder(reminder.local_notification_id).catch(() => undefined); return cancelCareReminder(reminder.id); }, onSuccess: async () => { showSuccess("Alarm iptal edildi."); await queryClient.invalidateQueries({ queryKey: ["care-reminders", selectedBaby?.id] }); }, onError: (e) => showError(e, "Alarm iptal edilemedi") });

  async function openPremium(feature: string) {
    try { await showPaywallIfNeeded(feature, { feature }); } catch (error) { showError(error, "Premium ekranı açılamadı"); }
  }

  async function exportPermanentArchive() {
    if (!selectedBaby) return;
    try {
      const { shareCareJournalArchive } = await import("@/features/care-journal/report");
      const { listMilkContainers, listMilkStorageEvents } = await import(
        "@/features/care-journal/milkInventory"
      );
      const [allEntries, containers, milkEvents] = await Promise.all([
        listAllCareJournalEntries(selectedBaby.id),
        listMilkContainers(selectedBaby.id),
        listMilkStorageEvents(selectedBaby.id)
      ]);
      await shareCareJournalArchive(selectedBaby, allEntries, containers, milkEvents);
    } catch (error) {
      showError(error, "Kalıcı arşiv oluşturulamadı");
    }
  }

  async function shareReport() {
    if (!selectedBaby) return;
    try {
      const { shareCareJournalReport } = await import("@/features/care-journal/report");
      const scopedEntries = reportEntries.filter(
        (entry) => Date.parse(entry.occurred_at) >= Date.now() - trendDays * 86_400_000
      );
      await shareCareJournalReport(selectedBaby, scopedEntries, trendDays);
    } catch (error) {
      showError(error, "PDF oluşturulamadı");
    }
  }

  async function openMilkInventory() {
    if (MilkInventoryComponent || milkInventoryLoading) return;
    setMilkInventoryLoading(true);
    try {
      const module = await import("@/features/care-journal/MilkInventoryCard");
      setMilkInventoryComponent(() => module.MilkInventoryCard);
    } catch (error) {
      showError(error, "Süt stoğu açılamadı");
    } finally {
      setMilkInventoryLoading(false);
    }
  }

  async function openNextSyncConflict() {
    if (!selectedBaby) return;
    const conflict = (await getCareSyncConflicts(selectedBaby.id))[0];
    if (!conflict) return;
    Alert.alert(
      "Senkronizasyon çakışması",
      `${conflict.error}\n\nKayıt cihazda korunuyor. Bilgiyi kontrol ettikten sonra yeniden eşitleyebilir veya bu cihazdaki işlemi iptal edebilirsin.`,
      [
        { text: "Beklet", style: "cancel" },
        {
          text: "Bu işlemi iptal et",
          style: "destructive",
          onPress: () => {
            discardCareSyncConflict(conflict.operationId)
              .then(() => invalidateCareEntries())
              .catch((error) => showError(error, "Çakışma kaldırılamadı"));
          }
        },
        {
          text: conflict.kind === "entry" && conflict.action === "create" ? "Kontrol ettim, eşitle" : "Güvenli birleştir",
          onPress: () => {
            retryCareSyncConflict(conflict.operationId)
              .then(() => invalidateCareEntries())
              .catch((error) => showError(error, "Kayıt eşitlenemedi"));
          }
        }
      ]
    );
  }

  if (babiesQuery.isLoading || profileQuery.isLoading || membershipQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Bakım günlüğü hazırlanıyor…" />
      </Screen>
    );
  }

  if (babiesQuery.isError || profileQuery.isError || membershipQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Bebek ve profil bilgileri alınamadı. Kayıtların silinmedi; bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() => {
            void Promise.all([babiesQuery.refetch(), profileQuery.refetch(), membershipQuery.refetch()]);
          }}
          retrying={babiesQuery.isFetching || profileQuery.isFetching || membershipQuery.isFetching}
          title="Bakım bilgileri yüklenemedi"
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
          description="Beslenme, uyku ve bez kayıtları doğum sonrası deneyime aittir. Doğum gerçekleştiğinde Profil ekranından geçişi tamamlayabilirsin."
          onActionPress={() => router.replace("/pregnancy-tools")}
          title="Bakım günlüğü doğum sonrasında açılır"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.theme.primarySoft }]}>
          <View style={[styles.iconBubble, { backgroundColor: appTheme.theme.accentSoft }]}>
            <Baby color={appTheme.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>{isPremium ? "Premium aile alanı" : "Anne + bebek"}</Text>
          <Text style={typography.heading1}>Akıllı bakım günlüğü</Text>
          <Text style={styles.heroText}>Son bakımı hatırlamaya çalışma; ailece kaydet, günün akışını tek bakışta gör.</Text>
        </View>

        {babies.length === 0 ? (
          <EmptyState title="Bebek profili gerekli" description="Günlüğü kullanmak için Bebek sekmesinden bir profil oluştur." />
        ) : (
          <>
            {isPremium && babies.length > 1 ? (
              <View style={styles.chips}>
                {babies.map((baby) => (
                  <ChoiceChip key={baby.id} active={baby.id === selectedBaby?.id} label={baby.name} onPress={() => setSelectedBabyId(baby.id)} />
                ))}
              </View>
            ) : null}

            <CareJournalSectionNav activeSection={activeSection} onChange={setActiveSection} />
            <CareSyncBanner onResolve={() => void openNextSyncConflict()} status={syncStatusQuery.data} />

            {activeSection === "plan" ? (
              <CareSectionBoundary title="Bakım alarmları">
                {remindersQuery.isError ? (
                  <QueryState
                    compact
                    description="Planlı bakım alarmları alınamadı."
                    onRetry={() => void remindersQuery.refetch()}
                    retrying={remindersQuery.isFetching}
                  />
                ) : <ReminderCard currentUserId={currentUserQuery.data ?? null} entryType={entryType} isPremium={isPremium} reminders={Array.isArray(remindersQuery.data) ? remindersQuery.data : []} reminderTime={reminderTime} onTimeChange={setReminderTime} scheduling={reminderMutation.isPending} cancelling={cancelReminderMutation.isPending} onSchedule={() => reminderMutation.mutate()} onCancel={(reminder) => cancelReminderMutation.mutate(reminder)} />}
              </CareSectionBoundary>
            ) : null}

            {activeSection === "insights" ? (
              <DoctorReportCard
                onOpen={() =>
                  router.push({
                    pathname: "/doctor-visit",
                    params: {
                      babyId: selectedBaby?.id,
                      subject: "baby"
                    }
                  })
                }
              />
            ) : null}

            {activeSection === "family" ? (
              <CareSectionBoundary title="Canlı aile vardiyası">
                {handoverQuery.isError || activityQuery.isError ? (
                  <QueryState
                    compact
                    description="Canlı aile bakım bilgisi alınamadı."
                    onRetry={() => void Promise.all([handoverQuery.refetch(), activityQuery.refetch()])}
                    retrying={handoverQuery.isFetching || activityQuery.isFetching}
                  />
                ) : <CareHandoverCard
                  activity={Array.isArray(activityQuery.data) ? activityQuery.data : []}
                  babyName={selectedBaby?.name ?? "Bebek"}
                  currentUserId={currentUserQuery.data ?? null}
                  loading={handoverQuery.isLoading}
                  now={timerNow}
                  onTakeOver={() => handoverMutation.mutate()}
                  snapshot={handoverSnapshot}
                  takingOver={handoverMutation.isPending}
                />}
              </CareSectionBoundary>
            ) : null}

            {activeSection === "plan" ? (
              <CareSectionBoundary title="Uyku ve sağım">
                <View style={{ gap: spacing.lg }}>
                {sleepPredictionQuery.isError ? (
                  <QueryState
                    compact
                    description="Uyku öngörüsü şu anda alınamadı."
                    onRetry={() => void sleepPredictionQuery.refetch()}
                    retrying={sleepPredictionQuery.isFetching}
                  />
                ) : <SleepPredictionCard
                  completedSleepCount={completedSleepCount}
                  isPremium={isPremium}
                  loading={sleepPredictionQuery.isLoading}
                  now={predictionNow}
                  onOpenPremium={() => void openPremium("sleep_prediction")}
                  prediction={sleepPredictionQuery.data ?? null}
                />}

                {isPremium && (feedingMode === "pumping" || feedingMode === "mixed") ? (
                  <PumpingFocusCard
                    blocked={Boolean(activeTimer)}
                    leftAmount={pumpLeftAmount}
                    leftTimer={activePumpLeft}
                    now={timerNow}
                    onLeftAmountChange={setPumpLeftAmount}
                    onRightAmountChange={setPumpRightAmount}
                    onStart={(side) => timerMutation.mutate({ action: "start", type: "pumping", side })}
                    onStop={(timer, amountValue) => {
                      const parsed = amountValue.trim() ? Number(amountValue.replace(",", ".")) : null;
                      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
                        showInfo("Miktarı ml olarak doğru gir.", "Miktarı kontrol et");
                        return;
                      }
                      timerMutation.mutate({ action: "stop", timer, amountMl: parsed });
                    }}
                    pending={timerMutation.isPending}
                    rightAmount={pumpRightAmount}
                    rightTimer={activePumpRight}
                  />
                ) : null}
                </View>
              </CareSectionBoundary>
            ) : null}

            {activeSection === "record" ? <Card>
              <View style={{ gap: spacing.lg }}>
                <View style={{ gap: spacing.xs }}>
                  <Text style={typography.heading2}>Şimdi kaydet</Text>
                  <Text style={typography.body}>Kayıt saati otomatik olarak şimdi alınır.</Text>
                </View>
                <View style={styles.chips}>
                  {visibleEntryTypes.map((item) => (
                    <ChoiceChip key={item.type} active={entryType === item.type} label={`${item.label}${!isPremium && !isFreeType(item.type) ? " · Premium" : ""}`} onPress={() => { if (!isPremium && !isFreeType(item.type)) { void openPremium(`care_${item.type}`); return; } setEntryType(item.type); }} />
                  ))}
                </View>
                {entryType === "breastfeeding" ? (
                  <>
                    <Text style={typography.label}>Meme tarafı</Text>
                    <View style={styles.chips}>
                      <ChoiceChip active={breastSide === "left"} label="Sol" onPress={() => setBreastSide("left")} />
                      <ChoiceChip active={breastSide === "right"} label="Sağ" onPress={() => setBreastSide("right")} />
                      <ChoiceChip active={breastSide === "both"} label="İkisi" onPress={() => setBreastSide("both")} />
                    </View>
                  </>
                ) : null}
                {entryType === "diaper" ? (
                  <View style={styles.chips}>
                    <ChoiceChip active={diaperType === "wet"} label="Islak" onPress={() => setDiaperType("wet")} />
                    <ChoiceChip active={diaperType === "dirty"} label="Kaka" onPress={() => setDiaperType("dirty")} />
                    <ChoiceChip active={diaperType === "both"} label="İkisi" onPress={() => setDiaperType("both")} />
                  </View>
                ) : null}
                {entryType === "bottle" ? <View style={styles.chips}><ChoiceChip active={feedingContent === "breast_milk"} label="Anne sütü" onPress={() => setFeedingContent("breast_milk")} /><ChoiceChip active={feedingContent === "formula"} label="Mama" onPress={() => setFeedingContent("formula")} /><ChoiceChip active={feedingContent === "water"} label="Su" onPress={() => setFeedingContent("water")} /></View> : null}
                {entryType === "sleep" ? <View style={styles.chips}><ChoiceChip active={sleepKind === "day"} label="Gündüz uykusu" onPress={() => setSleepKind("day")} /><ChoiceChip active={sleepKind === "night"} label="Gece uykusu" onPress={() => setSleepKind("night")} /></View> : null}
                {entryType === "bottle" || entryType === "pumping" ? (
                  <TextField
                    error={
                      entrySubmitAttempted && (!amount.trim() || !Number.isFinite(Number(amount.replace(",", "."))) || Number(amount.replace(",", ".")) <= 0)
                        ? "Miktarı ml olarak doğru gir."
                        : undefined
                    }
                    keyboardType="decimal-pad"
                    label="Miktar (ml)"
                    value={amount}
                    onChangeText={setAmount}
                  />
                ) : null}
                {entryType === "breastfeeding" || entryType === "sleep" ? (
                  <><View style={styles.timerBox}><Text style={styles.timerValue}>{activeTimer?.timer_type === entryType ? formatTimer(timerNow - Date.parse(activeTimer.started_at)) : "00:00"}</Text><Text style={styles.entryMeta}>{activeTimer ? `${activeTimer.started_by_name || "Bir bakıcı"} başlattı · tüm ailede canlı` : activePumpLeft || activePumpRight ? "Önce aktif sağımı bitir" : "Aile senkronlu zamanlayıcı"}</Text></View><Button variant="secondary" label={activeTimer?.timer_type === entryType ? "Bitir ve kaydet" : "Zamanlayıcıyı başlat"} disabled={timerMutation.isPending || Boolean(activePumpLeft || activePumpRight) || Boolean(activeTimer && activeTimer.timer_type !== entryType)} onPress={() => { if (activeTimer?.timer_type === entryType) timerMutation.mutate({ action: "stop", timer: activeTimer }); else timerMutation.mutate({ action: "start", type: entryType }); }} /><TextField keyboardType="number-pad" label="Ya da süreyi dakika gir" value={duration} onChangeText={setDuration} /></>
                ) : null}
                {entryType === "medicine" ? (
                  <>
                    <TextField error={entrySubmitAttempted && !medicineName.trim() ? "İlaç veya vitamin adını gir." : undefined} label="İlaç / vitamin adı" value={medicineName} onChangeText={setMedicineName} />
                    <TextField label="Doz (örn. 3 damla)" value={medicineDose} onChangeText={setMedicineDose} />
                    {recentMedicineQuery.data ? (
                      <MedicineSafetyNotice dose={recentMedicineQuery.data} />
                    ) : null}
                    <Text style={styles.safetyNote}>
                      Yalnızca doktorunun önerdiği ilaç ve dozu kaydet. Bu günlük tıbbi öneri veya doz belirleme aracı değildir.
                    </Text>
                  </>
                ) : null}
                {entryType === "solid_food" ? <><TextField error={entrySubmitAttempted && !foodName.trim() ? "Besin adını gir." : undefined} label="Besin" value={foodName} onChangeText={setFoodName} /><TextField label="Miktar (örn. 3 kaşık)" value={foodAmount} onChangeText={setFoodAmount} /><ChoiceChip active={firstTry} label={firstTry ? "İlk deneme ✓" : "İlk deneme"} onPress={() => setFirstTry((value) => !value)} /></> : null}
                {entryType === "temperature" ? <><TextField error={entrySubmitAttempted && (!Number.isFinite(Number(temperature.replace(",", "."))) || Number(temperature.replace(",", ".")) < 30 || Number(temperature.replace(",", ".")) > 45) ? "30,0–45,0 °C arasında bir değer gir." : undefined} keyboardType="decimal-pad" label="Ateş (°C)" placeholder="36,7" value={temperature} onChangeText={setTemperature} /><Text style={typography.label}>Ölçüm yeri</Text><View style={styles.chips}><ChoiceChip active={temperatureSite === "armpit"} label="Koltuk altı" onPress={() => setTemperatureSite("armpit")} /><ChoiceChip active={temperatureSite === "forehead"} label="Alın" onPress={() => setTemperatureSite("forehead")} /><ChoiceChip active={temperatureSite === "ear"} label="Kulak" onPress={() => setTemperatureSite("ear")} /><ChoiceChip active={temperatureSite === "other"} label="Diğer" onPress={() => setTemperatureSite("other")} /></View><Text style={styles.safetyNote}>Bu alan yalnızca ölçümü kaydeder; ateş değerlendirmesi veya tıbbi yönlendirme yapmaz.</Text></> : null}
                <TextField label="Not (isteğe bağlı)" maxLength={500} value={notes} onChangeText={setNotes} />
                <Button disabled={addMutation.isPending} label={addMutation.isPending ? "Kaydediliyor..." : `${entryLabel(entryType)} kaydet`} onPress={() => { setEntrySubmitAttempted(true); addMutation.mutate(false); }} />
              </View>
            </Card> : null}

            {activeSection === "record" ? <CareSectionBoundary title="Bugünkü bakım özeti">
              <TodaySummary entries={todayEntries} babyName={selectedBaby?.name ?? "Bebek"} />
            </CareSectionBoundary> : null}

            {activeSection !== "record" ? <CareSectionBoundary
              title={activeSection === "plan" ? "Süt ve beslenme araçları" : activeSection === "family" ? "Aile desteği" : "Bakım eğilimleri"}
            >
              {isPremium ? (
                <View style={{ gap: spacing.lg }}>
                {activeSection === "insights" ? <InsightsCard entries={reportEntries} days={trendDays} onArchive={() => void exportPermanentArchive()} onDaysChange={setTrendDays} /> : null}
                {activeSection === "plan" && selectedBaby && MilkInventoryComponent ? (
                  <MilkInventoryComponent actorName={caregiverName || null} babyId={selectedBaby.id} />
                ) : activeSection === "plan" && selectedBaby ? (
                  <Card>
                    <View style={{ gap: spacing.md }}>
                      <View style={styles.cardTitleRow}>
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <Text style={typography.eyebrow}>Premium · kalıcı stok</Text>
                          <Text style={typography.heading2}>Anne sütü stoğu</Text>
                        </View>
                        <Milk color={colors.sageGreen} size={26} />
                      </View>
                      <Text style={typography.body}>Saklanan sütleri, son kullanım zamanını ve önce sağılanı önce kullanma sırasını yönet.</Text>
                      <Button disabled={milkInventoryLoading} label={milkInventoryLoading ? "Açılıyor..." : "Süt stoğunu aç"} variant="secondary" onPress={() => void openMilkInventory()} />
                    </View>
                  </Card>
                ) : null}
                {activeSection === "family" ? (
                  <Card>
                    <View style={{ gap: spacing.md }}>
                      <Text style={typography.eyebrow}>İki cihazda ortak</Text>
                      <Text style={typography.heading2}>Aile görevleri ve alarmlar</Text>
                      <Text style={typography.body}>
                        Hazır görevlerden seç veya kendi görevini yaz; anneye, baba/bakıcıya ya da ikinize ata. Zamanlı alarm yalnız görevli kişilerin cihazlarında çalar.
                      </Text>
                      <Button
                        label="Aile görevlerini aç"
                        onPress={() => router.push("/family-planner")}
                      />
                    </View>
                  </Card>
                ) : null}
                {activeSection === "family" && membershipQuery.isSuccess && !membershipQuery.data ? (
                  <Card>
                    <View style={{ gap: spacing.md }}>
                      <Text style={typography.eyebrow}>Anne için</Text>
                      <Text style={typography.heading2}>Bugün nasılsın?</Text>
                      <Text style={typography.label}>Ruh hali</Text>
                      <Rating value={mood} onChange={setMood} />
                      <Text style={typography.label}>Dinlenmişlik</Text>
                      <Rating value={rest} onChange={setRest} />
                      <TextField label="Bugün kendin için ne yaptın?" value={selfCare} onChangeText={setSelfCare} />
                      <Button disabled={checkinMutation.isPending} label={checkinMutation.isPending ? "Kaydediliyor..." : "Anne check-in’ini kaydet"} onPress={() => checkinMutation.mutate()} />
                      <Text style={styles.safetyNote}>Bu alan iyi oluş farkındalığı içindir; değerlendirme veya teşhis yapmaz. Kendin ya da bebeğin için acil bir endişen varsa sağlık profesyoneline başvur.</Text>
                    </View>
                  </Card>
                ) : null}
                </View>
              ) : <PremiumUpsellCard onPress={() => void openPremium("care_insights")} />}
            </CareSectionBoundary> : null}

            {activeSection === "record" ? <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>Günlük zaman akışı</Text>
              {undoAction ? <View style={styles.undoBar}><View style={{ flex: 1 }}><Text style={typography.label}>{undoAction.label}</Text><Text style={styles.entryMeta}>15 saniye içinde geri alabilirsin.</Text></View><Button disabled={undoMutation.isPending} label="Geri al" variant="ghost" onPress={() => undoMutation.mutate()} /></View> : null}
              {entriesQuery.isLoading ? <QueryState compact loading description="Kayıtlar yükleniyor…" /> : null}
              {entriesQuery.isError ? (
                <QueryState
                  compact
                  description="Zaman akışı alınamadı. Çevrimdışı kayıtların korunuyor."
                  onRetry={() => void entriesQuery.refetch()}
                  retrying={entriesQuery.isFetching}
                  title="Kayıtlar yüklenemedi"
                />
              ) : null}
              {!entriesQuery.isLoading && !entriesQuery.isError && entries.length === 0 ? (
                <EmptyState title="Henüz kayıt yok" description="İlk bakım kaydını eklediğinde aile zaman akışı burada oluşacak." />
              ) : null}
              {entries.slice(0, isPremium ? historyLimit : 30).map((entry) => (
                <EntryCard key={entry.id} entry={entry} deleting={deleteMutation.isPending} onDelete={() => deleteMutation.mutate(entry)} />
              ))}
              {isPremium && entries.length >= historyLimit ? (
                <Button label="Daha eski kayıtları göster" variant="secondary" onPress={() => setHistoryLimit((value) => value + 100)} />
              ) : null}
            </View> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function PumpingFocusCard({
  blocked, leftAmount, leftTimer, now, onLeftAmountChange, onRightAmountChange,
  onStart, onStop, pending, rightAmount, rightTimer
}: {
  blocked: boolean; leftAmount: string; leftTimer: CareActiveTimer | null; now: number;
  onLeftAmountChange: (value: string) => void; onRightAmountChange: (value: string) => void;
  onStart: (side: "left" | "right") => void;
  onStop: (timer: CareActiveTimer, amount: string) => void;
  pending: boolean; rightAmount: string; rightTimer: CareActiveTimer | null;
}) {
  return (
    <Card style={styles.pumpFocusCard}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}><Text style={typography.eyebrow}>Sağım modu · aile senkronlu</Text><Text style={typography.heading2}>İki tarafı ayrı takip et</Text><Text style={styles.entryMeta}>Telefon kilitlense veya uygulama arka plana alınsa da sunucu başlangıç saati ve kilit ekranı sayacı korunur.</Text></View>
        <View style={styles.pumpColumns}>
          <View style={styles.pumpColumn}>
            <Text style={typography.label}>Sol meme</Text>
            <Text style={styles.timerValue}>{leftTimer ? formatTimer(now - Date.parse(leftTimer.started_at)) : "00:00"}</Text>
            {leftTimer ? <TextField keyboardType="decimal-pad" label="Çıkan (ml)" value={leftAmount} onChangeText={onLeftAmountChange} /> : null}
            <Button variant={leftTimer ? "secondary" : "primary"} disabled={pending || (blocked && !leftTimer)} label={leftTimer ? "Solu bitir" : "Solu başlat"} onPress={() => leftTimer ? onStop(leftTimer, leftAmount) : onStart("left")} />
          </View>
          <View style={styles.pumpColumn}>
            <Text style={typography.label}>Sağ meme</Text>
            <Text style={styles.timerValue}>{rightTimer ? formatTimer(now - Date.parse(rightTimer.started_at)) : "00:00"}</Text>
            {rightTimer ? <TextField keyboardType="decimal-pad" label="Çıkan (ml)" value={rightAmount} onChangeText={onRightAmountChange} /> : null}
            <Button variant={rightTimer ? "secondary" : "primary"} disabled={pending || (blocked && !rightTimer)} label={rightTimer ? "Sağı bitir" : "Sağı başlat"} onPress={() => rightTimer ? onStop(rightTimer, rightAmount) : onStart("right")} />
          </View>
        </View>
        {(leftTimer || rightTimer) ? <Text style={styles.pendingText}>{leftTimer?.started_by_name || rightTimer?.started_by_name || "Bir bakıcı"} başlattı · diğer aile üyesi de bitirebilir.</Text> : null}
      </View>
    </Card>
  );
}

function TodaySummary({ babyName, entries }: { babyName: string; entries: CareJournalEntry[] }) {
  const feeding = entries.filter((e) => e.entry_type === "breastfeeding" || e.entry_type === "bottle").length;
  const diapers = entries.filter((e) => e.entry_type === "diaper").length;
  const sleepMinutes = entries.filter((e) => e.entry_type === "sleep").reduce((sum, e) => sum + durationInMinutes(e), 0);
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text style={typography.heading2}>{babyName} · Bugün</Text>
        <View style={styles.summaryGrid}>
          <SummaryItem icon={<Milk color={colors.dustyRose} size={20} />} label="Beslenme" value={`${feeding} kayıt`} />
          <SummaryItem icon={<Droplets color={colors.sageGreen} size={20} />} label="Bez" value={`${diapers} değişim`} />
          <SummaryItem icon={<Moon color={colors.nightPlum} size={20} />} label="Uyku" value={formatMinutes(sleepMinutes)} />
        </View>
      </View>
    </Card>
  );
}

function CareSyncBanner({ onResolve, status }: { onResolve: () => void; status?: { conflicts: number; isOnline: boolean; pending: number } }) {
  if (!status || (status.isOnline && status.pending === 0 && status.conflicts === 0)) return null;
  const hasConflict = status.conflicts > 0;
  return (
    <View style={[styles.syncBanner, hasConflict && styles.syncBannerConflict]}>
      {status.isOnline ? <RefreshCw color={hasConflict ? colors.danger : colors.sageGreen} size={18} /> : <WifiOff color={colors.textMuted} size={18} />}
      <View style={{ flex: 1 }}>
        <Text style={typography.label}>{hasConflict ? "İncelenmesi gereken kayıt var" : status.isOnline ? "Aile günlüğü eşitleniyor" : "Çevrimdışı kayıt açık"}</Text>
        <Text style={styles.entryMeta}>{hasConflict ? `${status.conflicts} işlem veri kaybetmeden bekletiliyor.` : `${status.pending} işlem bağlantı gelince otomatik gönderilecek.`}</Text>
      </View>
      {hasConflict ? <Pressable accessibilityRole="button" hitSlop={8} onPress={onResolve} style={styles.syncAction}><Text style={styles.syncActionText}>İncele</Text></Pressable> : null}
    </View>
  );
}

function CareHandoverCard({
  activity,
  babyName,
  currentUserId,
  loading,
  now,
  onTakeOver,
  snapshot,
  takingOver
}: {
  activity: CareJournalActivity[];
  babyName: string;
  currentUserId: string | null;
  loading: boolean;
  now: number;
  onTakeOver: () => void;
  snapshot: CareHandoverSnapshot | null;
  takingOver: boolean;
}) {
  if (loading) return <Card style={styles.nowCard}><Text style={typography.body}>Bakım özeti hazırlanıyor...</Text></Card>;
  const activeSleep = snapshot?.active_timer?.timer_type === "sleep" ? snapshot.active_timer : null;
  const medicine = snapshot?.last_medicine;
  const isCurrentCaregiver = snapshot?.handover?.caregiver_id === currentUserId;
  const lastActivity = activity.slice(0, 3);

  return (
    <Card style={styles.nowCard}>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>Canlı aile vardiyası</Text>
            <Text style={typography.heading2}>{babyName} için bakımı devral</Text>
            <Text style={styles.entryMeta}>{snapshot?.handover ? `${snapshot.handover.caregiver_name} · ${relativeTime(snapshot.handover.started_at)} devraldı` : "Şu anda atanmış bir bakıcı yok"}</Text>
          </View>
          <View style={styles.handoverIcon}><HandHeart color={colors.sageGreen} size={25} /></View>
        </View>

        <View style={styles.handoverList}>
          <HandoverRow icon={<Milk color={colors.dustyRose} size={18} />} label="Son beslenme" value={formatFeedHandover(snapshot?.last_feed ?? null)} />
          <HandoverRow icon={<Droplets color={colors.sageGreen} size={18} />} label="Son bez" value={snapshot?.last_diaper ? `${diaperLabel(snapshot.last_diaper.diaper_type)} · ${relativeTime(snapshot.last_diaper.occurred_at)}` : "Kayıt yok"} />
          <HandoverRow icon={<Moon color={colors.nightPlum} size={18} />} label="Uyku" value={activeSleep ? `Şu anda uyuyor · ${formatTimer(now - Date.parse(activeSleep.started_at))}` : snapshot?.last_sleep?.ended_at ? `${relativeTime(snapshot.last_sleep.ended_at)} uyandı` : "Aktif uyku yok"} />
          <HandoverRow icon={<Pill color={colors.accent} size={18} />} label="İlaç / vitamin" value={`${medicine ? `${medicine.medicine_name || "Son doz"} · ${relativeTime(medicine.occurred_at)}` : "Son doz kaydı yok"} · D vitamini bugün ${snapshot?.vitamin_given_today ? "kaydedildi" : "kaydedilmedi"}${snapshot?.next_medicine_reminder ? ` · sıradaki ${formatClock(snapshot.next_medicine_reminder.scheduled_for)}` : ""}`} />
          <HandoverRow icon={<Thermometer color={colors.danger} size={18} />} label="Son ateş" value={snapshot?.last_temperature?.temperature_c ? `${formatTemperature(snapshot.last_temperature.temperature_c)} · ${relativeTime(snapshot.last_temperature.occurred_at)}` : "Kayıt yok"} />
          <HandoverRow icon={<BellRing color={colors.highlight} size={18} />} label="Plan" value={`${snapshot?.active_reminder_count ?? 0} aktif alarm · ${snapshot?.open_task_count ?? 0} açık görev`} />
        </View>

        <Button disabled={takingOver || isCurrentCaregiver} label={isCurrentCaregiver ? "Bakım şu anda sende" : takingOver ? "Devralınıyor..." : "Bakımı devraldım"} onPress={onTakeOver} />

        {lastActivity.length > 0 ? (
          <View style={styles.activityBox}>
            <View style={styles.activityTitle}><Users color={colors.textMuted} size={17} /><Text style={typography.label}>Son aile işlemleri</Text></View>
            {lastActivity.map((event) => <Text key={event.id} style={styles.entryMeta}>{event.actor_name || "Bir bakıcı"} · {activityActionLabel(event.action)} · {event.device_label || "cihaz bilgisi yok"} · {relativeTime(event.occurred_at)}</Text>)}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function HandoverRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <View style={styles.handoverRow}><View style={styles.handoverRowIcon}>{icon}</View><View style={{ flex: 1 }}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.nowValue}>{value}</Text></View></View>;
}

function formatFeedHandover(entry: CareJournalEntry | null) {
  if (!entry) return "Kayıt yok";
  if (entry.entry_type === "bottle") {
    const content = entry.feeding_content === "formula" ? "mama" : entry.feeding_content === "water" ? "su" : "anne sütü";
    return `${entry.amount_ml ?? "—"} ml ${content} · ${relativeTime(entry.occurred_at)}`;
  }
  return `${sideLabel(entry.breast_side)} meme · ${relativeTime(entry.occurred_at)}`;
}

function activityActionLabel(action: CareJournalActivity["action"]) {
  return action === "created" ? "kaydetti" : action === "updated" ? "düzenledi" : action === "deleted" ? "sildi" : "geri aldı";
}

function NowItem({ label, value }: { label: string; value: string }) { return <View style={styles.nowItem}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.nowValue}>{value}</Text></View>; }

function SleepPredictionCard({
  completedSleepCount,
  isPremium,
  loading,
  now,
  onOpenPremium,
  prediction
}: {
  completedSleepCount: number;
  isPremium: boolean;
  loading: boolean;
  now: number;
  onOpenPremium: () => void;
  prediction: SleepPrediction | null;
}) {
  if (!isPremium) {
    return (
      <Card style={styles.sleepPredictionCard}>
        <View style={{ gap: spacing.md }}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={typography.eyebrow}>Premium · Bakım zekâsı</Text>
              <Text style={typography.heading2}>Bir sonraki uyku tahmini</Text>
            </View>
            <View style={styles.predictionIcon}>
              <Moon color={colors.nightPlum} size={23} />
            </View>
          </View>
          <Text style={typography.body}>
            7 tamamlanmış uyku kaydından sonra bebeğinin kendi örüntüsüne göre
            yaklaşan uyku penceresini gör.
          </Text>
          <Button label="Uyku tahminini aç" variant="secondary" onPress={onOpenPremium} />
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card style={styles.sleepPredictionCard}>
        <Text style={typography.body}>Uyku örüntüsü hesaplanıyor...</Text>
      </Card>
    );
  }

  const sampleCount = Math.max(prediction?.sample_count ?? 0, completedSleepCount);
  const hasCurrentPrediction = Boolean(
    prediction?.status === "active" &&
      prediction.window_end &&
      Date.parse(prediction.window_end) >= now
  );

  if (!hasCurrentPrediction || !prediction?.predicted_sleep_at) {
    const needed = Math.max(0, 7 - sampleCount);
    return (
      <Card style={styles.sleepPredictionCard}>
        <View style={{ gap: spacing.md }}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={typography.eyebrow}>Premium · Öğreniyor</Text>
              <Text style={typography.heading2}>Uyku tahmini hazırlanıyor</Text>
            </View>
            <Moon color={colors.nightPlum} size={26} />
          </View>
          <Text style={typography.body}>
            {needed > 0
              ? `Saat vermek için ${needed} tamamlanmış uyku kaydı daha gerekli.`
              : "Son uyku penceresi geçti. Bir sonraki tamamlanmış uykudan sonra tahmin yenilenecek."}
          </Text>
          <View style={styles.learningTrack}>
            <View
              style={[
                styles.learningFill,
                { width: `${Math.min(100, (sampleCount / 7) * 100)}%` }
              ]}
            />
          </View>
          <Text style={styles.entryMeta}>{Math.min(sampleCount, 7)}/7 uyku kaydı</Text>
        </View>
      </Card>
    );
  }

  const minutesUntil = Math.round(
    (Date.parse(prediction.predicted_sleep_at) - now) / 60_000
  );
  const timingText = minutesUntil <= 0
    ? "Uyku penceresi şu anda"
    : minutesUntil <= 60
      ? `Yaklaşık ${minutesUntil} dakika içinde`
      : `Tahmini saat ${formatClock(prediction.predicted_sleep_at)}`;
  const confidenceLabel = prediction.confidence_score && prediction.confidence_score >= 78
    ? "Güçlü örüntü"
    : prediction.confidence_score && prediction.confidence_score >= 60
      ? "Dengeli örüntü"
      : "Gelişen örüntü";

  return (
    <Card style={styles.sleepPredictionActiveCard}>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Premium · Akıllı uyku</Text>
            <Text style={typography.heading2}>Uyku penceresi yaklaşıyor</Text>
          </View>
          <BellRing color={colors.nightPlum} size={26} />
        </View>
        <Text style={styles.predictionTime}>{timingText}</Text>
        {prediction.window_start && prediction.window_end ? (
          <Text style={typography.body}>
            Tahmini aralık: {formatClock(prediction.window_start)}–{formatClock(prediction.window_end)}
          </Text>
        ) : null}
        <View style={styles.predictionMetaRow}>
          <Text style={styles.predictionMeta}>{confidenceLabel}</Text>
          <Text style={styles.predictionMeta}>{sampleCount} benzer aralık</Text>
        </View>
        <Text style={styles.safetyNote}>
          Bu saat kayıt örüntüsünden üretilen yaklaşık bir tahmindir. Bebeğinin
          esneme, bakışını kaçırma ve sakinleşme ihtiyacı gibi uyku işaretlerini de izle.
        </Text>
      </View>
    </Card>
  );
}

function MedicineSafetyNotice({ dose }: { dose: RecentMedicineDose }) {
  return (
    <View style={styles.medicineWarning}>
      <ShieldAlert color={colors.danger} size={22} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={styles.medicineWarningTitle}>Yakın zamanda doz kaydı var</Text>
        <Text style={styles.medicineWarningText}>
          {dose.caregiver_name || "Bir bakıcı"}, {relativeTime(dose.occurred_at)}
          {dose.medicine_dose ? ` · ${dose.medicine_dose}` : ""} kaydetti.
        </Text>
        <Text style={styles.medicineWarningText}>
          Yeni bir doz vermeden önce aile günlüğünü ve kendi ilaç planını kontrol et.
        </Text>
      </View>
    </View>
  );
}

function showRecentMedicineConfirmation(
  dose: RecentMedicineDose | null,
  onConfirm: () => void
) {
  const detail = dose
    ? `${dose.caregiver_name || "Başka bir bakıcı"}, ${relativeTime(dose.occurred_at)}${dose.medicine_dose ? ` (${dose.medicine_dose})` : ""} kayıt ekledi.`
    : "Bu ilaç veya vitamin için yakın zamanda başka bir kayıt bulunuyor.";

  Alert.alert(
    "Çift doz riski",
    `${detail}\n\nBu uyarı doz önerisi değildir. Yeni bir doz vermeden önce kaydı, ilaç planını ve gerekirse sağlık profesyonelini kontrol et.`,
    [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kontrol ettim, kaydet",
        style: "destructive",
        onPress: onConfirm
      }
    ]
  );
}

function ReminderCard({ cancelling, currentUserId, entryType, isPremium, onCancel, onSchedule, onTimeChange, reminderTime, reminders, scheduling }: { cancelling: boolean; currentUserId: string | null; entryType: CareEntryType; isPremium: boolean; onCancel: (reminder: CareReminder) => void; onSchedule: () => void; onTimeChange: (value: Date) => void; reminderTime: Date; reminders: CareReminder[]; scheduling: boolean }) {
  const appTheme = useAppTheme();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const scheduledFor = normalizeNextReminderTime(reminderTime);

  function handleTimeChange(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS === "android") setShowAndroidPicker(false);
    if (event.type === "dismissed" || !value) return;
    const next = new Date(reminderTime);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onTimeChange(next);
  }

  return (
    <Card style={styles.reminderCard}>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>{isPremium ? "Premium · Aile senkronlu" : "Kişisel bakım alarmı"}</Text>
            <Text style={typography.heading2}>Bakım alarmı kur</Text>
          </View>
          <Clock3 color={colors.sageGreen} size={26} />
        </View>
        <Text style={typography.body}>{entryLabel(entryType)} için saati seç. Alarm cihazında çalar; Premium’da diğer aile cihazlarına da bildirim gider.</Text>
        <View style={styles.timePickerField}>
          <Text style={typography.label}>Alarm saati</Text>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              accentColor={appTheme.primary}
              display="spinner"
              locale="tr-TR"
              mode="time"
              onChange={handleTimeChange}
              themeVariant={appTheme.isDark ? "dark" : "light"}
              value={reminderTime}
            />
          ) : (
            <>
              <Pressable
                accessibilityHint="Telefonun saat seçicisini açar"
                accessibilityLabel={`Alarm saati, ${formatClockTime(reminderTime)}`}
                accessibilityRole="button"
                onPress={() => setShowAndroidPicker(true)}
                style={({ pressed }) => [styles.timePickerButton, pressed && styles.timePickerButtonPressed]}
              >
                <Clock3 color={appTheme.primary} size={21} />
                <Text style={styles.timePickerValue}>{formatClockTime(reminderTime)}</Text>
                <Text style={styles.timePickerAction}>Değiştir</Text>
              </Pressable>
              {showAndroidPicker ? (
                <DateTimePicker display="clock" is24Hour mode="time" onChange={handleTimeChange} value={reminderTime} />
              ) : null}
            </>
          )}
          <Text style={styles.selectedReminderText}>Alarm: {formatSelectedReminderDate(scheduledFor)}</Text>
        </View>
        <Button disabled={scheduling} label={scheduling ? "Alarm kuruluyor..." : `${entryLabel(entryType)} alarmı kur`} onPress={onSchedule} />
        {reminders.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.label}>Planlı alarmlar</Text>
            {reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.label}>{entryLabel(reminder.entry_type)}</Text>
                  <Text style={styles.entryMeta}>{formatReminderDate(reminder.scheduled_for)}</Text>
                </View>
                {reminder.created_by === currentUserId ? <Button disabled={cancelling} label="İptal" variant="ghost" onPress={() => onCancel(reminder)} /> : <Text style={styles.entryMeta}>Aile alarmı</Text>}
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.safetyNote}>Alarm saati uygulama tarafından önerilmez. Beslenme veya ilaç zamanını yalnızca kendi planına ve sağlık profesyonelinin önerisine göre belirle.</Text>
      </View>
    </Card>
  );
}

function DoctorReportCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Doktor görüşmesine hazırla</Text>
            <Text style={typography.heading2}>Doğru görüşme dosyasını hazırla</Text>
          </View>
          <ShieldAlert color={colors.sageGreen} size={25} />
        </View>
        <Text style={typography.body}>
          Bebek doktoru ve annenin doğum sonrası kontrolü ayrı hazırlanır. Seçtiğin gerçek kayıtların kapsamını önce görür, sonra PDF oluşturursun.
        </Text>
        <Button label="Doktor görüşmesine hazırlan" onPress={onOpen} />
        <Text style={styles.safetyNote}>Özet kullanıcı kayıtlarını düzenler; tıbbi değerlendirme, tanı veya persentil yorumu üretmez.</Text>
      </View>
    </Card>
  );
}

function InsightsCard({ days, entries, onArchive, onDaysChange }: { days: ReportPeriod; entries: CareJournalEntry[]; onArchive: () => void; onDaysChange: (days: ReportPeriod) => void }) {
  const scoped = entries.filter((e) => Date.parse(e.occurred_at) >= Date.now() - days * 86_400_000);
  const sleeps = scoped.filter((e) => e.entry_type === "sleep");
  const daySleeps = sleeps.filter((e) => e.sleep_kind === "day");
  const avgDaySleep = daySleeps.length ? Math.round(daySleeps.reduce((sum, e) => sum + durationInMinutes(e), 0) / daySleeps.length) : 0;
  const bottles = scoped.filter((e) => e.entry_type === "bottle" && e.amount_ml);
  const avgBottle = bottles.length ? Math.round(bottles.reduce((sum, e) => sum + (e.amount_ml ?? 0), 0) / bottles.length) : 0;
  const nightHours = sleeps.filter((e) => e.sleep_kind === "night").map((e) => new Date(e.occurred_at).getHours());
  const nightRange = nightHours.length ? `${Math.min(...nightHours).toString().padStart(2, "0")}.00–${(Math.max(...nightHours) + 1).toString().padStart(2, "0")}.00` : "Yeterli kayıt yok";
  return <Card style={styles.insightCard}><View style={{ gap: spacing.md }}><View style={styles.cardTitleRow}><View style={{ flex: 1 }}><Text style={typography.eyebrow}>Premium analiz</Text><Text style={typography.heading2}>Güvenli bakım özeti</Text></View><Sparkles color={colors.highlight} size={26} /></View><View style={styles.chips}>{([1, 7, 30] as const).map((value) => <ChoiceChip key={value} active={days === value} label={value === 1 ? "24 saat" : `${value} gün`} onPress={() => onDaysChange(value)} />)}</View><Text style={typography.body}>• Gündüz uykuları ortalama {avgDaySleep} dakika sürdü.</Text><Text style={typography.body}>• Gece uykusu başlangıçları çoğunlukla {nightRange} aralığında kaydedildi.</Text><Text style={typography.body}>• Biberon kayıtlarının ortalaması {avgBottle} ml.</Text><Text style={styles.safetyNote}>Bu özet yalnızca kaydedilen eğilimleri gösterir; bebeğin sağlığı veya yeterli beslenmesi hakkında değerlendirme yapmaz.</Text><Button variant="ghost" label="Tüm geçmişi kalıcı arşivle" onPress={onArchive} /></View></Card>;
}

function PremiumUpsellCard({ onPress }: { onPress: () => void }) { return <Card style={styles.premiumCard}><View style={{ gap: spacing.md }}><View style={styles.cardTitleRow}><View style={styles.lockBubble}><LockKeyhole color={colors.sageGreen} size={22} /></View><View style={{ flex: 1 }}><Text style={typography.eyebrow}>Premium</Text><Text style={typography.heading2}>Kayıtlarını anlamlandır</Text></View></View><Text style={typography.body}>7/30/90 günlük eğilimler, sınırsız geçmiş, süt stoğu ve aile görevleri.</Text><Button label="Premium özellikleri aç" onPress={onPress} /></View></Card>; }
function Rating({ onChange, value }: { onChange: (value: number) => void; value: number }) { return <View style={styles.chips}>{[1, 2, 3, 4, 5].map((item) => <ChoiceChip key={item} active={value === item} label={`${item}`} onPress={() => onChange(item)} />)}</View>; }

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <View style={styles.summaryItem}>{icon}<Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function EntryCard({ deleting, entry, onDelete }: { deleting: boolean; entry: CareJournalViewEntry; onDelete: () => void }) {
  const detail = entryDetail(entry);
  return (
    <Card>
      <View style={styles.entryRow}>
        <View style={styles.entryIcon}>{entryIcon(entry.entry_type)}</View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={typography.heading3}>{entryLabel(entry.entry_type)}</Text>
          <Text style={styles.entryMeta}>{formatTime(entry.occurred_at)}{detail ? ` · ${detail}` : ""}</Text>
          {entry.caregiver_name ? <Text style={styles.entryMeta}>{entry.caregiver_name} kaydetti</Text> : null}
          {entry.local_sync_state === "pending" ? <Text style={styles.pendingText}>Çevrimdışı · eşitlenmeyi bekliyor</Text> : null}
          {entry.local_sync_state === "conflict" ? <Text style={styles.conflictText}>Çakışma · kayıt cihazda korundu</Text> : null}
          {entry.version > 1 && entry.updated_by_name ? <Text style={styles.entryMeta}>Son düzenleme: {entry.updated_by_name} · {entry.updated_device_label || "bilinmeyen cihaz"}</Text> : null}
          {entry.notes ? <Text style={typography.body}>{entry.notes}</Text> : null}
        </View>
        <Pressable accessibilityLabel="Bakım kaydını sil" disabled={deleting} hitSlop={10} onPress={onDelete}><Trash2 color={colors.danger} size={20} /></Pressable>
      </View>
    </Card>
  );
}

function CareJournalSectionNav({
  activeSection,
  onChange
}: {
  activeSection: CareJournalSection;
  onChange: (section: CareJournalSection) => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View accessibilityLabel="Bakım günlüğü bölümleri" style={styles.sectionNav}>
      {CARE_JOURNAL_SECTIONS.map((item) => {
        const active = item.section === activeSection;
        const iconColor = active ? appTheme.primary : colors.textMuted;

        return (
          <Pressable
            accessibilityLabel={`${item.label} bölümünü aç`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={item.section}
            onPress={() => onChange(item.section)}
            style={({ pressed }) => [
              styles.sectionTab,
              active && styles.sectionTabActive,
              pressed && styles.sectionTabPressed
            ]}
          >
            {item.section === "record" ? <Clock3 color={iconColor} size={20} /> : null}
            {item.section === "plan" ? <BellRing color={iconColor} size={20} /> : null}
            {item.section === "family" ? <Users color={iconColor} size={20} /> : null}
            {item.section === "insights" ? <Sparkles color={iconColor} size={20} /> : null}
            <Text style={[styles.sectionTabText, active && { color: appTheme.primary }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const appTheme = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function entryIcon(type: CareEntryType) {
  const props = { color: colors.text, size: 20 };
  if (type === "sleep") return <Moon {...props} />;
  if (type === "diaper") return <Droplets {...props} />;
  if (type === "medicine") return <Pill {...props} />;
  if (type === "temperature") return <Thermometer {...props} />;
  if (type === "breastfeeding" || type === "bottle" || type === "pumping") return <Milk {...props} />;
  return <Clock3 {...props} />;
}

function entryLabel(type: CareEntryType) {
  return ENTRY_TYPES.find((item) => item.type === type)?.label ?? "Bakım";
}

function entryDetail(entry: CareJournalEntry) {
  if (entry.entry_type === "breastfeeding") return `${sideLabel(entry.breast_side)} · ${formatMinutes(durationInMinutes(entry))}`;
  if (entry.entry_type === "sleep") return formatMinutes(durationInMinutes(entry));
  if (entry.entry_type === "diaper") return diaperLabel(entry.diaper_type);
  if (entry.entry_type === "bottle" || entry.entry_type === "pumping") return entry.amount_ml ? `${entry.amount_ml} ml` : "";
  if (entry.entry_type === "medicine") return [entry.medicine_name, entry.medicine_dose].filter(Boolean).join(" · ");
  if (entry.entry_type === "solid_food") return [entry.food_name, entry.food_amount, entry.is_first_try ? "İlk deneme" : null].filter(Boolean).join(" · ");
  if (entry.entry_type === "temperature") return entry.temperature_c ? `${formatTemperature(entry.temperature_c)} · ${temperatureSiteLabel(entry.temperature_site)}` : "";
  return "";
}

function durationInMinutes(entry: CareJournalEntry) {
  if (!entry.ended_at) return 0;
  const endedAt = Date.parse(entry.ended_at);
  const occurredAt = Date.parse(entry.occurred_at);
  if (!Number.isFinite(endedAt) || !Number.isFinite(occurredAt)) return 0;
  return Math.max(0, Math.round((endedAt - occurredAt) / 60_000));
}

function normalizeHandoverSnapshot(value: CareHandoverSnapshot | null | undefined): CareHandoverSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const activeTimers = Array.isArray(value.active_timers)
    ? value.active_timers.filter((timer): timer is CareActiveTimer => Boolean(timer?.id && timer?.started_at))
    : [];
  const legacyTimer = value.active_timer?.id && value.active_timer?.started_at
    ? value.active_timer
    : null;
  if (legacyTimer && !activeTimers.some((timer) => timer.id === legacyTimer.id)) {
    activeTimers.push(legacyTimer);
  }

  return {
    active_reminder_count: Number.isFinite(Number(value.active_reminder_count)) ? Number(value.active_reminder_count) : 0,
    active_timer: legacyTimer ?? activeTimers.find((timer) => timer.timer_type !== "pumping") ?? null,
    active_timers: activeTimers,
    handover: value.handover ?? null,
    last_diaper: value.last_diaper ?? null,
    last_feed: value.last_feed ?? null,
    last_medicine: value.last_medicine ?? null,
    last_sleep: value.last_sleep ?? null,
    last_temperature: value.last_temperature ?? null,
    next_medicine_reminder: value.next_medicine_reminder ?? null,
    open_task_count: Number.isFinite(Number(value.open_task_count)) ? Number(value.open_task_count) : 0,
    vitamin_given_today: value.vitamin_given_today === true
  };
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} dk`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

function formatTime(value: string) {
  const date = validDate(value);
  return date
    ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" }).format(date)
    : "Zaman bilinmiyor";
}

function formatClock(value: string) {
  const date = validDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function isToday(value: string) {
  const date = validDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function sideLabel(value: CareJournalEntry["breast_side"]) { return value === "left" ? "Sol" : value === "right" ? "Sağ" : "İki taraf"; }
function diaperLabel(value: CareJournalEntry["diaper_type"]) { return value === "wet" ? "Islak" : value === "dirty" ? "Kaka" : "Islak + kaka"; }
function temperatureSiteLabel(value: CareJournalEntry["temperature_site"]) { return value === "armpit" ? "Koltuk altı" : value === "forehead" ? "Alın" : value === "ear" ? "Kulak" : value === "oral" ? "Ağız" : value === "rectal" ? "Rektal" : "Diğer"; }
function isFreeType(type: CareEntryType) { return type === "breastfeeding" || type === "bottle" || type === "sleep" || type === "diaper" || type === "temperature"; }
function isCareJournalSection(value?: string): value is CareJournalSection { return CARE_JOURNAL_SECTIONS.some((item) => item.section === value); }
function isCareEntryType(value: string): value is CareEntryType { return ENTRY_TYPES.some((item) => item.type === value); }
type FeedingMode = "breastfeeding" | "pumping" | "mixed" | "formula";
function normalizeFeedingMode(value: unknown): FeedingMode {
  return value === "breastfeeding" || value === "pumping" || value === "formula" || value === "mixed"
    ? value
    : "mixed";
}
function normalizeCareEntries(value: unknown): CareJournalViewEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CareJournalViewEntry =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.entry_type === "string" &&
          typeof entry.occurred_at === "string"
      )
  );
}
function orderEntryTypesForFeedingMode(mode: FeedingMode) {
  const priority: Record<typeof mode, CareEntryType[]> = {
    breastfeeding: ["breastfeeding", "diaper", "sleep", "bottle", "pumping"],
    pumping: ["pumping", "bottle", "diaper", "sleep", "breastfeeding"],
    mixed: ["breastfeeding", "pumping", "bottle", "diaper", "sleep"],
    formula: ["bottle", "diaper", "sleep", "breastfeeding", "pumping"]
  };
  return [...ENTRY_TYPES].sort((left, right) => {
    const leftIndex = priority[mode].indexOf(left.type);
    const rightIndex = priority[mode].indexOf(right.type);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
}
function relativeTime(value: string) { const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) return "Zaman bilinmiyor"; const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000)); if (minutes < 1) return "Şimdi"; if (minutes < 60) return `${minutes} dk önce`; const hours = Math.floor(minutes / 60); return `${hours} sa ${minutes % 60} dk önce`; }
function formatTimer(milliseconds: number) { const total = Math.max(0, Math.floor(milliseconds / 1000)); const minutes = Math.floor(total / 60).toString().padStart(2, "0"); const seconds = (total % 60).toString().padStart(2, "0"); return `${minutes}:${seconds}`; }
function createDefaultReminderTime() { const date = new Date(Date.now() + 30 * 60_000); date.setSeconds(0, 0); return date; }
function normalizeNextReminderTime(value: Date) { const date = new Date(); date.setHours(value.getHours(), value.getMinutes(), 0, 0); if (date.getTime() <= Date.now() + 30_000) date.setDate(date.getDate() + 1); return date; }
function formatClockTime(value: Date) { return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(value); }
function formatSelectedReminderDate(value: Date) { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const day = value.toDateString() === tomorrow.toDateString() ? "Yarın" : "Bugün"; return `${day} ${formatClockTime(value)}`; }
function formatReminderDate(value: string) { const date = validDate(value); return date ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date) : "Zaman bilinmiyor"; }
function formatTemperature(value: unknown) { const numericValue = typeof value === "number" ? value : Number(value); return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)} °C` : "Ölçüm bilinmiyor"; }
function validDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  hero: { ...radii.card, gap: spacing.sm, padding: spacing.lg },
  heroText: { ...typography.body, color: colors.text },
  iconBubble: { alignItems: "center", borderRadius: radii.pill, height: 52, justifyContent: "center", width: 52 },
  nightShiftEyebrow: { color: "#87AB9D", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  nightShiftIcon: { alignItems: "center", backgroundColor: "#273124", borderRadius: 20, height: 54, justifyContent: "center", width: 54 },
  nightShiftLaunch: { alignItems: "center", backgroundColor: "#101B18", borderColor: "#30453E", borderRadius: 24, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  nightShiftText: { color: "#A7B8B1", fontSize: 13, lineHeight: 18 },
  nightShiftTitle: { color: "#EEF3F1", fontSize: 20, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sectionNav: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  sectionTab: { alignItems: "center", borderRadius: radii.sm, flex: 1, gap: spacing.xs, justifyContent: "center", minHeight: 60, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  sectionTabActive: { backgroundColor: colors.surface },
  sectionTabPressed: { opacity: 0.72 },
  sectionTabText: { ...typography.label, color: colors.textMuted, fontSize: 12, lineHeight: 16, textAlign: "center" },
  chip: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { ...typography.label, color: colors.text },
  chipTextActive: { color: colors.onPrimary },
  summaryGrid: { flexDirection: "row", gap: spacing.sm },
  summaryItem: { alignItems: "center", backgroundColor: colors.background, borderRadius: radii.md, flex: 1, gap: spacing.xs, padding: spacing.sm },
  summaryLabel: { ...typography.label, color: colors.textMuted, textAlign: "center" },
  summaryValue: { ...typography.label, color: colors.text, textAlign: "center" },
  nowCard: { backgroundColor: colors.primarySoft },
  syncBanner: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  syncBannerConflict: { backgroundColor: colors.accentSoft, borderColor: colors.danger },
  syncAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  syncActionText: { ...typography.label, color: colors.danger },
  handoverIcon: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.pill, height: 46, justifyContent: "center", width: 46 },
  handoverList: { backgroundColor: colors.surface, borderRadius: radii.md, overflow: "hidden" },
  handoverRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  handoverRowIcon: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
  activityBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, gap: spacing.xs, padding: spacing.md },
  activityTitle: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  insightCard: { backgroundColor: colors.highlightSoft },
  premiumCard: { backgroundColor: colors.accentSoft },
  reminderCard: { backgroundColor: colors.primarySoft },
  sleepPredictionCard: { backgroundColor: colors.surface },
  sleepPredictionActiveCard: { backgroundColor: colors.highlightSoft },
  predictionIcon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  predictionTime: { ...typography.heading1, color: colors.nightPlum, fontSize: 27, lineHeight: 34 },
  predictionMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  predictionMeta: { ...typography.label, backgroundColor: colors.surface, borderRadius: radii.pill, color: colors.textMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  learningTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, height: 8, overflow: "hidden" },
  learningFill: { backgroundColor: colors.nightPlum, borderRadius: radii.pill, height: "100%" },
  medicineWarning: { alignItems: "flex-start", backgroundColor: colors.accentSoft, borderColor: colors.danger, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  medicineWarningTitle: { ...typography.label, color: colors.text },
  medicineWarningText: { ...typography.body, color: colors.text, fontSize: 13, lineHeight: 19 },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  nowGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  nowItem: { backgroundColor: colors.surface, borderRadius: radii.md, gap: spacing.xs, padding: spacing.md, width: "48%" },
  nowValue: { ...typography.label, color: colors.text },
  stockValue: { ...typography.heading1, color: colors.sageGreen },
  twoButtons: { flexDirection: "row", gap: spacing.sm },
  taskRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  taskCheck: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 28, justifyContent: "center", width: 28 },
  timePickerField: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  timePickerButton: { alignItems: "center", backgroundColor: colors.background, borderRadius: radii.md, flexDirection: "row", gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  timePickerButtonPressed: { opacity: 0.72 },
  timePickerValue: { ...typography.heading2, color: colors.text, flex: 1, fontVariant: ["tabular-nums"] },
  timePickerAction: { ...typography.label, color: colors.sageGreen },
  selectedReminderText: { ...typography.label, color: colors.textMuted, textAlign: "center" },
  reminderRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  lockBubble: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  timerBox: { alignItems: "center", backgroundColor: colors.background, borderRadius: radii.md, gap: spacing.xs, padding: spacing.lg },
  timerValue: { ...typography.heading1, color: colors.sageGreen, fontVariant: ["tabular-nums"] },
  pumpFocusCard: { backgroundColor: colors.highlightSoft },
  pumpColumns: { flexDirection: "row", gap: spacing.sm },
  pumpColumn: { backgroundColor: colors.surface, borderRadius: radii.md, flex: 1, gap: spacing.sm, padding: spacing.md },
  entryRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  entryIcon: { alignItems: "center", backgroundColor: colors.background, borderRadius: radii.pill, height: 42, justifyContent: "center", width: 42 },
  entryMeta: { ...typography.label, color: colors.textMuted },
  pendingText: { ...typography.label, color: colors.sageGreen },
  conflictText: { ...typography.label, color: colors.danger },
  undoBar: { alignItems: "center", backgroundColor: colors.highlightSoft, borderRadius: radii.md, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  safetyNote: { ...typography.label, color: colors.textMuted, lineHeight: 20 }
});
