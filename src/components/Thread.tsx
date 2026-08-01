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
type Point = { x: number; y: number };
type CubicSegment = {
  control1: Point;
  control2: Point;
  end: Point;
  start: Point;
};

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

const pathSegments: Record<ThreadVariant, CubicSegment[]> = {
  progress: [
    {
      start: { x: 8, y: 48 },
      control1: { x: 84, y: 64 },
      control2: { x: 142, y: 18 },
      end: { x: 216, y: 30 }
    },
    {
      start: { x: 216, y: 30 },
      control1: { x: 272, y: 39 },
      control2: { x: 305, y: 30 },
      end: { x: 336, y: 18 }
    }
  ],
  chart: [
    {
      start: { x: 4, y: 60 },
      control1: { x: 40, y: 52 },
      control2: { x: 52, y: 28 },
      end: { x: 88, y: 36 }
    },
    {
      start: { x: 88, y: 36 },
      control1: { x: 122, y: 44 },
      control2: { x: 134, y: 18 },
      end: { x: 170, y: 24 }
    },
    {
      start: { x: 170, y: 24 },
      control1: { x: 212, y: 31 },
      control2: { x: 210, y: 70 },
      end: { x: 252, y: 54 }
    },
    {
      start: { x: 252, y: 54 },
      control1: { x: 288, y: 40 },
      control2: { x: 300, y: 24 },
      end: { x: 340, y: 32 }
    }
  ]
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function cubicPoint(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
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

function createPathMetric(segments: CubicSegment[]) {
  const samples: { distance: number; point: Point }[] = [
    { distance: 0, point: segments[0]?.start ?? { x: 0, y: 0 } }
  ];
  let distance = 0;
  let previousPoint = samples[0]!.point;

  segments.forEach((segment) => {
    for (let index = 1; index <= 120; index += 1) {
      const point = cubicPoint(
        segment.start,
        segment.control1,
        segment.control2,
        segment.end,
        index / 120
      );
      distance += Math.hypot(
        point.x - previousPoint.x,
        point.y - previousPoint.y
      );
      samples.push({ distance, point });
      previousPoint = point;
    }
  });

  return { length: distance, samples };
}

const pathMetrics: Record<ThreadVariant, ReturnType<typeof createPathMetric>> = {
  progress: createPathMetric(pathSegments.progress),
  chart: createPathMetric(pathSegments.chart)
};

function getMarkerPoint(variant: ThreadVariant, position: number) {
  const metric = pathMetrics[variant];
  const targetDistance =
    metric.length * Math.max(0, Math.min(1, position));
  let lowerIndex = 0;
  let upperIndex = metric.samples.length - 1;

  while (lowerIndex < upperIndex) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
    if (metric.samples[middleIndex]!.distance < targetDistance) {
      lowerIndex = middleIndex + 1;
    } else {
      upperIndex = middleIndex;
    }
  }

  const upper = metric.samples[lowerIndex] ?? metric.samples.at(-1)!;
  const lower = metric.samples[Math.max(0, lowerIndex - 1)] ?? upper;
  const distanceRange = upper.distance - lower.distance;
  const ratio = distanceRange
    ? (targetDistance - lower.distance) / distanceRange
    : 0;
  return {
    x: lower.point.x + (upper.point.x - lower.point.x) * ratio,
    y: lower.point.y + (upper.point.y - lower.point.y) * ratio
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
  const dashLength = pathMetrics[variant].length;
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
