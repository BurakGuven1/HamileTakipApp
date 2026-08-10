import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RhythmSegment, SleepEventLike } from "./model";
import { sleepRhythmColors as palette } from "./palette";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SleepRhythmRing({
  events,
  reducedMotion,
  segments,
  size
}: {
  events: SleepEventLike[];
  reducedMotion: boolean;
  segments: RhythmSegment[];
  size: number;
}) {
  const center = size / 2;
  const radius = size * 0.31;
  const labelRadius = radius + 34;
  const visibleEvents = useMemo(() => {
    const segmentStart = segments[0]?.startMs ?? Date.now() - 86_400_000;
    const segmentEnd = segments.at(-1)?.endMs ?? Date.now();
    const scoped = events.filter((event) => {
      const occurred = Date.parse(event.occurred_at);
      return occurred >= segmentStart && occurred <= segmentEnd;
    });
    return pickSpacedEvents(scoped, 6);
  }, [events, segments]);
  const summary = ringAccessibilitySummary(segments);

  return (
    <View
      accessibilityLabel={summary}
      accessibilityRole="image"
      accessible
      style={{ height: size, width: size }}
    >
      <Svg height={size} width={size}>
        <G>
          {Array.from({ length: 48 }, (_, index) => {
            const angle = -90 + index * 7.5;
            const outer = polar(center, center, radius - 27, angle);
            const inner = polar(center, center, radius - (index % 4 === 0 ? 38 : 34), angle);
            return (
              <Line
                key={index}
                stroke={palette.ticks}
                strokeWidth={index % 4 === 0 ? 1.8 : 1.2}
                x1={inner.x}
                x2={outer.x}
                y1={inner.y}
                y2={outer.y}
              />
            );
          })}
          <Circle
            cx={center}
            cy={center}
            fill="none"
            r={radius}
            stroke={palette.border}
            strokeWidth={30}
          />
          {segments.map((segment) => (
            <AnimatedSegment
              key={segment.id}
              center={center}
              radius={radius}
              reducedMotion={reducedMotion}
              segment={segment}
            />
          ))}
          {visibleEvents.map((event) => {
            const angle = eventAngle(event, segments);
            if (angle === null) return null;
            const dot = polar(center, center, radius + 1, angle);
            const label = polar(center, center, labelRadius, angle);
            const color = event.event_type === "sleep" ? palette.navy : palette.awake;
            return (
              <G key={event.id}>
                <Circle cx={dot.x} cy={dot.y} fill={color} r={4.5} />
                <Line
                  stroke={color}
                  strokeWidth={1}
                  x1={dot.x}
                  x2={label.x}
                  y1={dot.y}
                  y2={label.y}
                />
                <SvgText
                  fill={palette.text}
                  fontSize={12}
                  fontWeight="700"
                  textAnchor={label.x < center - 10 ? "end" : label.x > center + 10 ? "start" : "middle"}
                  x={label.x}
                  y={label.y + (label.y < center ? -3 : 13)}
                >
                  {formatClock(event.occurred_at)}
                </SvgText>
              </G>
            );
          })}
          {segments.length ? (
            <ActivePoint
              center={center}
              color={segments.at(-1)?.type === "sleep" ? palette.navy : palette.awake}
              radius={radius}
              reducedMotion={reducedMotion}
            />
          ) : null}
        </G>
      </Svg>
      <View pointerEvents="none" style={styles.centerCopy}>
        <Text style={styles.centerValue}>24 saat</Text>
        <Text style={styles.centerLabel}>Günün ritmi</Text>
      </View>
    </View>
  );
}

function AnimatedSegment({
  center,
  radius,
  reducedMotion,
  segment
}: {
  center: number;
  radius: number;
  reducedMotion: boolean;
  segment: RhythmSegment;
}) {
  const length = Math.max(1, radius * Math.abs(segment.endAngle - segment.startAngle) * Math.PI / 180);
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) });
  }, [progress, reducedMotion, segment.endAngle, segment.startAngle]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value)
  }));
  const color = segment.type === "sleep" ? palette.navy : palette.awake;
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={arcPath(center, center, radius, segment.startAngle + 1.2, segment.endAngle - 1.2)}
      fill="none"
      stroke={color}
      strokeDasharray={`${length} ${length}`}
      strokeLinecap="round"
      strokeWidth={30}
    />
  );
}

function ActivePoint({
  center,
  color,
  radius,
  reducedMotion
}: {
  center: number;
  color: string;
  radius: number;
  reducedMotion: boolean;
}) {
  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = reducedMotion
      ? 0.55
      : withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.45, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        );
  }, [glow, reducedMotion]);
  const point = polar(center, center, radius, 270);
  const animatedProps = useAnimatedProps(() => ({
    opacity: glow.value,
    r: 8 + glow.value * 3
  }));
  return (
    <>
      <AnimatedCircle animatedProps={animatedProps} cx={point.x} cy={point.y} fill={color} />
      <Circle cx={point.x} cy={point.y} fill={palette.ivory} r={6} stroke={color} strokeWidth={3} />
    </>
  );
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const delta = Math.max(0, endAngle - startAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${delta > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function eventAngle(event: SleepEventLike, segments: RhythmSegment[]) {
  const first = segments[0];
  const last = segments.at(-1);
  if (!first || !last || last.endMs <= first.startMs) return null;
  const occurred = Date.parse(event.occurred_at);
  if (occurred < first.startMs || occurred > last.endMs) return null;
  return -90 + ((occurred - first.startMs) / (last.endMs - first.startMs)) * 360;
}

function pickSpacedEvents<T extends SleepEventLike>(events: T[], limit: number) {
  if (events.length <= limit) return events;
  const picked: T[] = [];
  const step = (events.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) {
    const event = events[Math.round(index * step)];
    if (event) picked.push(event);
  }
  return [...new Map(picked.map((event) => [event.id, event])).values()];
}

function ringAccessibilitySummary(segments: RhythmSegment[]) {
  const sleepMinutes = Math.round(
    segments
      .filter((segment) => segment.type === "sleep")
      .reduce((total, segment) => total + segment.endMs - segment.startMs, 0) / 60_000
  );
  const awakeMinutes = Math.round(
    segments
      .filter((segment) => segment.type === "wake")
      .reduce((total, segment) => total + segment.endMs - segment.startMs, 0) / 60_000
  );
  return `Son 24 saatin uyku ritmi. Yaklaşık ${Math.floor(sleepMinutes / 60)} saat ${sleepMinutes % 60} dakika uyku ve ${Math.floor(awakeMinutes / 60)} saat ${awakeMinutes % 60} dakika uyanıklık kaydedildi.`;
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit"
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  centerCopy: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  centerLabel: { color: palette.muted, fontFamily: "Manrope_400Regular", fontSize: 17 },
  centerValue: { color: palette.text, fontFamily: "Manrope_700Bold", fontSize: 28 }
});
