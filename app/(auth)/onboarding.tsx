import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { spacing, typography } from "@/theme";

export default function OnboardingScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Başlangıç bilgileri</Text>
          <Text style={typography.body}>
            Takvimleri kişiselleştirmek için yalnızca temel bilgileri alıyoruz.
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Durumun</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                label="Hamileyim"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => undefined}
              />
              <Button
                label="Doğum yaptım"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => undefined}
              />
            </View>
            <TextField label="Tahmini doğum / doğum tarihi" placeholder="GG.AA.YYYY" />
            <TextField label="Bebek adı" placeholder="Opsiyonel" />
          </View>
        </Card>

        <Button label="Devam et" onPress={() => router.replace("/home")} />
      </View>
    </Screen>
  );
}
