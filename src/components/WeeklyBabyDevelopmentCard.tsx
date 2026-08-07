import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Baby, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import {
  getPregnancyWeekInfo,
  PREGNANCY_WEEK_GROWTH
} from "@/features/pregnancy/weekInfo";
import { colors, radii, spacing, typography } from "@/theme";
import { semanticColor } from "@/theme/colors";

const babyImageContext = require.context(
  "../../assets/photos",
  false,
  /\.(?:jfif|png|jpg)$/i
);
const comparisonImageContext = require.context(
  "../../assets/photos1",
  false,
  /\.(?:jfif|png|jpg)$/i
);

const ASSET_EXTENSION_PRIORITY = ["jfif", "png", "jpg"] as const;
const MIN_WEEK = 2;
const MAX_WEEK = 40;

export const WEEKLY_BABY_DEVELOPMENT = PREGNANCY_WEEK_GROWTH.filter(
  ({ week }) => week >= MIN_WEEK && week <= MAX_WEEK
);

type WeekItem = (typeof WEEKLY_BABY_DEVELOPMENT)[number];

type WeeklyBabyDevelopmentCardProps = {
  initialWeek: number;
  onWeekChange?: (week: number) => void;
};

function clampWeek(week: number) {
  return Math.max(MIN_WEEK, Math.min(MAX_WEEK, Math.round(week)));
}

function getTrimesterLabel(week: number) {
  if (week <= 13) return "1. trimester";
  if (week <= 27) return "2. trimester";
  return "3. trimester";
}

function getAssetCandidates(
  context: typeof babyImageContext,
  week: number
) {
  const availableKeys = new Set(context.keys());

  return ASSET_EXTENSION_PRIORITY.flatMap((extension) => {
    const key = `./${week}.${extension}`;
    return availableKeys.has(key) ? [context(key)] : [];
  });
}

function DevelopmentVisual({
  active,
  reducedMotion,
  week
}: {
  active: boolean;
  reducedMotion: boolean;
  week: number;
}) {
  const imageCandidates = useMemo(
    () => getAssetCandidates(babyImageContext, week),
    [week]
  );
  const [imageAttempt, setImageAttempt] = useState(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(float);
    cancelAnimation(pulse);

    if (!active || reducedMotion) {
      float.value = 0.5;
      pulse.value = 0;
      return;
    }

    float.value = 0;
    float.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.inOut(Easing.sin)
      }),
      -1,
      true
    );
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 140 }),
        withDelay(80, withTiming(0.68, { duration: 80 })),
        withTiming(0, { duration: 150 }),
        withDelay(560, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(float);
      cancelAnimation(pulse);
    };
  }, [active, float, pulse, reducedMotion]);

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-6, 6]) },
      { rotate: `${interpolate(float.value, [0, 1], [-0.8, 0.8])}deg` }
    ]
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.08]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.1]) }]
  }));
  const selectedSource = imageCandidates[imageAttempt];

  return (
    <View style={styles.visualPage}>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.pulseRing, pulseStyle]}
      />
      <Animated.View style={[styles.babyOrb, floatingStyle]}>
        {selectedSource ? (
          <Image
            accessibilityLabel={`${week}. hafta bebeğinin temsili gelişim görseli`}
            accessibilityRole="image"
            contentFit="contain"
            onError={() => setImageAttempt((attempt) => attempt + 1)}
            source={selectedSource}
            style={styles.babyImage}
            transition={reducedMotion ? 0 : 220}
          />
        ) : (
          <View
            accessibilityLabel={`${week}. hafta gelişim görseli hazırlanıyor`}
            accessibilityRole="image"
            style={styles.babyPlaceholder}
          >
            <Baby color={weeklyColors.indigo} size={52} strokeWidth={1.6} />
            <Text style={styles.placeholderWeek}>{week}. hafta</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function ComparisonBadge({
  emoji,
  reducedMotion,
  week
}: {
  emoji: string;
  reducedMotion: boolean;
  week: number;
}) {
  const candidates = useMemo(
    () => getAssetCandidates(comparisonImageContext, week),
    [week]
  );
  const [imageAttempt, setImageAttempt] = useState(0);
  const pop = useSharedValue(1);
  const selectedSource = candidates[imageAttempt];

  useEffect(() => {
    setImageAttempt(0);
    cancelAnimation(pop);

    if (reducedMotion) {
      pop.value = 1;
      return;
    }

    pop.value = 0.82;
    pop.value = withSequence(
      withTiming(1.06, {
        duration: 170,
        easing: Easing.out(Easing.cubic)
      }),
      withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) })
    );
  }, [pop, reducedMotion, week]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pop.value },
      { rotate: `${interpolate(pop.value, [0.82, 1.06], [-7, 2])}deg` }
    ]
  }));

  return (
    <Animated.View style={[styles.comparisonBadge, popStyle]}>
      {selectedSource ? (
        <Image
          accessibilityLabel={`${week}. hafta büyüklük karşılaştırması`}
          accessibilityRole="image"
          contentFit="contain"
          onError={() => setImageAttempt((attempt) => attempt + 1)}
          source={selectedSource}
          style={styles.comparisonImage}
          transition={reducedMotion ? 0 : 160}
        />
      ) : (
        <Text
          accessibilityLabel={`${week}. hafta büyüklük karşılaştırması: ${emoji}`}
          style={styles.comparisonEmoji}
        >
          {emoji}
        </Text>
      )}
    </Animated.View>
  );
}

