/**
 * THESIS: Görüşme öncesi dağınık gerçek kayıtları sakin, taranabilir bir hazırlık akışına dönüştürür.
 * OWN-WORLD: Anne+ ipliği; yumuşak krem zemin, adaçayı yönlendirme ve gül tonlu kişisel notlarla yaşar.
 * STORY: Önce kimin görüşmesi ve dönem seçilir, sonra gerçek özet görülür, son olarak sorular eklenip PDF alınır.
 * FIRST VIEWPORT: Konu, dönem, kısa veri özeti ve ana PDF eylemi kaydırmadan bulunabilir.
 * FORM: Tek sütunlu, açılır giriş alanları; ham ölçüm ile kullanıcı öz değerlendirmesini açıkça etiketler.
 */
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowLeft,
  Baby,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ClipboardPlus,
  FileText,
  HeartPulse,
  LockKeyhole,
  NotebookPen,
  Pill,
  Plus,
  Stethoscope
} from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import Animated, { Easing, FadeIn, useReducedMotion } from "react-native-reanimated";

import {
  commitDoctorVisitReportCredit,
  createDoctorVisitItem,
  createPregnancyVisitMeasurement,
  getDoctorVisitSnapshot,
  releaseDoctorVisitReportCredit,
  reserveDoctorVisitReportCredit,
  type DoctorVisitItemType,
  type DoctorVisitPeriodDays,
  type DoctorVisitSnapshot,
  type DoctorVisitSubject,
  type PregnancyMeasurementSource
} from "@/api/doctorVisit";
import { getFamilyCoordinationContext } from "@/api/familyCoordination";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { createCareUuid } from "@/features/care-journal/careSync";
import {
  cleanupDoctorVisitPdf,
  createDoctorVisitPdf,
  isDoctorVisitSharingAvailable,
  shareAndCleanupDoctorVisitPdf
} from "@/features/doctor-visit/report";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

type PickerTarget = "item_date" | "item_time" | "measurement_date" | "measurement_time" | null;

const itemTypes: Array<{ type: DoctorVisitItemType; label: string }> = [
  { type: "question", label: "Soru" },
  { type: "symptom", label: "Belirti" },
  { type: "medication", label: "İlaç / vitamin" },
  { type: "note", label: "Not" }
];

