import { Check, Flag, ShieldCheck, UserX } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { Button } from "@/components/Button";
import { openLegalPage } from "@/config/legal";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

type CommunityAgreementGateProps = {
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  visible: boolean;
};

export function CommunityAgreementGate({
  busy = false,
  onAccept,
  onDecline,
  visible
}: CommunityAgreementGateProps) {
  const appTheme = useAppTheme();
  const { showError } = useFeedback();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (visible) setChecked(false);
  }, [visible]);

  async function openLegalDocument(page: "appleEula" | "terms") {
    try {
      await openLegalPage(page);
    } catch (error) {
      showError(error, "Sözleşme açılamadı");
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heading}>
              <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>
                <ShieldCheck color={appTheme.primary} size={28} strokeWidth={2.2} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={typography.eyebrow}>Anne+ topluluk sözleşmesi</Text>
                <Text style={typography.heading1}>
                  Burayı birlikte güvenli tutalım
                </Text>
                <Text style={styles.intro}>
                  Forum, deneyimlerin yargılanmadan paylaşılabildiği sakin bir alan.
                  Devam etmeden önce üç ortak kuralda buluşalım.
                </Text>
              </View>
            </View>

            <View style={styles.rules}>
              <AgreementRule
                icon={<ShieldCheck color={appTheme.primary} size={21} />}
                text="Hakaret, taciz, nefret söylemi ve uygunsuz içeriğe izin vermiyoruz."
                title="Saygılı paylaş"
              />
              <AgreementRule
                icon={<Flag color={appTheme.accent} size={21} />}
                text="Raporlanan içeriği akıştan kaldırır, en geç 24 saat içinde inceleriz."
                title="Gördüğünü bildir"
              />
              <AgreementRule
                icon={<UserX color={colors.danger} size={21} />}
                text="İhlal içeriğini kaldırır; kötüye kullanan hesabı topluluktan çıkarırız."
                title="Sıfır tolerans"
              />
            </View>

            <View style={styles.legalLinks}>
              <Pressable
                accessibilityLabel="Kullanım Şartları’nı aç"
                accessibilityRole="link"
                onPress={() => void openLegalDocument("terms")}
                style={styles.legalLink}
              >
                <Text style={[styles.legalLinkText, { color: appTheme.primary }]}>
                  Kullanım Şartları
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Apple Standard EULA’yı aç"
                accessibilityRole="link"
                onPress={() => void openLegalDocument("appleEula")}
                style={styles.legalLink}
              >
                <Text style={[styles.legalLinkText, { color: appTheme.primary }]}>
                  Apple Standard EULA
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Kullanım Şartları ve topluluk kurallarını kabul et"
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => setChecked((value) => !value)}
              style={styles.consentRow}
            >
              <View
                style={[
                  styles.checkbox,
                  checked && {
                    backgroundColor: appTheme.primary,
                    borderColor: appTheme.primary
                  }
                ]}
              >
                {checked ? <Check color={colors.onPrimary} size={17} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.consentText}>
                Kullanım Şartları’nı ve topluluk kurallarını okudum; bu kurallara
                uymayı kabul ediyorum.
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Button
                accessibilityState={{ busy, disabled: busy || !checked }}
                disabled={busy || !checked}
                label={busy ? "Kabulün kaydediliyor…" : "Kabul et ve foruma gir"}
                onPress={onAccept}
              />
              <Button
                disabled={busy}
                label="Şimdi değil"
                variant="ghost"
                onPress={onDecline}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AgreementRule({
  icon,
  text,
  title
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleIcon}>{icon}</View>
      <View style={styles.ruleCopy}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(23, 20, 25, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  sheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "90%",
    maxWidth: 560,
    overflow: "hidden",
    width: "100%"
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl
  },
  heading: {
    gap: spacing.md
  },
  headingCopy: {
    gap: spacing.sm
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  intro: {
    ...typography.body,
    color: colors.textMuted
  },
  rules: {
    gap: spacing.lg
  },
  rule: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  ruleIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  ruleCopy: {
    flex: 1,
    gap: 2
  },
  ruleTitle: {
    ...typography.label,
    color: colors.text
  },
  ruleText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  legalLink: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  legalLinkText: {
    ...typography.label,
    textDecorationLine: "underline"
  },
  consentRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  consentText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 21
  },
  actions: {
    gap: spacing.sm
  }
});