export function WeeklyBabyDevelopmentCard({
  initialWeek,
  onWeekChange
}: WeeklyBabyDevelopmentCardProps) {
  const reducedMotion = useReducedMotion();
  const listRef = useRef<FlatList<WeekItem>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(clampWeek(initialWeek));
  const bubbleDrift = useSharedValue(0.5);
  const selectedInfo = getPregnancyWeekInfo(selectedWeek);
  const selectedIndex = selectedWeek - MIN_WEEK;
  const progress = selectedIndex / (MAX_WEEK - MIN_WEEK);

  useEffect(() => {
    const nextWeek = clampWeek(initialWeek);
    setSelectedWeek(nextWeek);
    if (pageWidth > 0) {
      listRef.current?.scrollToIndex({
        animated: false,
        index: nextWeek - MIN_WEEK
      });
    }
  }, [initialWeek, pageWidth]);

  useEffect(() => {
    cancelAnimation(bubbleDrift);
    if (reducedMotion) {
      bubbleDrift.value = 0.5;
      return;
    }

    bubbleDrift.value = 0;
    bubbleDrift.value = withRepeat(
      withTiming(1, {
        duration: 5200,
        easing: Easing.inOut(Easing.sin)
      }),
      -1,
      true
    );

    return () => cancelAnimation(bubbleDrift);
  }, [bubbleDrift, reducedMotion]);

  const bubbleOneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(bubbleDrift.value, [0, 1], [-8, 10]) },
      { translateY: interpolate(bubbleDrift.value, [0, 1], [7, -6]) }
    ]
  }));
  const bubbleTwoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(bubbleDrift.value, [0, 1], [7, -5]) },
      { translateY: interpolate(bubbleDrift.value, [0, 1], [-5, 8]) }
    ]
  }));

  function selectWeek(nextWeek: number, animated = true) {
    const clamped = clampWeek(nextWeek);
    setSelectedWeek(clamped);
    onWeekChange?.(clamped);
    listRef.current?.scrollToIndex({
      animated: animated && !reducedMotion,
      index: clamped - MIN_WEEK
    });
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth <= 0) return;
    const index = Math.max(
      0,
      Math.min(
        WEEKLY_BABY_DEVELOPMENT.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / pageWidth)
      )
    );
    const nextWeek = WEEKLY_BABY_DEVELOPMENT[index]?.week ?? selectedWeek;
    if (nextWeek !== selectedWeek) {
      setSelectedWeek(nextWeek);
      onWeekChange?.(nextWeek);
    }
  }

  if (!selectedInfo) return null;

  return (
    <LinearGradient
      colors={[weeklyColors.gradientStart, weeklyColors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shell}
    >
      <Animated.View style={[styles.bubbleOne, bubbleOneStyle]} />
      <Animated.View style={[styles.bubbleTwo, bubbleTwoStyle]} />

      <View
        accessibilityActions={[
          { name: "decrement", label: "Önceki haftayı göster" },
          { name: "increment", label: "Sonraki haftayı göster" }
        ]}
        accessibilityLabel={`Haftalık bebek gelişimi. ${selectedWeek}. hafta, ${getTrimesterLabel(selectedWeek)}. Bebeğiniz yaklaşık ${selectedInfo.size}.`}
        accessibilityLiveRegion="polite"
        accessibilityRole="adjustable"
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "decrement") {
            selectWeek(selectedWeek - 1);
          }
          if (event.nativeEvent.actionName === "increment") {
            selectWeek(selectedWeek + 1);
          }
        }}
        style={styles.headingRow}
      >
        <View style={styles.headingCopy}>
          <Text style={styles.kicker}>Haftalık Bebek Gelişimi</Text>
          <Text style={styles.weekTitle}>{selectedWeek}. Hafta</Text>
        </View>
        <View style={styles.trimesterBadge}>
          <Text style={styles.trimesterText}>{getTrimesterLabel(selectedWeek)}</Text>
        </View>
      </View>

      <View
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        style={styles.pagerViewport}
      >
        {pageWidth > 0 ? (
          <FlatList
            accessibilityElementsHidden
            data={WEEKLY_BABY_DEVELOPMENT}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              index,
              length: pageWidth,
              offset: pageWidth * index
            })}
            horizontal
            initialNumToRender={1}
            initialScrollIndex={selectedIndex}
            keyExtractor={(item) => String(item.week)}
            maxToRenderPerBatch={3}
            onMomentumScrollEnd={handleMomentumEnd}
            pagingEnabled
            ref={listRef}
            renderItem={({ item }) => (
              <View style={{ width: pageWidth }}>
                <DevelopmentVisual
                  active={item.week === selectedWeek}
                  reducedMotion={reducedMotion}
                  week={item.week}
                />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
            windowSize={3}
          />
        ) : null}

        <Pressable
          accessibilityLabel="Önceki hafta"
          accessibilityRole="button"
          disabled={selectedWeek === MIN_WEEK}
          hitSlop={8}
          onPress={() => selectWeek(selectedWeek - 1)}
          style={({ pressed }) => [
            styles.arrowButton,
            styles.arrowLeft,
            selectedWeek === MIN_WEEK && styles.arrowDisabled,
            pressed && styles.arrowPressed
          ]}
        >
          <ChevronLeft color={weeklyColors.indigo} size={24} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          accessibilityLabel="Sonraki hafta"
          accessibilityRole="button"
          disabled={selectedWeek === MAX_WEEK}
          hitSlop={8}
          onPress={() => selectWeek(selectedWeek + 1)}
          style={({ pressed }) => [
            styles.arrowButton,
            styles.arrowRight,
            selectedWeek === MAX_WEEK && styles.arrowDisabled,
            pressed && styles.arrowPressed
          ]}
        >
          <ChevronRight color={weeklyColors.indigo} size={24} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.comparisonRow}>
        <ComparisonBadge
          emoji={selectedInfo.emoji}
          reducedMotion={reducedMotion}
          week={selectedWeek}
        />
        <View style={styles.comparisonCopy}>
          <Text style={styles.comparisonLabel}>Bu hafta bebeğiniz</Text>
          <Text style={styles.comparisonValue}>
            yaklaşık {selectedInfo.size}
          </Text>
        </View>
      </View>

      <View style={styles.progressGroup}>
        <View
          accessibilityLabel={`Gebelik haftası gezgini: ${selectedWeek}. hafta, 2 ile 40 hafta arasında`}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: MAX_WEEK, min: MIN_WEEK, now: selectedWeek }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>2. hafta</Text>
          <Text style={styles.progressLabel}>40. hafta</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const weeklyColors = {
  coral: semanticColor("#FF8B7A", "#FF9E91"),
  gradientEnd: semanticColor("#F6E9F0", "#201A28"),
  gradientStart: semanticColor("#FBF2ED", "#2C222E"),
  indigo: semanticColor("#5341C4", "#B8A9FF"),
  indigoSoft: semanticColor("rgba(110, 86, 229, 0.13)", "rgba(184, 169, 255, 0.16)"),
  ring: semanticColor("rgba(110, 86, 229, 0.42)", "rgba(184, 169, 255, 0.48)"),
  surface: semanticColor("rgba(255, 252, 248, 0.92)", "rgba(41, 36, 44, 0.92)")
} as const;

