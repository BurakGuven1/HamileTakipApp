import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

/**
 * Kart ekranda göründüğü boyutta yakalanır, sonra paylaşıma uygun çözünürlüğe
 * büyütülür/küçültülür. Yakalama sırasında fotoğrafın kendisine dokunulmaz;
 * sadece ekrandaki kompozisyonun fotoğrafı çekilir.
 */
const EXPORT_WIDTH = 1440;

export async function captureCard(node: View | null) {
  if (!node) {
    throw new Error("Kart henüz hazır değil.");
  }

  const rawUri = await captureRef(node, {
    format: "jpg",
    quality: 1,
    result: "tmpfile"
  });

  const rendered = await ImageManipulator.manipulateAsync(
    rawUri,
    [{ resize: { width: EXPORT_WIDTH } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );

  return rendered.uri;
}

export async function shareCard(uri: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Bu cihazda paylaşım penceresi açılamıyor.");
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Kartını paylaş",
    mimeType: "image/jpeg",
    UTI: "public.jpeg"
  });
}
