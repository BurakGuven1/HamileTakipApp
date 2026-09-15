import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import {
  buildGrowthSeries,
  describeGrowthTrend,
  type GrowthMeasurementInput,
  type GrowthPoint
} from "@/features/growth-tracking/growthSeries";
import {
  formatPercentile,
  GROWTH_INDICATOR_UNITS,
  type GrowthIndicator,
  type GrowthSex
} from "@/features/growth-tracking/percentile";
import { formatDate } from "@/lib/dates";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HEIGHT = 190;
const PADDING = { top: 18, right: 18, bottom: 18, left: 18 };

type GrowthThreadProps = {
  birthDate: string;
  indicator: GrowthIndicator;
  /** Grafiğe adını veren bebek — ekran okuyucu özeti için. */
  name: string;
  records: GrowthMeasurementInput[];
  sex: GrowthSex;
};

/**
 * Bebeğin büyüme ipliği.
 *
 * Bu, eski dekoratif dalganın yerini alan gerçek grafik: arkada WHO'nun
 * persentil bantları (-2σ…+2σ), üstünde ailenin girdiği ölçümlerden geçen
 * eğri. Her ölçüm dokunulabilir bir düğüm; en yenisi nabız atan nokta.
 *
 * Tek bir kilo sayısı tek başına hiçbir şey anlatmaz — anlamı, o sayının
 * yaşıtlarının dağılımında nereye düştüğünden ve zaman içinde kendi
 * çizgisini koruyup korumadığından gelir. Grafik tam olarak bu ikisini
 * gösteriyor, altındaki cümle de bunu yazıya döküyor.
 */
