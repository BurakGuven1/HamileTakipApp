import { HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import type { SFSymbol } from "sf-symbols-typescript";
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding
} from "@expo/ui/swift-ui/modifiers";
import {
  createLiveActivity,
  type LiveActivityEnvironment
} from "expo-widgets";

export type CareTimerLiveActivityProps = {
  babyName: string;
  sideLine: string;
  startedAtMs: number;
  status: "active" | "completed";
  summaryLine: string;
  timerType: "breastfeeding" | "pumping" | "sleep";
  title: string;
};

// The timer counts up with no end in sight, so the interval needs an upper
// bound that will never be reached during a feed or a nap.
const OPEN_ENDED_HOURS = 12;

const SYSTEM_ICONS: Record<CareTimerLiveActivityProps["timerType"], SFSymbol> = {
  breastfeeding: "drop.fill",
  pumping: "waveform.path.ecg",
  sleep: "moon.zzz.fill"
};

function CareTimerLiveActivity(
  props: CareTimerLiveActivityProps,
  environment: LiveActivityEnvironment
) {
  "widget";

  const isDark = environment.colorScheme === "dark";
  const accent = isDark ? "#E9B7C4" : "#A94F60";
  const primary = isDark ? "#F5F2ED" : "#2E2931";
  const secondary = isDark ? "#CFC6CB" : "#625C66";
  const backgroundColor = isDark ? "#221A1D" : "#F7EDEF";

  const startedAt = new Date(props?.startedAtMs || Date.now());
  const openEndedUpper = new Date(
    (props?.startedAtMs || Date.now()) + OPEN_ENDED_HOURS * 60 * 60 * 1000
  );
  const isCompleted = props?.status === "completed";
  const babyName = props?.babyName || "Bebek";
  const title = props?.title || "Bakım sürüyor";
  const sideLine = props?.sideLine || "";
  const summaryLine = props?.summaryLine || "";
  const icon: SFSymbol = SYSTEM_ICONS[props?.timerType] ?? "drop.fill";

  return {
    banner: (
      <VStack
        spacing={9}
        modifiers={[
          padding({ all: 15 }),
          activityBackgroundTint(backgroundColor)
        ]}
      >
        <HStack modifiers={[frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(accent)]}>
            ANNE+ · {title.toUpperCase()}
          </Text>
        </HStack>
        <HStack spacing={10}>
          <VStack spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: "topLeading" })]}>
            <Text modifiers={[font({ size: 19, weight: "bold" }), foregroundStyle(primary), lineLimit(1)]}>
              {babyName}
            </Text>
            <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(secondary), lineLimit(1)]}>
              {isCompleted ? summaryLine : sideLine}
            </Text>
          </VStack>
          {isCompleted ? (
            <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle(accent)]}>
              Kaydedildi
            </Text>
          ) : (
            // No countsDown: a feed or a nap counts up from when it started.
            <Text
              timerInterval={{ lower: startedAt, upper: openEndedUpper }}
              modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(accent)]}
            />
          )}
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: isCompleted ? (
      <Image systemName="checkmark.circle.fill" color={accent} />
    ) : (
      <Text
        timerInterval={{ lower: startedAt, upper: openEndedUpper }}
        modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(primary)]}
      />
    ),
    minimal: (
      <Image
        systemName={isCompleted ? "checkmark.circle.fill" : icon}
        color={accent}
      />
    ),
    expandedLeading: (
      <VStack spacing={4} modifiers={[padding({ all: 10 })]}>
        <Image systemName={icon} color={accent} />
        <Text modifiers={[font({ size: 11, weight: "bold" }), foregroundStyle(primary)]}>
          Anne+
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack spacing={3} modifiers={[padding({ all: 10 })]}>
        {isCompleted ? (
          <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(accent)]}>
            Bitti
          </Text>
        ) : (
          <Text
            timerInterval={{ lower: startedAt, upper: openEndedUpper }}
            modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(accent)]}
          />
        )}
        <Text modifiers={[font({ size: 10 }), foregroundStyle(secondary)]}>
          {isCompleted ? "" : "sürüyor"}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
        <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle(primary), lineLimit(1)]}>
          {babyName} · {title}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>
          {isCompleted ? summaryLine : sideLine}
        </Text>
      </VStack>
    )
  };
}

export default createLiveActivity<CareTimerLiveActivityProps>(
  "CareTimerLiveActivity",
  CareTimerLiveActivity
);
