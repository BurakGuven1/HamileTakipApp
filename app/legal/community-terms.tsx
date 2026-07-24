import { router } from "expo-router";
import { ArrowLeft, Flag, ShieldCheck, UserX } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { openLegalPage } from "@/config/legal";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function CommunityTermsScreen() {
  const appTheme = useAppTheme();
  const { showError } = useFeedback();

  async function openAppleEula() {
    try {
      await openLegalPage("appleEula");
    } catch (error) {
      showError(error, "Apple Standard EULA açılamadı");
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Pressable
          accessibilityLabel="Giriş ekranına dön"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={appTheme.primary} size={20} />
          <Text style={[styles.backText, { color: appTheme.primary }]}>
            Giriş ekranına dön
          </Text>
        </Pressable>

        <View style={[styles.hero, { backgroundColor: appTheme.tint }]}>
          <View style={styles.heroIcon}>
            <ShieldCheck color={appTheme.primary} size={28} />
          </View>
          <Text style={typography.eyebrow}>EULA • 24 Temmuz 2026</Text>
          <Text style={typography.heading1}>
            Kullanım Şartları ve Topluluk Kuralları
          </Text>
          <Text style={styles.body}>
            Giriş veya kayıt ekranındaki kutuyu işaretlediğinde bu kuralları
            okuduğunu ve kabul ettiğini açıkça beyan edersin. Kabul etmezsen giriş
            veya kayıt işlemi tamamlanmaz.
          </Text>
        </View>

        <Card>
          <View style={styles.section}>
            <Text style={typography.heading2}>Sıfır tolerans</Text>
            <Text style={styles.body}>
              Anne+; hakaret, taciz, tehdit, zorbalık, nefret söylemi, cinsel
              içerik, istismar, kişisel bilgileri ifşa etme, hedef gösterme ve
              kötüye kullanan kullanıcılara izin vermez.
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.section}>
            <TermRow
              icon={<ShieldCheck color={appTheme.primary} size={21} />}
              text="Sakıncalı ifadeler paylaşılmadan önce sunucu tarafında filtrelenir."
              title="Filtrele"
            />
            <TermRow
              icon={<Flag color={appTheme.accent} size={21} />}
              text="Her gönderi ve yorumdaki Raporla eylemi içeriği incelemeye gönderir. Raporlanan içerik akıştan kaldırılır ve en geç 24 saat içinde incelenir."
              title="Raporla"
            />
            <TermRow
              icon={<UserX color={colors.danger} size={21} />}
              text="Her gönderi ve yorumdaki Engelle eylemi kötüye kullanan kullanıcıyı ve içeriklerini hesabının akışından çıkarır."
              title="Engelle"
            />
          </View>
        </Card>

        <Card>
          <View style={styles.section}>
            <Text style={typography.heading2}>İhlal doğrulanırsa</Text>
            <Text style={styles.body}>
              İçerik kaldırılır ve içeriği sağlayan kullanıcı topluluktan
              çıkarılır. Ağır veya tekrarlanan ihlallerde uzaklaştırma kalıcıdır.
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.section}>
            <Text style={typography.heading2}>Hizmet sınırları</Text>
            <Text style={styles.body}>
              Uygulama tıbbi tavsiye, teşhis veya tedavi sunmaz. Forum
              paylaşımlarının sorumluluğu paylaşan kullanıcıya aittir. Sağlık
              kararlarında doktoruna veya yetkili sağlık kuruluşuna başvur.
            </Text>
          </View>
        </Card>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="Apple Standard EULA’yı aç"
            accessibilityRole="link"
            onPress={() => void openAppleEula()}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: appTheme.primary }]}>
              Apple Standard EULA’yı aç
            </Text>
          </Pressable>
          <Text style={styles.contact}>
            Moderasyon ve destek: burakguven351999@gmail.com
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function TermRow({
  icon,
  text,
  title
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <View style={styles.termRow}>
      <View style={styles.termIcon}>{icon}</View>
      <View style={styles.termCopy}>
        <Text style={styles.termTitle}>{title}</Text>
        <Text style={styles.termText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingRight: spacing.md
  },
  backText: {
    ...typography.label
  },
  hero: {
    ...radii.cardLarge,
    gap: spacing.sm,
    padding: spacing.xl
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  section: {
    gap: spacing.lg
  },
  body: {
    ...typography.body,
    color: colors.textMuted
  },
  termRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  termIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  termCopy: {
    flex: 1,
    gap: 2
  },
  termTitle: {
    ...typography.label,
    color: colors.text
  },
  termText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  footer: {
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingBottom: spacing.xl
  },
  linkButton: {
    justifyContent: "center",
    minHeight: 44
  },
  linkText: {
    ...typography.label,
    textDecorationLine: "underline"
  },
  contact: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13
  }
});
