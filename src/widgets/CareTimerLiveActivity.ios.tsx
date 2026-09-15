import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import type { SFSymbol } from "sf-symbols-typescript";
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

export type CareTimerLiveActivityProps = {
  babyName: string;
  sideLine: string;
  /** "03:12" — sabahın üçünde "ne zaman başladım" sorusunun tek cevabı. */
  startedClock: string;
  startedAtMs: number;
  status: "active" | "completed";
  summaryLine: string;
  timerType: "breastfeeding" | "pumping" | "sleep";
  title: string;
};

/**
 * Live Activity'nin Dynamic Island'daki "Bitir" düğmesinin hedefi. Uygulama
 * tarafı bu dizeyi `addUserInteractionListener` içinde tanır; bkz.
 * src/features/care-journal/careTimerLiveActivity.ts.
 */
export const CARE_TIMER_FINISH_TARGET = "care-timer-finish";

// Sayaç yukarı doğru sayar ve bitişi belli değildir, bu yüzden aralığın bir
// emzirme ya da uyku sırasında asla ulaşılamayacak bir üst sınırı olması
// gerekir. ActivityKit sayacı sistem tarafında çizer: saniyede bir güncelleme
// göndermiyoruz, bu pil ve ActivityKit hız limiti açısından kritik.
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

  // SwiftUI'da `.frame(maxWidth: .infinity)` karşılığı. Doğrudan `Infinity`
  // yazılamaz: modifier'lar yerel tarafa JSON ile geçiyor ve
  // `JSON.stringify(Infinity)` "null" üretiyor, bu da çerçeveyi sıfır
  // genişliğe düşürüp rozeti boş bir kutuya çeviriyor.
  const EXPAND = 100000;

  // Kilit ekranı Live Activity'yi kendi koyu zemininde çizer, bu yüzden
  // `colorScheme` açık gelse bile metnin koyu zeminde okunur kalması gerekir.
  // Rozet tek bir koyu yüzey kullanır ve kontrastı kendisi garanti eder.
  const accent = "#FF9BBE"; // Gül
  const primary = "#F4F0FF"; // Açık mürekkep
  const secondary = "#A9A2BF"; // Soluk mürekkep
  const backgroundColor = "#1A1426"; // Koyu yüzey

  const startedAt = new Date(props?.startedAtMs || Date.now());
  const openEndedUpper = new Date(
    (props?.startedAtMs || Date.now()) + OPEN_ENDED_HOURS * 60 * 60 * 1000
  );
  const isCompleted = props?.status === "completed";
  const babyName = props?.babyName || "Bebek";
  const title = props?.title || "Bakım sürüyor";
  const sideLine = props?.sideLine || "";
  const summaryLine = props?.summaryLine || "";
  const startedClock = props?.startedClock || "";
  const icon: SFSymbol = SYSTEM_ICONS[props?.timerType] ?? "drop.fill";
  const timerModifiers = [
    font({ size: 34, weight: "bold", design: "rounded" }),
    monospacedDigit(),
    foregroundStyle(accent)
  ];

  return {
    banner: (
      <VStack
        spacing={10}
        modifiers={[
          padding({ horizontal: 16, vertical: 14 }),
          activityBackgroundTint(backgroundColor)
        ]}
      >
        <HStack spacing={6} modifiers={[frame({ maxWidth: EXPAND, alignment: "leading" })]}>
          <Image systemName={icon} color={accent} />
          <Text
            modifiers={[
              font({ size: 12, weight: "bold" }),
              foregroundStyle(accent),
              lineLimit(1)
            ]}
          >
            ANNE+ · {title.toUpperCase()}
          </Text>
          <Spacer />
          {startedClock ? (
            <Text
              modifiers={[
                font({ size: 12, weight: "semibold", design: "monospaced" }),
                foregroundStyle(secondary)
              ]}
            >
              {startedClock}’de başladı
            </Text>
          ) : null}
        </HStack>
        <HStack spacing={12} modifiers={[frame({ maxWidth: EXPAND })]}>
          <VStack
            spacing={3}
            modifiers={[frame({ maxWidth: EXPAND, alignment: "topLeading" })]}
          >
            <Text
              modifiers={[
                font({ size: 20, weight: "bold" }),
                foregroundStyle(primary),
                lineLimit(1)
              ]}
            >
              {babyName}
            </Text>
            <Text
              modifiers={[
                font({ size: 14, weight: "semibold" }),
                foregroundStyle(secondary),
                lineLimit(1)
              ]}
            >
              {isCompleted ? summaryLine : sideLine}
            </Text>
          </VStack>
          {isCompleted ? (
            <Text
              modifiers={[
                font({ size: 16, weight: "bold" }),
                foregroundStyle(accent)
              ]}
            >
              Kaydedildi
            </Text>
          ) : (
            // countsDown yok: bir emzirme ya da uyku başladığı andan itibaren
            // yukarı doğru sayar.
            <Text
              timerInterval={{ lower: startedAt, upper: openEndedUpper }}
              modifiers={timerModifiers}
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
        modifiers={[
          font({ size: 13, weight: "bold" }),
          monospacedDigit(),
          foregroundStyle(accent)
        ]}
      />
    ),
    minimal: (
      <Image
        systemName={isCompleted ? "checkmark.circle.fill" : icon}
        color={accent}
      />
    ),
    expandedLeading: (
      <VStack
        spacing={4}
        modifiers={[padding({ leading: 6 }), frame({ alignment: "leading" })]}
      >
        <Image systemName={icon} color={accent} />
        <Text
          modifiers={[
            font({ size: 11, weight: "bold" }),
            foregroundStyle(secondary),
            lineLimit(1)
          ]}
        >
          {sideLine || "Anne+"}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack
        spacing={2}
        modifiers={[padding({ trailing: 6 }), frame({ alignment: "trailing" })]}
      >
        {isCompleted ? (
          <Text
            modifiers={[
              font({ size: 15, weight: "bold" }),
              foregroundStyle(accent)
            ]}
          >
            Bitti
          </Text>
        ) : (
          <Text
            timerInterval={{ lower: startedAt, upper: openEndedUpper }}
            modifiers={[
              font({ size: 20, weight: "bold", design: "rounded" }),
              monospacedDigit(),
              foregroundStyle(accent)
            ]}
          />
        )}
        <Text
          modifiers={[font({ size: 10 }), foregroundStyle(secondary)]}
        >
          {isCompleted ? "kaydedildi" : "sürüyor"}
        </Text>
      </VStack>
    ),
    expandedCenter: (
      <VStack spacing={2}>
        <Text
          modifiers={[
            font({ size: 15, weight: "bold" }),
            foregroundStyle(primary),
            lineLimit(1)
          ]}
        >
          {babyName}
        </Text>
        <Text
          modifiers={[
            font({ size: 11 }),
            foregroundStyle(secondary),
            lineLimit(1)
          ]}
        >
          {title}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <HStack spacing={10} modifiers={[padding({ horizontal: 10, vertical: 6 })]}>
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundStyle(secondary),
            lineLimit(1)
          ]}
        >
          {isCompleted
            ? summaryLine
            : startedClock
              ? `${startedClock}’de başladı`
              : sideLine}
        </Text>
        <Spacer />
        {isCompleted ? null : (
          // iOS 17+ LiveActivityIntent: düğme uygulamayı öne getirmeden,
          // kilit ekranından sayacı bitirir.
          <Button
            label="Bitir"
            systemImage="stop.circle.fill"
            target={CARE_TIMER_FINISH_TARGET}
            modifiers={[
              font({ size: 13, weight: "bold" }),
              foregroundStyle(accent)
            ]}
          />
        )}
      </HStack>
    )
  };
}

export default createLiveActivity<CareTimerLiveActivityProps>(
  "CareTimerLiveActivity",
  CareTimerLiveActivity
);
