import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { ImagePlus, Share2, Sparkles } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listBabies } from "@/api/babies";
import { uploadBabyPhoto } from "@/api/gallery";
import { listGrowthRecords } from "@/api/growthRecords";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DatePickerField } from "@/components/DatePickerField";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { ConceptPicker } from "@/features/photo-studio/ConceptPicker";
import { getMilestoneConcept, isConceptLocked, MILESTONE_CONCEPTS } from "@/features/photo-studio/concepts";
import { captureCard, shareCard } from "@/features/photo-studio/exportCard";
import {
  formatCardDate,
  formatHeightLabel,
  formatWeightLabel,
  getMilestoneAgeLabel,
  MAX_CAPTION_LENGTH,
  sanitizeCaption
} from "@/features/photo-studio/milestone";
import { MilestoneCard } from "@/features/photo-studio/MilestoneCard";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { trackEvent } from "@/lib/analytics";
import { toDateOnly } from "@/lib/dates";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function MilestoneStudioScreen() {
  const { showError, showSuccess } = useFeedback();
  const { isPremium } = useSubscriptionStatus();
  const { width: windowWidth } = useWindowDimensions();
  const cardRef = useRef<View>(null);

  const [conceptId, setConceptId] = useState(getMilestoneConcept(null).id);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(toDateOnly(new Date()));
  const [busy, setBusy] = useState(false);

  const babiesQuery = useQuery({ queryKey: ["babies"], queryFn: listBabies });
  const baby = babiesQuery.data?.[0] ?? null;

  const growthQuery = useQuery({
    queryKey: ["growth-records", baby?.id],
    queryFn: () => listGrowthRecords(baby?.id as string),
    enabled: Boolean(baby?.id)
  });

  // Rozetlerdeki kilo ve boy son ölçümden gelir; anne aynı bilgiyi ikinci kez
  // yazmasın diye form değil, hazır değer gösteriyoruz.
  const latestMeasurement = useMemo(() => {
    const records = growthQuery.data ?? [];
    return {
      heightCm: records.find((record) => typeof record.height_cm === "number")?.height_cm ?? null,
      weightKg: records.find((record) => typeof record.weight_kg === "number")?.weight_kg ?? null
    };
  }, [growthQuery.data]);

  const concept = getMilestoneConcept(conceptId);
  const locked = isConceptLocked(concept, isPremium);

  const values = {
    ageLabel: getMilestoneAgeLabel(baby?.birth_date, photoDate),
    caption: sanitizeCaption(caption) || null,
    dateLabel: formatCardDate(photoDate),
    heightLabel: formatHeightLabel(latestMeasurement.heightCm),
    weightLabel: formatWeightLabel(latestMeasurement.weightKg)
  };

  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 420);

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

      // Kart 4:5; kırpmayı anneye burada yaptırıyoruz ki bebeğin yüzü kadrajın
      // ortasında kalsın ve süslemeler yüzün üstüne gelmesin.
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.95
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 5],
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.95
            });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setPhotoUri(result.assets[0].uri);
      void trackEvent("photo_studio_photo_selected", { kind: "milestone", source });
    } catch (error) {
      showError(error, "Fotoğraf alınamadı");
    }
  }

  async function ensureAccess() {
    if (!locked) {
      return true;
    }

    const result = await showPaywallIfNeeded(PREMIUM_FEATURES.photoStudioMilestone.source, {
      concept: concept.id,
      feature: "photo_studio",
      life_stage: "postpartum"
    });

    return result.didBecomePremium;
  }

  async function handleShare() {
    if (!photoUri || busy) return;
    if (!(await ensureAccess())) return;

    setBusy(true);
    try {
      const uri = await captureCard(cardRef.current);
      await shareCard(uri);
      void trackEvent("photo_studio_exported", { action: "share", concept: concept.id, kind: "milestone" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      showError(error, "Kart paylaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveToGallery() {
    if (!photoUri || busy) return;
    if (!baby?.id) {
      showError(new Error("Önce bebeğini ekle."), "Galeri bulunamadı");
      return;
    }
    if (!(await ensureAccess())) return;

    setBusy(true);
    try {
      const uri = await captureCard(cardRef.current);
      await uploadBabyPhoto({
        babyId: baby.id,
        caption: values.caption ?? concept.title,
        takenAt: new Date(`${photoDate}T12:00:00`).toISOString(),
        uri
      });
      void trackEvent("photo_studio_exported", { action: "gallery", concept: concept.id, kind: "milestone" });
      showSuccess("Kart anı galerine eklendi.");
    } catch (error) {
      showError(error, "Kart kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.eyebrow}>Foto Stüdyo</Text>
        <Text style={typography.heading1}>Aylık anı kartı</Text>
        <Text style={styles.lede}>
          Fotoğrafına dokunmuyoruz: bebeğinin karesi olduğu gibi kalır, ölçüleri ve
          süslemeleri üstüne biz yerleştiririz.
        </Text>
      </View>

      {photoUri ? (
        <View style={styles.preview}>
          <MilestoneCard
            concept={concept}
            photoUri={photoUri}
            ref={cardRef}
            values={values}
            width={cardWidth}
          />
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <ImagePlus color={colors.primary} size={26} />
          </View>
          <Text style={typography.heading3}>Bir fotoğraf seç</Text>
          <Text style={styles.emptyHint}>
            Bebeğinin ortada durduğu bir kare en iyi sonucu verir. Kırpma ekranında
            kadrajı sen belirlersin.
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
          concepts={MILESTONE_CONCEPTS}
          isPremium={isPremium}
          onSelect={(next) => setConceptId(next.id)}
          selectedId={concept.id}
        />
        {locked ? (
          <Pressable
            accessibilityHint="Premium ekranını açar"
            accessibilityRole="button"
            onPress={() => void showPaywallIfNeeded(PREMIUM_FEATURES.photoStudioMilestone.source, {
              concept: concept.id,
              feature: "photo_studio",
              life_stage: "postpartum"
            })}
            style={[styles.lockedNote, { borderColor: colors.primary }]}
          >
            <Sparkles color={colors.primary} size={16} />
            <Text style={styles.lockedText}>
              {concept.title} premium bir konsept. Kartı görebilirsin; paylaşmak için
              Anı Stüdyosu gerekiyor.
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.formCard}>
        <DatePickerField
          label="Kart tarihi"
          maximumDate={new Date()}
          onChange={setPhotoDate}
          value={photoDate}
        />
        <TextField
          helperText={`${sanitizeCaption(caption).length}/${MAX_CAPTION_LENGTH} karakter`}
          label="Kartın üzerindeki yazı"
          maxLength={MAX_CAPTION_LENGTH}
          onChangeText={(text) => setCaption(sanitizeCaption(text))}
          placeholder="Bir aylık oldun canım"
          value={caption}
        />
        <Text style={styles.formHint}>
          Kilo ve boy rozetleri son gelişim ölçümünden gelir.{" "}
          {values.weightLabel || values.heightLabel
            ? "Değiştirmek için Gelişim kaydına yeni ölçüm ekle."
            : "Henüz ölçüm yok; ölçüm eklediğinde rozetler kartta belirir."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/baby")}
          style={styles.linkRow}
        >
          <Text style={styles.link}>Gelişim ölçümlerine git</Text>
        </Pressable>
      </Card>

      {photoUri ? (
        <View style={styles.actionRow}>
          <Button
            accessibilityHint="Kartı paylaşım penceresinde açar"
            disabled={busy}
            label={busy ? "Hazırlanıyor…" : "Paylaş"}
            onPress={() => void handleShare()}
            style={styles.flexButton}
          />
          <Button
            disabled={busy}
            label="Galerime kaydet"
            onPress={() => void handleSaveToGallery()}
            style={styles.flexButton}
            variant="secondary"
          />
        </View>
      ) : null}

      {photoUri ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void pickPhoto("library")}
          style={styles.linkRow}
        >
          <Share2 color={colors.primary} size={16} />
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
    marginBottom: spacing.lg
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
  formCard: {
    gap: spacing.md,
    marginBottom: spacing.lg
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
