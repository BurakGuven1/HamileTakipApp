import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
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

/** Dynamic Island'daki "Vardiyayı bitir" düğmesinin hedefi. */
export const NIGHT_SHIFT_FINISH_TARGET = "night-shift-finish";

function NightShiftLiveActivity(
  props: NightShiftLiveActivityProps,
  environment: LiveActivityEnvironment
) {
  "widget";

  // DESIGN.md: gece vardiyası "ilerleyen görev" olduğu için Ada Yeşili taşır;
  // koyu temada aynı rol ışıklılığı yükseltilmiş karşılığıyla çizilir.
  const isDark = environment.colorScheme === "dark";
  const accent = isDark ? "#8FBBA2" : "#3F6F59"; // Ada Yeşili
  const primary = isDark ? "#F5F1EC" : "#372F3D"; // Gece Eriği
  const secondary = isDark ? "#C3BAC2" : "#655F57"; // Sis Grisi
  const backgroundColor = isDark ? "#211D24" : "#F9F4F0"; // koyu yüzey / Krem Zemin
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
              modifiers={[
                font({ size: 30, weight: "bold", design: "rounded" }),
                monospacedDigit(),
                foregroundStyle(accent)
              ]}
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
        modifiers={[
          font({ size: 13, weight: "bold" }),
          monospacedDigit(),
          foregroundStyle(accent)
        ]}
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
    expandedCenter: (
      <VStack spacing={2}>
        <Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(primary), lineLimit(1)]}>
          {babyName}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>
          {props?.caregiverName || "Gece vardiyası"}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <HStack spacing={10} modifiers={[padding({ horizontal: 10, vertical: 6 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary), lineLimit(1)]}>
          {nextReminderLine}
        </Text>
        <Spacer />
        {isCompleted ? null : (
          // iOS 17+ LiveActivityIntent: vardiyayı kilit ekranından bitirir.
          <Button
            label="Vardiyayı bitir"
            systemImage="checkmark.circle.fill"
            target={NIGHT_SHIFT_FINISH_TARGET}
            modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(accent)]}
          />
        )}
      </HStack>
    )
  };
}

export default createLiveActivity<NightShiftLiveActivityProps>(
  "NightShiftLiveActivity",
  NightShiftLiveActivity
);
