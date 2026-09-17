import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  EyeOff,
  FileSearch,
  Image as ImageIcon,
  Info,
  Link2,
  Minus,
  Share2,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";

import {
  DOCUMENT_INSIGHT_MAX_BYTES,
  analyzeMedicalDocument,
  type DocumentInsightResult,
  type DocumentInsightValue
} from "@/api/documentInsight";
import {
  commitFamilyFeatureCredit,
  getFamilyFeatureAccess,
  releaseFamilyFeatureCredit,
  reserveFamilyFeatureCredit
} from "@/api/familyCoordination";
import {
  listPregnancyHealthTimeline,
  savePregnancyHealthLabResults
} from "@/api/pregnancyHealthFile";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  PressableScale,
  SkeletonShimmer,
  StaggeredList
} from "@/components/motion";
import { Screen } from "@/components/Screen";
import { createCareUuid } from "@/features/care-journal/careSync";
import {
  acknowledgeDocumentDisclaimer,
  DOCUMENT_DISCLAIMER_ACKNOWLEDGEMENT,
  DOCUMENT_DISCLAIMER_BODY,
  DOCUMENT_DISCLAIMER_TITLE,
  hasAcknowledgedDocumentDisclaimer
} from "@/features/document-insight/disclaimerConsent";
import {
  getTrimesterLabel,
  resolveInterpretationContext
} from "@/features/document-insight/pregnancyContext";
import { buildRangeBarModel } from "@/features/document-insight/rangeBar";
import type {
  DocumentRedFlag,
  DocumentRedFlagSeverity
} from "@/features/document-insight/types";
import {
  collectPreviousLabValues,
  findValueTrend,
  formatTrendDate,
  type PreviousLabValue
} from "@/features/document-insight/trend";
import {
  getRemainingAnalysisCopy,
  resolveValueMomentPaywall,
  type DocumentInsightAction
} from "@/features/document-insight/valueMomentPaywall";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPostCreditPaywallIfNeeded } from "@/features/subscription/postCreditPaywall";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { getPregnancyWeek } from "@/lib/dates";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

type TemporaryDocument = {
  uri: string;
  mimeType: string;
  byteSize: number;
  kind: "pdf" | "image";
};

const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Sorted by how much the reader needs them, not by how the lab printed them. */
type ResultGroup = "attention" | "normal" | "unread";

const PERSISTENT_DISCLAIMER =
  "Bu bilgi tıbbi tavsiye değildir; tanı ve tedavi için doktoruna başvur.";

