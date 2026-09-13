import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, fonts, radii, spacing, typography } from "@/theme";

import type { GrowthSeries } from "./growthSeries";
import {
  GROWTH_INDICATOR_UNITS,
  type GrowthIndicator
} from "./percentile";

const CHART_HEIGHT = 220;
const PADDING = { bottom: 26, left: 38, right: 10, top: 12 };

/**
 * The percentile bands are what make a single number readable: a parent does
 * not know whether 6.4 kg is good, but they can see their child tracking the
 * same line month after month.
 */
export function GrowthPercentileChart({
  indicator,
  series
}: {
  indicator: GrowthIndicator;
  series: GrowthSeries;
}) {
  const appTheme = useAppTheme();
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const geometry = useMemo(() => {
    if (width <= 0) return null;

    const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const ageSpan = Math.max(1, series.maxAgeDays - series.minAgeDays);
    // A little vertical breathing room keeps the outermost band off the frame.
    const valuePadding = (series.maxValue - series.minValue) * 0.05 || 1;
    const minValue = series.minValue - valuePadding;
    const valueSpan = Math.max(0.0001, series.maxValue + valuePadding - minValue);

    const toX = (ageDays: number) =>
      PADDING.left + ((ageDays - series.minAgeDays) / ageSpan) * plotWidth;
    const toY = (value: number) =>
      PADDING.top + plotHeight - ((value - minValue) / valueSpan) * plotHeight;

    return { minValue, plotHeight, plotWidth, toX, toY, valueSpan };
  }, [series, width]);

  const monthTicks = useMemo(() => {
    const lastMonth = Math.floor(series.maxAgeDays / 30.4375);
    const stepMonths = lastMonth <= 6 ? 1 : lastMonth <= 24 ? 3 : 6;
    const ticks: number[] = [];
    for (let month = 0; month <= lastMonth; month += stepMonths) {
      ticks.push(month);
    }
    return ticks;
  }, [series.maxAgeDays]);

  const unit = GROWTH_INDICATOR_UNITS[indicator];

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {geometry ? (
        <Svg height={CHART_HEIGHT} width={width}>
          {monthTicks.map((month) => {
            const x = geometry.toX(month * 30.4375);
            return (
              <Line
                key={`grid-${month}`}
                stroke={colors.border}
                strokeWidth={1}
                x1={x}
                x2={x}
                y1={PADDING.top}
                y2={PADDING.top + geometry.plotHeight}
              />
            );
          })}

          {series.bands.map((band) => {
            const isMedian = band.zScore === 0;
            const path = band.points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"} ${geometry.toX(point.ageDays).toFixed(2)} ${geometry
                    .toY(point.value)
                    .toFixed(2)}`
              )
              .join(" ");

            return (
              <Path
                d={path}
                key={`band-${band.zScore}`}
                fill="none"
                stroke={isMedian ? appTheme.primary : colors.border}
                strokeDasharray={isMedian ? undefined : "4 4"}
                strokeWidth={isMedian ? 2 : 1}
              />
            );
          })}

          <Path
            d={series.points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"} ${geometry.toX(point.ageDays).toFixed(2)} ${geometry
                    .toY(point.value)
                    .toFixed(2)}`
              )
              .join(" ")}
            fill="none"
            stroke={appTheme.accent}
            strokeWidth={2.5}
          />

          {series.points.map((point) => (
            <Circle
              cx={geometry.toX(point.ageDays)}
              cy={geometry.toY(point.value)}
              fill={appTheme.accent}
              key={point.id}
              r={4}
              stroke={colors.surface}
              strokeWidth={1.5}
            />
          ))}

          {monthTicks.map((month) => (
            <SvgText
              fill={colors.textMuted}
              fontFamily={fonts.dataRegular}
              fontSize={10}
              key={`tick-${month}`}
              textAnchor="middle"
              x={geometry.toX(month * 30.4375)}
              y={CHART_HEIGHT - 8}
            >
              {`${month}a`}
            </SvgText>
          ))}

          {[0, 0.5, 1].map((ratio) => {
            const value = geometry.minValue + geometry.valueSpan * ratio;
            return (
              <SvgText
                fill={colors.textMuted}
                fontFamily={fonts.dataRegular}
                fontSize={10}
                key={`value-${ratio}`}
                textAnchor="start"
                x={4}
                y={geometry.toY(value) + 3}
              >
                {value.toFixed(1)}
              </SvgText>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: CHART_HEIGHT }} />
      )}

      <View style={styles.legend}>
        <LegendItem color={appTheme.accent} label="Bebeğin" solid />
        <LegendItem color={appTheme.primary} label="%50 (ortanca)" solid />
        <LegendItem color={colors.border} label="%3 – %97 aralığı" />
      </View>
      <Text style={styles.axisNote}>
        Yatay eksen ay, dikey eksen {unit}. Eğriler Dünya Sağlık Örgütü büyüme
        standartlarıdır.
      </Text>
    </View>
  );
}

function LegendItem({
  color,
  label,
  solid
}: {
  color: string;
  label: string;
  solid?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: solid ? color : "transparent", borderColor: color }
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  legendSwatch: {
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 10,
    width: 10
  },
  legendLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13
  },
  axisNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  }
});
