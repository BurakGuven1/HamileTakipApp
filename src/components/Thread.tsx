import type { DimensionValue } from "react-native";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/theme";

export type ThreadMarker = {
  color?: string;
  kind: "knot" | "loop";
  position: number;
};

type ThreadVariant = "progress" | "chart";

type ThreadProps = {
  accessibilityLabel?: string;
  color?: string;
  height?: number;
  markers?: ThreadMarker[];
  mutedColor?: string;
  progress?: number;
  semantic?: "progress" | "timeline";
  variant?: ThreadVariant;
  width?: DimensionValue;
};

const paths: Record<ThreadVariant, string> = {
  progress: "M4 24 C42 6 78 42 116 24 S190 6 228 24 S302 42 340 24",
  chart: "M4 60 C40 52 52 28 88 36 C122 44 134 18 170 24 C212 31 210 70 252 54 C288 40 300 24 340 32"
};

const chartAnchors = [
  { position: 0, y: 60 },
  { position: 0.25, y: 36 },
  { position: 0.5, y: 24 },
  { position: 0.75, y: 54 },
  { position: 1, y: 32 }
];

function getMarkerY(variant: ThreadVariant, position: number) {
  if (variant === "progress") {
    const scaled = Math.max(0, Math.min(0.999_999, position)) * 3;
    const segment = Math.floor(scaled);
    const t = scaled - segment;
    const points = [
      [24, 6, 42, 24],
      [24, 6, 6, 24],
      [24, 42, 42, 24]
    ][segment] ?? [24, 24, 24, 24];
    const inverse = 1 - t;

    return (
      inverse ** 3 * points[0]! +
      3 * inverse ** 2 * t * points[1]! +
      3 * inverse * t ** 2 * points[2]! +
      t ** 3 * points[3]!
    );
  }

  const index = chartAnchors.findIndex((anchor) => anchor.position >= position);
  const upper =
    chartAnchors[
      Math.max(1, index === -1 ? chartAnchors.length - 1 : index)
    ] ?? chartAnchors[chartAnchors.length - 1]!;
  const lower =
    chartAnchors[Math.max(0, chartAnchors.indexOf(upper) - 1)] ??
    chartAnchors[0]!;
  const range = upper.position - lower.position || 1;
  const ratio = (position - lower.position) / range;
  return lower.y + (upper.y - lower.y) * ratio;
}

export function Thread({
  accessibilityLabel,
  color = colors.primary,
  height = 56,
  markers = [],
  mutedColor = colors.border,
  progress = 1,
  semantic,
  variant = "progress",
  width = "100%"
}: ThreadProps) {
  const viewBox = "0 0 344 88";
  const strokeWidth = 3;
  const dashLength = 360;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isProgress = semantic !== "timeline";

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isProgress ? "progressbar" : "image"}
      accessibilityValue={
        !isProgress
          ? undefined
          : { min: 0, max: 100, now: Math.round(clampedProgress * 100) }
      }
      style={[styles.frame, { height, width }]}
    >
      <Svg height="100%" pointerEvents="none" viewBox={viewBox} width="100%">
        <Path
          d={paths[variant]}
          fill="none"
          stroke={mutedColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d={paths[variant]}
          fill="none"
          stroke={color}
          strokeDasharray={`${dashLength * clampedProgress}, ${dashLength}`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        {markers.map((marker, index) => {
          const position = Math.max(0, Math.min(1, marker.position));
          const x = 4 + position * 336;
          const y = getMarkerY(variant, position);
          const markerColor = marker.color ?? color;

          return marker.kind === "knot" ? (
            <Circle
              key={`${marker.kind}-${marker.position}-${index}`}
              cx={x}
              cy={y}
              fill={markerColor}
              r={6}
              stroke={colors.surfaceStrong}
              strokeWidth={3}
            />
          ) : (
            <Circle
              key={`${marker.kind}-${marker.position}-${index}`}
              cx={x}
              cy={y}
              fill={colors.surfaceStrong}
              r={7}
              stroke={markerColor}
              strokeWidth={3}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden"
  }
});