export default function DocumentInsightScreen() {
  const appTheme = useAppTheme();
  const { showError, showInfo, showSuccess } = useFeedback();
  const [selected, setSelected] = useState<TemporaryDocument | null>(null);
  const selectedRef = useRef<TemporaryDocument | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingToHealthFile, setIsSavingToHealthFile] = useState(false);
  const [result, setResult] = useState<DocumentInsightResult | null>(null);
  // The paywall may fire at most once per analysed document.
  const paywallOfferedRef = useRef(false);

  const featureAccessQuery = useQuery({
    queryKey: ["family-feature-access", PREMIUM_FEATURES.documentInsight.source],
    queryFn: () => getFamilyFeatureAccess(PREMIUM_FEATURES.documentInsight.source)
  });
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getCurrentProfile
  });
  const featureAccess = featureAccessQuery.data;
  const profile = profileQuery.data;
  const isPremium = Boolean(featureAccess?.is_premium);
  const lifeStage = profile?.is_pregnant ? "pregnancy" : "postpartum";
  const interpretationContext = useMemo(
    () =>
      resolveInterpretationContext({
        isPregnant: profile?.is_pregnant ?? null,
        pregnancyWeek: getPregnancyWeek(profile?.due_date)
      }),
    [profile?.due_date, profile?.is_pregnant]
  );

  // Trend comparison only has something to read once values were saved before,
  // which is a Premium archive, so it is not fetched for anyone else.
  const timelineQuery = useQuery({
    queryKey: ["pregnancy-health-timeline"],
    queryFn: listPregnancyHealthTimeline,
    enabled: isPremium && Boolean(result?.values.length)
  });
  const previousValues = useMemo<PreviousLabValue[]>(
    () => (timelineQuery.data ? collectPreviousLabValues(timelineQuery.data.timeline) : []),
    [timelineQuery.data]
  );

  useEffect(() => {
    let active = true;
    void hasAcknowledgedDocumentDisclaimer().then((acknowledged) => {
      if (active) setDisclaimerAcknowledged(acknowledged);
    });
    return () => {
      active = false;
    };
  }, []);

  const runValueMoment = useCallback(
    async (action: DocumentInsightAction) => {
      const decision = resolveValueMomentPaywall(action, {
        hasSeenResult: Boolean(result?.values.length),
        isPremium,
        remaining: featureAccess?.remaining ?? null,
        alreadyOffered: paywallOfferedRef.current
      });
      if (!decision.present) return false;

      paywallOfferedRef.current = true;
      await trackEvent("document_insight_result_engaged", {
        action,
        life_stage: lifeStage,
        paywall_reason: decision.reason,
        remaining: featureAccess?.remaining ?? null
      });

      if (decision.reason === "last_free_credit_used") {
        // Keeps the once-per-account server claim that postCreditPaywall owns.
        return showPostCreditPaywallIfNeeded({
          feature: "document_insight",
          isPremium,
          lifeStage,
          remaining: 0,
          source: PREMIUM_FEATURES.documentInsight.source
        });
      }

      const source =
        decision.reason === "premium_feature_selected"
          ? PREMIUM_FEATURES.pregnancyHealthFileSave.source
          : PREMIUM_FEATURES.documentInsight.source;
      const outcome = await showPaywallIfNeeded(
        source,
        {
          feature:
            decision.reason === "premium_feature_selected"
              ? "pregnancy_health_file_save"
              : "document_insight",
          life_stage: lifeStage,
          reason: decision.reason,
          remaining: featureAccess?.remaining ?? null
        },
        { mode: "required" }
      );
      return outcome.presented;
    },
    [featureAccess?.remaining, isPremium, lifeStage, result?.values.length]
  );

  async function ensureDocumentAccess() {
    if (featureAccessQuery.isLoading) return false;
    if (featureAccessQuery.isError) {
      showError(featureAccessQuery.error, "Akıllı hak kontrol edilemedi");
      return false;
    }
    const creditsExhausted = Boolean(
      featureAccess && !featureAccess.is_premium && featureAccess.remaining === 0
    );
    if (!creditsExhausted) return true;

    // Nothing was seen yet on a fresh screen, so the offer only lands here when
    // the user is coming back for another document.
    const presented = await runValueMoment("pick_document");
    if (!presented) {
      await showPaywallIfNeeded(
        PREMIUM_FEATURES.documentInsight.source,
        {
          feature: "document_insight",
          life_stage: lifeStage,
          reason: "free_credits_exhausted",
          remaining: 0
        },
        { mode: "required" }
      );
    }
    return false;
  }

  const setTemporaryDocument = useCallback(async (next: TemporaryDocument | null) => {
    const previous = selectedRef.current;
    selectedRef.current = next;
    setSelected(next);
    if (previous && previous.uri !== next?.uri) await deleteTemporaryFile(previous.uri);
  }, []);

  useEffect(
    () => () => {
      const current = selectedRef.current;
      selectedRef.current = null;
      if (current) void deleteTemporaryFile(current.uri);
    },
    []
  );

  const acceptDisclaimer = async () => {
    await acknowledgeDocumentDisclaimer();
    setDisclaimerAcknowledged(true);
  };

  const choosePdf = async () => {
    try {
      if (!await ensureDocumentAccess()) return;
      const pick = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "application/pdf"
      });
      if (pick.canceled || !pick.assets[0]) return;
      const asset = pick.assets[0];
      await acceptTemporaryDocument({
        uri: asset.uri,
        mimeType: asset.mimeType || "application/pdf",
        byteSize: asset.size ?? new File(asset.uri).size,
        kind: "pdf"
      });
    } catch (error) {
      showError(error, "PDF seçilemedi");
    }
  };

  const chooseImage = async (source: "camera" | "library") => {
    try {
      if (!await ensureDocumentAccess()) return;
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(source === "camera" ? "Kamera izni gerekli." : "Fotoğraf arşivi izni gerekli.");
      }

      const pick =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85
            });
      if (pick.canceled || !pick.assets[0]) return;
      const asset = pick.assets[0];
      const file = new File(asset.uri);
      const mimeType = normalizeImageMimeType(asset.mimeType, asset.uri);
      await acceptTemporaryDocument({
        uri: asset.uri,
        mimeType,
        byteSize: asset.fileSize ?? file.size,
        kind: "image"
      });
    } catch (error) {
      showError(error, source === "camera" ? "Fotoğraf çekilemedi" : "Fotoğraf seçilemedi");
    }
  };

  const acceptTemporaryDocument = async (document: TemporaryDocument) => {
    if (!MIME_TYPES.has(document.mimeType)) {
      await deleteTemporaryFile(document.uri);
      throw new Error("Yalnızca PDF, JPEG, PNG veya WebP belge seçebilirsiniz.");
    }
    if (!Number.isFinite(document.byteSize) || document.byteSize < 1) {
      await deleteTemporaryFile(document.uri);
      throw new Error("Belgenin boyutu okunamadı.");
    }
    if (document.byteSize > DOCUMENT_INSIGHT_MAX_BYTES) {
      await deleteTemporaryFile(document.uri);
      throw new Error("Belge en fazla 8 MB olabilir.");
    }

    setResult(null);
    setConsentAccepted(false);
    await setTemporaryDocument(document);
  };

  const analyze = async () => {
    const document = selectedRef.current;
    if (!document) {
      showInfo("Önce bir PDF veya belge fotoğrafı seçin.");
      return;
    }
    if (!consentAccepted) {
      showInfo("Belgeyi işlemeden önce gizlilik onayını işaretleyin.", "Onay gerekli");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    paywallOfferedRef.current = false;
    let ocrCopy: File | null = null;
    const operationId = createCareUuid();
    let creditReserved = false;
    let creditCommitted = false;
    try {
      const reservation = await reserveFamilyFeatureCredit({
        featureKey: "document_insight",
        lifeStage,
        operationId
      });
      if (!reservation.allowed) {
        await showPaywallIfNeeded(PREMIUM_FEATURES.documentInsight.source, {
          feature: "document_insight",
          life_stage: lifeStage,
          reason: "free_credits_exhausted",
          remaining: 0
        }, { mode: "required" });
        return;
      }
      creditReserved = !reservation.is_premium;

      const file = new File(document.uri);
      if (!file.exists) throw new Error("Geçici belge artık cihazda bulunmuyor.");
      ocrCopy = createPrivateOcrCopy(document);
      const analysis = await analyzeMedicalDocument({
        uri: ocrCopy.uri,
        mimeType: document.mimeType,
        context: interpretationContext
      });
      const hasUsefulResult = analysis.readability !== "unreadable" && analysis.values.length > 0;
      const finalCredit = hasUsefulResult && creditReserved
        ? await commitFamilyFeatureCredit(operationId)
        : reservation;
      creditCommitted = hasUsefulResult && creditReserved;
      if (!hasUsefulResult && creditReserved) {
        await releaseFamilyFeatureCredit(operationId);
        creditReserved = false;
      }
      setResult(analysis);
      await trackEvent("document_insight_completed", {
        credit_consumed: creditCommitted,
        life_stage: lifeStage,
        readability: analysis.readability,
        result_count: analysis.values.length
      });
      showSuccess("Belge düzenlendi. Geçici dosya silindi.", "İşlem tamamlandı");

      if (hasUsefulResult) {
        // The value moment: the user now has something real on screen. It is
        // recorded, and deliberately *not* followed by an offer.
        await trackEvent("document_insight_result_viewed", {
          explained_count: analysis.values.filter((value) => value.interpretability === "explained").length,
          life_stage: lifeStage,
          not_interpretable_count: analysis.values.filter((value) => value.interpretability !== "explained").length,
          pregnancy_status: analysis.context.pregnancyStatus,
          red_flag_count: analysis.redFlags.length,
          remaining: finalCredit.remaining,
          result_count: analysis.values.length
        });
        if (analysis.redFlags.length) {
          await trackEvent("document_insight_red_flag_shown", {
            flag_ids: analysis.redFlags.map((flag) => flag.id).join(","),
            life_stage: lifeStage
          });
        }
        await featureAccessQuery.refetch();
      }
    } catch (error) {
      if (creditReserved && !creditCommitted) {
        await releaseFamilyFeatureCredit(operationId).catch(() => undefined);
      }
      showError(error, "Belge işlenemedi");
    } finally {
      if (ocrCopy?.exists) ocrCopy.delete();
      const processed = selectedRef.current;
      selectedRef.current = null;
      setSelected(null);
      setConsentAccepted(false);
      if (processed) await deleteTemporaryFile(processed.uri);
      setIsAnalyzing(false);
    }
  };

  const clearAll = async () => {
    setResult(null);
    setConsentAccepted(false);
    paywallOfferedRef.current = false;
    await setTemporaryDocument(null);
    showSuccess("Geçici belge ve ekrandaki sonuç temizlendi.", "Silindi");
  };

  const saveToHealthFile = async (
    values: DocumentInsightValue[],
    storageConsentAccepted: boolean
  ) => {
    if (!isPremium) {
      await runValueMoment("save_to_health_file");
      return;
    }
    if (!storageConsentAccepted) {
      showInfo("Seçtiğin değerleri saklamadan önce sağlık dosyası onayını işaretle.", "Onay gerekli");
      return;
    }
    if (!values.length) {
      showInfo("Sağlık dosyana kaydetmek için en az bir değer seç.");
      return;
    }

    setIsSavingToHealthFile(true);
    try {
      await savePregnancyHealthLabResults({
        recordedAt: new Date().toISOString(),
        title: "Tahlil sonuçları",
        values
      });
      await trackEvent("pregnancy_health_lab_saved", {
        source: "document_insight",
        value_count: values.length
      });
      await timelineQuery.refetch();
      showSuccess(`${values.length} değer Sağlık Dosyam'a kaydedildi.`, "Sağlık dosyan güncellendi");
    } catch (error) {
      showError(error, "Tahlil değerleri kaydedilemedi");
    } finally {
      setIsSavingToHealthFile(false);
    }
  };

  const showUploadCard = !result;

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.text} size={22} />
          </Pressable>
          <View style={styles.titleCopy}>
            <Text style={typography.eyebrow}>Gizlilik odaklı</Text>
            <Text style={typography.heading1}>Belgeyi Anla</Text>
          </View>
          <ShieldCheck color={appTheme.primary} size={30} />
        </View>

        {disclaimerAcknowledged === false ? (
          <DisclaimerGate onAccept={() => void acceptDisclaimer()} />
        ) : null}

        {showUploadCard && disclaimerAcknowledged ? (
          <Card style={{ backgroundColor: appTheme.tint }}>
            <View style={styles.stack}>
              <Text style={typography.heading3}>Belge yalnızca bu cihazda okunur</Text>
              <Text style={typography.body}>
                Laboratuvar değerlerini bulur, belgenin kendi referans aralıklarıyla karşılaştırır ve her testin ne anlama geldiğini anlatır. Emin olmadığı değerleri yorumlamaz.
              </Text>
              <Text style={styles.privacyLine}>İnternete gönderilmez • Orijinal dosya saklanmaz</Text>
            </View>
          </Card>
        ) : null}

        {showUploadCard && disclaimerAcknowledged ? (
          <Card>
            <View style={styles.stack}>
              <View style={styles.sectionTitleRow}>
                <FileSearch color={appTheme.primary} size={25} />
                <Text style={typography.heading2}>Belge ekle</Text>
              </View>
              <Text style={typography.body}>PDF ya da okunaklı bir belge fotoğrafı seçin. En fazla 8 MB.</Text>
              <Text style={styles.smallText}>
                {getRemainingAnalysisCopy(isPremium, featureAccess?.remaining ?? null)}
              </Text>
              {interpretationContext.pregnancyStatus === "pregnant" ? (
                <Text style={styles.smallText}>
                  {getTrimesterLabel(interpretationContext)} bilgin dikkate alınır; gebeliğe özel aralık gerektiren değerler tahmin edilmez.
                </Text>
              ) : null}
              <View style={styles.pickerRow}>
                <PickerButton icon={<Upload color={appTheme.primary} size={21} />} label="PDF" onPress={choosePdf} />
                <PickerButton icon={<Camera color={appTheme.primary} size={21} />} label="Kamera" onPress={() => chooseImage("camera")} />
                <PickerButton icon={<ImageIcon color={appTheme.primary} size={21} />} label="Galeri" onPress={() => chooseImage("library")} />
              </View>

              {selected ? (
                <View style={[styles.selectedBox, { backgroundColor: appTheme.tint }]}>
                  <FileSearch color={appTheme.primary} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.label}>{selected.kind === "pdf" ? "PDF hazır" : "Belge fotoğrafı hazır"}</Text>
                    <Text style={styles.smallText}>{formatBytes(selected.byteSize)} • Dosya adı gösterilmez</Text>
                  </View>
                  <Pressable accessibilityLabel="Seçili belgeyi sil" accessibilityRole="button" onPress={() => void setTemporaryDocument(null)} style={styles.iconButton}>
                    <Trash2 color={colors.danger} size={20} />
                  </Pressable>
                </View>
              ) : null}

              <ConsentCheckbox
                checked={consentAccepted}
                label="Belgenin cihazda okunacağını, kimlik alanlarının sonuçtan çıkarılacağını ve geçici dosyanın işlem sonunda silineceğini anlıyorum."
                onToggle={() => setConsentAccepted((value) => !value)}
              />

              <Button disabled={!selected || !consentAccepted || isAnalyzing} label={isAnalyzing ? "Belge okunuyor…" : "Belgeyi anla"} onPress={analyze} />
            </View>
          </Card>
        ) : null}

        {isAnalyzing ? <AnalysisSkeleton /> : null}

        {result ? (
          <ResultView
            isPremium={isPremium}
            isSaving={isSavingToHealthFile}
            onEngage={(action) => void runValueMoment(action)}
            onSave={(values, storageConsentAccepted) =>
              void saveToHealthFile(values, storageConsentAccepted)
            }
            previousValues={previousValues}
            remaining={featureAccess?.remaining ?? null}
            result={result}
          />
        ) : null}

        {(selected || result) && !isAnalyzing ? <Button label="Belgeyi ve sonucu sil" onPress={clearAll} variant="ghost" /> : null}
      </View>
    </Screen>
  );
}

