import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { purchasePremiumPackage } from "@/lib/revenuecat";
import { colors, spacing, typography } from "@/theme";

const options = [
  {
    id: "premium_monthly",
    title: "Aylık Premium",
    price: "149 TL / ay",
    description: "Reklamsız kullanım ve sakin deneyim."
  },
  {
    id: "premium_lifetime",
    title: "Ömür Boyu Premium",
    price: "999 TL",
    description: "Tek ödeme ile kalıcı reklamsız kullanım."
  }
] as const;

export default function PaywallScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.eyebrow}>Premium</Text>
          <Text style={typography.heading1}>Reklamsız devam et</Text>
          <Text style={typography.body}>
            Aşı, galeri, ninni ve forum akışlarında dikkat dağıtmayan deneyim.
          </Text>
        </View>

        {options.map((option) => (
          <Card key={option.id} style={{ borderColor: colors.primary }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.heading2}>{option.title}</Text>
              <Text style={typography.price}>{option.price}</Text>
              <Text style={typography.body}>{option.description}</Text>
              <Button
                label="Seç"
                onPress={() => purchasePremiumPackage(option.id)}
              />
            </View>
          </Card>
        ))}

        <Button label="Kapat" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
