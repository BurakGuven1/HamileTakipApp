import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Check,
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
  type DocumentInsightValue,
  type DocumentReferenceStatus
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

const MASKED_FIELD_LABELS: Record<string, string> = {
  name: "Ad ve soyad",
  tc_identity: "T.C. kimlik numarası",
  address: "Adres",
  phone: "Telefon",
  email: "E-posta",
  birth_date: "Doğum tarihi",
  patient_id: "Hasta / protokol numarası",
  other: "Diğer kişisel bilgiler"
};

const STATUS_LABELS: Record<DocumentReferenceStatus, string> = {
  below: "Belge aralığının altında",
  within: "Belge aralığında",
  above: "Belge aralığının üstünde",
  document_marked: "Belgede işaretli",
  unclassified: "Karşılaştırılamadı"
};

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

  const flaggedValues = useMemo(
    () =>
      result?.values.filter(
        (value) =>
          value.referenceStatus === "below" ||
          value.referenceStatus === "above" ||
          (value.referenceStatus === "document_marked" && value.documentMarker !== "normal")
      ) ?? [],
    [result]
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

        <Card style={{ backgroundColor: appTheme.tint }}>
          <View style={styles.stack}>
            <Text style={typography.heading3}>Belge yalnızca bu cihazda okunur</Text>
            <Text style={typography.body}>
              Değerleri ve belgenin kendi referans aralıklarını cihazda tabloya dönüştürür. Teşhis, aciliyet, tedavi veya ilaç önerisi üretmez.
            </Text>
            <Text style={styles.privacyLine}>İnternete gönderilmez • OpenAI kullanılmaz • Orijinal dosya saklanmaz • Sonuç geçmişi oluşturulmaz</Text>
          </View>
        </Card>

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
                  {consentAccepted ? <Check color={colors.background} size={16} /> : null}
                </View>
                <Text style={styles.consentText}>
                  Belgenin cihazda okunacağını, kimlik alanlarının sonuçtan çıkarılacağını ve geçici dosyanın işlem sonunda silineceğini anlıyorum.
                </Text>
              </Pressable>

              <Button disabled={!selected || !consentAccepted || isAnalyzing} label={isAnalyzing ? "Belge düzenleniyor…" : "Belgeyi düzenle"} onPress={analyze} />
            </View>
          </Card>
        ) : (
          <ResultView flaggedValues={flaggedValues} result={result} />
        )}

        {(selected || result) && !isAnalyzing ? <Button label="Belgeyi ve sonucu sil" onPress={clearAll} variant="ghost" /> : null}
      </View>
    </Screen>
  );
}

