import type { DimensionValue } from "react-native";
import { Fragment, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import { colors } from "@/theme";

export type ThreadMarker = {
  color?: string;
  kind: "current" | "knot" | "loop";
  position: number;
};

type ThreadVariant = "progress" | "chart";

type ThreadProps = {
  accessibilityLabel?: string;
  animated?: boolean;
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
  progress: "M8 48 C84 64 142 18 216 30 C272 39 305 30 336 18",
  chart: "M4 60 C40 52 52 28 88 36 C122 44 134 18 170 24 C212 31 210 70 252 54 C288 40 300 24 340 32"
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const chartAnchors = [
  { position: 0, y: 60 },
  { position: 0.25, y: 36 },
  { position: 0.5, y: 24 },
  { position: 0.75, y: 54 },
  { position: 1, y: 32 }
];

function cubicPoint(
  start: { x: number; y: number },
  control1: { x: number; y: number },
  control2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const inverse = 1 - t;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * control1.x +
      3 * inverse * t ** 2 * control2.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * control1.y +
      3 * inverse * t ** 2 * control2.y +
      t ** 3 * end.y
  };
}

function getMarkerPoint(variant: ThreadVariant, position: number) {
  if (variant === "progress") {
    const clamped = Math.max(0, Math.min(1, position));
    const split = 208 / 328;

    return clamped <= split
      ? cubicPoint(
          { x: 8, y: 48 },
          { x: 84, y: 64 },
          { x: 142, y: 18 },
          { x: 216, y: 30 },
          clamped / split
        )
      : cubicPoint(
          { x: 216, y: 30 },
          { x: 272, y: 39 },
          { x: 305, y: 30 },
          { x: 336, y: 18 },
          (clamped - split) / (1 - split)
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
  return {
    x: 4 + position * 336,
    y: lower.y + (upper.y - lower.y) * ratio
  };
}

export function Thread({
  accessibilityLabel,
  animated = false,
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
  const dashLength = variant === "progress" ? 372 : 390;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const isProgress = semantic !== "timeline";
  const reducedMotion = useReducedMotion();
  const drawProgress = useSharedValue(
    animated && !reducedMotion ? 0 : clampedProgress
  );
  const markerReveal = useSharedValue(animated && !reducedMotion ? 0 : 1);

  useEffect(() => {
    if (!animated || reducedMotion) {
      drawProgress.value = clampedProgress;
      markerReveal.value = 1;
      return;
    }

    drawProgress.value = withTiming(clampedProgress, {
      duration: 920,
      easing: Easing.out(Easing.exp)
    });
    markerReveal.value = withDelay(
      580,
      withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.exp)
      })
    );
  }, [animated, clampedProgress, drawProgress, markerReveal, reducedMotion]);

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: dashLength * (1 - drawProgress.value)
  }));
  const currentHaloProps = useAnimatedProps(() => ({
    opacity: markerReveal.value * 0.22,
    r: 8 + markerReveal.value * 5
  }));
  const currentDotProps = useAnimatedProps(() => ({
    opacity: markerReveal.value,
    r: 3 + markerReveal.value * 3
  }));

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
        <AnimatedPath
          animatedProps={progressProps}
          d={paths[variant]}
          fill="none"
          stroke={color}
          strokeDasharray={`${dashLength}, ${dashLength}`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        {markers.map((marker, index) => {
          const position = Math.max(0, Math.min(1, marker.position));
          const { x, y } = getMarkerPoint(variant, position);
          const markerColor = marker.color ?? color;

          if (marker.kind === "current") {
            return (
              <Fragment key={`${marker.kind}-${marker.position}-${index}`}>
                <AnimatedCircle
                  animatedProps={currentHaloProps}
                  cx={x}
                  cy={y}
                  fill={markerColor}
                />
                <AnimatedCircle
                  animatedProps={currentDotProps}
                  cx={x}
                  cy={y}
                  fill={markerColor}
                  stroke={colors.surfaceStrong}
                  strokeWidth={3}
                />
              </Fragment>
            );
          }

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
