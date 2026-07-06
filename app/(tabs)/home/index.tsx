import { Link } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { Screen } from "@/components/Screen";
import { trackEvent } from "@/lib/analytics";
import { colors, spacing, typography } from "@/theme";

export default function HomeScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.eyebrow}>Bugün</Text>
          <Text style={typography.heading1}>Sakin bir takip alanı</Text>
          <Text style={typography.body}>
            Aşı, büyüme, fotoğraf ve ninni akışlarını Supabase bağlandıktan sonra
            buradan yöneteceğiz.
          </Text>
        </View>

        <Card style={{ backgroundColor: colors.primarySoft }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.heading2}>Gebelik / bebek özeti</Text>
            <Text style={typography.body}>
              Onboarding tamamlandığında bu kart haftalık gelişim ve yaklaşan
              hatırlatmaları gösterecek.
            </Text>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MetricCard label="Yaklaşan aşı" value="0" />
          <MetricCard label="Büyüme kaydı" value="0" />
        </View>

        <Link href="/paywall" asChild>
          <Button
            label="Premium seçeneklerini gör"
            onPress={() => trackEvent("paywall_viewed", { trigger_source: "home" })}
          />
        </Link>
      </View>
    </Screen>
  );
}