/**
 * Shown once, before the first analysis. Acknowledging it is a deliberate tap,
 * not a checkbox buried under a button the user was going to press anyway.
 */
function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  const appTheme = useAppTheme();
  const [checked, setChecked] = useState(false);
  return (
    <Card style={{ backgroundColor: appTheme.tint }}>
      <View style={styles.stack}>
        <View style={styles.sectionTitleRow}>
          <ShieldCheck color={appTheme.primary} size={24} />
          <Text style={typography.heading2}>{DOCUMENT_DISCLAIMER_TITLE}</Text>
        </View>
        <Text style={typography.body}>{DOCUMENT_DISCLAIMER_BODY}</Text>
        <ConsentCheckbox
          checked={checked}
          label={DOCUMENT_DISCLAIMER_ACKNOWLEDGEMENT}
          onToggle={() => setChecked((value) => !value)}
        />
        <Button disabled={!checked} label="Anladım, devam et" onPress={onAccept} />
      </View>
    </Card>
  );
}

function ResultView({
  isPremium,
  isSaving,
  onEngage,
  onSave,
  previousValues,
  remaining,
  result
}: {
  isPremium: boolean;
  isSaving: boolean;
  onEngage: (action: DocumentInsightAction) => void;
  onSave: (values: DocumentInsightValue[], storageConsentAccepted: boolean) => void;
  previousValues: PreviousLabValue[];
  remaining: number | null;
  result: DocumentInsightResult;
}) {
  const appTheme = useAppTheme();
  const { showSuccess } = useFeedback();
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(() => new Set());
  const [storageConsentAccepted, setStorageConsentAccepted] = useState(false);
  const grouped = useMemo(() => groupDocumentValues(result.values), [result.values]);
  const contextualCount = result.values.filter((value) => value.interpretability === "contextual").length;
  const selectedValues = result.values.filter((_, index) => selectedIndexes.has(index));
  const remainingCopy = getRemainingAnalysisCopy(isPremium, remaining);

  function toggleSelected(index: number) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const questionsText = result.doctorQuestions
    .map((question, index) => `${index + 1}. ${question}`)
    .join("\n");

  const copyQuestions = async () => {
    await Clipboard.setStringAsync(`Doktoruma soracaklarım\n\n${questionsText}\n\n${PERSISTENT_DISCLAIMER}`);
    showSuccess("Sorular panoya kopyalandı.", "Kopyalandı");
    onEngage("copy_questions");
  };

  const shareQuestions = async () => {
    await Share.share({
      message: `Doktoruma soracaklarım\n\n${questionsText}\n\n${PERSISTENT_DISCLAIMER}`
    });
    onEngage("copy_questions");
  };

  return (
    <View style={styles.stackLarge}>
      {result.redFlags.length ? <RedFlagCard flags={result.redFlags} /> : null}

      {result.readability !== "readable" ? (
        <Card style={{ backgroundColor: colors.highlightSoft }}>
          <Text style={typography.heading3}>Laboratuvar sonuçları güvenle ayırt edilemedi</Text>
          <Text style={typography.body}>Belge metni okundu ancak test adı, sonuç ve birim eşleştirilemedi. Daha düz ve net bir fotoğraf deneyin; okunmayan alanlar tahmin edilmedi.</Text>
        </Card>
      ) : null}

      <Card style={{ backgroundColor: appTheme.tint }}>
        <View style={styles.stack}>
          <Text style={typography.eyebrow}>BELGE ÖZETİ</Text>
          <Text style={typography.heading2}>
            {result.values.length
              ? `${result.values.length} sonuç okundu`
              : "Eşleştirilebilen bir sonuç bulunamadı"}
          </Text>
          {result.values.length ? (
            <View style={styles.resultSummaryRow}>
              <SummaryCount label="Dikkat" tone="attention" value={grouped.attention.length} />
              <SummaryCount label="Beklenen" tone="normal" value={grouped.normal.length} />
              <SummaryCount label="Yorumlanmadı" tone="unread" value={grouped.unread.length} />
            </View>
          ) : null}
          {contextualCount ? (
            <View style={styles.contextNote}>
              <Info color={colors.honeyGold} size={16} />
              <Text style={styles.contextNoteText}>
                {contextualCount} sonuç “Gebelik notu var” rozetiyle işaretlendi: laboratuvarın kendi karşılaştırmasını gösteriyoruz, ama o aralık gebe olmayan yetişkinler için yazıldığı için sonucun anlamı hakkında bir şey söylemiyoruz.
              </Text>
            </View>
          ) : null}
          {remainingCopy ? <Text style={styles.smallText}>{remainingCopy}</Text> : null}
        </View>
      </Card>

      {grouped.attention.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Rapordaki aralığın dışında görünenler</Text>
            <StaggeredList style={styles.stack}>
              {grouped.attention.map((value, index) => (
                <ValueCard
                  key={`attention-${value.testName}-${index}`}
                  onExpand={() => onEngage("expand_value")}
                  previousValues={previousValues}
                  value={value}
                />
              ))}
            </StaggeredList>
          </View>
        </Card>
      ) : null}

      {grouped.normal.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Rapordaki aralığın içinde görünenler</Text>
            <StaggeredList style={styles.stack}>
              {grouped.normal.map((value, index) => (
                <ValueCard
                  key={`normal-${value.testName}-${index}`}
                  onExpand={() => onEngage("expand_value")}
                  previousValues={previousValues}
                  value={value}
                />
              ))}
            </StaggeredList>
          </View>
        </Card>
      ) : null}

      {grouped.unread.length ? (
        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <View style={styles.stack}>
            <View style={styles.sectionTitleRow}>
              <EyeOff color={colors.textMuted} size={22} />
              <Text style={typography.heading2}>Bunları yorumlamadık</Text>
            </View>
            <Text style={typography.body}>
              Bu değerleri belgeden okuduk ama emin olamadığımız için anlamı hakkında bir şey yazmadık. Tahmin etmek yerine boş bırakmayı tercih ediyoruz.
            </Text>
            {grouped.unread.map((value, index) => (
              <View key={`unread-${value.testName}-${index}`} style={styles.unreadRow}>
                <View style={styles.valueHeader}>
                  <Text style={[typography.label, styles.valueName]}>{value.testName}</Text>
                  <Text style={styles.resultText}>{value.result}{value.unit ? ` ${value.unit}` : ""}</Text>
                </View>
                <Text style={styles.smallText}>{value.notInterpretableReason}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {result.doctorQuestions.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Doktoruna sor</Text>
            <Text style={typography.body}>Bu listeyi görüşmene götürebilirsin.</Text>
            {result.doctorQuestions.map((question, index) => (
              <Text key={`${question}-${index}`} style={styles.questionText}>{index + 1}. {question}</Text>
            ))}
            <View style={styles.questionActions}>
              <SecondaryAction icon={<Copy color={appTheme.primary} size={18} />} label="Kopyala" onPress={() => void copyQuestions()} />
              <SecondaryAction icon={<Share2 color={appTheme.primary} size={18} />} label="Paylaş" onPress={() => void shareQuestions()} />
            </View>
          </View>
        </Card>
      ) : null}

      {result.values.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.eyebrow}>{isPremium ? "PREMIUM · KALICI DOSYA" : "PREMIUM"}</Text>
            <Text style={typography.heading2}>Sağlık Dosyam'a kaydet</Text>
            <Text style={typography.body}>
              Kaydettiğin değerler bir sonraki tahlilinde karşılaştırma için kullanılır. Yalnızca seçtiğin test adı, değer, birim ve belgedeki referans aralığı saklanır; belgenin kendisi ve OCR metni saklanmaz.
            </Text>
            {result.values.map((value, index) => {
              const checked = selectedIndexes.has(index);
              return (
                <ConsentCheckbox
                  checked={checked}
                  key={`${value.testName}-${index}`}
                  label={`${value.testName}: ${value.result}${value.unit ? ` ${value.unit}` : ""}`}
                  onToggle={() => toggleSelected(index)}
                />
              );
            })}
            {isPremium ? (
              <ConsentCheckbox
                checked={storageConsentAccepted}
                label="Seçtiğim değerlerin Anne+ Sağlık Dosyam'da saklanacağını ve yalnızca tam aile erişimi verdiğim kişilerle paylaşılabileceğini kabul ediyorum."
                onToggle={() => setStorageConsentAccepted((value) => !value)}
              />
            ) : null}
            <Button
              disabled={isSaving || (isPremium && (selectedValues.length === 0 || !storageConsentAccepted))}
              label={isSaving ? "Kaydediliyor..." : isPremium ? `${selectedValues.length} değeri kaydet` : "Sağlık Dosyam'a kaydet · Premium"}
              onPress={() => onSave(selectedValues, storageConsentAccepted)}
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.safetyCard}>
        <View style={styles.stack}>
          <View style={styles.sectionTitleRow}><ShieldCheck color={appTheme.primary} size={22} /><Text style={typography.heading3}>Bilmen gereken</Text></View>
          <Text style={styles.safetyNotice}>{result.safetyNotice}</Text>
          <Text style={styles.smallText}>Geçici belge silindi; sonuç kendiliğinden hiçbir yere kaydedilmedi.</Text>
        </View>
      </Card>
    </View>
  );
}

/**
 * The first thing on screen when it applies. Loud enough to be seen, quiet
 * enough not to frighten: it names what the number looks like and what to do,
 * and never what it might be.
 */
const SEVERITY_LABEL: Record<DocumentRedFlagSeverity, string> = {
  urgent: "Bugün değerlendirilmeli",
  today: "Bugün doktoruna danış",
  soon: "Dikkat"
};

function RedFlagCard({ flags }: { flags: DocumentRedFlag[] }) {
  return (
    <Card style={styles.redFlagCard}>
      <View style={styles.stack}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.redFlagIcon}>
            <AlertTriangle color={colors.dustyRose} size={20} />
          </View>
          <Text style={[typography.heading2, styles.redFlagTitle]}>Bunu doktorunla paylaş</Text>
        </View>
        <StaggeredList style={styles.stack}>
          {flags.map((flag) => (
            <View key={flag.id} style={styles.redFlagRow}>
              <View style={styles.redFlagHeader}>
                <Text style={[typography.label, styles.valueName]}>{flag.testName}</Text>
                <View
                  style={[
                    styles.severityPill,
                    { backgroundColor: flag.severity === "soon" ? colors.highlightSoft : colors.surface }
                  ]}
                >
                  <Text style={styles.severityText}>{SEVERITY_LABEL[flag.severity]}</Text>
                </View>
              </View>
              {/* A cuff at home and a laboratory report are not the same kind of
                  evidence, so the card never lets them look alike. */}
              <Text style={styles.smallText}>
                {flag.source === "manual_measurement" ? "Kendi ölçümün" : "Tahlil raporundan"}
              </Text>
              <Text style={typography.body}>{flag.observation}</Text>
              <Text style={styles.redFlagAction}>{flag.action}</Text>
              <SourceLink label={flag.sourceLabel} url={flag.sourceUrl} />
            </View>
          ))}
        </StaggeredList>
        <Text style={styles.smallText}>
          Bu uyarı bir tanı değildir ve aciliyet değerlendirmesi yapmaz. Kendini kötü hissediyorsan beklemeden sağlık kuruluşuna başvur.
        </Text>
      </View>
    </Card>
  );
}

