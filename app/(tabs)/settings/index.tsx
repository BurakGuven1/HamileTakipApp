import { Link } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { spacing, typography } from "@/theme";

export default function SettingsScreen() {
  const { isPremium, isLoading } = useSubscriptionStatus();

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Ayarlar</Text>
          <Text style={typography.body}>
            Supabase, abonelik ve reklam durumu tek yerden izlenir.
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.heading2}>Bağlantılar</Text>
            <Text style={typography.body}>
              Supabase: {isSupabaseConfigured ? "Hazır" : "Env bekliyor"}
            </Text>
            <Text style={typography.body}>
              Premium: {isLoading ? "Kontrol ediliyor" : isPremium ? "Aktif" : "Pasif"}
            </Text>
          </View>
        </Card>

        <Link href="/paywall" asChild>
          <Button label="Premium'a geç" />
        </Link>
      </View>
    </Screen>
  );
}
