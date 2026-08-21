import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Camera, Images } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listBabies } from "@/api/babies";
import { getCurrentProfile } from "@/api/profiles";
import {
  deleteBabyPhoto,
  getBabyGalleryAccess,
  getBabyPhotoSignedUrl,
  listBabyPhotos,
  updateBabyPhoto,
  uploadBabyPhoto,
  type BabyPhoto
} from "@/api/gallery";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { PREMIUM_FEATURES } from "@/features/subscription/premiumFeatures";
import { showPaywallIfNeeded } from "@/features/subscription/showPaywallIfNeeded";
import { formatDate } from "@/lib/dates";
import { useFeedback } from "@/providers/FeedbackProvider";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function GalleryScreen() {
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  if (profileQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Galeri deneyimi hazırlanıyor…" />
      </Screen>
    );
  }

  if (profileQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Yaşam evren belirlenemediği için galeri açılamadı."
          onRetry={() => void profileQuery.refetch()}
          retrying={profileQuery.isFetching}
          title="Galeri yüklenemedi"
        />
      </Screen>
    );
  }

  if (profileQuery.data?.is_pregnant) {
    return (
      <Screen>
        <EmptyState
          actionHint="Gebelik araçları ekranına gider"
          actionLabel="Gebelik araçlarına dön"
          description="Bebek anı galerisi doğum bilgilerini kaydettiğinde açılır. Gebelik boyunca ultrason ve belge içeriklerini Belgeyi Anla alanında kullanabilirsin."
          onActionPress={() => router.replace("/pregnancy-tools")}
          title="Anı galerisi doğum sonrasında açılır"
        />
      </Screen>
    );
  }

  return <GalleryContent />;
}