function ValueCard({
  onExpand,
  previousValues,
  value
}: {
  onExpand: () => void;
  previousValues: PreviousLabValue[];
  value: DocumentInsightValue;
}) {
  const appTheme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const status = getValueStatus(value);
  const rangeBar = useMemo(() => buildRangeBarModel(value), [value]);
  const trend = useMemo(() => findValueTrend(value, previousValues), [previousValues, value]);
  const referenceRange = usefulDocumentText(value.referenceRange);
  const whatItIs = usefulDocumentText(value.plainLanguage.whatItIs);
  const possibleMeaning = usefulDocumentText(value.plainLanguage.possibleMeaning);
  const clinicianContext = usefulDocumentText(value.plainLanguage.clinicianContext);

  function toggle() {
    setExpanded((current) => {
      if (!current) onExpand();
      return !current;
    });
  }

  return (
    <View style={styles.valueCard}>
      <View style={styles.valueHeader}>
        <Text style={[typography.label, styles.valueName]}>{value.testName}</Text>
        <Text style={[styles.resultValue, { color: status.color }]}>
          {value.result}
          {value.unit ? <Text style={styles.resultUnit}> {value.unit}</Text> : null}
        </Text>
      </View>

      {/* Colour never carries the meaning alone: the icon and the word do too. */}
      <View style={styles.pillRow}>
        <View style={[styles.statusPill, { backgroundColor: status.background }]}>
          {status.icon}
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
        {value.interpretability === "contextual" ? (
          <View style={[styles.statusPill, { backgroundColor: colors.highlightSoft }]}>
            <Info color={colors.honeyGold} size={14} />
            <Text style={styles.statusText}>Gebelik notu var</Text>
          </View>
        ) : null}
      </View>

      {rangeBar ? (
        <View
          accessibilityLabel={`${value.testName} sonucu ${value.result} ${value.unit}. Rapordaki aralık ${referenceRange ?? "belirtilmemiş"}. Durum: ${status.label}.`}
          accessibilityRole="image"
          style={styles.rangeBarBlock}
        >
          <View style={styles.rangeTrack}>
            <View
              style={[
                styles.rangeBand,
                { left: `${rangeBar.bandStart * 100}%`, width: `${(rangeBar.bandEnd - rangeBar.bandStart) * 100}%` }
              ]}
            />
            <View style={[styles.rangeMarker, { left: `${rangeBar.markerPosition * 100}%`, backgroundColor: status.color }]} />
          </View>
          <View style={styles.rangeLabels}>
            <Text style={styles.rangeLabelText}>{rangeBar.lowLabel ? `alt ${rangeBar.lowLabel}` : ""}</Text>
            <Text style={styles.rangeLabelText}>{rangeBar.highLabel ? `üst ${rangeBar.highLabel}` : ""}</Text>
          </View>
        </View>
      ) : null}

      {trend ? (
        <View style={styles.trendRow}>
          {trend.direction === "up" ? <TrendingUp color={colors.textMuted} size={16} />
            : trend.direction === "down" ? <TrendingDown color={colors.textMuted} size={16} />
            : <Minus color={colors.textMuted} size={16} />}
          <Text style={styles.smallText}>
            Önceki kayıt ({formatTrendDate(trend.previousDate)}): {trend.previousResult}{trend.previousUnit ? ` ${trend.previousUnit}` : ""}
            {trend.difference ? ` · ${trend.difference}` : ""}
          </Text>
        </View>
      ) : null}

      <Text style={styles.valueSummary}>
        {value.interpretability === "explained"
          ? possibleMeaning ?? value.referenceExplanation
          : value.interpretability === "contextual"
            ? value.referenceExplanation
            : value.notInterpretableReason}
      </Text>

      {/*
        A contextual value keeps the lab's own comparison but not its meaning,
        so the reason must be visible without opening anything — otherwise the
        comparison reads as a verdict it is not.
      */}
      {value.contextNote ? (
        <View style={styles.contextNote}>
          <Info color={colors.honeyGold} size={16} />
          <Text style={styles.contextNoteText}>{value.contextNote}</Text>
        </View>
      ) : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={styles.expandButton}
      >
        <Text style={[styles.expandText, { color: appTheme.primary }]}>{expanded ? "Ayrıntıyı kapat" : "Ayrıntıyı gör"}</Text>
        {expanded ? <ChevronUp color={appTheme.primary} size={17} /> : <ChevronDown color={appTheme.primary} size={17} />}
      </PressableScale>

      {expanded ? (
        <View style={styles.explanationBox}>
          {whatItIs ? (
            <View style={styles.explanationSection}>
              <Text style={styles.explanationLabel}>Bu test neyi anlatır?</Text>
              <Text style={typography.body}>{whatItIs}</Text>
            </View>
          ) : null}
          {value.plainLanguage.symptomContext.length ? (
            <View style={styles.explanationSection}>
              <Text style={styles.explanationLabel}>Bu yöndeki sonuçlarla birlikte görülebilen yakınmalar</Text>
              <Text style={typography.body}>{value.plainLanguage.symptomContext.join(" • ")}</Text>
              <Text style={styles.smallText}>Bu yakınmalar sonucu kanıtlamaz; hiçbiri görülmeyebilir ve başka nedenleri olabilir.</Text>
            </View>
          ) : null}
          {clinicianContext ? (
            <View style={styles.explanationSection}>
              <Text style={styles.explanationLabel}>Birlikte değerlendirilmesi gerekenler</Text>
              <Text style={typography.body}>{clinicianContext}</Text>
            </View>
          ) : null}
          {referenceRange ? (
            <Text style={styles.rangeText}>Rapordaki referans aralığı: {referenceRange}</Text>
          ) : null}
          {value.trimesterSensitive ? (
            <Text style={styles.smallText}>Bu testin beklenen aralığı gebelik dönemine göre değişebilir.</Text>
          ) : null}
          <SourceLink label={value.plainLanguage.sourceLabel} url={value.plainLanguage.sourceUrl} />
        </View>
      ) : null}
    </View>
  );
}

/** No source, no link — and therefore no claim standing on its own. */
function SourceLink({ label, url }: { label: string; url: string }) {
  const appTheme = useAppTheme();
  if (!label.trim() || !/^https:\/\//i.test(url ?? "")) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.sourceLink}>
      <Link2 color={appTheme.primary} size={16} />
      <Text style={[styles.sourceText, { color: appTheme.primary }]}>{label}</Text>
    </Pressable>
  );
}

function ConsentCheckbox({
  checked,
  label,
  onToggle
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const appTheme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.consentRow}
    >
      <View style={[styles.checkbox, checked && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }]}>
        {checked ? <Check color={colors.onPrimary} size={16} /> : null}
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const appTheme = useAppTheme();
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}>
      {icon}
      <Text style={[styles.secondaryActionLabel, { color: appTheme.primary }]}>{label}</Text>
    </PressableScale>
  );
}

