import { HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
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

export type NightShiftLiveActivityProps = {
  babyName: string;
  caregiverName: string;
  startedAtMs: number;
  plannedEndAtMs: number;
  status: "active" | "completed";
  statusLine: string;
  nextReminderLine: string;
};

function NightShiftLiveActivity(
  props: NightShiftLiveActivityProps,
  environment: LiveActivityEnvironment
) {
  "widget";

  const isDark = environment.colorScheme === "dark";
  const accent = isDark ? "#A9CFB8" : "#557664";
  const primary = isDark ? "#F5F2ED" : "#2E2931";
  const secondary = isDark ? "#C7D0CB" : "#625C66";
  const backgroundColor = isDark ? "#14211C" : "#EAF0EC";
  const startedAt = new Date(props?.startedAtMs || Date.now());
  const plannedEndAt = new Date(
    props?.plannedEndAtMs || Date.now() + 60 * 60 * 1000
  );
  const isCompleted = props?.status === "completed";
  const babyName = props?.babyName || "Bebek";
  const statusLine = props?.statusLine || "Gece vardiyası devam ediyor";
  const nextReminderLine = props?.nextReminderLine || "Planlı alarm yok";

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
            ANNE+ · GECE VARDİYASI
          </Text>
        </HStack>
        <HStack spacing={10}>
          <VStack spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: "topLeading" })]}>
            <Text modifiers={[font({ size: 19, weight: "bold" }), foregroundStyle(primary), lineLimit(1)]}>
              {babyName}
            </Text>
            <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(primary), lineLimit(1)]}>
              {statusLine}
            </Text>
          </VStack>
          {isCompleted ? (
            <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle(accent)]}>
              Tamamlandı
            </Text>
          ) : (
            <Text
              timerInterval={{ lower: startedAt, upper: plannedEndAt }}
              countsDown
              modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(accent)]}
            />
          )}
        </HStack>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>
          {nextReminderLine}
        </Text>
      </VStack>
    ),
    compactLeading: <Image systemName="moon.stars.fill" color={accent} />,
    compactTrailing: isCompleted ? (
      <Image systemName="checkmark.circle.fill" color={accent} />
    ) : (
      <Text
        timerInterval={{ lower: startedAt, upper: plannedEndAt }}
        countsDown
        modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(primary)]}
      />
    ),
    minimal: <Image systemName={isCompleted ? "checkmark.circle.fill" : "moon.stars.fill"} color={accent} />,
    expandedLeading: (
      <VStack spacing={4} modifiers={[padding({ all: 10 })]}>
        <Image systemName="moon.stars.fill" color={accent} />
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
            timerInterval={{ lower: startedAt, upper: plannedEndAt }}
            countsDown
            modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(accent)]}
          />
        )}
        <Text modifiers={[font({ size: 10 }), foregroundStyle(secondary)]}>
          kalan
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
        <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle(primary), lineLimit(1)]}>
          {babyName} · {statusLine}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>
          {nextReminderLine}
        </Text>
      </VStack>
    )
  };
}

export default createLiveActivity<NightShiftLiveActivityProps>(
  "NightShiftLiveActivity",
  NightShiftLiveActivity
);
