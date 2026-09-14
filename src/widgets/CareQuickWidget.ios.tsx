import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
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
  // DESIGN.md token'ları: Krem Zemin / Gece Eriği yüzeyler, Ada Yeşili vurgu.
  const isDark = environment.colorScheme === "dark";
  const backgroundColor = isDark ? "#211D24" : "#F9F4F0";
  const primaryText = isDark ? "#F5F1EC" : "#372F3D";
  const secondaryText = isDark ? "#C3BAC2" : "#655F57";
  const accentText = isDark ? "#8FBBA2" : "#3F6F59";
  const actionBackground = isDark ? "#29242C" : "#FFFCF8";
  const snapshot = {
    subjectName: props?.subjectName || "Anne+",
    headline: props?.headline || "Bugün yeni kayıt yok",
    detail:
      props?.detail || "İlk kaydı eklemek için dokun.",
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
    // Kilit ekranı "vibrant" modda çizer: sistem her rengi tek bir maskeye
    // düşürür, bu yüzden burada RENK DEĞİL yalnızca ağırlık ve boyut
    // hiyerarşisi kullanılır. foregroundStyle eklemek okunurluğu bozar.
    return (
      <VStack
        spacing={2}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "topLeading" }),
          ...openModifiers
        ]}
      >
        <HStack spacing={4}>
          <Image systemName="heart.text.square.fill" />
          <Text modifiers={[font({ size: 11, weight: "semibold" }), lineLimit(1)]}>
            {snapshot.subjectName}
          </Text>
        </HStack>
        <Text modifiers={[font({ size: 15, weight: "bold" }), lineLimit(2)]}>
          {headline}
        </Text>
        <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{detail}</Text>
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

  // systemMedium küçük boyutun büyütülmüş hali değildir: burada yer olduğu
  // için iki durum aynı anda görünür ve düğmeye gerek kalmaz. Küçük boyutta
  // ikinci duruma ancak düğmeyle geçilir.
  return (
    <VStack
      spacing={9}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        padding({ all: 16 }),
        containerBackground(backgroundColor, "widget"),
        ...openModifiers
      ]}
    >
      <HStack spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
        <Image systemName="heart.text.square.fill" color={accentText} />
        <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(accentText), lineLimit(1)]}>
          ŞU AN NE ÖNEMLİ? · {snapshot.subjectName}
        </Text>
        <Spacer />
      </HStack>
      <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(primaryText), lineLimit(2)]}>
        {snapshot.headline}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(secondaryText), lineLimit(2)]}>
        {snapshot.detail}
      </Text>
      {hasAlternate ? (
        <HStack
          spacing={7}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({ vertical: 7, horizontal: 10 }),
            background(actionBackground),
            cornerRadius(12)
          ]}
        >
          <Image systemName="circle.fill" color={accentText} />
          <VStack spacing={1} modifiers={[frame({ maxWidth: Infinity, alignment: "topLeading" })]}>
            <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(primaryText), lineLimit(1)]}>
              {snapshot.alternateHeadline}
            </Text>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(secondaryText), lineLimit(1)]}>
              {snapshot.alternateDetail}
            </Text>
          </VStack>
        </HStack>
      ) : null}
    </VStack>
  );
}

export default createWidget<CareQuickWidgetProps>("CareQuickWidget", CareQuickWidget);
