import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { spacing, typography } from "@/theme";

const categories = [
  "Hamilelik",
  "Doğum Sonrası",
  "Bebek Kaybı Desteği",
  "Genel Sohbet"
];

export default function ForumScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Forum</Text>
          <Text style={typography.body}>
            Client tarafı yalnızca anonim nickname görecek şekilde tasarlandı.
          </Text>
        </View>

        {categories.map((category) => (
          <Card key={category}>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.heading2}>{category}</Text>
              <Text style={typography.body}>
                Gönderi, yorum, raporlama ve realtime akış burada genişletilecek.
              </Text>
            </View>
          </Card>
        ))}

        <Button label="Gönderi oluştur" onPress={() => undefined} />
      </View>
    </Screen>
  );
}
