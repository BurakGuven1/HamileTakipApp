import { Button, HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type CareQuickWidgetProps = {
  subjectName: string;
  headline: string;
  detail: string;
  alternateHeadline: string;
  alternateDetail: string;
  alternateDestination: string;
  destination: string;
  showAlternate: boolean;
};

function CareQuickWidget(
  props: CareQuickWidgetProps,
  environment: WidgetEnvironment
) {
  "widget";

  // Widget code runs in an isolated runtime. Keep every runtime value inside
  // the function or receive it through props.
  const isDark = environment.colorScheme === "dark";
  const backgroundColor = isDark ? "#17231E" : "#EAF0EC";
  const primaryText = isDark ? "#F7F3EE" : "#302B34";
  const secondaryText = isDark ? "#C8D2CC" : "#625C66";
  const accentText = isDark ? "#A9CFB8" : "#557664";
  const actionBackground = isDark ? "#304139" : "#FFFFFFE8";
  const snapshot = {
    subjectName: props?.subjectName || "Anne+",
    headline: props?.headline || "Bugün yeni kayıt yok",
    detail:
      props?.detail || "İstersen yalnızca son durumu görmek için dokun.",
    alternateHeadline: props?.alternateHeadline || "",
    alternateDetail: props?.alternateDetail || "",
    alternateDestination: props?.alternateDestination || "",
    destination: props?.destination || "hamiletakip://home",
    showAlternate: Boolean(props?.showAlternate)
  };
  const hasAlternate = Boolean(snapshot.alternateHeadline);
  const showingAlternate = hasAlternate && snapshot.showAlternate;
  const headline = showingAlternate
    ? snapshot.alternateHeadline
    : snapshot.headline;
  const detail = showingAlternate
    ? snapshot.alternateDetail
    : snapshot.detail;
  const destination = showingAlternate && snapshot.alternateDestination
    ? snapshot.alternateDestination
    : snapshot.destination;
  const openModifiers = [widgetURL(destination)];
  const toggleModifiers = [
    buttonStyle("plain"),
    padding({ vertical: 6, horizontal: 9 }),
    background(actionBackground),
    cornerRadius(10),
    foregroundStyle(primaryText),
    font({ size: 10, weight: "semibold" })
  ];

  if (environment.widgetFamily === "accessoryInline") {
    return (
      <Text modifiers={[font({ weight: "semibold" }), ...openModifiers]}>
        Anne+ · {headline}
      </Text>
    );
  }

  if (environment.widgetFamily === "accessoryRectangular") {
    return (
      <VStack spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: "topLeading" }), ...openModifiers]}>
        <Text modifiers={[font({ size: 11, weight: "bold" }), lineLimit(1)]}>
          Anne+ · {snapshot.subjectName}
        </Text>
        <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(2)]}>
          {headline}
        </Text>
        <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>{detail}</Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === "systemSmall") {
    return (
      <VStack
        spacing={7}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
          padding({ all: 13 }),
          containerBackground(backgroundColor, "widget"),
          ...openModifiers
        ]}
      >
        <Text modifiers={[font({ size: 11, weight: "bold" }), foregroundStyle(accentText), lineLimit(1)]}>
          ŞU AN NE ÖNEMLİ? · {snapshot.subjectName}
        </Text>
        <Text modifiers={[font({ size: 17, weight: "bold" }), foregroundStyle(primaryText), lineLimit(3)]}>
          {headline}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondaryText), lineLimit(2)]}>
          {detail}
        </Text>
        {hasAlternate ? (
          <Button
            label={showingAlternate ? "İlk durumu göster" : "Diğer durumu göster"}
            target="toggle-context"
            onPress={() => ({ showAlternate: !snapshot.showAlternate })}
            modifiers={toggleModifiers}
          />
        ) : null}
      </VStack>
    );
  }

  return (
    <VStack
      spacing={10}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        padding({ all: 16 }),
        containerBackground(backgroundColor, "widget"),
        ...openModifiers
      ]}
    >
      <HStack modifiers={[frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(accentText)]}>
          ŞU AN NE ÖNEMLİ? · {snapshot.subjectName}
        </Text>
      </HStack>
      <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(primaryText), lineLimit(2)]}>
        {headline}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(secondaryText), lineLimit(2)]}>
        {detail}
      </Text>
      {hasAlternate ? (
        <Button
          label={showingAlternate ? "Öncelikli duruma dön" : "Diğer durumu göster"}
          target="toggle-context"
          onPress={() => ({ showAlternate: !snapshot.showAlternate })}
          modifiers={toggleModifiers}
        />
      ) : null}
    </VStack>
  );
}

export default createWidget<CareQuickWidgetProps>("CareQuickWidget", CareQuickWidget);