export function GrowthThread({ birthDate, indicator, name, records, sex }: GrowthThreadProps) {
  const appTheme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draw = useSharedValue(0);
  const pulse = useSharedValue(0);

  const series = useMemo(
    () => buildGrowthSeries({ birthDate, indicator, records, sex }),
    [birthDate, indicator, records, sex]
  );

  useEffect(() => {
    draw.value = 0;
    if (reducedMotion) {
      draw.value = 1;
      return;
    }
    draw.value = withTiming(1, { duration: 980, easing: Easing.out(Easing.cubic) });
  }, [draw, indicator, reducedMotion, series]);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, [pulse, reducedMotion]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const geometry = useMemo(() => {
    if (!series || width <= 0) return null;

    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    // Değer ekseninde biraz nefes payı: en yüksek ve en alçak eğri kenara
    // yapışırsa grafik kesilmiş görünür.
    const span = Math.max(0.001, series.maxValue - series.minValue);
    const padValue = span * 0.08;
    const minValue = series.minValue - padValue;
    const maxValue = series.maxValue + padValue;
    const ageSpan = Math.max(1, series.maxAgeDays - series.minAgeDays);

    const x = (ageDays: number) =>
      PADDING.left + ((ageDays - series.minAgeDays) / ageSpan) * innerWidth;
    const y = (value: number) =>
      PADDING.top + (1 - (value - minValue) / (maxValue - minValue)) * innerHeight;

    const toPath = (points: { ageDays: number; value: number }[]) =>
      points
        .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.ageDays).toFixed(1)} ${y(point.value).toFixed(1)}`)
        .join(" ");

    // -2σ ile +2σ arasını dolduran alan: "normal aralık" bu.
    const lower = series.bands.find((band) => band.zScore === -2);
    const upper = series.bands.find((band) => band.zScore === 2);
    const normalRange =
      lower && upper
        ? `${toPath(upper.points)} ${[...lower.points]
            .reverse()
            .map((point) => `L${x(point.ageDays).toFixed(1)} ${y(point.value).toFixed(1)}`)
            .join(" ")} Z`
        : null;

    return {
      bands: series.bands.map((band) => ({ d: toPath(band.points), zScore: band.zScore })),
      median: series.bands.find((band) => band.zScore === 0),
      normalRange,
      path: toPath(series.points.map((point) => ({ ageDays: point.ageDays, value: point.value }))),
      points: series.points.map((point) => ({
        ...point,
        cx: x(point.ageDays),
        cy: y(point.value)
      }))
    };
  }, [series, width]);

  // Çizgi uzunluğunu bilmeden strokeDasharray ile çizemeyiz; kaba bir üst
  // sınır yeterli çünkü dashoffset fazlası görünmüyor.
  const dashLength = Math.max(1, width * 2);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: dashLength * (1 - draw.value)
  }));

  const haloProps = useAnimatedProps(() => ({
    r: 7 + pulse.value * 12,
    opacity: 0.45 * (1 - pulse.value)
  }));

  const trend = series ? describeGrowthTrend(series.points) : null;
  const latest = series?.points[series.points.length - 1] ?? null;
  const selected = selectedId
    ? (geometry?.points.find((point) => point.id === selectedId) ?? null)
    : null;
  const unit = GROWTH_INDICATOR_UNITS[indicator];

  if (!series || !latest) {
    return (
      <View onLayout={handleLayout} style={styles.empty}>
        <View style={[styles.emptyDot, { backgroundColor: appTheme.primarySoft }]}>
          <View style={[styles.emptyCore, { backgroundColor: appTheme.primary }]} />
        </View>
        <Text style={styles.emptyTitle}>Büyüme ipliği henüz başlamadı</Text>
        <Text style={styles.emptyBody}>
          {`${name} için ilk ölçümü eklediğinde burada gerçek büyüme eğrisi çizilir ve yaşıtlarına göre nerede olduğunu görürsün.`}
        </Text>
      </View>
    );
  }

  const summary = describeSummary({ latest, name, trend, unit });

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={summary.accessibility}
        accessibilityRole="image"
        onLayout={handleLayout}
        style={styles.canvas}
      >
        {geometry ? (
          <Svg height={HEIGHT} width={width}>
            {geometry.normalRange ? (
              <Path d={geometry.normalRange} fill={appTheme.primary} opacity={0.08} />
            ) : null}
            <G>
              {geometry.bands.map((band) => (
                <Path
                  d={band.d}
                  key={band.zScore}
                  stroke={colors.textMuted}
                  strokeDasharray={band.zScore === 0 ? undefined : "3 6"}
                  strokeLinecap="round"
                  strokeOpacity={band.zScore === 0 ? 0.3 : 0.18}
                  strokeWidth={band.zScore === 0 ? 1.5 : 1}
                />
              ))}
            </G>
            <AnimatedPath
              animatedProps={pathProps}
              d={geometry.path}
              fill="none"
              stroke={appTheme.primary}
              strokeDasharray={dashLength}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.5}
            />
            {geometry.points.map((point, index) => {
              const isLatest = index === geometry.points.length - 1;
              const isSelected = point.id === selectedId;
              return (
                <G key={point.id}>
                  {isLatest ? (
                    <AnimatedCircle
                      animatedProps={haloProps}
                      cx={point.cx}
                      cy={point.cy}
                      fill={appTheme.primary}
                    />
                  ) : null}
                  <Circle
                    cx={point.cx}
                    cy={point.cy}
                    fill={isLatest ? appTheme.primary : colors.surface}
                    r={isSelected ? 8 : isLatest ? 7 : 5.5}
                    stroke={appTheme.primary}
                    strokeWidth={2.5}
                  />
                  {/* Nokta küçük olduğu için dokunma alanı ayrıca büyütülüyor. */}
                  <Rect
                    fill="transparent"
                    height={44}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      setSelectedId(isSelected ? null : point.id);
                    }}
                    width={44}
                    x={point.cx - 22}
                    y={point.cy - 22}
                  />
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>Doğum</Text>
        <Text style={styles.axisLabel}>Bugün</Text>
      </View>

      <View style={[styles.readout, { backgroundColor: appTheme.primarySoft }]}>
        {selected ? (
          <>
            <Text style={styles.readoutTitle}>
              {`${selected.value.toLocaleString("tr-TR")} ${unit}`}
            </Text>
            <Text style={styles.readoutBody}>
              {`${formatDate(selected.recordDate)} · ${formatPercentile(selected.percentile)} persentil`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.readoutTitle}>{summary.title}</Text>
            <Text style={styles.readoutBody}>{summary.body}</Text>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Grafiğin altındaki cümle. Sayıyı okunabilir kılan şey karşılaştırma ve
 * yön; ikisini de düz Türkçe olarak söylüyoruz.
 */
function describeSummary({
  latest,
  name,
  trend,
  unit
}: {
  latest: GrowthPoint;
  name: string;
  trend: ReturnType<typeof describeGrowthTrend>;
  unit: string;
}) {
  const percentile = Math.round(latest.percentile);
  const title = `${latest.value.toLocaleString("tr-TR")} ${unit} · ${formatPercentile(latest.percentile)} persentil`;
  const comparison = `${name}, yaşıtlarının %${percentile}'inden daha yüksek bir değerde.`;

  const body =
    trend === null
      ? `${comparison} İkinci ölçümden sonra kendi çizgisini de göreceksin.`
      : trend.tone === "steady"
        ? `${comparison} Kendi çizgisini istikrarlı biçimde koruyor.`
        : trend.tone === "rising"
          ? `${comparison} Son ölçümlerde kendi çizgisinin üstüne çıkıyor.`
          : `${comparison} Son ölçümlerde kendi çizgisinin altına iniyor; bir sonraki kontrolde konuşmaya değer.`;

  return {
    accessibility: `${name} büyüme eğrisi. ${title}. ${body}`,
    body,
    title
  };
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm
  },
  canvas: {
    height: HEIGHT,
    width: "100%"
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs
  },
  axisLabel: {
    ...typography.caption,
    fontSize: 12
  },
  readout: {
    borderRadius: radii.md,
    gap: 2,
    padding: spacing.md
  },
  readoutTitle: {
    ...typography.bodyStrong
  },
  readoutBody: {
    ...typography.caption
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  emptyDot: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  emptyCore: {
    borderRadius: radii.pill,
    height: 14,
    width: 14
  },
  emptyTitle: {
    ...typography.heading3,
    textAlign: "center"
  },
  emptyBody: {
    ...typography.caption,
    textAlign: "center"
  }
});
