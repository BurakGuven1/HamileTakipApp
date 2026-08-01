import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  Baby,
  Heart,
  RefreshCw,
  Shuffle,
  Sparkle,
  Sparkles
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue
} from "react-native-reanimated";

import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import {
  loadBabyNameDataset,
  namesForSelection,
  pickUnseenName,
  scrambleName,
  type BabyNameRecord,
  type BabyNameSelection
} from "@/features/baby-names/babyNames";
import {
  listBabyNameFavorites,
  toggleBabyNameFavorite
} from "@/features/baby-names/favorites";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

type Frame = { height: number; width: number; x: number; y: number };

type NamePalette = {
  accent: string;
  accentSoft: string;
  cardColors: readonly [string, string, string];
  description: string;
  label: string;
};

const PALETTES: Record<BabyNameSelection, NamePalette> = {
  girl: {
    accent: "#934C63",
    accentSoft: "#F7E8ED",
    cardColors: ["#FFF9FA", "#F8E8ED", "#EECBD6"],
    description: "Kız isimleri arasından kalbine dokunanı keşfet",
    label: "Kız"
  },
  boy: {
    accent: "#486F93",
    accentSoft: "#E7F0F7",
    cardColors: ["#FAFCFE", "#E8F1F8", "#CADDEC"],
    description: "Erkek isimleri arasından sana sesleneni bul",
    label: "Erkek"
  },
  surprise: {
    accent: "#657E70",
    accentSoft: "#E9F0EB",
    cardColors: ["#FFFCF7", "#EAF0EB", "#EEE4EF"],
    description: "Kız ve erkek isimleri aynı küçük sürprizde buluşsun",
    label: "Sürpriz olsun"
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function BabyNamesScreen() {
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
  const reducedMotion = useReducedMotion();
  const transitionProgress = useSharedValue(0);
  const meaningProgress = useSharedValue(0);
  const sparkleProgress = useSharedValue(0);
  const rollTokenRef = useRef(0);
  const seenNameIdsRef = useRef(new Set<string>());
  const [selection, setSelection] = useState<BabyNameSelection>();
  const [selectedFrame, setSelectedFrame] = useState<Frame>();
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [currentName, setCurrentName] = useState<BabyNameRecord>();
  const [displayName, setDisplayName] = useState("");
  const [isRolling, setIsRolling] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const datasetQuery = useQuery({
    queryKey: ["baby-name-dataset"],
    queryFn: loadBabyNameDataset,
    staleTime: Infinity
  });
  const favoritesQuery = useQuery({
    queryKey: ["baby-name-favorites"],
    queryFn: listBabyNameFavorites
  });

  const favoriteIds = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((item) => item.id)),
    [favoritesQuery.data]
  );
  const activePalette = PALETTES[selection ?? "surprise"];
  const activeNames = useMemo(
    () =>
      selection && datasetQuery.data
        ? namesForSelection(datasetQuery.data.names, selection)
        : [],
    [datasetQuery.data, selection]
  );

  const favoriteMutation = useMutation({
    mutationFn: toggleBabyNameFavorite,
    onSuccess: ({ favorites, isFavorite }) => {
      queryClient.setQueryData(["baby-name-favorites"], favorites);
      if (isFavorite) {
        showSuccess("Bu isim favorilerine eklendi.", "Kalbine yakın");
      } else {
        showInfo("İsim favorilerinden çıkarıldı.", "Favoriler güncellendi");
      }
    },
    onError: (error) => showError(error, "Favori kaydedilemedi")
  });

  useEffect(
    () => () => {
      rollTokenRef.current += 1;
    },
    []
  );

  const selectionLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      transitionProgress.value,
      [0, 0.58, 1],
      [1, 0.12, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          transitionProgress.value,
          [0, 1],
          [1, 0.985],
          Extrapolation.CLAMP
        )
      }
    ]
  }));

  const discoveryLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      transitionProgress.value,
      [0, 0.52, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          transitionProgress.value,
          [0.5, 1],
          [14, 0],
          Extrapolation.CLAMP
        )
      }
    ]
  }));

  const heroStyle = useAnimatedStyle(() => {
    if (!selectedFrame || !stageSize.width || !stageSize.height) {
      return { opacity: 0 };
    }
    return {
      borderRadius: interpolate(
        transitionProgress.value,
        [0, 1],
        [26, 0],
        Extrapolation.CLAMP
      ),
      height: interpolate(
        transitionProgress.value,
        [0, 1],
        [selectedFrame.height, stageSize.height],
        Extrapolation.CLAMP
      ),
      left: interpolate(
        transitionProgress.value,
        [0, 1],
        [selectedFrame.x, 0],
        Extrapolation.CLAMP
      ),
      opacity: interpolate(
        transitionProgress.value,
        [0, 0.76, 1],
        [1, 1, 0],
        Extrapolation.CLAMP
      ),
      top: interpolate(
        transitionProgress.value,
        [0, 1],
        [selectedFrame.y, 0],
        Extrapolation.CLAMP
      ),
      width: interpolate(
        transitionProgress.value,
        [0, 1],
        [selectedFrame.width, stageSize.width],
        Extrapolation.CLAMP
      )
    };
  });

  function selectGender(nextSelection: BabyNameSelection, frame: Frame) {
    rollTokenRef.current += 1;
    setCurrentName(undefined);
    setDisplayName("");
    setIsRolling(false);
    meaningProgress.value = 0;
    sparkleProgress.value = 0;
    setSelectedFrame(frame);
    setSelection(nextSelection);
    transitionProgress.value = 0;
    transitionProgress.value = withTiming(1, {
      duration: reducedMotion ? 0 : 540,
      easing: Easing.out(Easing.cubic)
    });
    Haptics.selectionAsync().catch(() => undefined);
  }

  async function changeSelection() {
    rollTokenRef.current += 1;
    setIsRolling(false);
    meaningProgress.value = 0;
    sparkleProgress.value = 0;
    transitionProgress.value = withTiming(0, {
      duration: reducedMotion ? 0 : 400,
      easing: Easing.out(Easing.cubic)
    });
    await wait(reducedMotion ? 0 : 410);
    setSelection(undefined);
    setCurrentName(undefined);
    setDisplayName("");
  }

  async function suggestName() {
    if (!selection || isRolling || activeNames.length === 0) return;
    const token = rollTokenRef.current + 1;
    rollTokenRef.current = token;
    const { item, reset } = pickUnseenName(
      activeNames,
      seenNameIdsRef.current
    );
    if (!item) {
      showInfo("Bu seçim için kullanılabilir isim bulunamadı.", "İsim bulunamadı");
      return;
    }

    if (reset) {
      showInfo(
        "Bu seçenekteki tüm isimleri gördün; keşif döngüsü yeniden başladı.",
        "İsimler yeniden karıştı"
      );
    }

    setCurrentName(item);
    setIsRolling(true);
    meaningProgress.value = 0;
    sparkleProgress.value = 0;

    if (reducedMotion) {
      setDisplayName(item.name);
      setIsRolling(false);
      meaningProgress.value = 1;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
      }
      announceName(item);
      return;
    }

    const startedAt = Date.now();
    const duration = 1_250;
    while (Date.now() - startedAt < duration) {
      if (rollTokenRef.current !== token) return;
      const elapsedRatio = Math.min(1, (Date.now() - startedAt) / duration);
      setDisplayName(scrambleName(item.name));
      await wait(34 + Math.round(Math.pow(elapsedRatio, 2.5) * 105));
    }
    if (rollTokenRef.current !== token) return;

    setDisplayName(item.name);
    setIsRolling(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    }
    sparkleProgress.value = withSequence(
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })
    );
    meaningProgress.value = withDelay(
      200,
      withTiming(1, { duration: 430, easing: Easing.out(Easing.cubic) })
    );
    await wait(700);
    if (rollTokenRef.current === token) announceName(item);
  }

  if (profileQuery.isLoading || datasetQuery.isLoading) {
    return <BabyNameLoading />;
  }

  if (profileQuery.isError || datasetQuery.isError) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <QueryState
          description="İsim arşivi şu anda hazırlanamadı. Dosyayı ve bağlantını kontrol edip yeniden deneyebilirsin."
          onRetry={() =>
            void Promise.all([profileQuery.refetch(), datasetQuery.refetch()])
          }
          retrying={profileQuery.isFetching || datasetQuery.isFetching}
          title="Bebek isimleri açılamadı"
        />
      </SafeAreaView>
    );
  }

  if (!profileQuery.data?.is_pregnant) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <EmptyState
          actionLabel="Ana ekrana dön"
          description="Bebek isimleri keşfi, hamilelik haftaların boyunca sana eşlik eden özel bir alandır."
          onActionPress={() => router.replace("/home")}
          title="Bu alan hamilelik deneyimine özel"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        onLayout={(event) => setStageSize(event.nativeEvent.layout)}
        style={styles.stage}
      >
        <Animated.View
          pointerEvents={selection ? "none" : "auto"}
          style={[styles.layer, selectionLayerStyle]}
        >
          <SelectionScene
            favoriteCount={favoritesQuery.data?.length ?? 0}
            selectedOption={selection}
            transitionProgress={transitionProgress}
            totalCount={datasetQuery.data?.names.length ?? 0}
            onBack={() => router.back()}
            onFavorites={() => router.push("/baby-names/favorites")}
            onSelect={selectGender}
          />
        </Animated.View>

        {selection ? (
          <Animated.View style={[styles.layer, discoveryLayerStyle]}>
            <LinearGradient
              colors={[...activePalette.cardColors]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <DiscoveryScene
              currentName={currentName}
              displayName={displayName}
              favoriteCount={favoritesQuery.data?.length ?? 0}
              favoritePending={favoriteMutation.isPending}
              isFavorite={Boolean(currentName && favoriteIds.has(currentName.id))}
              isRolling={isRolling}
              meaningProgress={meaningProgress}
              palette={activePalette}
              selection={selection}
              sparkleProgress={sparkleProgress}
              onChangeSelection={() => void changeSelection()}
              onFavorite={() => {
                if (currentName) favoriteMutation.mutate(currentName);
              }}
              onFavorites={() => router.push("/baby-names/favorites")}
              onSuggest={() => void suggestName()}
            />
          </Animated.View>
        ) : null}

        {selection && selectedFrame ? (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.heroOverlay, heroStyle]}
          >
            <LinearGradient
              colors={[...activePalette.cardColors]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function SelectionScene({
  favoriteCount,
  onBack,
  onFavorites,
  onSelect,
  selectedOption,
  totalCount,
  transitionProgress
}: {
  favoriteCount: number;
  onBack: () => void;
  onFavorites: () => void;
  onSelect: (selection: BabyNameSelection, frame: Frame) => void;
  selectedOption?: BabyNameSelection;
  totalCount: number;
  transitionProgress: SharedValue<number>;
}) {
  const [cardsOrigin, setCardsOrigin] = useState({ x: 0, y: 0 });
  const [genderRowOrigin, setGenderRowOrigin] = useState({ x: 0, y: 0 });
  const [cardFrames, setCardFrames] = useState<
    Partial<Record<BabyNameSelection, Frame>>
  >({});

  function registerCardFrame(
    option: BabyNameSelection,
    event: LayoutChangeEvent
  ) {
    const { height, width, x, y } = event.nativeEvent.layout;
    setCardFrames((current) => ({
      ...current,
      [option]: { height, width, x, y }
    }));
  }

  function selectCard(option: BabyNameSelection) {
    const frame = cardFrames[option];
    if (!frame) return;
    const rowOrigin = option === "surprise" ? { x: 0, y: 0 } : genderRowOrigin;
    onSelect(option, {
      ...frame,
      x: cardsOrigin.x + rowOrigin.x + frame.x,
      y: cardsOrigin.y + rowOrigin.y + frame.y
    });
  }

  return (
    <View style={styles.selectionContent}>
      <HeaderBar
        favoriteCount={favoriteCount}
        onBack={onBack}
        onFavorites={onFavorites}
      />
      <View style={styles.selectionIntro}>
        <View style={styles.introMark}>
          <Sparkles color={colors.honeyGold} size={22} />
        </View>
        <Text style={styles.selectionTitle}>Bir isim, ilk küçük hikâyesi</Text>
        <Text style={styles.selectionDescription}>
          Bugün hangi isimler kalbine yaklaşsın? Her dokunuşta anlamıyla birlikte
          yeni bir ihtimal açılacak.
        </Text>
      </View>

      <View
        onLayout={(event) => {
          const { x, y } = event.nativeEvent.layout;
          setCardsOrigin({ x, y });
        }}
        style={styles.cardsArea}
      >
        <View
          onLayout={(event) => {
            const { x, y } = event.nativeEvent.layout;
            setGenderRowOrigin({ x, y });
          }}
          style={styles.genderRow}
        >
          <GenderChoiceCard
            delay={0}
            option="girl"
            selectedOption={selectedOption}
            transitionProgress={transitionProgress}
            onLayout={(event) => registerCardFrame("girl", event)}
            onPress={() => selectCard("girl")}
          />
          <GenderChoiceCard
            delay={180}
            option="boy"
            selectedOption={selectedOption}
            transitionProgress={transitionProgress}
            onLayout={(event) => registerCardFrame("boy", event)}
            onPress={() => selectCard("boy")}
          />
        </View>
        <GenderChoiceCard
          delay={360}
          option="surprise"
          selectedOption={selectedOption}
          transitionProgress={transitionProgress}
          wide
          onLayout={(event) => registerCardFrame("surprise", event)}
          onPress={() => selectCard("surprise")}
        />
      </View>

      <Text style={styles.archiveNote}>
        {totalCount.toLocaleString("tr-TR")} tek ve çift isim · Aynı keşif
        döngüsünde tekrar etmez
      </Text>
      {Object.keys(cardFrames).length < 3 ? (
        <Text accessibilityLiveRegion="polite" style={styles.preparingLabel}>
          Seçim kartları hazırlanıyor…
        </Text>
      ) : null}
    </View>
  );
}

function GenderChoiceCard({
  delay,
  onLayout,
  onPress,
  option,
  selectedOption,
  transitionProgress,
  wide = false
}: {
  delay: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  option: BabyNameSelection;
  selectedOption?: BabyNameSelection;
  transitionProgress: SharedValue<number>;
  wide?: boolean;
}) {
  const palette = PALETTES[option];
  const reducedMotion = useReducedMotion();
  const breath = useSharedValue(1);
  const press = useSharedValue(1);
  const selected = selectedOption === option;

  useEffect(() => {
    if (reducedMotion || selectedOption) {
      breath.value = withTiming(1, { duration: 160 });
      return;
    }
    breath.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.018, {
            duration: 1_800,
            easing: Easing.inOut(Easing.quad)
          }),
          withTiming(1, {
            duration: 1_800,
            easing: Easing.inOut(Easing.quad)
          })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(breath);
  }, [breath, delay, reducedMotion, selectedOption]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: selectedOption
      ? interpolate(
          transitionProgress.value,
          [0, selected ? 0.22 : 0.44],
          [1, 0],
          Extrapolation.CLAMP
        )
      : 1,
    transform: [{ scale: breath.value * press.value }]
  }));

  return (
    <AnimatedPressable
      accessibilityHint={`${palette.label} isimleri keşfini başlatır`}
      accessibilityLabel={`${palette.label}: ${palette.description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onLayout={onLayout}
      onPress={onPress}
      onPressIn={() => {
        press.value = reducedMotion ? 1 : withTiming(0.975, { duration: 110 });
      }}
      onPressOut={() => {
        press.value = reducedMotion ? 1 : withTiming(1, { duration: 150 });
      }}
      style={[styles.genderCard, wide && styles.genderCardWide, animatedStyle]}
    >
      <LinearGradient
        colors={[...palette.cardColors]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.genderCardGradient}
      >
        <View style={[styles.genderIcon, { backgroundColor: palette.accentSoft }]}>
          {option === "surprise" ? (
            <Shuffle color={palette.accent} size={26} />
          ) : (
            <Baby color={palette.accent} size={27} />
          )}
        </View>
        <View style={styles.genderCardCopy}>
          <Text style={[styles.genderCardTitle, { color: palette.accent }]}>
            {palette.label}
          </Text>
          <Text numberOfLines={wide ? 2 : 3} style={styles.genderCardDescription}>
            {palette.description}
          </Text>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

function DiscoveryScene({
  currentName,
  displayName,
  favoriteCount,
  favoritePending,
  isFavorite,
  isRolling,
  meaningProgress,
  onChangeSelection,
  onFavorite,
  onFavorites,
  onSuggest,
  palette,
  selection,
  sparkleProgress
}: {
  currentName?: BabyNameRecord;
  displayName: string;
  favoriteCount: number;
  favoritePending: boolean;
  isFavorite: boolean;
  isRolling: boolean;
  meaningProgress: SharedValue<number>;
  onChangeSelection: () => void;
  onFavorite: () => void;
  onFavorites: () => void;
  onSuggest: () => void;
  palette: NamePalette;
  selection: BabyNameSelection;
  sparkleProgress: SharedValue<number>;
}) {
  const meaningStyle = useAnimatedStyle(() => ({
    opacity: meaningProgress.value,
    transform: [
      {
        translateY: interpolate(
          meaningProgress.value,
          [0, 1],
          [12, 0],
          Extrapolation.CLAMP
        )
      }
    ]
  }));

  return (
    <View style={styles.discoveryContent}>
      <View style={styles.discoveryHeader}>
        <Pressable
          accessibilityLabel="Cinsiyet seçimine dön"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onChangeSelection}
          style={styles.headerIconButton}
        >
          <ArrowLeft color={palette.accent} size={23} />
        </Pressable>
        <View style={styles.discoveryHeaderCopy}>
          <Text style={[styles.discoveryKicker, { color: palette.accent }]}>
            {PALETTES[selection].label} isimleri
          </Text>
          <Text style={styles.discoveryHeaderTitle}>İsim keşfi</Text>
        </View>
        <FavoriteHeaderButton
          count={favoriteCount}
          color={palette.accent}
          onPress={onFavorites}
        />
      </View>

      <View style={styles.nameMoment}>
        <View style={[styles.nameHalo, { backgroundColor: palette.accentSoft }]} />
        {currentName ? (
          <>
            <SparkleBurst color={palette.accent} progress={sparkleProgress} />
            <Text
              accessibilityElementsHidden={isRolling}
              accessibilityLiveRegion={isRolling ? "none" : "polite"}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={2}
              style={[styles.nameText, { color: palette.accent }]}
            >
              {displayName}
            </Text>
            <Animated.View style={[styles.meaningBlock, meaningStyle]}>
              <Text style={[styles.meaningLabel, { color: palette.accent }]}>Anlamı</Text>
              <Text style={styles.meaningText}>{currentName.meaning}</Text>
              <Text style={styles.nameKindLabel}>
                {currentName.kind === "double" ? "Çift isim" : "Tek isim"}
              </Text>
            </Animated.View>
          </>
        ) : (
          <View style={styles.invitation}>
            <View style={[styles.invitationIcon, { backgroundColor: palette.accentSoft }]}>
              <Sparkles color={palette.accent} size={31} />
            </View>
            <Text style={styles.invitationTitle}>Bir isim sana yaklaşsın</Text>
            <Text style={styles.invitationText}>
              Butona dokun; arşivden gelen bir isim, anlamıyla birlikte burada
              usulca belirsin.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.discoveryActions}>
        {!currentName ? (
          <Pressable
            accessibilityRole="button"
            disabled={isRolling}
            onPress={onSuggest}
            style={({ pressed }) => [
              styles.primaryDiscoveryButton,
              { backgroundColor: palette.accent },
              pressed && styles.actionPressed
            ]}
          >
            <Sparkles color="#FFFDFC" size={21} />
            <Text style={styles.primaryDiscoveryButtonText}>
              {isRolling ? "İsim aranıyor…" : "Bir isim öner"}
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.resultActionRow}>
              <Pressable
                accessibilityLabel={
                  isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
                }
                accessibilityRole="button"
                disabled={favoritePending || isRolling}
                onPress={onFavorite}
                style={({ pressed }) => [
                  styles.resultActionButton,
                  isFavorite && { backgroundColor: palette.accentSoft },
                  pressed && styles.actionPressed
                ]}
              >
                <Heart
                  color={palette.accent}
                  fill={isFavorite ? palette.accent : "transparent"}
                  size={22}
                />
                <Text style={[styles.resultActionText, { color: palette.accent }]}>
                  {isFavorite ? "Favoride" : "Favoriye ekle"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isRolling}
                onPress={onSuggest}
                style={({ pressed }) => [
                  styles.resultActionButton,
                  pressed && styles.actionPressed
                ]}
              >
                <RefreshCw color={palette.accent} size={21} />
                <Text style={[styles.resultActionText, { color: palette.accent }]}>
                  {isRolling ? "Aranıyor…" : "Başka isim"}
                </Text>
              </Pressable>
            </View>
            <Button
              label="Seçimi değiştir"
              onPress={onChangeSelection}
              variant="ghost"
            />
          </>
        )}
      </View>
    </View>
  );
}

function HeaderBar({
  favoriteCount,
  onBack,
  onFavorites
}: {
  favoriteCount: number;
  onBack: () => void;
  onFavorites: () => void;
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityLabel="Geri"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.headerIconButton}
      >
        <ArrowLeft color={colors.text} size={23} />
      </Pressable>
      <Text style={styles.headerBrand}>Bebek İsimleri</Text>
      <FavoriteHeaderButton
        color={colors.dustyRose}
        count={favoriteCount}
        onPress={onFavorites}
      />
    </View>
  );
}

function FavoriteHeaderButton({
  color,
  count,
  onPress
}: {
  color: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Favorilerim, ${count} isim`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.favoriteHeaderButton}
    >
      <Heart color={color} fill={count > 0 ? color : "transparent"} size={21} />
      {count > 0 ? <Text style={[styles.favoriteCount, { color }]}>{count}</Text> : null}
    </Pressable>
  );
}

