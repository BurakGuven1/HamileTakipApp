import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Minus, Plus, Shuffle, Sparkles } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { listBabies } from "@/api/babies";
import { uploadBabyPhoto } from "@/api/gallery";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { BellyCard } from "@/features/photo-studio/BellyCard";
import { ConceptPicker } from "@/features/photo-studio/ConceptPicker";
import { BELLY_CONCEPTS, getBellyConcept, isConceptLocked } from "@/features/photo-studio/concepts";
import { captureCard, shareCard } from "@/features/photo-studio/exportCard";
import {
  clampBellyEllipse,
  DEFAULT_BELLY_ELLIPSE,
  getSuggestedStickerCount,
  scatterBellyStickers
} from "@/features/photo-studio/scatter";
import type { BellyEllipse } from "@/features/photo-studio/types";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { trackEvent } from "@/lib/analytics";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

/** Anne "daha yoğun"/"daha seyrek" derken taş sayısı bu kadar değişir. */
const DENSITY_STEP = 10;

export default function BellyStudioScreen() {
  const { showError, showSuccess } = useFeedback();
  const { isPremium } = useSubscriptionStatus();
  const { width: windowWidth } = useWindowDimensions();
  const cardRef = useRef<View>(null);

  const [conceptId, setConceptId] = useState(getBellyConcept(null).id);
  const [photo, setPhoto] = useState<{ aspectRatio: number; uri: string } | null>(null);
  const [ellipse, setEllipse] = useState<BellyEllipse>(DEFAULT_BELLY_ELLIPSE);
  const [densityOffset, setDensityOffset] = useState(0);
  const [shuffle, setShuffle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const baby = babiesQuery.data?.[0] ?? null;

  const concept = getBellyConcept(conceptId);
  const locked = isConceptLocked(concept, isPremium);

  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 420);
  const stickerCount = Math.max(
    12,
    getSuggestedStickerCount(ellipse) + densityOffset * DENSITY_STEP
  );

  const stickers = useMemo(
    () =>
      photo
        ? scatterBellyStickers(concept, {
            count: stickerCount,
            seed: `${photo.uri}:${shuffle}`
          })
        : [],
    [concept, photo, shuffle, stickerCount]
  );

  const moveEllipse = useCallback(
    (dx: number, dy: number) => {
      const cardHeight = cardWidth / (photo?.aspectRatio ?? 0.8);
      setEllipse((current) =>
        clampBellyEllipse({
          ...current,
          centerX: current.centerX + dx / cardWidth,
          centerY: current.centerY + dy / cardHeight
        })
      );
    },
    [cardWidth, photo?.aspectRatio]
  );

  const scaleEllipse = useCallback((factor: number) => {
    setEllipse((current) =>
      clampBellyEllipse({
        ...current,
        radiusX: current.radiusX * factor,
        radiusY: current.radiusY * factor
      })
    );
  }, []);

  // Kaydırma karnı işaretler, iki parmak elipsi büyütür. İkisi aynı anda
  // çalışmalı; anne çoğu zaman tek hamlede hem taşıyıp hem büyütüyor.
  const gesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan().onChange((event) => {
          runOnJS(moveEllipse)(event.changeX, event.changeY);
        }),
        Gesture.Pinch().onChange((event) => {
          runOnJS(scaleEllipse)(event.scaleChange ?? 1);
        })
      ),
    [moveEllipse, scaleEllipse]
  );

  async function pickPhoto(source: "camera" | "library") {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showError(
          new Error(
            source === "camera"
              ? "Kamera izni verilmediği için fotoğraf çekilemiyor."
              : "Galeri izni verilmediği için fotoğraf seçilemiyor."
          ),
          "İzin gerekiyor"
        );
        return;
      }

      // Kırpma yok: fotoğraf ne ise o kalsın istiyoruz. Taşlar zaten ayrı bir
      // katman; kadraja dokunmuyoruz.
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.95 })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.95
            });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const aspectRatio =
        asset.width && asset.height ? asset.width / asset.height : 0.8;

      setPhoto({ aspectRatio, uri: asset.uri });
      setEllipse(DEFAULT_BELLY_ELLIPSE);
      setDensityOffset(0);
      void trackEvent("photo_studio_photo_selected", { kind: "belly", source });
    } catch (error) {
      showError(error, "Fotoğraf alınamadı");
    }
  }

  async function ensureAccess() {
    if (!locked) {
      return true;
    }

    const result = await showPaywallIfNeeded(PREMIUM_FEATURES.photoStudioBelly.source, {
      concept: concept.id,
      feature: "photo_studio",
      life_stage: "pregnancy"
    });

    return result.didBecomePremium;
  }

  async function withExport(action: (uri: string) => Promise<void>, label: string) {
    if (!photo || busy) return;
    if (!(await ensureAccess())) return;

    setBusy(true);
    // Kılavuz halkası dışa aktarılan karta girmesin diye önce gizliyoruz.
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 60));
      const uri = await captureCard(cardRef.current);
      await action(uri);
      void trackEvent("photo_studio_exported", { action: label, concept: concept.id, kind: "belly" });
    } catch (error) {
      showError(error, "Kart hazırlanamadı");
    } finally {
      setExporting(false);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.eyebrow}>Foto Stüdyo</Text>
        <Text style={typography.heading1}>Karın ışıltısı</Text>
        <Text style={styles.lede}>
          Yüzün, saçın, kıyafetin ve arka plan olduğu gibi kalır. Taşlar yalnızca
          işaretlediğin alana, karnın yuvarlaklığına uyacak şekilde yerleşir.
        </Text>
      </View>

      {photo ? (
        <View style={styles.preview}>
          <GestureDetector gesture={gesture}>
            <View>
              <BellyCard
                aspectRatio={photo.aspectRatio}
                concept={concept}
                ellipse={ellipse}
                photoUri={photo.uri}
                ref={cardRef}
                showGuide={!exporting}
                stickers={stickers}
                width={cardWidth}
              />
            </View>
          </GestureDetector>
          <Text style={styles.previewHint}>
            Kesikli halkayı parmağınla karnının üstüne taşı, iki parmakla büyüt.
          </Text>
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <ImagePlus color={colors.primary} size={26} />
          </View>
          <Text style={typography.heading3}>Bir fotoğraf seç</Text>
          <Text style={styles.emptyHint}>
            Karnının göründüğü bir kare seç. Fotoğrafın hiçbir yeri değiştirilmez,
            kırpılmaz; taşlar üstüne ayrı bir katman olarak eklenir.
          </Text>
          <View style={styles.actionRow}>
            <Button label="Galeriden seç" onPress={() => void pickPhoto("library")} style={styles.flexButton} />
            <Button
              label="Fotoğraf çek"
              onPress={() => void pickPhoto("camera")}
              style={styles.flexButton}
              variant="secondary"
            />
          </View>
        </Card>
      )}

      <View style={styles.section}>
        <Text style={typography.heading3}>Konsept</Text>
        <ConceptPicker
          concepts={BELLY_CONCEPTS}
          isPremium={isPremium}
          onSelect={(next) => setConceptId(next.id)}
          selectedId={concept.id}
        />
        {locked ? (
          <Pressable
            accessibilityHint="Premium ekranını açar"
            accessibilityRole="button"
            onPress={() => void showPaywallIfNeeded(PREMIUM_FEATURES.photoStudioBelly.source, {
              concept: concept.id,
              feature: "photo_studio",
              life_stage: "pregnancy"
            })}
            style={[styles.lockedNote, { borderColor: colors.primary }]}
          >
            <Sparkles color={colors.primary} size={16} />
            <Text style={styles.lockedText}>
              {concept.title} premium bir konsept. Önizlemesi açık; paylaşmak için
              Anı Stüdyosu gerekiyor.
            </Text>
          </Pressable>
        ) : null}
      </View>

      {photo ? (
        <Card style={styles.controlCard}>
          <Text style={typography.label}>Taş yoğunluğu</Text>
          <View style={styles.controlRow}>
            <Pressable
              accessibilityLabel="Daha seyrek"
              accessibilityRole="button"
              onPress={() => setDensityOffset((value) => Math.max(-3, value - 1))}
              style={styles.controlButton}
            >
              <Minus color={colors.text} size={18} />
            </Pressable>
            <Text style={styles.controlValue}>{stickers.length} taş</Text>
            <Pressable
              accessibilityLabel="Daha yoğun"
              accessibilityRole="button"
              onPress={() => setDensityOffset((value) => Math.min(4, value + 1))}
              style={styles.controlButton}
            >
              <Plus color={colors.text} size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Yeniden dağıt"
              accessibilityRole="button"
              onPress={() => {
                setShuffle((value) => value + 1);
                Haptics.selectionAsync().catch(() => undefined);
              }}
              style={styles.controlButton}
            >
              <Shuffle color={colors.text} size={18} />
            </Pressable>
          </View>
          <Text style={styles.formHint}>
            Dağılım rastgele görünür ama sabittir; konsept değiştirip geri
            döndüğünde aynı yerleşimi bulursun.
          </Text>
        </Card>
      ) : null}

      {photo ? (
        <View style={styles.actionRow}>
          <Button
            disabled={busy}
            label={busy ? "Hazırlanıyor…" : "Paylaş"}
            onPress={() =>
              void withExport(async (uri) => {
                await shareCard(uri);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                  () => undefined
                );
              }, "share")
            }
            style={styles.flexButton}
          />
          {baby?.id ? (
            <Button
              disabled={busy}
              label="Galerime kaydet"
              onPress={() =>
                void withExport(async (uri) => {
                  await uploadBabyPhoto({
                    babyId: baby.id,
                    caption: concept.title,
                    takenAt: new Date().toISOString(),
                    uri
                  });
                  showSuccess("Kart anı galerine eklendi.");
                }, "gallery")
              }
              style={styles.flexButton}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      {photo ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void pickPhoto("library")}
          style={styles.linkRow}
        >
          <Text style={styles.link}>Başka bir fotoğraf seç</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  lede: {
    ...typography.body
  },
  preview: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  previewHint: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  emptyCard: {
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  emptyIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  emptyHint: {
    ...typography.body
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  lockedNote: {
    ...radii.card,
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  lockedText: {
    ...typography.body,
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  },
  controlCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  controlButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  controlValue: {
    ...typography.label,
    flex: 1,
    textAlign: "center"
  },
  formHint: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  flexButton: {
    flex: 1
  },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md
  },
  link: {
    ...typography.label,
    color: colors.primary
  }
});
