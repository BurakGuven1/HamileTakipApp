import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import {
  Baby,
  CalendarHeart,
  Camera,
  MessageCircleHeart,
  Sparkles,
  Syringe
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import {
  listVaccinationsForBaby,
  type BabyVaccinationWithSchedule
} from "@/api/vaccinations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { Screen } from "@/components/Screen";
import {
  formatDate,
  getBabyAgeLabel,
  getPregnancyWeek,
  getRelativeDayLabel
} from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";

export default function HomeScreen() {
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const babies = babiesQuery.data ?? [];
  const firstBaby = babies[0];

  const vaccinationsQuery = useQuery({
    queryKey: ["baby-vaccinations", firstBaby?.id],
    queryFn: () => listVaccinationsForBaby(firstBaby?.id as string),
    enabled: Boolean(firstBaby?.id)
  });

  const profile = profileQuery.data;
  const week = getPregnancyWeek(profile?.due_date);
  const vaccinations: BabyVaccinationWithSchedule[] = vaccinationsQuery.data ?? [];
  const nextVaccination = vaccinations.find((item) => !item.completed);
  const completedVaccines = vaccinations.filter((item) => item.completed).length;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconBubble}>
            <Sparkles color={colors.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Bugun</Text>
            <Text style={typography.heading1}>
              {profile?.forum_nickname
                ? `Merhaba ${profile.forum_nickname}`
                : "Merhaba"}
            </Text>
            <Text style={styles.heroText}>
              Anne+ bugunku bilgilerine gore akis, hatirlatma ve topluluk
              onerilerini hazirlar.
            </Text>
          </View>
        </View>

        {profile?.is_pregnant && week ? (
          <Card style={styles.primaryCard}>
            <View style={styles.cardHeader}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.heading2}>{week}. hafta hamilelik</Text>
                <Text style={typography.body}>
                  Tahmini dogum: {formatDate(profile.due_date)}
                </Text>
              </View>
              <CalendarHeart color={colors.primary} size={30} />
            </View>
          </Card>
        ) : firstBaby ? (
          <Card style={styles.primaryCard}>
            <View style={styles.cardHeader}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.heading2}>{firstBaby.name}</Text>
                <Text style={typography.body}>
                  {getBabyAgeLabel(firstBaby.birth_date)} / dogum{" "}
                  {formatDate(firstBaby.birth_date)}
                </Text>
              </View>
              <Baby color={colors.primary} size={30} />
            </View>
          </Card>
        ) : (
          <Card style={styles.primaryCard}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.cardHeader}>
                <View style={{ gap: spacing.xs, flex: 1 }}>
                  <Text style={typography.heading2}>Deneyimini kisisellestir</Text>
                  <Text style={typography.body}>
                    Gebelik veya bebek bilgisi eklediginde ana ekran sana ozel
                    hatirlatmalar ve gelisim ozeti gosterir.
                  </Text>
                </View>
                <Sparkles color={colors.primary} size={30} />
              </View>
              <Link href="/baby" asChild>
                <Button label="Bebek bilgisi ekle" variant="secondary" />
              </Link>
            </View>
          </Card>
        )}

        <View style={styles.metricRow}>
          <MetricCard label="Bebek profili" value={`${babies.length}`} />
          <MetricCard
            label="Asi tamamlama"
            value={
              vaccinations.length > 0
                ? `${completedVaccines}/${vaccinations.length}`
                : "0"
            }
          />
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ gap: spacing.xs, flex: 1 }}>
                <Text style={typography.heading2}>Siradaki hatirlatici</Text>
                {nextVaccination ? (
                  <Text style={typography.body}>
                    {nextVaccination.vaccine_schedule?.vaccine_name ?? "Asi"} /{" "}
                    {getRelativeDayLabel(nextVaccination.scheduled_date)} /{" "}
                    {formatDate(nextVaccination.scheduled_date)}
                  </Text>
                ) : (
                  <Text style={typography.body}>
                    Su an yaklasan asi yok. Yeni kayit ekledikce burada gorunur.
                  </Text>
                )}
              </View>
              <Syringe color={colors.primary} size={28} />
            </View>
            <Link href="/baby" asChild>
              <Button label="Asi takvimini ac" variant="secondary" />
            </Link>
          </View>
        </Card>

        <View style={styles.quickGrid}>
          <QuickAction
            href="/gallery"
            icon={<Camera color={colors.accent} size={24} />}
            title="Ani ekle"
            body="Fotograf zaman cizelgesi"
          />
          <QuickAction
            href="/forum"
            icon={<MessageCircleHeart color={colors.accent} size={24} />}
            title="Topluluga sor"
            body="Anonim forum destegi"
          />
        </View>
      </View>
    </Screen>
  );
}

function QuickAction({
  href,
  icon,
  title,
  body
}: {
  href: "/gallery" | "/forum";
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.quickPressable}>
        <Card style={styles.quickCard}>
          <View style={{ gap: spacing.sm }}>
            {icon}
            <Text style={styles.quickTitle}>{title}</Text>
            <Text style={styles.quickBody}>{body}</Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
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
  primaryCard: {
    backgroundColor: colors.surface
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  quickGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  quickPressable: {
    flex: 1
  },
  quickCard: {
    minHeight: 132
  },
  quickTitle: {
    ...typography.label,
    color: colors.text
  },
  quickBody: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18
  }
});