function SparkleBurst({
  color,
  progress
}: {
  color: string;
  progress: SharedValue<number>;
}) {
  const particles = [
    { delay: 0, kind: "star", x: -92, y: -54 },
    { delay: 0.08, kind: "dot", x: -68, y: 52 },
    { delay: 0.14, kind: "star", x: 88, y: -42 },
    { delay: 0.2, kind: "dot", x: 102, y: 34 },
    { delay: 0.25, kind: "dot", x: -116, y: 2 },
    { delay: 0.3, kind: "star", x: 62, y: 70 }
  ] as const;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.sparkleLayer}
    >
      {particles.map((particle, index) => (
        <SparkleParticle
          color={color}
          delay={particle.delay}
          key={`${particle.x}:${particle.y}`}
          kind={particle.kind}
          progress={progress}
          x={particle.x}
          y={particle.y}
          size={index % 2 === 0 ? 16 : 8}
        />
      ))}
    </View>
  );
}

function SparkleParticle({
  color,
  delay,
  kind,
  progress,
  size,
  x,
  y
}: {
  color: string;
  delay: number;
  kind: "dot" | "star";
  progress: SharedValue<number>;
  size: number;
  x: number;
  y: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const localProgress = interpolate(
      progress.value,
      [delay, Math.min(1, delay + 0.62)],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: interpolate(
        localProgress,
        [0, 0.2, 0.78, 1],
        [0, 1, 0.72, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        { translateX: x * localProgress },
        { translateY: y * localProgress },
        {
          scale: interpolate(
            localProgress,
            [0, 0.35, 1],
            [0.3, 1, 0.72],
            Extrapolation.CLAMP
          )
        }
      ]
    };
  });

  return (
    <Animated.View style={[styles.sparkleParticle, animatedStyle]}>
      {kind === "star" ? (
        <Sparkle color={color} size={size} />
      ) : (
        <View
          style={[
            styles.sparkleDot,
            { backgroundColor: color, height: size, width: size }
          ]}
        />
      )}
    </Animated.View>
  );
}

