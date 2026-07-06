import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { spacing, typography } from "@/theme";

export default function GalleryScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Fotoğraf Galerisi</Text>
          <Text style={typography.body}>
            Yükleme öncesi sıkıştırma, private bucket ve signed URL akışı için
            API katmanı hazır.
          </Text>
        </View>

        <Button label="Fotoğraf ekle" onPress={() => undefined} />
        <EmptyState
          title="Galeri boş"
          description="Fotoğraflar aylık zaman tüneli olarak gruplanacak."
        />
      </View>
    </Screen>
  );
}
