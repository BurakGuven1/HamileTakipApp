import { HStack, Link, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type CareQuickWidgetProps = {
  babyName: string;
  lastFeed: string;
  lastDiaper: string;
  sleepToday: string;
};

const fallbackSnapshot: CareQuickWidgetProps = {
  babyName: "Anne+",
  lastDiaper: "Kayıt yok",
  lastFeed: "Kayıt yok",
  sleepToday: "0 dk"
};

const actionStyle = [
  padding({ vertical: 7, horizontal: 9 }),
  background("#FFFFFFCC"),
  cornerRadius(12),
  foregroundStyle("#372F3D"),
  font({ size: 11, weight: "semibold" })
];

function CareQuickWidget(
  props: CareQuickWidgetProps = fallbackSnapshot,
  environment: WidgetEnvironment
) {
  "widget";

  const snapshot = { ...fallbackSnapshot, ...props };

  if (environment.widgetFamily === "systemSmall") {
    return (
      <VStack
        spacing={8}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
          padding({ all: 14 }),
          containerBackground("#EAF0EC", "widget"),
          background("#EAF0EC")
        ]}
      >
        <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle("#6E8F7C")]}>Anne+</Text>
        <Text modifiers={[font({ size: 17, weight: "bold" }), foregroundStyle("#372F3D")]}>{snapshot.babyName}</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle("#6F6673")]}>Son beslenme: {snapshot.lastFeed}</Text>
        <Link label="Hızlı kayıt aç" destination="hamiletakip://care-journal" modifiers={actionStyle} />
      </VStack>
    );
  }

  return (
    <VStack
      spacing={10}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        padding({ all: 16 }),
        containerBackground("#EAF0EC", "widget"),
        background("#EAF0EC")
      ]}
    >
      <HStack modifiers={[frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle("#6E8F7C")]}>Anne+ · {snapshot.babyName}</Text>
      </HStack>
      <HStack spacing={14}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle("#372F3D")]}>Beslenme {snapshot.lastFeed}</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle("#372F3D")]}>Bez {snapshot.lastDiaper}</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle("#372F3D")]}>Uyku {snapshot.sleepToday}</Text>
      </HStack>
      <HStack spacing={8}>
        <Link label="Emzirme" destination="hamiletakip://care-journal?entry=breastfeeding" modifiers={actionStyle} />
        <Link label="Uyku" destination="hamiletakip://care-journal?entry=sleep" modifiers={actionStyle} />
        <Link label="Bez" destination="hamiletakip://care-journal?entry=diaper" modifiers={actionStyle} />
      </HStack>
    </VStack>
  );
}

export default createWidget<CareQuickWidgetProps>("CareQuickWidget", CareQuickWidget);
