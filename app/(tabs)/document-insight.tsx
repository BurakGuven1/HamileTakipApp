import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Image as ImageIcon,
  Link2,
  ShieldCheck,
  Trash2,
  Upload
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  DOCUMENT_INSIGHT_MAX_BYTES,
  analyzeMedicalDocument,
  type DocumentInsightResult,
  type DocumentInsightValue
} from "@/api/documentInsight";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
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

type ResultCategory = "low" | "high" | "normal" | "other";

export default function DocumentInsightScreen() {
  const appTheme = useAppTheme();
  const { showError, showInfo, showSuccess } = useFeedback();
  const [selected, setSelected] = useState<TemporaryDocument | null>(null);
  const selectedRef = useRef<TemporaryDocument | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DocumentInsightResult | null>(null);

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

  const choosePdf = async () => {
    try {
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
    let ocrCopy: File | null = null;
    try {
      const file = new File(document.uri);
      if (!file.exists) throw new Error("Geçici belge artık cihazda bulunmuyor.");
      ocrCopy = createPrivateOcrCopy(document);
      const analysis = await analyzeMedicalDocument({
        uri: ocrCopy.uri,
        mimeType: document.mimeType
      });
      setResult(analysis);
      showSuccess("Belge düzenlendi. Geçici dosya silindi.", "İşlem tamamlandı");
    } catch (error) {
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
    await setTemporaryDocument(null);
    showSuccess("Geçici belge ve ekrandaki sonuç temizlendi.", "Silindi");
  };

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

        {!result ? (
          <Card style={{ backgroundColor: appTheme.tint }}>
            <View style={styles.stack}>
              <Text style={typography.heading3}>Belge yalnızca bu cihazda okunur</Text>
              <Text style={typography.body}>
                Laboratuvar değerlerini bulur, belgenin referans aralıklarıyla karşılaştırır ve her testi halk dilinde açıklar. Teşhis, aciliyet, tedavi veya ilaç önerisi üretmez.
              </Text>
              <Text style={styles.privacyLine}>İnternete gönderilmez • Orijinal dosya ve sonuç geçmişi saklanmaz</Text>
            </View>
          </Card>
        ) : null}

        {!result ? (
          <Card>
            <View style={styles.stack}>
              <View style={styles.sectionTitleRow}>
                <FileSearch color={appTheme.primary} size={25} />
                <Text style={typography.heading2}>Belge ekle</Text>
              </View>
              <Text style={typography.body}>PDF ya da okunaklı bir belge fotoğrafı seçin. En fazla 8 MB.</Text>
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

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                onPress={() => setConsentAccepted((value) => !value)}
                style={styles.consentRow}
              >
                <View style={[styles.checkbox, consentAccepted && { backgroundColor: appTheme.primary, borderColor: appTheme.primary }]}>
                  {consentAccepted ? <Check color={colors.onPrimary} size={16} /> : null}
                </View>
                <Text style={styles.consentText}>
                  Belgenin cihazda okunacağını, kimlik alanlarının sonuçtan çıkarılacağını ve geçici dosyanın işlem sonunda silineceğini anlıyorum.
                </Text>
              </Pressable>

              <Button disabled={!selected || !consentAccepted || isAnalyzing} label={isAnalyzing ? "Belge okunuyor…" : "Belgeyi anla"} onPress={analyze} />
            </View>
          </Card>
        ) : (
          <ResultView result={result} />
        )}

        {(selected || result) && !isAnalyzing ? <Button label="Belgeyi ve sonucu sil" onPress={clearAll} variant="ghost" /> : null}
      </View>
    </Screen>
  );
}

function ResultView({ result }: { result: DocumentInsightResult }) {
  const appTheme = useAppTheme();
  const groupedValues = useMemo(() => groupDocumentValues(result.values), [result.values]);
  const categorizedCount = groupedValues.low.length + groupedValues.high.length + groupedValues.normal.length;

  return (
    <View style={styles.stackLarge}>
      {result.readability !== "readable" ? (
        <Card style={{ backgroundColor: colors.highlightSoft }}>
          <Text style={typography.heading3}>Laboratuvar sonuçları güvenle ayırt edilemedi</Text>
          <Text style={typography.body}>Belge metni okundu ancak test adı, sonuç ve birim eşleştirilemedi. Daha düz ve net bir fotoğraf deneyin; okunmayan alanlar tahmin edilmedi.</Text>
        </Card>
      ) : null}

      <Card style={{ backgroundColor: appTheme.tint }}>
        <View style={styles.stack}>
          <Text style={typography.eyebrow}>BELGE ÖZETİ</Text>
          <Text style={typography.heading2}>Sonuçların anlaşılır görünümü</Text>
          <Text style={typography.body}>
            {result.values.length
              ? `${result.values.length} sonuç okundu${categorizedCount ? `, ${categorizedCount} tanesi rapordaki bilgiye göre sınıflandırıldı` : ""}.`
              : "Eşleştirilebilen bir laboratuvar sonucu bulunamadı."}
          </Text>
          {result.values.length ? (
            <View style={styles.resultSummaryRow}>
              <SummaryCount label="Düşük" value={groupedValues.low.length} tone="low" />
              <SummaryCount label="Yüksek" value={groupedValues.high.length} tone="high" />
              <SummaryCount label="Normal" value={groupedValues.normal.length} tone="normal" />
            </View>
          ) : null}
        </View>
      </Card>

      {result.values.length ? (
        <Card>
          <View style={styles.resultList}>
            <ResultCategorySection category="low" values={groupedValues.low} />
            <ResultCategorySection category="high" values={groupedValues.high} />
            <ResultCategorySection category="normal" values={groupedValues.normal} />
            <ResultCategorySection category="other" values={groupedValues.other} />
          </View>
        </Card>
      ) : null}

      {result.doctorQuestions.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Doktoruna sorabileceğin sorular</Text>
            {result.doctorQuestions.map((question, index) => <Text key={`${question}-${index}`} style={typography.body}>{index + 1}. {question}</Text>)}
          </View>
        </Card>
      ) : null}

      <Card style={styles.safetyCard}>
        <View style={styles.stack}>
          <View style={styles.sectionTitleRow}><ShieldCheck color={appTheme.primary} size={22} /><Text style={typography.heading3}>Bilmen gereken</Text></View>
          <Text style={styles.safetyNotice}>{result.safetyNotice}</Text>
          <Text style={styles.smallText}>Geçici belge silindi; sonuç cihazda veya veritabanında saklanmadı.</Text>
        </View>
      </Card>
    </View>
  );
}

