import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images, Plus, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import {
  getBabyPhotoSignedUrl,
  listBabyPhotos,
  uploadBabyPhoto,
  type BabyPhoto
} from "@/api/gallery";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { formatDate } from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";

export default function GalleryScreen() {
  const queryClient = useQueryClient();
  const [selectedBabyId, setSelectedBabyId] = useState<string>();

  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const babies = babiesQuery.data ?? [];
  const selectedBaby = useMemo(
    () => babies.find((baby) => baby.id === selectedBabyId) ?? babies[0],
    [babies, selectedBabyId]
  );

  useEffect(() => {
    if (!selectedBabyId && babies[0]) {
      setSelectedBabyId(babies[0].id);
    }
  }, [babies, selectedBabyId]);

  const photosQuery = useQuery({
    queryKey: ["baby-photos", selectedBaby?.id],
    queryFn: () => listBabyPhotos(selectedBaby?.id as string),
    enabled: Boolean(selectedBaby?.id)
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBaby) {
        throw new Error("Once bebek profili eklemelisin.");
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Fotograf secmek icin galeri izni gerekli.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      return uploadBabyPhoto({
        babyId: selectedBaby.id,
        uri: result.assets[0].uri,
        takenAt: result.assets[0].exif?.DateTimeOriginal
          ? new Date(result.assets[0].exif.DateTimeOriginal).toISOString()
          : new Date().toISOString()
      });
    },
    onSuccess: async (photo) => {
      if (!photo) return;
      await queryClient.invalidateQueries({ queryKey: ["baby-photos", selectedBaby?.id] });
    },
    onError: (error) => Alert.alert("Fotograf eklenemedi", error.message)
  });

  const photos = photosQuery.data ?? [];

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconBubble}>
            <Images color={colors.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Anilar</Text>
            <Text style={typography.heading1}>Fotograf galerisi</Text>
            <Text style={styles.heroText}>
              Fotograflari tarihe gore sakla; bebeginin yolculugunu zaman cizgisi
              uzerinde gor.
            </Text>
          </View>
        </View>

        {babies.length > 0 ? (
          <View style={styles.babyChips}>
            {babies.map((baby) => (
              <Pressable
                key={baby.id}
                accessibilityRole="button"
                onPress={() => setSelectedBabyId(baby.id)}
                style={[
                  styles.babyChip,
                  baby.id === selectedBaby?.id && styles.babyChipActive
                ]}
              >
                <Text
                  style={[
                    styles.babyChipText,
                    baby.id === selectedBaby?.id && styles.babyChipTextActive
                  ]}
                >
                  {baby.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!selectedBaby ? (
          <EmptyState
            title="Galeri icin bebek profili gerekli"
            description="Once Bebek sekmesinden bebek profilini olustur."
          />
        ) : (
          <>
            <Button
              label={uploadMutation.isPending ? "Yukleniyor..." : "Fotograf ekle"}
              disabled={uploadMutation.isPending}
              onPress={() => uploadMutation.mutate()}
            />

            {photos.length === 0 ? (
              <Card style={styles.emptyCard}>
                <View style={{ gap: spacing.md }}>
                  <Sparkles color={colors.accent} size={28} />
                  <View style={{ gap: spacing.xs }}>
                    <Text style={typography.heading2}>Ilk aniyi ekle</Text>
                    <Text style={typography.body}>
                      Fotograflar burada tarihe gore bir yol cizgisi uzerinde
                      listelenecek.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : (
              <View style={styles.timeline}>
                {photos.map((photo, index) => (
                  <PhotoTimelineItem
                    key={photo.id}
                    last={index === photos.length - 1}
                    photo={photo}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

function PhotoTimelineItem({ photo, last }: { photo: BabyPhoto; last: boolean }) {
  const signedUrlQuery = useQuery({
    queryKey: ["baby-photo-url", photo.storage_path],
    queryFn: () => getBabyPhotoSignedUrl(photo.storage_path)
  });

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot}>
          <Camera color={colors.primary} size={16} />
        </View>
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>

      <Card style={styles.photoCard}>
        <View style={{ gap: spacing.sm }}>
          {signedUrlQuery.data ? (
            <Image
              contentFit="cover"
              source={{ uri: signedUrlQuery.data }}
              style={styles.photo}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Plus color={colors.primary} size={24} />
            </View>
          )}
          <Text style={styles.photoDate}>{formatDate(photo.taken_at)}</Text>
          {photo.caption ? <Text style={typography.body}>{photo.caption}</Text> : null}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  babyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  babyChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  babyChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  babyChipText: {
    ...typography.label,
    color: colors.textMuted
  },
  babyChipTextActive: {
    color: colors.surface
  },
  emptyCard: {
    backgroundColor: colors.surface
  },
  timeline: {
    gap: spacing.md
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  timelineRail: {
    alignItems: "center",
    width: 34
  },
  timelineDot: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  timelineLine: {
    backgroundColor: colors.border,
    flex: 1,
    width: 2
  },
  photoCard: {
    flex: 1,
    padding: spacing.sm
  },
  photo: {
    aspectRatio: 1.35,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    width: "100%"
  },
  photoPlaceholder: {
    alignItems: "center",
    aspectRatio: 1.35,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    justifyContent: "center",
    width: "100%"
  },
  photoDate: {
    ...typography.label,
    color: colors.text
  }
});