function GalleryContent() {
  const queryClient = useQueryClient();
  const accentColor = useAppTheme();
  const { showError, showSuccess } = useFeedback();
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
  const galleryAccessQuery = useQuery({
    queryKey: ["baby-gallery-access"],
    queryFn: getBabyGalleryAccess
  });

  async function requestUpload(source: "camera" | "library") {
    if (galleryAccessQuery.isLoading) return;

    if (galleryAccessQuery.isError) {
      showError(galleryAccessQuery.error, "Galeri hakkı kontrol edilemedi");
      return;
    }

    if (!galleryAccessQuery.data?.allowed) {
      await showPaywallIfNeeded(PREMIUM_FEATURES.babyMemoryGallery.source, {
        feature: "baby_memory_gallery",
        free_limit: galleryAccessQuery.data?.limit ?? 5,
        used: galleryAccessQuery.data?.used ?? 5
      }, { mode: "required" });
      return;
    }

    uploadMutation.mutate(source);
  }

  const uploadMutation = useMutation({
    mutationFn: async (source: "camera" | "library") => {
      if (!selectedBaby) {
        throw new Error("Önce bebek profili eklemelisin.");
      }

      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          source === "camera"
            ? "Fotoğraf çekmek için kamera izni gerekli."
            : "Fotoğraf seçmek için galeri izni gerekli."
        );
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.9
            })
          : await ImagePicker.launchImageLibraryAsync({
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      showSuccess("Fotoğraf galeriye eklendi.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["baby-photos", selectedBaby?.id] }),
        queryClient.invalidateQueries({ queryKey: ["baby-gallery-access"] })
      ]);
    },
    onError: (error) => showError(error, "Fotoğraf eklenemedi")
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ caption, id }: { caption: string; id: string }) =>
      updateBabyPhoto(id, { caption: caption.trim() || null }),
    onSuccess: async () => {
      showSuccess("Fotoğraf açıklaması güncellendi.");
      await queryClient.invalidateQueries({ queryKey: ["baby-photos", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Açıklama kaydedilemedi")
  });

  const deletePhotoMutation = useMutation({
    mutationFn: deleteBabyPhoto,
    onSuccess: async () => {
      showSuccess("Fotoğraf silindi.");
      await queryClient.invalidateQueries({ queryKey: ["baby-photos", selectedBaby?.id] });
    },
    onError: (error) => showError(error, "Fotoğraf silinemedi")
  });

  const photos = photosQuery.data ?? [];

  function confirmDelete(photo: BabyPhoto) {
    Alert.alert(
      "Fotoğraf silinsin mi?",
      "Bu fotoğraf anı galerisinden ve güvenli depolamadan kalıcı olarak silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Fotoğrafı sil",
          style: "destructive",
          onPress: () => deletePhotoMutation.mutate(photo)
        }
      ]
    );
  }

  if (babiesQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <QueryState loading description="Anı galerisi hazırlanıyor…" />
      </Screen>
    );
  }

  if (babiesQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Bebek bilgileri alınamadığı için galeri açılamadı."
          onRetry={() => void babiesQuery.refetch()}
          retrying={babiesQuery.isFetching}
          title="Galeri yüklenemedi"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        contentContainerStyle={styles.container}
        data={selectedBaby && !photosQuery.isError ? photos : []}
        keyExtractor={(photo) => photo.id}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onRefresh={() => void photosQuery.refetch()}
        refreshing={photosQuery.isRefetching}
        style={styles.list}
        renderItem={({ item: photo, index }) => (
          <PhotoTimelineItem
            disabled={updatePhotoMutation.isPending || deletePhotoMutation.isPending}
            last={index === photos.length - 1}
            photo={photo}
            primaryColor={accentColor.primary}
            tintColor={accentColor.tint}
            onDelete={() => confirmDelete(photo)}
            onUpdateCaption={(caption) =>
              updatePhotoMutation.mutate({ caption, id: photo.id })
            }
          />
        )}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
        <View style={[styles.hero, { backgroundColor: accentColor.accentSoft }]}>
          <View style={[styles.iconBubble, { backgroundColor: colors.surface }]}>
            <Images color={accentColor.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Anılar</Text>
            <Text style={typography.heading1}>Fotoğraf galerisi</Text>
            <Text style={styles.heroText}>
              Fotoğrafları tarihe göre sakla; bebeğinin yolculuğunu zaman çizgisi
              üzerinde gör.
            </Text>
          </View>
        </View>

        {babies.length > 0 ? (
          <View style={styles.babyChips}>
            {babies.map((baby) => (
              <Pressable
                key={baby.id}
                accessibilityRole="button"
                accessibilityState={{ selected: baby.id === selectedBaby?.id }}
                onPress={() => setSelectedBabyId(baby.id)}
                style={[
                  styles.babyChip,
                  baby.id === selectedBaby?.id && {
                    backgroundColor: accentColor.primary,
                    borderColor: accentColor.primary
                  }
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

        {galleryAccessQuery.data && !galleryAccessQuery.data.isPremium ? (
          <Card style={styles.allowanceCard}>
            <View style={styles.allowanceRow}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.eyebrow}>Ücretsiz anılar</Text>
                <Text style={typography.heading3}>
                  {galleryAccessQuery.data.used}/{galleryAccessQuery.data.limit} fotoğraf
                </Text>
                <Text style={typography.body}>
                  İlk {galleryAccessQuery.data.limit} anını ücretsiz sakla; sınırsız galeri Premium ile açılır.
                </Text>
              </View>
              <Images color={accentColor.primary} size={26} />
            </View>
          </Card>
        ) : null}

        {!selectedBaby ? (
          <EmptyState
            actionHint="Bebek profili oluşturma ekranını açar"
            actionLabel="Bebek profili ekle"
            title="Galeri için bebek profili gerekli"
            description="Galeri mevcut bebek profillerine bağlıdır. Hamilelik veya annelik akışındayken bir bebek profili ekleyebilirsin."
            onActionPress={() =>
              router.push({ pathname: "/baby", params: { section: "profile" } })
            }
          />
        ) : (
          <View style={styles.galleryContent}>
            <View style={styles.actionRow}>
              <Button
                label={uploadMutation.isPending ? "Yükleniyor..." : "Galeriden seç"}
                disabled={uploadMutation.isPending || galleryAccessQuery.isLoading}
                style={styles.actionButton}
                onPress={() => void requestUpload("library")}
              />
              <Button
                label="Kamera"
                disabled={uploadMutation.isPending || galleryAccessQuery.isLoading}
                style={styles.actionButton}
                variant="secondary"
                onPress={() => void requestUpload("camera")}
              />
            </View>

            {photosQuery.isLoading ? (
              <QueryState compact loading description="Fotoğraflar yükleniyor…" />
            ) : null}
            {photosQuery.isError ? (
              <QueryState
                description="Fotoğraflar alınamadı. Mevcut anıların silinmedi; bağlantını kontrol edip yeniden deneyebilirsin."
                onRetry={() => void photosQuery.refetch()}
                retrying={photosQuery.isFetching}
                title="Fotoğraflar yüklenemedi"
              />
            ) : null}
          </View>
        )}
          </View>
        )}
        ListEmptyComponent={
          selectedBaby && !photosQuery.isLoading && !photosQuery.isError ? (
            <EmptyState
              actionLabel="Fotoğraf seç"
              description="Fotoğraflar burada tarihe göre bir yol çizgisi üzerinde listelenecek."
              title="İlk anıyı ekle"
              onActionPress={() => void requestUpload("library")}
            />
          ) : null
        }
      />
    </Screen>
  );
}

function PhotoTimelineItem({
  disabled,
  last,
  onDelete,
  onUpdateCaption,
  photo,
  primaryColor,
  tintColor
}: {
  disabled: boolean;
  last: boolean;
  onDelete: () => void;
  onUpdateCaption: (caption: string) => void;
  photo: BabyPhoto;
  primaryColor: string;
  tintColor: string;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const signedUrlQuery = useQuery({
    queryKey: ["baby-photo-url", photo.storage_path],
    queryFn: () => getBabyPhotoSignedUrl(photo.storage_path)
  });

  useEffect(() => {
    setCaption(photo.caption ?? "");
  }, [photo.caption]);

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: tintColor }]}>
          <Camera color={primaryColor} size={16} />
        </View>
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>

      <Card style={styles.photoCard}>
        <View style={{ gap: spacing.sm }}>
          {signedUrlQuery.data ? (
            <Image
              accessibilityLabel={
                photo.caption?.trim()
                  ? `${photo.caption}, ${formatDate(photo.taken_at)}`
                  : `Bebek anı fotoğrafı, ${formatDate(photo.taken_at)}`
              }
              contentFit="cover"
              source={{ uri: signedUrlQuery.data }}
              style={styles.photo}
            />
          ) : signedUrlQuery.isError ? (
            <QueryState
              compact
              description="Fotoğraf görüntüsü alınamadı."
              onRetry={() => void signedUrlQuery.refetch()}
              retrying={signedUrlQuery.isFetching}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <QueryState compact loading description="Fotoğraf hazırlanıyor…" />
            </View>
          )}
          <Text style={styles.photoDate}>{formatDate(photo.taken_at)}</Text>
          <TextField
            label="Açıklama"
            value={caption}
            onChangeText={setCaption}
          />
          <View style={styles.photoActions}>
            <Button
              disabled={disabled || caption.trim() === (photo.caption ?? "")}
              label="Açıklamayı kaydet"
              style={styles.photoActionButton}
              variant="secondary"
              onPress={() => onUpdateCaption(caption)}
            />
            <Button
              disabled={disabled}
              label="Sil"
              style={styles.photoActionButton}
              variant="ghost"
              onPress={onDelete}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1
  },
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xl
  },
  headerContent: {
    gap: spacing.lg
  },
  galleryContent: {
    gap: spacing.lg
  },
  allowanceCard: {
    backgroundColor: colors.primarySoft
  },
  allowanceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  hero: {
    backgroundColor: colors.accentSoft,
    ...radii.cardLarge,
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
    justifyContent: "center",
    minHeight: 44,
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
    color: colors.onPrimary
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
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
    ...radii.card,
    backgroundColor: colors.surfaceMuted,
    width: "100%"
  },
  photoPlaceholder: {
    alignItems: "center",
    aspectRatio: 1.35,
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    justifyContent: "center",
    width: "100%"
  },
  photoDate: {
    ...typography.label,
    color: colors.text
  },
  photoActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  photoActionButton: {
    flex: 1
  }
});
