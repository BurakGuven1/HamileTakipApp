import { Check, Flag, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

const REPORT_REASONS = [
  {
    id: "harassment",
    label: "Taciz veya zorbalık",
    description: "Hakaret, tehdit, hedef gösterme ya da ısrarlı rahatsız etme"
  },
  {
    id: "unsafe_medical",
    label: "Tehlikeli sağlık yönlendirmesi",
    description: "Acil risk yaratan veya tedaviyi bırakmaya çağıran bilgi"
  },
  {
    id: "privacy",
    label: "Özel bilgi paylaşımı",
    description: "İzin olmadan kimlik, iletişim ya da sağlık bilgisi paylaşımı"
  },
  {
    id: "spam",
    label: "Spam veya reklam",
    description: "Tekrarlı, ilgisiz ya da ticari içerik"
  },
  {
    id: "other",
    label: "Başka bir kural ihlali",
    description: "Topluluk kurallarına uymayan farklı bir durum"
  }
] as const;

type ForumReportDialogProps = {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  targetLabel?: string;
  visible: boolean;
};

export function ForumReportDialog({
  busy,
  onClose,
  onSubmit,
  targetLabel,
  visible
}: ForumReportDialogProps) {
  const appTheme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [selectedReasonId, setSelectedReasonId] = useState<string>();
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!visible) {
      setSelectedReasonId(undefined);
      setDetails("");
    }
  }, [visible]);

  const selectedReason = REPORT_REASONS.find(
    (reason) => reason.id === selectedReasonId
  );
  const cleanDetails = details.trim();

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={busy ? undefined : onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={[styles.icon, { backgroundColor: appTheme.accentSoft }]}>
                <Flag color={appTheme.accent} size={23} />
              </View>
              <Pressable
                accessibilityLabel="Rapor ekranını kapat"
                accessibilityRole="button"
                disabled={busy}
                hitSlop={8}
                onPress={onClose}
                style={styles.closeButton}
              >
                <X color={colors.text} size={24} />
              </Pressable>
            </View>

            <View style={styles.titleGroup}>
              <Text style={typography.heading1}>Neyi incelemeliyiz?</Text>
              <Text style={styles.intro}>
                {targetLabel ? `“${targetLabel}” için ` : ""}raporun moderasyon
                kuyruğuna eklenir. Tek bir rapor içeriği silmez.
              </Text>
            </View>

            <View accessibilityRole="radiogroup" style={styles.reasonList}>
              {REPORT_REASONS.map((reason) => {
                const selected = reason.id === selectedReasonId;
                return (
                  <Pressable
                    key={reason.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setSelectedReasonId(reason.id)}
                    style={({ pressed }) => [
                      styles.reasonRow,
                      selected && {
                        backgroundColor: appTheme.theme.primarySoft,
                        borderColor: appTheme.primary
                      },
                      pressed && styles.pressed
                    ]}
                  >
                    <View style={styles.reasonCopy}>
                      <Text style={styles.reasonLabel}>{reason.label}</Text>
                      <Text style={styles.reasonDescription}>
                        {reason.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        selected && {
                          backgroundColor: appTheme.primary,
                          borderColor: appTheme.primary
                        }
                      ]}
                    >
                      {selected ? <Check color={colors.onPrimary} size={15} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              helperText={`${cleanDetails.length}/160 · İsteğe bağlı`}
              label="Kısa açıklama"
              maxLength={160}
              multiline
              onChangeText={setDetails}
              placeholder="Moderatörün bilmesi gereken ayrıntıyı yaz."
              style={styles.detailsInput}
              value={details}
            />

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Seri veya kötü niyetli raporlar saatlik ve günlük sınırlarla
                korunur. Acil bir güvenlik riski varsa uygulama dışındaki acil
                yardım kanallarını kullan.
              </Text>
            </View>

            <Button
              disabled={!selectedReason || busy}
              label={busy ? "Rapor gönderiliyor…" : "Raporu gönder"}
              onPress={() => {
                if (!selectedReason) return;
                onSubmit(
                  cleanDetails
                    ? `${selectedReason.label}: ${cleanDetails}`
                    : selectedReason.label
                );
              }}
            />
            <Button
              disabled={busy}
              label="Vazgeç"
              onPress={onClose}
              variant="ghost"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  detailsInput: { minHeight: 88, textAlignVertical: "top" },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  intro: { ...typography.body, color: colors.textMuted },
  notice: {
    backgroundColor: colors.highlightSoft,
    ...radii.card,
    padding: spacing.md
  },
  noticeText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  pressed: { opacity: 0.72 },
  radio: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  reasonCopy: { flex: 1, gap: 2 },
  reasonDescription: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  reasonLabel: { ...typography.label, color: colors.text },
  reasonList: { gap: spacing.sm },
  reasonRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md
  },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  titleGroup: { gap: spacing.sm }
});
