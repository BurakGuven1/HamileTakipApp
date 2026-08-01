import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Heart, Sparkles } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentProfile } from "@/api/profiles";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import {
  listBabyNameFavorites,
  removeBabyNameFavorite,
  type BabyNameFavorite
} from "@/features/baby-names/favorites";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

const FAVORITE_PALETTES = {
  girl: {
    accent: "#934C63",
    colors: ["#FFF9FA", "#F7E5EB"] as const,
    label: "Kız ismi"
  },
  boy: {
    accent: "#486F93",
    colors: ["#FAFCFE", "#E5EFF7"] as const,
    label: "Erkek ismi"
  }
};

export default function BabyNameFavoritesScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo } = useFeedback();
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const favoritesQuery = useQuery({
    queryKey: ["baby-name-favorites"],
    queryFn: listBabyNameFavorites
  });
  const removeMutation = useMutation({
    mutationFn: removeBabyNameFavorite,
    onSuccess: (favorites) => {
      queryClient.setQueryData(["baby-name-favorites"], favorites);
      showInfo("İsim favorilerinden çıkarıldı.", "Favorilerin güncellendi");
    },
    onError: (error) => showError(error, "Favori güncellenemedi")
  });

  if (profileQuery.isLoading || favoritesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <QueryState
          loading
          description="Kalbine yakın isimler hazırlanıyor…"
          shape="baby"
        />
      </SafeAreaView>
    );
  }

  if (profileQuery.isError || favoritesQuery.isError) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <QueryState
          description="Favori isimlerin şu anda açılamadı. Yeniden deneyebilirsin."
          onRetry={() =>
            void Promise.all([profileQuery.refetch(), favoritesQuery.refetch()])
          }
          retrying={profileQuery.isFetching || favoritesQuery.isFetching}
          title="Favoriler alınamadı"
        />
      </SafeAreaView>
    );
  }

  if (!profileQuery.data?.is_pregnant) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <EmptyState
          actionLabel="Ana ekrana dön"
          description="Bebek isimleri ve favoriler, hamilelik deneyimine özel bir alandır."
          onActionPress={() => router.replace("/home")}
          title="Bu alan hamilelik deneyimine özel"
        />
      </SafeAreaView>
    );
  }

  const favorites = favoritesQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={favorites}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.navigationRow}>
              <Pressable
                accessibilityLabel="İsim keşfine dön"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <ArrowLeft color={colors.text} size={23} />
              </Pressable>
              <View style={styles.headerCount}>
                <Heart color="#934C63" fill="#934C63" size={16} />
                <Text style={styles.headerCountText}>{favorites.length}</Text>
              </View>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SENİN SEÇKİN</Text>
              <Text style={styles.title}>Favori isimlerim</Text>
              <Text style={styles.subtitle}>
                Kalbine dokunan isimler burada, anlamlarıyla birlikte seni
                bekliyor.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            actionHint="Yeni bir isim keşfetmek için isim önerisi ekranını açar"
            actionLabel="Bir isim keşfet"
            description="Henüz favoriye eklediğin bir isim yok. İlk özel ismini birlikte bulalım."
            onActionPress={() => router.replace("/baby-names")}
            title="İlk isim için yer hazır"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <FavoriteNameCard
            item={item}
            pending={removeMutation.isPending}
            onRemove={() => removeMutation.mutate(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function FavoriteNameCard({
  item,
  onRemove,
  pending
}: {
  item: BabyNameFavorite;
  onRemove: () => void;
  pending: boolean;
}) {
  const palette = FAVORITE_PALETTES[item.gender];

  return (
    <LinearGradient
      colors={[...palette.colors]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.nameCard}
    >
      <View style={styles.nameCardTop}>
        <View style={styles.nameCopy}>
          <Text style={[styles.genderLabel, { color: palette.accent }]}>
            {palette.label} · {item.kind === "double" ? "Çift isim" : "Tek isim"}
          </Text>
          <Text style={[styles.name, { color: palette.accent }]}>{item.name}</Text>
        </View>
        <Pressable
          accessibilityLabel={`${item.name} ismini favorilerden çıkar`}
          accessibilityRole="button"
          accessibilityState={{ busy: pending, disabled: pending }}
          disabled={pending}
          hitSlop={8}
          onPress={onRemove}
          style={[styles.heartButton, { borderColor: `${palette.accent}24` }]}
        >
          <Heart color={palette.accent} fill={palette.accent} size={21} />
        </Pressable>
      </View>
      <View style={styles.meaningDivider} />
      <View style={styles.meaningRow}>
        <Sparkles color={palette.accent} size={18} />
        <Text style={styles.meaning}>{item.meaning}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#FBF7F3", flex: 1 },
  stateScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg
  },
  headerArea: { gap: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  navigationRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  headerCount: {
    alignItems: "center",
    backgroundColor: "#F7E8ED",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md
  },
  headerCountText: {
    ...typography.label,
    color: "#934C63",
    fontVariant: ["tabular-nums"]
  },
  headerCopy: { gap: spacing.sm, maxWidth: 540 },
  eyebrow: {
    ...typography.eyebrow,
    color: "#657E70",
    letterSpacing: 1.2
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 36,
    lineHeight: 42
  },
  subtitle: { ...typography.body, color: colors.textMuted, maxWidth: 480 },
  separator: { height: spacing.md },
  nameCard: {
    borderColor: "rgba(94, 77, 84, 0.10)",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg
  },
  nameCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  nameCopy: { flex: 1, gap: spacing.xs },
  genderLabel: { ...typography.label, fontSize: 13 },
  name: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 31,
    lineHeight: 38
  },
  heartButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.66)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  meaningDivider: {
    backgroundColor: "rgba(91, 73, 80, 0.10)",
    height: StyleSheet.hairlineWidth
  },
  meaningRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  meaning: { ...typography.body, color: "#524C4F", flex: 1 }
});
