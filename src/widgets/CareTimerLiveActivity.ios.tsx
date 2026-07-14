import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import { background, cornerRadius, font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

export type CareTimerLiveActivityProps = {
  babyName: string;
  leftStartedAt: string | null;
  rightStartedAt: string | null;
  startedAt: string;
  timerType: "breastfeeding" | "pumping" | "sleep";
};

function runningTimer(startedAt: string, size = 18) {
  const start = new Date(startedAt);
  return (
    <Text
      countsDown={false}
      modifiers={[font({ size, weight: "bold" }), foregroundStyle("#372F3D")]}
      timerInterval={{ lower: start, upper: new Date(start.getTime() + 8 * 60 * 60 * 1000) }}
    />
  );
}

function CareTimerLiveActivity(props: CareTimerLiveActivityProps, _environment: LiveActivityEnvironment) {
  "widget";
  const title = props.timerType === "pumping" ? "Sağım sürüyor" : props.timerType === "sleep" ? "Uyku sürüyor" : "Emzirme sürüyor";
  const compactLetter = props.timerType === "pumping" ? "S" : props.timerType === "sleep" ? "U" : "E";
  const banner = (
    <VStack spacing={8} modifiers={[padding({ all: 16 }), background("#EAF0EC"), cornerRadius(18)]}>
      <HStack modifiers={[frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#6E8F7C")]}>{props.babyName} · {title}</Text>
      </HStack>
      {props.timerType === "pumping" ? (
        <HStack spacing={18}>
          <VStack spacing={2}><Text modifiers={[font({ size: 11 }), foregroundStyle("#6F6673")]}>Sol</Text>{props.leftStartedAt ? runningTimer(props.leftStartedAt) : <Text>—</Text>}</VStack>
          <VStack spacing={2}><Text modifiers={[font({ size: 11 }), foregroundStyle("#6F6673")]}>Sağ</Text>{props.rightStartedAt ? runningTimer(props.rightStartedAt) : <Text>—</Text>}</VStack>
        </HStack>
      ) : runningTimer(props.startedAt, 24)}
      <Text modifiers={[font({ size: 11 }), foregroundStyle("#6F6673")]}>Anne+ zamanlayıcısı ekran kapalıyken de devam eder.</Text>
    </VStack>
  );

  return {
    banner,
    compactLeading: <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle("#A86470")]}>{compactLetter}</Text>,
    compactTrailing: runningTimer(props.startedAt, 13),
    minimal: <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle("#A86470")]}>{compactLetter}</Text>,
    expandedLeading: <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle("#6E8F7C")]}>{props.babyName}</Text>,
    expandedCenter: <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#372F3D")]}>{title}</Text>,
    expandedTrailing: runningTimer(props.startedAt, 13),
    expandedBottom: banner
  };
}

export default createLiveActivity("CareTimerLiveActivity", CareTimerLiveActivity);