function BabyNameLoading() {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0.54);

  useEffect(() => {
    pulse.value = reducedMotion
      ? 0.76
      : withRepeat(
          withTiming(1, {
            duration: 900,
            easing: Easing.inOut(Easing.quad)
          }),
          -1,
          true
        );
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <SafeAreaView
      accessibilityLabel="Bebek isimleri arşivi hazırlanıyor"
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.loadingScreen}
    >
      <Animated.View style={[styles.loadingContent, animatedStyle]}>
        <View style={styles.loadingHeader} />
        <View style={styles.loadingTitle} />
        <View style={styles.loadingLine} />
        <View style={styles.loadingCards}>
          <View style={styles.loadingCard} />
          <View style={styles.loadingCard} />
        </View>
        <View style={styles.loadingWideCard} />
      </Animated.View>
      <Text style={styles.loadingText}>İsimler ve anlamları hazırlanıyor…</Text>
    </SafeAreaView>
  );
}

function announceName(item: BabyNameRecord) {
  AccessibilityInfo.announceForAccessibility(`${item.name}. Anlamı: ${item.meaning}`);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const styles = StyleSheet.create({
  actionPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  archiveNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  cardsArea: { gap: spacing.md },
  discoveryActions: { gap: spacing.sm, width: "100%" },
  discoveryContent: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: "space-between",
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  discoveryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52
  },
  discoveryHeaderCopy: { flex: 1, gap: 1 },
  discoveryHeaderTitle: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 18,
    lineHeight: 23
  },
  discoveryKicker: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18
  },
  errorScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  favoriteCount: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16
  },
  favoriteHeaderButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 252, 248, 0.76)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.sm
  },
  genderCard: { flex: 1, minHeight: 196 },
  genderCardCopy: { gap: spacing.xs },
  genderCardDescription: {
    ...typography.body,
    color: "#554F52",
    fontSize: 14,
    lineHeight: 20
  },
  genderCardGradient: {
    ...radii.cardLarge,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing.lg
  },
  genderCardTitle: {
    ...typography.heading2,
    fontSize: 25,
    lineHeight: 31
  },
  genderCardWide: { flex: 0, minHeight: 132, width: "100%" },
  genderIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  genderRow: { flexDirection: "row", gap: spacing.md },
  headerBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48
  },
  headerBrand: {
    ...typography.label,
    color: colors.text,
    flex: 1,
    textAlign: "center"
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 252, 248, 0.76)",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  heroOverlay: { overflow: "hidden", position: "absolute", zIndex: 5 },
  introMark: {
    alignItems: "center",
    backgroundColor: colors.highlightSoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  invitation: { alignItems: "center", gap: spacing.md, maxWidth: 390 },
  invitationIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 68,
    justifyContent: "center",
    width: 68
  },
  invitationText: {
    ...typography.body,
    color: "#5E585B",
    textAlign: "center"
  },
  invitationTitle: {
    ...typography.heading2,
    color: colors.text,
    textAlign: "center"
  },
  layer: StyleSheet.absoluteFill,
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    flex: 1,
    height: 196
  },
  loadingCards: { flexDirection: "row", gap: spacing.md },
  loadingContent: { gap: spacing.lg, paddingHorizontal: spacing.lg },
  loadingHeader: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    width: "100%"
  },
  loadingLine: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 18,
    width: "84%"
  },
  loadingScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    gap: spacing.xl
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center"
  },
  loadingTitle: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 38,
    width: "72%"
  },
  loadingWideCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 132,
    width: "100%"
  },
  meaningBlock: {
    alignItems: "center",
    backgroundColor: "rgba(255, 252, 248, 0.7)",
    ...radii.card,
    gap: spacing.sm,
    maxWidth: 440,
    padding: spacing.lg,
    width: "100%"
  },
  meaningLabel: { ...typography.label, fontSize: 14, lineHeight: 19 },
  meaningText: {
    ...typography.body,
    color: "#4E484C",
    textAlign: "center"
  },
  nameHalo: {
    borderRadius: 120,
    height: 240,
    opacity: 0.58,
    position: "absolute",
    width: 240
  },
  nameKindLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16
  },
  nameMoment: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xl,
    justifyContent: "center",
    minHeight: 330,
    paddingHorizontal: spacing.md,
    position: "relative"
  },
  nameText: {
    fontFamily: fonts.displayBold,
    fontSize: 48,
    lineHeight: 56,
    maxWidth: 470,
    minHeight: 62,
    textAlign: "center"
  },
  preparingLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },
  primaryDiscoveryButton: {
    ...radii.button,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: spacing.lg
  },
  primaryDiscoveryButtonText: {
    ...typography.button,
    color: "#FFFDFC"
  },
  resultActionButton: {
    ...radii.button,
    alignItems: "center",
    backgroundColor: "rgba(255, 252, 248, 0.7)",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing.md
  },
  resultActionRow: { flexDirection: "row", gap: spacing.sm },
  resultActionText: {
    ...typography.label,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center"
  },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  selectionContent: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: "space-between",
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  selectionDescription: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 520
  },
  selectionIntro: { gap: spacing.sm },
  selectionTitle: {
    ...typography.heading1,
    color: colors.text,
    maxWidth: 480
  },
  sparkleDot: { borderRadius: radii.pill },
  sparkleLayer: {
    height: 1,
    left: "50%",
    position: "absolute",
    top: "38%",
    width: 1,
    zIndex: 2
  },
  sparkleParticle: { left: 0, position: "absolute", top: 0 },
  stage: { flex: 1, overflow: "hidden", position: "relative" }
});