function SummaryCount({ label, tone, value }: { label: string; tone: ResultGroup; value: number }) {
  const backgroundColor =
    tone === "normal" ? colors.primarySoft : tone === "attention" ? colors.accentSoft : colors.surfaceMuted;
  return (
    <View style={[styles.summaryCount, { backgroundColor }]}>
      <Text style={styles.summaryNumber}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function groupDocumentValues(values: DocumentInsightValue[]) {
  return values.reduce<Record<ResultGroup, DocumentInsightValue[]>>((groups, value) => {
    groups[getResultGroup(value)].push(value);
    return groups;
  }, { attention: [], normal: [], unread: [] });
}

function getResultGroup(value: DocumentInsightValue): ResultGroup {
  // A contextual value still carries the lab's own comparison, so it belongs
  // beside the values it was compared with rather than in the unread pile. The
  // badge and the note on its card are what mark it as the weaker claim.
  if (value.interpretability === "not_interpretable") return "unread";
  if (value.referenceStatus === "below" || value.referenceStatus === "above") return "attention";
  if (value.documentMarker === "low" || value.documentMarker === "high" || value.documentMarker === "abnormal") {
    return "attention";
  }
  if (value.referenceStatus === "within" || value.documentMarker === "normal") return "normal";
  return "unread";
}

function getValueStatus(value: DocumentInsightValue) {
  const group = getResultGroup(value);
  if (group === "attention") {
    const low = value.referenceStatus === "below" || value.documentMarker === "low";
    return {
      background: colors.accentSoft,
      color: colors.dustyRose,
      icon: <AlertTriangle color={colors.dustyRose} size={14} />,
      label: low ? "Aralığın altında" : "Aralığın üstünde"
    };
  }
  if (group === "normal") {
    return {
      background: colors.primarySoft,
      color: colors.sageGreen,
      icon: <Check color={colors.sageGreen} size={14} />,
      label: "Rapordaki aralıkta"
    };
  }
  return {
    background: colors.highlightSoft,
    color: colors.honeyGold,
    icon: <EyeOff color={colors.honeyGold} size={14} />,
    label: "Yorumlanmadı"
  };
}

function usefulDocumentText(value?: string | null) {
  const text = value?.trim();
  if (!text || /^(belirtilmemiş|belirtilmemis|yok|[-–—])$/i.test(text)) return null;
  return text;
}

function AnalysisSkeleton() {
  return (
    <Card>
      <View style={styles.stack}>
        <SkeletonShimmer height={18} width="55%" />
        <SkeletonShimmer delay={80} height={12} />
        <SkeletonShimmer delay={160} height={12} width="80%" />
        <SkeletonShimmer delay={240} height={44} radius={radii.lg} />
        <Text style={styles.smallText}>Belge cihazında okunuyor. Hiçbir şey internete gönderilmiyor.</Text>
      </View>
    </Card>
  );
}

function PickerButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.pickerButton}>{icon}<Text style={styles.pickerLabel}>{label}</Text></PressableScale>;
}

