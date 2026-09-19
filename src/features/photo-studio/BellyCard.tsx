import { Image } from "expo-image";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

import { BellyStickerShapeView } from "./stickers";
import type { BellyConcept, BellyEllipse, BellySticker } from "./types";

type BellyCardProps = {
  aspectRatio: number;
  concept: BellyConcept;
  ellipse: BellyEllipse;
  photoUri: string;
  /** Kılavuz halkası yalnızca düzenleme sırasında görünür, dışa aktarımda çizilmez. */
  showGuide?: boolean;
  stickers: BellySticker[];
  width: number;
};

/**
 * Fotoğrafın tek bir pikseli değişmez: yüz, saç, kıyafet, arka plan olduğu
 * gibi kalır. Taşlar yalnızca annenin işaretlediği elipsin içine, karnın
 * yuvarlaklığını taklit eden bir dağılımla yerleşir.
 */
export const BellyCard = forwardRef<View, BellyCardProps>(function BellyCard(
  { aspectRatio, concept, ellipse, photoUri, showGuide = false, stickers, width },
  ref
) {
  const height = width / aspectRatio;
  const radiusX = ellipse.radiusX * width;
  const radiusY = ellipse.radiusY * height;
  const centerX = ellipse.centerX * width;
  const centerY = ellipse.centerY * height;

  return (
    <View collapsable={false} ref={ref} style={[styles.card, { height, width }]}>
      <Image
        contentFit="cover"
        source={{ uri: photoUri }}
        style={StyleSheet.absoluteFill}
        transition={120}
      />

      {showGuide ? (
        <View
          pointerEvents="none"
          style={[
            styles.guide,
            {
              borderColor: concept.palette.accent,
              height: radiusY * 2,
              left: centerX - radiusX,
              top: centerY - radiusY,
              width: radiusX * 2
            }
          ]}
        />
      ) : null}

      {stickers.map((sticker, index) => {
        const size = sticker.size * width;
        return (
          <View
            key={`${sticker.shape}-${index}`}
            pointerEvents="none"
            style={[
              styles.sticker,
              {
                left: centerX + sticker.offsetX * radiusX - size / 2,
                opacity: sticker.opacity,
                top: centerY + sticker.offsetY * radiusY - size / 2,
                transform: [{ rotate: `${sticker.rotation}deg` }]
              }
            ]}
          >
            <BellyStickerShapeView color={sticker.color} shape={sticker.shape} size={size} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#000000",
    overflow: "hidden"
  },
  guide: {
    borderRadius: 9999,
    borderStyle: "dashed",
    borderWidth: 2,
    position: "absolute"
  },
  sticker: {
    position: "absolute",
    // Taşlar cam gibi parlasın diye hafif bir gölge; düz yapıştırma yerine
    // fotoğrafın üstünde duruyormuş hissi veriyor.
    shadowColor: "#000000",
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5
  }
});