export default function DoctorVisitScreen() {
  const appTheme = useAppTheme();
  const { showError, showInfo, showSuccess } = useFeedback();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const familyQuery = useQuery({
    queryKey: ["family-coordination-context"],
    queryFn: getFamilyCoordinationContext
  });

  const context = familyQuery.data;
  const availableSubjects = useMemo<DoctorVisitSubject[]>(() => {
    if (!context) return [];
    const subjects: DoctorVisitSubject[] = [];
    if (context.can_access_maternal && context.profile.is_pregnant) subjects.push("pregnancy");
    if (context.babies.length) subjects.push("baby");
    if (context.can_access_maternal && context.babies.length) subjects.push("postpartum_mother");
    return subjects;
  }, [context]);

  const [subject, setSubject] = useState<DoctorVisitSubject>("pregnancy");
  const [days, setDays] = useState<DoctorVisitPeriodDays>(7);
  const [babyId, setBabyId] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);
  const [includePumping, setIncludePumping] = useState(true);
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [itemType, setItemType] = useState<DoctorVisitItemType>("question");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDetails, setItemDetails] = useState("");
  const [severity, setSeverity] = useState(3);
  const [itemStartedAt, setItemStartedAt] = useState(new Date());

  const [measurementSource, setMeasurementSource] = useState<PregnancyMeasurementSource>("self");
  const [measurementAt, setMeasurementAt] = useState(new Date());
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [fundalHeight, setFundalHeight] = useState("");
  const [fetalHeartRate, setFetalHeartRate] = useState("");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  useEffect(() => {
    if (availableSubjects.length && !availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0]!);
    }
  }, [availableSubjects, subject]);

  useEffect(() => {
    if (!context?.babies.length) {
      setBabyId(null);
      return;
    }
    if (!babyId || !context.babies.some((baby) => baby.id === babyId)) {
      setBabyId(context.babies[0]!.id);
    }
  }, [babyId, context?.babies]);

  useEffect(() => {
    setItemFormOpen(false);
    setMeasurementFormOpen(false);
    setPickerTarget(null);
  }, [subject]);

  const needsBaby = subject !== "pregnancy";
  const snapshotQuery = useQuery({
    queryKey: ["doctor-visit-snapshot", subject, needsBaby ? babyId : null, days],
    queryFn: () => getDoctorVisitSnapshot(subject, needsBaby ? babyId : null, days),
    enabled: Boolean(context && availableSubjects.includes(subject) && (!needsBaby || babyId)),
    staleTime: 15_000
  });
  const snapshot = snapshotQuery.data;

  async function refreshSnapshot() {
    await queryClient.invalidateQueries({ queryKey: ["doctor-visit-snapshot"] });
  }

  async function savePreparedItem() {
    if (!snapshot || savingItem) return;
    if (!itemTitle.trim()) {
      showInfo("Kısa bir başlık yazın; örneğin ‘Gece artan baş ağrısı’.", "Başlık gerekli");
      return;
    }

    setSavingItem(true);
    try {
      await createDoctorVisitItem({
        profileId: snapshot.profile.id,
        babyId: snapshot.baby?.id ?? null,
        subject,
        itemType,
        title: itemTitle,
        details: itemDetails,
        severity: itemType === "symptom" ? severity : null,
        startedAt: itemType === "symptom" || itemType === "medication"
          ? itemStartedAt.toISOString()
          : null
      });
      setItemTitle("");
      setItemDetails("");
      setSeverity(3);
      setItemStartedAt(new Date());
      setItemFormOpen(false);
      await refreshSnapshot();
      showSuccess("Madde görüşme listesine eklendi.", "Hazırlık listesi güncellendi");
    } catch (error) {
      showError(error, "Madde kaydedilemedi");
    } finally {
      setSavingItem(false);
    }
  }

  async function saveMeasurement() {
    if (!snapshot || snapshot.subject !== "pregnancy" || savingMeasurement) return;

    try {
      const values = {
        systolicBp: parseOptionalInteger(systolic, "Büyük tansiyon"),
        diastolicBp: parseOptionalInteger(diastolic, "Küçük tansiyon"),
        pulseBpm: parseOptionalInteger(pulse, "Nabız"),
        fundalHeightCm: parseOptionalNumber(fundalHeight, "Fundal yükseklik"),
        fetalHeartRateBpm: parseOptionalInteger(fetalHeartRate, "Fetal kalp hızı")
      };
      setSavingMeasurement(true);
      await createPregnancyVisitMeasurement({
        profileId: snapshot.profile.id,
        measuredAt: measurementAt.toISOString(),
        source: measurementSource,
        ...values,
        notes: measurementNotes
      });
      setSystolic("");
      setDiastolic("");
      setPulse("");
      setFundalHeight("");
      setFetalHeartRate("");
      setMeasurementNotes("");
      setMeasurementAt(new Date());
      setMeasurementFormOpen(false);
      await refreshSnapshot();
      showSuccess("Ham ölçüm görüşme özetine eklendi.", "Ölçüm kaydedildi");
    } catch (error) {
      showError(error, "Ölçüm kaydedilemedi");
    } finally {
      setSavingMeasurement(false);
    }
  }

  async function createAndSharePdf() {
    if (!snapshot || creatingPdf) return;
    setCreatingPdf(true);
    let uri: string | null = null;
    let creditCommitted = false;
    const operationId = createCareUuid();

    try {
      if (!(await isDoctorVisitSharingAvailable())) {
        throw new Error("Bu cihazda PDF paylaşımı kullanılamıyor.");
      }

      const credit = await reserveDoctorVisitReportCredit(
        operationId,
        snapshot.subject === "pregnancy" ? "pregnancy" : "postpartum"
      );

      if (!credit.allowed) {
        if (credit.reason === "premium_required" || credit.reason === "free_credits_exhausted") {
          await showPaywallIfNeeded("premium_feature", {
            feature: "doctor_visit_report",
            reason: "free_credits_exhausted"
          });
          return;
        }
        throw new Error("Kullanım hakkı doğrulanamadı. Lütfen yeniden deneyin.");
      }
      let finalCredit = credit;

      try {
        uri = await createDoctorVisitPdf(snapshot, { includePumping });
      } catch (error) {
        await releaseDoctorVisitReportCredit(operationId).catch(() => undefined);
        throw error;
      }

      try {
        finalCredit = await commitDoctorVisitReportCredit(operationId);
        creditCommitted = true;
      } catch (error) {
        await releaseDoctorVisitReportCredit(operationId).catch(() => undefined);
        cleanupDoctorVisitPdf(uri);
        uri = null;
        throw error;
      }

      await shareAndCleanupDoctorVisitPdf(uri, snapshot);
      uri = null;
      await trackEvent("doctor_visit_report_created", {
        subject: snapshot.subject,
        days: snapshot.period.days,
        is_premium: finalCredit.isPremium
      }).catch(() => undefined);
      await queryClient
        .invalidateQueries({ queryKey: ["family-coordination-context"] })
        .catch(() => undefined);

      const creditCopy = finalCredit.isPremium
        ? "Premium aile hesabınızla sınırsız PDF oluşturabilirsiniz."
        : finalCredit.remaining == null
          ? "PDF başarıyla oluşturuldu."
          : `${finalCredit.remaining} ortak akıllı kullanım hakkınız kaldı.`;
      showSuccess(creditCopy, "Doktor özeti hazır");
    } catch (error) {
      if (uri) cleanupDoctorVisitPdf(uri);
      showError(
        error,
        creditCommitted ? "PDF oluşturuldu, paylaşım açılamadı" : "PDF hazırlanamadı"
      );
    } finally {
      setCreatingPdf(false);
    }
  }

  function onPickerChange(event: DateTimePickerEvent, value?: Date) {
    if (event.type === "dismissed") {
      setPickerTarget(null);
      return;
    }
    if (!value || !pickerTarget) return;

    if (pickerTarget.startsWith("item")) setItemStartedAt(value);
    else setMeasurementAt(value);

    if (Platform.OS !== "ios") setPickerTarget(null);
  }

  if (familyQuery.isLoading) {
    return (
      <Screen>
        <Header />
        <QueryState loading description="Aile ve görüşme alanı hazırlanıyor…" />
      </Screen>
    );
  }

  if (familyQuery.isError) {
    return (
      <Screen>
        <Header />
        <QueryState
          description="Aile erişimi doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin."
          onRetry={() => void familyQuery.refetch()}
          retrying={familyQuery.isFetching}
          title="Görüşme alanı açılamadı"
        />
      </Screen>
    );
  }

  if (!context || availableSubjects.length === 0) {
    return (
      <Screen>
        <Header />
        <EmptyState
          title="Önce bir takip profili gerekli"
          description="Hamilelik profilinizi tamamladığınızda veya bir bebek eklediğinizde doktor görüşmesi hazırlığı burada açılır."
          actionLabel="Profil ayarlarına git"
          onActionPress={() => router.push("/(tabs)/settings")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.page}>
        <Header />

        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(360).easing(Easing.out(Easing.exp))}
          style={[styles.hero, { backgroundColor: appTheme.theme.primarySoft }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
            <Stethoscope color={appTheme.primary} size={28} strokeWidth={2.1} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={typography.heading1}>Görüşmeye hazırla</Text>
            <Text style={styles.heroBody}>
              Sorularınızı ve uygulamadaki gerçek kayıtları tek, okunabilir özette buluşturun.
            </Text>
          </View>
        </Animated.View>

        {!context.can_access_maternal ? (
          <View style={styles.accessNote} accessibilityRole="text">
            <LockKeyhole color={colors.highlight} size={18} />
            <Text style={styles.accessNoteText}>Bakıcı erişiminde yalnız bebeğe ait bakım bilgileri gösterilir.</Text>
          </View>
        ) : null}

        <Card style={styles.contextCard}>
          <View style={styles.sectionLead}>
            <Text style={typography.heading3}>Kimin görüşmesi?</Text>
            <Text style={styles.sectionHint}>Anne ve bebek raporları birbirine karışmaz.</Text>
          </View>
          <View style={styles.subjectRow}>
            {availableSubjects.includes("pregnancy") ? (
              <ChoiceButton
                icon={<HeartPulse color={subject === "pregnancy" ? colors.onPrimary : colors.text} size={19} />}
                label="Hamilelik"
                selected={subject === "pregnancy"}
                onPress={() => setSubject("pregnancy")}
              />
            ) : null}
            {availableSubjects.includes("baby") ? (
              <ChoiceButton
                icon={<Baby color={subject === "baby" ? colors.onPrimary : colors.text} size={19} />}
                label="Bebek"
                selected={subject === "baby"}
                onPress={() => setSubject("baby")}
              />
            ) : null}
            {availableSubjects.includes("postpartum_mother") ? (
              <ChoiceButton
                icon={<Stethoscope color={subject === "postpartum_mother" ? colors.onPrimary : colors.text} size={19} />}
                label="Anne"
                selected={subject === "postpartum_mother"}
                onPress={() => setSubject("postpartum_mother")}
              />
            ) : null}
          </View>

          {needsBaby && context.babies.length > 1 ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bebek bağlamı</Text>
              <View style={styles.wrapRow}>
                {context.babies.map((baby) => (
                  <SmallChoice
                    key={baby.id}
                    label={baby.name}
                    selected={babyId === baby.id}
                    onPress={() => setBabyId(baby.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Gerçek kayıt dönemi</Text>
            <View style={styles.periodRow}>
              <ChoiceButton label="Son 7 gün" selected={days === 7} onPress={() => setDays(7)} />
              <ChoiceButton label="Son 30 gün" selected={days === 30} onPress={() => setDays(30)} />
            </View>
          </View>
        </Card>

        {snapshotQuery.isLoading ? (
          <QueryState compact loading description="Gerçek kayıt özeti hazırlanıyor…" />
        ) : snapshotQuery.isError ? (
          <QueryState
            compact
            description="Seçili görüşme özeti alınamadı. Erişim ve bağlantınızı kontrol edin."
            onRetry={() => void snapshotQuery.refetch()}
            retrying={snapshotQuery.isFetching}
            title="Özet yüklenemedi"
          />
        ) : snapshot ? (
          <>
            <Card style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={[styles.previewMark, { backgroundColor: appTheme.theme.primarySoft }]}>
                  <FileText color={appTheme.primary} size={23} />
                </View>
                <View style={styles.previewCopy}>
                  <Text style={typography.heading2}>Canlı önizleme</Text>
                  <Text style={styles.sectionHint}>{formatDateRange(snapshot)} · yorum eklenmeden</Text>
                </View>
              </View>
              {snapshot.subject === "postpartum_mother" ? (
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Sağım özetini PDF’e ekle</Text>
                    <Text style={styles.switchHint}>Miktar ve tamamlanmış süre kayıtları isteğe bağlıdır.</Text>
                  </View>
                  <Switch
                    accessibilityLabel="Sağım özetini PDF'e ekle"
                    accessibilityState={{ checked: includePumping }}
                    ios_backgroundColor={colors.border}
                    thumbColor={colors.surface}
                    trackColor={{ false: colors.border, true: appTheme.primary }}
                    value={includePumping}
                    onValueChange={setIncludePumping}
                  />
                </View>
              ) : null}

              <Button
                accessibilityHint="Kullanım hakkını kontrol eder, PDF oluşturur ve paylaşım menüsünü açar"
                accessibilityState={{ busy: creatingPdf, disabled: creatingPdf }}
                breathing={!creatingPdf}
                disabled={creatingPdf}
                label={creatingPdf ? "PDF hazırlanıyor…" : "Doktor için PDF oluştur"}
                onPress={() => void createAndSharePdf()}
              />
              <View style={styles.creditNote}>
                <LockKeyhole color={colors.textMuted} size={15} />
                <Text style={styles.creditText}>
                  {context.feature_access.is_premium
                    ? "Önizleme ücretsizdir; Premium aile hesabında PDF oluşturma sınırsızdır."
                    : `Önizleme ücretsizdir. ${context.feature_access.remaining ?? 0}/3 ortak akıllı hakkın; zamanlı alarm, gebelikte akıllı devir ve PDF arasında paylaşılır.`}
                </Text>
              </View>
              <PreviewFacts snapshot={snapshot} />
            </Card>

            <Card style={styles.listCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.sectionLead}>
                  <Text style={typography.heading3}>Görüşme listesi</Text>
                  <Text style={styles.sectionHint}>
                    {snapshot.items.length ? `${snapshot.items.length} hazırlanmış madde` : "Henüz madde eklenmedi"}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={itemFormOpen ? "Yeni madde alanını kapat" : "Yeni görüşme maddesi ekle"}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: itemFormOpen }}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconAction,
                    { backgroundColor: appTheme.theme.primarySoft },
                    pressed && styles.pressed
                  ]}
                  onPress={() => setItemFormOpen((current) => !current)}
                >
                  {itemFormOpen ? <ChevronUp color={appTheme.primary} size={22} /> : <Plus color={appTheme.primary} size={22} />}
                </Pressable>
              </View>

              {snapshot.items.length ? (
                <View style={styles.itemList}>
                  {snapshot.items.slice(0, 6).map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={[styles.itemDot, { backgroundColor: item.item_type === "symptom" ? colors.accent : appTheme.primary }]} />
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemMeta}>
                          {itemTypeLabel(item.item_type)}
                          {item.severity != null ? ` · sizin değerlendirmeniz ${item.severity}/5` : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {snapshot.items.length > 6 ? <Text style={styles.moreText}>PDF’de {snapshot.items.length - 6} madde daha gösterilecek.</Text> : null}
                </View>
              ) : (
                <Text style={styles.emptyCopy}>Doktora sormak istediklerinizi aklınıza geldikçe ekleyin.</Text>
              )}

              {itemFormOpen ? (
                <View style={styles.formArea}>
                  <Text style={styles.fieldLabel}>Madde türü</Text>
                  <View style={styles.wrapRow}>
                    {itemTypes.map((option) => (
                      <SmallChoice
                        key={option.type}
                        icon={renderItemTypeIcon(option.type, itemType === option.type, appTheme.primary)}
                        label={option.label}
                        selected={itemType === option.type}
                        onPress={() => setItemType(option.type)}
                      />
                    ))}
                  </View>
                  <TextField
                    accessibilityHint="Doktorla konuşmak istediğiniz konuyu kısa yazın"
                    label={itemTitleLabel(itemType)}
                    maxLength={160}
                    value={itemTitle}
                    onChangeText={setItemTitle}
                  />
                  <TextField
                    label={itemDetailsLabel(itemType)}
                    maxLength={1200}
                    multiline
                    textAlignVertical="top"
                    value={itemDetails}
                    onChangeText={setItemDetails}
                  />

                  {itemType === "symptom" ? (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Sizin hissettiğiniz şiddet</Text>
                      <View accessibilityRole="radiogroup" style={styles.scaleRow}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <SmallChoice
                            key={value}
                            accessibilityLabel={`Şiddet ${value} / 5`}
                            accessibilityRole="radio"
                            label={String(value)}
                            selected={severity === value}
                            onPress={() => setSeverity(value)}
                          />
                        ))}
                      </View>
                      <Text style={styles.helperText}>Bu seçim tıbbi derece veya aciliyet değerlendirmesi değildir.</Text>
                    </View>
                  ) : null}

                  {itemType === "symptom" || itemType === "medication" ? (
                    <>
                      <DateTimeControls
                        label={itemType === "symptom" ? "Ne zaman başladı?" : "Ne zamandan beri kullanılıyor?"}
                        value={itemStartedAt}
                        onDatePress={() => setPickerTarget("item_date")}
                        onTimePress={() => setPickerTarget("item_time")}
                      />
                      {pickerTarget?.startsWith("item") ? (
                        <InlinePicker
                          target={pickerTarget}
                          value={itemStartedAt}
                          onChange={onPickerChange}
                          onClose={() => setPickerTarget(null)}
                        />
                      ) : null}
                    </>
                  ) : null}

                  <Button
                    accessibilityState={{ busy: savingItem, disabled: savingItem }}
                    disabled={savingItem}
                    label={savingItem ? "Kaydediliyor…" : "Görüşme listesine ekle"}
                    onPress={() => void savePreparedItem()}
                  />
                </View>
              ) : null}
            </Card>

            {snapshot.subject === "pregnancy" ? (
              <Card style={styles.listCard}>
                <Pressable
                  accessibilityLabel={measurementFormOpen ? "Ölçüm girişini kapat" : "Hamilelik ölçümü ekle"}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: measurementFormOpen }}
                  style={({ pressed }) => [styles.expandHeader, pressed && styles.pressed]}
                  onPress={() => setMeasurementFormOpen((current) => !current)}
                >
                  <View style={[styles.previewMark, { backgroundColor: colors.highlightSoft }]}>
                    <ClipboardPlus color={colors.highlight} size={22} />
                  </View>
                  <View style={styles.previewCopy}>
                    <Text style={typography.heading3}>Ham ölçüm ekle</Text>
                    <Text style={styles.sectionHint}>{snapshot.measurements.length ? `${snapshot.measurements.length} dönem kaydı` : "Kendi ölçümünüz veya sağlık ekibi ölçümü"}</Text>
                  </View>
                  {measurementFormOpen ? <ChevronUp color={colors.text} size={22} /> : <ChevronDown color={colors.text} size={22} />}
                </Pressable>

                {measurementFormOpen ? (
                  <View style={styles.formArea}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Ölçüm kaynağı</Text>
                      <View style={styles.periodRow}>
                        <ChoiceButton label="Kendi ölçümüm" selected={measurementSource === "self"} onPress={() => setMeasurementSource("self")} />
                        <ChoiceButton label="Sağlık ekibinden" selected={measurementSource === "health_team"} onPress={() => setMeasurementSource("health_team")} />
                      </View>
                    </View>
                    <DateTimeControls
                      label="Ölçüm zamanı"
                      value={measurementAt}
                      onDatePress={() => setPickerTarget("measurement_date")}
                      onTimePress={() => setPickerTarget("measurement_time")}
                    />
                    {pickerTarget?.startsWith("measurement") ? (
                      <InlinePicker
                        target={pickerTarget}
                        value={measurementAt}
                        onChange={onPickerChange}
                        onClose={() => setPickerTarget(null)}
                      />
                    ) : null}
                    <View style={styles.inputRow}>
                      <TextField
                        containerStyle={styles.flexField}
                        keyboardType="number-pad"
                        label="Büyük tansiyon"
                        maxLength={3}
                        value={systolic}
                        onChangeText={setSystolic}
                      />
                      <TextField
                        containerStyle={styles.flexField}
                        keyboardType="number-pad"
                        label="Küçük tansiyon"
                        maxLength={3}
                        value={diastolic}
                        onChangeText={setDiastolic}
                      />
                    </View>
                    <TextField keyboardType="number-pad" label="Nabız (atım/dk)" maxLength={3} value={pulse} onChangeText={setPulse} />
                    <TextField keyboardType="decimal-pad" label="Fundal yükseklik (cm)" maxLength={5} value={fundalHeight} onChangeText={setFundalHeight} />
                    <TextField keyboardType="number-pad" label="Fetal kalp hızı (atım/dk)" maxLength={3} value={fetalHeartRate} onChangeText={setFetalHeartRate} />
                    <TextField label="Ölçüm notu" maxLength={500} multiline value={measurementNotes} onChangeText={setMeasurementNotes} />
                    <View style={styles.safetyCopy}>
                      <Check color={appTheme.primary} size={17} />
                      <Text style={styles.helperText}>Kaynak etiketini siz seçersiniz. Anne+ değeri veya kaynağı doğrulamaz ve yorumlamaz.</Text>
                    </View>
                    <Button
                      accessibilityState={{ busy: savingMeasurement, disabled: savingMeasurement }}
                      disabled={savingMeasurement}
                      label={savingMeasurement ? "Ölçüm kaydediliyor…" : "Ham ölçümü kaydet"}
                      onPress={() => void saveMeasurement()}
                    />
                  </View>
                ) : null}
              </Card>
            ) : null}

            <View style={styles.disclaimer}>
              <HeartPulse color={colors.accent} size={19} />
              <Text style={styles.disclaimerText}>Bu alan tanı koymaz, ölçüm yorumlamaz ve acil durum değerlendirmesi yapmaz. Ciddi veya ani bir endişede sağlık profesyoneline başvurun.</Text>
            </View>
          </>
        ) : null}

      </View>
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Geri dön"
        accessibilityRole="button"
        hitSlop={10}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <ArrowLeft color={colors.text} size={24} />
      </Pressable>
      <Text style={styles.headerTitle}>Doktor Görüşmesi</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function ChoiceButton({
  icon,
  label,
  onPress,
  selected
}: {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const appTheme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.choice,
        selected && { backgroundColor: appTheme.primary, borderColor: appTheme.primary },
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      {icon ? <View>{icon}</View> : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SmallChoice({
  accessibilityLabel,
  accessibilityRole = "button",
  icon,
  label,
  onPress,
  selected
}: {
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "radio";
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const appTheme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.smallChoice,
        selected && { backgroundColor: appTheme.theme.primarySoft, borderColor: appTheme.primary },
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      {icon ? <View style={{ opacity: selected ? 1 : 0.72 }}>{icon}</View> : null}
      <Text style={[styles.smallChoiceText, selected && { color: appTheme.primary }]}>{label}</Text>
    </Pressable>
  );
}

function DateTimeControls({
  label,
  onDatePress,
  onTimePress,
  value
}: {
  label: string;
  onDatePress: () => void;
  onTimePress: () => void;
  value: Date;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <Pressable
          accessibilityLabel={`${label} tarihi ${value.toLocaleDateString("tr-TR")}`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dateControl, pressed && styles.pressed]}
          onPress={onDatePress}
        >
          <CalendarClock color={colors.textMuted} size={18} />
          <Text style={styles.dateControlText}>{value.toLocaleDateString("tr-TR")}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${label} saati ${value.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dateControl, pressed && styles.pressed]}
          onPress={onTimePress}
        >
          <Text style={styles.dateControlText}>{value.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InlinePicker({
  onChange,
  onClose,
  target,
  value
}: {
  onChange: (event: DateTimePickerEvent, value?: Date) => void;
  onClose: () => void;
  target: Exclude<PickerTarget, null>;
  value: Date;
}) {
  return (
    <View style={styles.pickerPanel}>
      <DateTimePicker
        display={Platform.OS === "ios" ? "spinner" : "default"}
        maximumDate={new Date()}
        mode={target.endsWith("date") ? "date" : "time"}
        value={value}
        onChange={onChange}
      />
      {Platform.OS === "ios" ? (
        <Button label="Zaman seçimini kapat" variant="ghost" onPress={onClose} />
      ) : null}
    </View>
  );
}

function PreviewFacts({ snapshot }: { snapshot: DoctorVisitSnapshot }) {
  if (snapshot.subject === "pregnancy") {
    return (
      <View style={styles.factList}>
        <FactRow label="Gebelik yaşı" value={snapshot.pregnancy_age ? `${snapshot.pregnancy_age.week} hafta + ${snapshot.pregnancy_age.day_of_week} gün` : "Kayıt yok"} />
        <FactRow label="Görüşme ölçümü" value={recordCount(snapshot.measurements.length)} />
        <FactRow label="Kilo kaydı" value={recordCount(snapshot.weight_records.length)} />
        <FactRow label="Sayaç kaydı olan gün" value={recordCount(snapshot.daily_counters.length, "gün")} />
      </View>
    );
  }

  if (snapshot.subject === "baby") {
    return (
      <View style={styles.factList}>
        <FactRow label="Bebek" value={snapshot.baby.name} />
        <FactRow label="Bakım günlüğü" value={snapshot.care_coverage.has_records ? `${snapshot.care_coverage.record_count} kayıt` : "Kayıt yok"} />
        <FactRow label="Vücut ısısı" value={recordCount(snapshot.temperatures.length)} />
        <FactRow label="En son ham büyüme ölçümü" value={recordCount(snapshot.growth_records.length)} />
      </View>
    );
  }

  return (
    <View style={styles.factList}>
      <FactRow label="Anne" value={snapshot.profile.mother_name?.trim() || snapshot.profile.display_name?.trim() || "Anne"} />
      <FactRow label="Doğum sonrası" value={`${snapshot.postpartum_days}. gün`} />
      <FactRow label="İyi oluş öz değerlendirmesi" value={recordCount(snapshot.wellbeing.length)} />
      <FactRow label="Sağım kaydı" value={snapshot.pumping_summary.has_records ? `${snapshot.pumping_summary.record_count} kayıt` : "Kayıt yok"} />
    </View>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function recordCount(count: number, suffix = "kayıt") {
  return count ? `${count} ${suffix}` : "Kayıt yok";
}

function itemTypeLabel(type: DoctorVisitItemType) {
  return ({ question: "Soru", symptom: "Belirti", medication: "İlaç / vitamin", note: "Not" })[type];
}

function renderItemTypeIcon(type: DoctorVisitItemType, selected: boolean, primary: string) {
  const color = selected ? primary : colors.textMuted;
  if (type === "question") return <CircleHelp color={color} size={17} />;
  if (type === "symptom") return <HeartPulse color={color} size={17} />;
  if (type === "medication") return <Pill color={color} size={17} />;
  return <NotebookPen color={color} size={17} />;
}

function itemTitleLabel(type: DoctorVisitItemType) {
  return ({
    question: "Doktora sorum",
    symptom: "Belirti başlığı",
    medication: "İlaç / vitamin adı",
    note: "Not başlığı"
  })[type];
}

function itemDetailsLabel(type: DoctorVisitItemType) {
  return ({
    question: "Sorunun ayrıntısı",
    symptom: "Ne zaman, ne sıklıkta, ne artırıyor?",
    medication: "Doz, sıklık ve kullanım notu",
    note: "Ayrıntı"
  })[type];
}

function parseOptionalNumber(value: string, label: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} sayısal bir değer olmalı.`);
  return parsed;
}

function parseOptionalInteger(value: string, label: string) {
  const parsed = parseOptionalNumber(value, label);
  if (parsed != null && !Number.isInteger(parsed)) {
    throw new Error(`${label} tam sayı olmalı.`);
  }
  return parsed;
}

function formatDateRange(snapshot: DoctorVisitSnapshot) {
  return `${formatDate(snapshot.period.start_date)}–${formatDate(snapshot.period.end_date)}`;
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

const styles = StyleSheet.create({
  page: {
    alignSelf: "center",
    gap: spacing.lg,
    maxWidth: 720,
    width: "100%"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  headerTitle: {
    ...typography.heading3
  },
  headerSpacer: {
    width: 48
  },
  hero: {
    ...radii.cardLarge,
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.lg,
    overflow: "hidden",
    padding: spacing.xl
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm
  },
  heroBody: {
    ...typography.body,
    color: colors.text
  },
  accessNote: {
    alignItems: "flex-start",
    backgroundColor: colors.highlightSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  accessNoteText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  contextCard: {
    gap: spacing.xl
  },
  sectionLead: {
    flex: 1,
    gap: spacing.xs
  },
  sectionHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  subjectRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  periodRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: spacing.sm
  },
  choiceText: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    textAlign: "center"
  },
  choiceTextSelected: {
    color: colors.onPrimary
  },
  fieldGroup: {
    gap: spacing.sm
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  smallChoice: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 48,
    paddingHorizontal: spacing.md
  },
  smallChoiceText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 14
  },
  previewCard: {
    gap: spacing.lg
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  previewMark: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  previewCopy: {
    flex: 1,
    gap: spacing.xs
  },
  factList: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  factRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 47,
    paddingVertical: spacing.sm
  },
  factLabel: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  factValue: {
    color: colors.text,
    fontFamily: fonts.dataBold,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: "48%",
    textAlign: "right"
  },
  switchRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md
  },
  switchCopy: {
    flex: 1,
    gap: spacing.xs
  },
  switchTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 15
  },
  switchHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  creditNote: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  creditText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  listCard: {
    gap: spacing.lg
  },
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  iconAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  itemList: {
    gap: spacing.md
  },
  itemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  itemDot: {
    borderRadius: radii.pill,
    height: 9,
    marginTop: 8,
    width: 9
  },
  itemCopy: {
    flex: 1,
    gap: 2
  },
  itemTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  itemMeta: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  moreText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: spacing.xl
  },
  emptyCopy: {
    ...typography.body,
    color: colors.textMuted
  },
  formArea: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    paddingTop: spacing.lg
  },
  scaleRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  flexField: {
    flex: 1
  },
  dateControl: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  dateControlText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14
  },
  expandHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52
  },
  safetyCopy: {
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  disclaimer: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  disclaimerText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  pickerPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }]
  }
});