function normalizeImageMimeType(mimeType: string | undefined, uri: string) {
  if (mimeType && MIME_TYPES.has(mimeType)) return mimeType;
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function createPrivateOcrCopy(document: TemporaryDocument) {
  const extension = document.mimeType === "application/pdf"
    ? "pdf"
    : document.mimeType === "image/png"
      ? "png"
      : document.mimeType === "image/webp"
        ? "webp"
        : "jpg";
  const destination = new File(
    Paths.cache,
    `document-insight-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
  );
  new File(document.uri).copy(destination);
  return destination;
}

async function deleteTemporaryFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A picker may already have cleared its cache. Nothing is persisted by the app.
  }
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  topBar: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  titleCopy: { flex: 1 },
  iconButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  stack: { gap: spacing.md },
  stackLarge: { gap: spacing.lg },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  privacyLine: { color: colors.primary, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 },
  pickerRow: { flexDirection: "row", gap: spacing.sm },
  pickerButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flex: 1, gap: spacing.xs, minHeight: 72, justifyContent: "center" },
  pickerLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  selectedBox: { alignItems: "center", borderRadius: radii.md, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  smallText: { color: colors.textMuted, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  consentRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, minHeight: 44 },
  checkbox: { alignItems: "center", borderColor: colors.border, borderRadius: 6, borderWidth: 1.5, height: 24, justifyContent: "center", marginTop: 2, width: 24 },
  consentText: { color: colors.text, flex: 1, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 20 },
  resultSummaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCount: { alignItems: "center", borderRadius: radii.md, flex: 1, gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  summaryNumber: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 20 },
  summaryLabel: { color: colors.textMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, textAlign: "center" },
  redFlagCard: { backgroundColor: colors.accentSoft, borderColor: colors.dustyRose, borderWidth: 1 },
  redFlagIcon: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.pill, height: 34, justifyContent: "center", width: 34 },
  redFlagTitle: { flex: 1 },
  redFlagRow: { gap: spacing.xs },
  redFlagHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  severityPill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  severityText: { ...typography.body, color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  pillRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  contextNote: { alignItems: "flex-start", backgroundColor: colors.highlightSoft, borderRadius: radii.lg, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  contextNoteText: { ...typography.body, color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
  redFlagAction: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
  valueCard: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingBottom: spacing.lg },
  valueHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  valueName: { flex: 1 },
  resultValue: { fontFamily: fonts.dataBold, fontSize: 26, lineHeight: 32, textAlign: "right" },
  resultUnit: { color: colors.textMuted, fontFamily: fonts.dataRegular, fontSize: 14 },
  resultText: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 16, textAlign: "right" },
  statusPill: { alignItems: "center", alignSelf: "flex-start", borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  rangeBarBlock: { gap: spacing.xs, marginTop: spacing.xs },
  rangeTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, height: 10, justifyContent: "center", overflow: "hidden" },
  rangeBand: { backgroundColor: colors.primarySoft, bottom: 0, position: "absolute", top: 0 },
  rangeMarker: { borderRadius: radii.pill, height: 16, marginLeft: -2, position: "absolute", width: 4 },
  rangeLabels: { flexDirection: "row", justifyContent: "space-between" },
  rangeLabelText: { color: colors.textMuted, fontFamily: fonts.dataRegular, fontSize: 11 },
  trendRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  valueSummary: { color: colors.textMuted, fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 22 },
  unreadRow: { gap: spacing.xs },
  questionText: { color: colors.text, fontFamily: fonts.bodyRegular, fontSize: 16, lineHeight: 24 },
  questionActions: { flexDirection: "row", gap: spacing.md },
  secondaryAction: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 44, paddingRight: spacing.md },
  secondaryActionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  expandButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.xs, minHeight: 44 },
  expandText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  rangeText: { color: colors.text, fontFamily: fonts.dataRegular, fontSize: 13, lineHeight: 19 },
  explanationBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, gap: spacing.md, marginTop: spacing.xs, padding: spacing.md },
  explanationSection: { gap: spacing.xs },
  explanationLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 19 },
  sourceLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs },
  sourceText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  safetyCard: { backgroundColor: colors.surfaceMuted },
  safetyNotice: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 }
});