function ResultView({ flaggedValues, result }: { flaggedValues: DocumentInsightValue[]; result: DocumentInsightResult }) {
  const appTheme = useAppTheme();
  return (
    <View style={styles.stackLarge}>
      {result.readability !== "readable" ? (
        <Card style={{ backgroundColor: colors.highlightSoft }}>
          <Text style={typography.heading3}>Belgenin tamamı net okunamadı</Text>
          <Text style={typography.body}>Düşük güvenli satırları orijinal belgeden kontrol edin; okunmayan alanlar tahmin edilmedi.</Text>
        </Card>
      ) : null}

      {result.maskedFieldTypes.length ? (
        <Card style={{ backgroundColor: appTheme.tint }}>
          <Text style={typography.heading3}>Sonuçtan çıkarılan kişisel alanlar</Text>
          <Text style={typography.body}>{result.maskedFieldTypes.map((field) => MASKED_FIELD_LABELS[field] ?? "Kişisel bilgi").join(" • ")}</Text>
        </Card>
      ) : null}

      {flaggedValues.length ? (
        <Card style={{ backgroundColor: colors.highlightSoft }}>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Belgedeki referans dışında görünenler</Text>
            <Text style={styles.smallText}>Bu sıralama önem veya aciliyet göstermez; yalnızca belgedeki işaret ve aralık aktarılır.</Text>
            {flaggedValues.map((value, index) => <ValueRow key={`flag-${value.testName}-${index}`} value={value} compact />)}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.stack}>
          <Text style={typography.heading2}>Belgedeki değerler</Text>
          {result.values.length ? result.values.map((value, index) => <ValueRow key={`${value.testName}-${index}`} value={value} />) : <Text style={typography.body}>Güvenle tabloya dönüştürülebilen bir değer bulunamadı.</Text>}
        </View>
      </Card>

      {result.glossary.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Terimler ne demek?</Text>
            <Text style={styles.smallText}>Açıklamalar genel bilgi verir; kişisel tıbbi yorum değildir.</Text>
            {result.glossary.map((item) => (
              <View key={item.term} style={styles.glossaryItem}>
                <Text style={typography.label}>{item.term}</Text>
                <Text style={typography.body}>{item.explanation}</Text>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(item.sourceUrl)} style={styles.sourceLink}>
                  <Link2 color={appTheme.primary} size={16} />
                  <Text style={[styles.sourceText, { color: appTheme.primary }]}>{item.sourceLabel}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {result.doctorQuestions.length ? (
        <Card>
          <View style={styles.stack}>
            <Text style={typography.heading2}>Doktora sorulabilecek tarafsız sorular</Text>
            {result.doctorQuestions.map((question, index) => <Text key={`${question}-${index}`} style={typography.body}>{index + 1}. {question}</Text>)}
          </View>
        </Card>
      ) : null}

      <Card style={{ backgroundColor: appTheme.tint }}>
        <View style={styles.stack}>
          <View style={styles.sectionTitleRow}><ShieldCheck color={appTheme.primary} size={23} /><Text style={typography.heading3}>Gizlilik sonucu</Text></View>
          <Text style={typography.body}>Orijinal geçici dosya silindi. Belge OpenAI veya başka bir yapay zekâ servisine gönderilmedi; sonuç veritabanına ya da cihaz geçmişine kaydedilmedi.</Text>
          <Text style={styles.safetyNotice}>{result.safetyNotice}</Text>
        </View>
      </Card>
    </View>
  );
}

function ValueRow({ compact = false, value }: { compact?: boolean; value: DocumentInsightValue }) {
  const isOutside = value.referenceStatus === "below" || value.referenceStatus === "above" || (value.referenceStatus === "document_marked" && value.documentMarker !== "normal");
  return (
    <View style={[styles.valueRow, compact && styles.compactValueRow]}>
      <View style={styles.valueHeader}>
        <Text style={typography.label}>{value.testName}</Text>
        <Text style={styles.resultText}>{value.result}{value.unit ? ` ${value.unit}` : ""}</Text>
      </View>
      <Text style={styles.rangeText}>Belgedeki referans: {value.referenceRange || "Belirtilmemiş"}</Text>
      <View style={[styles.statusPill, isOutside ? styles.statusOutside : styles.statusNeutral]}>
        <Text style={styles.statusText}>{STATUS_LABELS[value.referenceStatus]}</Text>
      </View>
      <Text style={styles.smallText}>{value.referenceExplanation}</Text>
      {value.confidence !== "high" ? <Text style={styles.lowConfidence}>Okuma güveni: {value.confidence === "medium" ? "orta" : "düşük"} • Orijinalden kontrol edin</Text> : null}
    </View>
  );
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
  iconButton: { alignItems: "center", height: 42, justifyContent: "center", width: 42 },
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
  valueRow: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingBottom: spacing.lg },
  compactValueRow: { paddingBottom: spacing.md },
  valueHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  resultText: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 16, textAlign: "right" },
  rangeText: { color: colors.text, fontFamily: fonts.dataRegular, fontSize: 13, lineHeight: 19 },
  statusPill: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusOutside: { backgroundColor: colors.highlightSoft },
  statusNeutral: { backgroundColor: colors.primarySoft },
  statusText: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  lowConfidence: { color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 18 },
  glossaryItem: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingBottom: spacing.md },
  sourceLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs },
  sourceText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  safetyNotice: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 }
});
