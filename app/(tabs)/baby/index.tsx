import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { spacing, typography } from "@/theme";

export default function BabyScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Bebek Profili</Text>
          <Text style={typography.body}>
            Çoklu bebek desteği ve aşı takvimi bu ekrandan yönetilecek.
          </Text>
        </View>

        <Card>
          <View style={{ gap: spacing.md }}>
            <Text style={typography.heading2}>Yeni bebek</Text>
            <TextField label="İsim" />
            <TextField label="Doğum tarihi" placeholder="GG.AA.YYYY" />
            <TextField label="Cinsiyet" placeholder="Kız / Erkek / Belirtmek istemiyorum" />
            <Button label="Bebek profili oluştur" onPress={() => undefined} />
          </View>
        </Card>

        <EmptyState
          title="Henüz bebek profili yok"
          description="Supabase bağlantısı tamamlandığında kayıtlar burada listelenecek."
        />
      </View>
    </Screen>
  );
}
