import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { spacing, typography } from "@/theme";

const sampleDurations = ["15 dk", "30 dk", "60 dk"];

export default function LullabyScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Ninni Kütüphanesi</Text>
          <Text style={typography.body}>
            Supabase Storage public read bucket ve offline cache akışı için
            iskelet hazır.
          </Text>
        </View>

        {sampleDurations.map((duration) => (
          <Card key={duration}>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.heading2}>{duration} sakin ninni</Text>
              <Text style={typography.body}>
                Arka plan oynatma ve indirme kontrolleri bu kartta genişletilecek.
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  label="Oynat"
                  style={{ flex: 1 }}
                  onPress={() => undefined}
                />
                <Button
                  label="İndir"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => undefined}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