function ValueRow({ value }: { value: DocumentInsightValue }) {
  const appTheme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const referenceRange = usefulDocumentText(value.referenceRange);
  const resultSummary = usefulDocumentText(value.plainLanguage.resultSummary);
  const whatItIs = usefulDocumentText(value.plainLanguage.whatItIs);
  const possibleMeaning = usefulDocumentText(value.plainLanguage.possibleMeaning);
  const clinicianContext = usefulDocumentText(value.plainLanguage.clinicianContext);
  const sourceUrl = /^https?:\/\//i.test(value.plainLanguage.sourceUrl ?? "")
    ? value.plainLanguage.sourceUrl
    : null;
  return (
    <View style={styles.valueRow}>
      <View style={styles.valueHeader}>
        <Text style={[typography.label, styles.valueName]}>{value.testName}</Text>
        <Text style={styles.resultText}>{value.result}{value.unit ? ` ${value.unit}` : ""}</Text>
      </View>
      {resultSummary ? <Text style={styles.valueSummary}>{resultSummary}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.expandButton}
      >
        <Text style={[styles.expandText, { color: appTheme.primary }]}>{expanded ? "Ayrıntıyı kapat" : "Açıklamayı gör"}</Text>
        {expanded ? <ChevronUp color={appTheme.primary} size={17} /> : <ChevronDown color={appTheme.primary} size={17} />}
      </Pressable>
      {expanded ? (
        <View style={styles.explanationBox}>
          {whatItIs ? (
            <View style={styles.explanationSection}>
              <Text style={styles.explanationLabel}>Bu test neyi anlatır?</Text>
              <Text style={typography.body}>{whatItIs}</Text>
            </View>
          ) : null}
          {possibleMeaning ? (
            <View style={styles.explanationSection}>
              <Text style={styles.explanationLabel}>Genel olarak ne anlatabilir?</Text>
              <Text style={typography.body}>{possibleMeaning}</Text>
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
          {sourceUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(sourceUrl)} style={styles.sourceLink}>
              <Link2 color={appTheme.primary} size={16} />
              <Text style={[styles.sourceText, { color: appTheme.primary }]}>{value.plainLanguage.sourceLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ResultCategorySection({ category, values }: { category: ResultCategory; values: DocumentInsightValue[] }) {
  if (!values.length) return null;
  const metadata = getCategoryMetadata(category);
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIcon, { backgroundColor: metadata.background }]}>{metadata.icon}</View>
        <Text style={[typography.heading3, styles.categoryTitle]}>{metadata.title}</Text>
        <Text style={styles.categoryCount}>{values.length}</Text>
      </View>
      {category === "other" ? <Text style={styles.smallText}>Rapor bu sonuçlar için düşük, yüksek veya normal ayrımı yapmaya yetecek bilgi içermiyor.</Text> : null}
      {values.map((value, index) => <ValueRow key={`${category}-${value.testName}-${index}`} value={value} />)}
    </View>
  );
}

function SummaryCount({ label, tone, value }: { label: string; tone: "low" | "high" | "normal"; value: number }) {
  const backgroundColor = tone === "normal" ? colors.primarySoft : colors.highlightSoft;
  return <View style={[styles.summaryCount, { backgroundColor }]}><Text style={styles.summaryNumber}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function groupDocumentValues(values: DocumentInsightValue[]) {
  return values.reduce<Record<ResultCategory, DocumentInsightValue[]>>((groups, value) => {
    groups[getResultCategory(value)].push(value);
    return groups;
  }, { high: [], low: [], normal: [], other: [] });
}

function getResultCategory(value: DocumentInsightValue): ResultCategory {
  if (value.referenceStatus === "below" || value.documentMarker === "low") return "low";
  if (value.referenceStatus === "above" || value.documentMarker === "high") return "high";
  if (value.referenceStatus === "within" || value.documentMarker === "normal") return "normal";
  return "other";
}

function getCategoryMetadata(category: ResultCategory) {
  if (category === "low") return { background: colors.highlightSoft, icon: <ArrowDown color={colors.highlight} size={18} />, title: "Düşük görünenler" };
  if (category === "high") return { background: colors.accentSoft, icon: <ArrowUp color={colors.accent} size={18} />, title: "Yüksek görünenler" };
  if (category === "normal") return { background: colors.primarySoft, icon: <Check color={colors.primary} size={18} />, title: "Normal aralıkta görünenler" };
  return { background: colors.surfaceMuted, icon: <FileSearch color={colors.textMuted} size={18} />, title: "Diğer sonuçlar" };
}

function usefulDocumentText(value?: string | null) {
  const text = value?.trim();
  if (!text || /^(belirtilmemiş|belirtilmemis|yok|[-–—])$/i.test(text)) return null;
  return text;
}

function PickerButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.pickerButton}>{icon}<Text style={styles.pickerLabel}>{label}</Text></Pressable>;
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
  consentRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  checkbox: { alignItems: "center", borderColor: colors.border, borderRadius: 6, borderWidth: 1.5, height: 24, justifyContent: "center", marginTop: 2, width: 24 },
  consentText: { color: colors.text, flex: 1, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 20 },
  resultSummaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCount: { alignItems: "center", borderRadius: radii.md, flex: 1, gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  summaryNumber: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 20 },
  summaryLabel: { color: colors.textMuted, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  resultList: { gap: spacing.xl },
  categorySection: { gap: spacing.md },
  categoryHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  categoryIcon: { alignItems: "center", borderRadius: radii.pill, height: 34, justifyContent: "center", width: 34 },
  categoryTitle: { flex: 1 },
  categoryCount: { color: colors.textMuted, fontFamily: fonts.dataBold, fontSize: 14 },
  valueRow: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingBottom: spacing.lg },
  compactValueRow: { paddingBottom: spacing.md },
  valueHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  valueName: { flex: 1 },
  resultText: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 16, textAlign: "right" },
  valueSummary: { color: colors.textMuted, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  expandButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.xs, minHeight: 44 },
  expandText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  rangeText: { color: colors.text, fontFamily: fonts.dataRegular, fontSize: 13, lineHeight: 19 },
  statusPill: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusOutside: { backgroundColor: colors.highlightSoft },
  statusNeutral: { backgroundColor: colors.primarySoft },
  statusText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  lowConfidence: { color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 18 },
  explanationBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, gap: spacing.md, marginTop: spacing.xs, padding: spacing.md },
  explanationSection: { gap: spacing.xs },
  explanationLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 19 },
  sourceLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs },
  sourceText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  safetyCard: { backgroundColor: colors.surfaceMuted },
  safetyNotice: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 }
});