const styles = StyleSheet.create({
  arrowButton: {
    alignItems: "center",
    backgroundColor: weeklyColors.surface,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    top: 88,
    width: 48,
    zIndex: 4
  },
  arrowDisabled: { opacity: 0.36 },
  arrowLeft: { left: spacing.sm },
  arrowPressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
  arrowRight: { right: spacing.sm },
  babyImage: { height: "100%", width: "100%" },
  babyOrb: {
    alignItems: "center",
    backgroundColor: weeklyColors.surface,
    borderRadius: radii.pill,
    height: 190,
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: weeklyColors.indigo,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    width: 190
  },
  babyPlaceholder: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center"
  },
  bubbleOne: {
    backgroundColor: weeklyColors.indigoSoft,
    borderRadius: radii.pill,
    height: 92,
    opacity: 0.42,
    position: "absolute",
    right: -26,
    top: 92,
    width: 92
  },
  bubbleTwo: {
    backgroundColor: weeklyColors.coral,
    borderRadius: radii.pill,
    bottom: 94,
    height: 52,
    left: -18,
    opacity: 0.08,
    position: "absolute",
    width: 52
  },
  comparisonBadge: {
    alignItems: "center",
    backgroundColor: weeklyColors.surface,
    borderRadius: radii.lg,
    height: 68,
    justifyContent: "center",
    overflow: "hidden",
    width: 68
  },
  comparisonCopy: { flex: 1, gap: 2 },
  comparisonEmoji: { fontSize: 38, lineHeight: 46 },
  comparisonImage: { height: 58, width: 58 },
  comparisonLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  comparisonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm
  },
  comparisonValue: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24
  },
  headingCopy: { flex: 1, gap: 2 },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  kicker: {
    ...typography.label,
    color: weeklyColors.indigo,
    fontSize: 13,
    lineHeight: 18
  },
  pagerViewport: {
    height: 236,
    marginHorizontal: -spacing.md,
    overflow: "hidden"
  },
  placeholderWeek: {
    ...typography.data,
    color: weeklyColors.indigo,
    fontSize: 14,
    lineHeight: 20
  },
  progressFill: {
    backgroundColor: weeklyColors.indigo,
    borderRadius: radii.pill,
    height: "100%"
  },
  progressGroup: { gap: spacing.xs, marginTop: spacing.sm },
  progressLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressThumb: {
    backgroundColor: weeklyColors.coral,
    borderColor: weeklyColors.surface,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 16,
    marginLeft: -8,
    position: "absolute",
    top: -5,
    width: 16
  },
  progressTrack: {
    backgroundColor: weeklyColors.indigoSoft,
    borderRadius: radii.pill,
    height: 6,
    position: "relative"
  },
  pulseRing: {
    borderColor: weeklyColors.ring,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 210,
    position: "absolute",
    width: 210
  },
  shell: {
    borderRadius: 30,
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg,
    position: "relative"
  },
  trimesterBadge: {
    backgroundColor: weeklyColors.indigoSoft,
    borderRadius: radii.pill,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  trimesterText: {
    ...typography.label,
    color: weeklyColors.indigo,
    fontSize: 12,
    lineHeight: 17
  },
  visualPage: {
    alignItems: "center",
    height: 236,
    justifyContent: "center"
  },
  weekTitle: {
    ...typography.dataStrong,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34
  }
});
