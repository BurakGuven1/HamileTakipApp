import { useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Music2, Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getLullabyPublicUrl,
  listLullabies,
  recordLullabyPlayed,
  type Lullaby
} from "@/api/lullabies";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { Thread } from "@/components/Thread";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { useLullabyPlayer } from "@/providers/LullabyPlayerProvider";
import { colors, radii, spacing, typography } from "@/theme";

type DurationFilter = 15 | 30 | 60;

const durationFilters: DurationFilter[] = [15, 30, 60];

export default function LullabyScreen() {
  const { showError, showInfo, showSuccess } = useFeedback();
  const accentColor = useAppTheme();
  const [durationFilter, setDurationFilter] = useState<DurationFilter>();
  const [downloadingId, setDownloadingId] = useState<string>();
  const {
    currentLullaby: selectedLullaby,
    pause,
    play,
    resume,
    status,
    stop
  } = useLullabyPlayer();

  const lullabiesQuery = useQuery({
    queryKey: ["lullabies", durationFilter],
    queryFn: () => listLullabies(durationFilter)
  });

  const lullabies = lullabiesQuery.data ?? [];
  const progress = status.duration
    ? Math.min(1, status.currentTime / status.duration)
    : 0;

  async function playLullaby(lullaby: Lullaby) {
    try {
      const localUri = await getCachedLullabyUri(lullaby);
      await play(lullaby, localUri ?? getLullabyPublicUrl(lullaby.storage_path));
      await recordLullabyPlayed(lullaby.id, 0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (error) {
      showError(error, "Ninni başlatılamadı");
    }
  }

  async function downloadLullaby(lullaby: Lullaby) {
    setDownloadingId(lullaby.id);
    try {
      const target = getLullabyCachePath(lullaby);
      const info = await FileSystem.getInfoAsync(target);
      if (!info.exists) {
        await FileSystem.downloadAsync(getLullabyPublicUrl(lullaby.storage_path), target);
      }
      showSuccess("Ninni çevrimdışı dinlemek için indirildi.");
    } catch (error) {
      showError(error, "Ninni indirilemedi");
    } finally {
      setDownloadingId(undefined);
    }
  }

  function toggleCurrent() {
    if (!selectedLullaby) {
      showInfo("Önce bir ninni seç.");
      return;
    }

    if (status.playing) {
      pause();
      return;
    }

    resume();
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={[styles.hero, { backgroundColor: accentColor.tint }]}>
          <View style={styles.thread}>
            <Thread
              color={accentColor.primary}
              height={96}
              mutedColor={accentColor.accentSoft}
              progress={0.7}
              variant="decorative"
            />
          </View>
          <View style={styles.iconBubble}>
            <Music2 color={accentColor.primary} size={28} />
          </View>
          <Text style={typography.heading1}>Ninni Kütüphanesi</Text>
          <Text style={typography.body}>
            Sakin sesleri oynat, favori süreyi seç ve ninnileri çevrimdışı dinlemek
            için indir.
          </Text>
        </View>

        <View style={styles.filterRow}>
          <FilterChip
            active={!durationFilter}
            activeColor={accentColor.primary}
            label="Tümü"
            onPress={() => setDurationFilter(undefined)}
          />
          {durationFilters.map((duration) => (
            <FilterChip
              key={duration}
              active={durationFilter === duration}
              activeColor={accentColor.primary}
              label={`${duration} dk`}
              onPress={() => setDurationFilter(duration)}
            />
          ))}
        </View>

        {selectedLullaby ? (
          <Card style={[styles.playerCard, { backgroundColor: accentColor.tint }]}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.playerHeader}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={typography.heading2}>{selectedLullaby.title}</Text>
                  <Text style={typography.body}>
                    {selectedLullaby.category ?? "Sakin ninni"} /{" "}
                    {selectedLullaby.duration_minutes} dk
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={toggleCurrent}
                  style={[styles.playButton, { backgroundColor: accentColor.primary }]}
                >
                  {status.playing ? (
                    <Pause color={colors.onPrimary} size={24} />
                  ) : (
                    <Play color={colors.onPrimary} size={24} />
                  )}
                </Pressable>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: accentColor.primary,
                      width: `${progress * 100}%`
                    }
                  ]}
                />
              </View>
              <Text style={styles.timeText}>
                {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
              </Text>
            </View>
          </Card>
        ) : null}

        {lullabiesQuery.isLoading ? (
          <QueryState compact loading description="Ninniler yükleniyor…" />
        ) : lullabiesQuery.isError ? (
          <QueryState
            description="Ninniler şu anda alınamadı."
            onRetry={() => void lullabiesQuery.refetch()}
            retrying={lullabiesQuery.isFetching}
          />
        ) : lullabies.length === 0 ? (
          <EmptyState
            title="Henüz ninni yok"
            description="Supabase Storage içeriği eklendiğinde ninniler burada listelenir."
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {lullabies.map((lullaby) => (
              <Card key={lullaby.id}>
                <View style={{ gap: spacing.md }}>
                  <View style={styles.playerHeader}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={typography.heading2}>{lullaby.title}</Text>
                      <Text style={typography.body}>
                        {lullaby.category ?? "Ninni"} / {lullaby.duration_minutes} dk
                      </Text>
                    </View>
                    <Music2 color={accentColor.accent} size={24} />
                  </View>
                  <View style={styles.actionRow}>
                    <Button
                      label={
                        selectedLullaby?.id === lullaby.id && status.playing
                          ? "Duraklat"
                          : "Oynat"
                      }
                      style={styles.actionButton}
                      onPress={() =>
                        selectedLullaby?.id === lullaby.id && status.playing
                          ? pause()
                          : playLullaby(lullaby)
                      }
                    />
                    <Button
                      label={downloadingId === lullaby.id ? "İndiriliyor..." : "İndir"}
                      disabled={downloadingId === lullaby.id}
                      variant="secondary"
                      style={styles.actionButton}
                      onPress={() => downloadLullaby(lullaby)}
                    />
                  </View>
                  {selectedLullaby?.id === lullaby.id ? (
                    <Button label="Durdur" variant="ghost" onPress={stop} />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function FilterChip({
  active,
  activeColor,
  label,
  onPress
}: {
  active: boolean;
  activeColor: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
        active && { backgroundColor: activeColor, borderColor: activeColor }
      ]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function getLullabyCachePath(lullaby: Lullaby) {
  const safePath = lullaby.storage_path.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${FileSystem.documentDirectory ?? ""}lullabies_${lullaby.id}_${safePath}`;
}

async function getCachedLullabyUri(lullaby: Lullaby) {
  const target = getLullabyCachePath(lullaby);
  const info = await FileSystem.getInfoAsync(target);
  return info.exists ? target : null;
}

function formatSeconds(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

const styles = StyleSheet.create({
  hero: {
    ...radii.cardLarge,
    backgroundColor: colors.highlightSoft,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg
  },
  thread: {
    bottom: -18,
    left: spacing.lg,
    opacity: 0.3,
    position: "absolute",
    right: -spacing.lg
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.label,
    color: colors.textMuted
  },
  filterTextActive: {
    color: colors.onPrimary
  },
  playerCard: {
    backgroundColor: colors.primarySoft
  },
  playerHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  playButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: "100%"
  },
  timeText: {
    ...typography.data,
    color: colors.textMuted,
    textAlign: "right"
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
  }
});
