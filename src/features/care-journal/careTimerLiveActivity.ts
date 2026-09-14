import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getLiveActivityEnabled } from "@/features/notifications/liveActivityPreference";

import type { CareTimerLiveActivityProps } from "@/widgets/CareTimerLiveActivity.ios";

import {
  getCareTimerSideLine,
  getCareTimerSummaryLine,
  getCareTimerTitle,
  type CareBreastSide,
  type CareSleepKind,
  type CareTimerType
} from "./careTimerActivityCopy";

export type CareTimerActivityInput = {
  babyId: string;
  babyName: string;
  breastSide: CareBreastSide;
  sleepKind: CareSleepKind;
  startedAt: string;
  timerType: CareTimerType;
};

/** How long the finished card stays on the Lock Screen before dismissing. */
const COMPLETED_DISMISSAL_MINUTES = 8;

/**
 * ActivityKit bir Live Activity'yi başlangıcından 8 saat sonra kendiliğinden
 * sonlandırır (ve 12 saat sonra kilit ekranından kaldırır). Uygulama o anda
 * çalışmıyor olabileceği için biz de aynı sınırı kendi tarafımızda uygularız:
 * bu yaştan büyük bir kart, kaydı çoktan bitmiş bir emzirmeyi gösteriyor
 * demektir ve derhal kaldırılır.
 */
const MAX_ACTIVITY_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * Çalışan Live Activity'nin kimliği. expo-widgets bir instance'ın props'unu
 * geri okumaya izin vermediği için, yetim kart temizliğinde neyi bitirdiğimizi
 * bilmek adına başlangıç girdisini burada saklıyoruz. Uygulama çökse veya
 * öldürülse bile bu kayıt diskte kalır.
 */
const ACTIVE_TIMER_KEY = "care-timer-live-activity-v1";

/**
 * A feed or a nap is timed one-handed in the dark, and the phone is locked for
 * almost all of it. Putting the running timer on the Lock Screen and in the
 * Dynamic Island is the difference between a tool that fits that moment and
 * one that asks a mother to unlock, find a tab and read a screen.
 *
 * Every failure here is swallowed: the entry itself is already recorded
 * offline-first, and a missing Live Activity must never break logging a feed.
 */
export async function ensureCareTimerLiveActivity(input: CareTimerActivityInput) {
  if (Platform.OS !== "ios") return;
  // Kullanıcı kilit ekranı sayacını Ayarlar'dan kapattıysa hiç başlatma.
  if (!(await getLiveActivityEnabled())) return;

  try {
    const { default: CareTimerActivity } = await import(
      "@/widgets/CareTimerLiveActivity.ios"
    );
    const props = toProps(input, "active");
    const instances = CareTimerActivity.getInstances();

    await AsyncStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(input)).catch(
      () => undefined
    );
    registerFinishActionListener();

    if (instances.length === 0) {
      // The care journal screen reads no route params of its own, so the link
      // is the bare route rather than one implying a deep link that does nothing.
      CareTimerActivity.start(props, "hamiletakip://care-journal");
      return;
    }

    await Promise.all(instances.map((instance) => instance.update(props)));
  } catch (error) {
    console.warn("Care timer Live Activity could not be started", error);
  }
}

export async function endCareTimerLiveActivity(
  input: CareTimerActivityInput,
  endedAt: string | null
) {
  if (Platform.OS !== "ios") return;

  try {
    const [{ default: CareTimerActivity }, { after }] = await Promise.all([
      import("@/widgets/CareTimerLiveActivity.ios"),
      import("expo-widgets")
    ]);

    const startedTime = Date.parse(input.startedAt);
    const endedTime = endedAt ? Date.parse(endedAt) : Date.now();
    const durationMs =
      Number.isFinite(startedTime) && Number.isFinite(endedTime)
        ? Math.max(0, endedTime - startedTime)
        : 0;

    const props = toProps(input, "completed", durationMs);
    const dismissalDate = new Date(
      Date.now() + COMPLETED_DISMISSAL_MINUTES * 60_000
    );

    await AsyncStorage.removeItem(ACTIVE_TIMER_KEY).catch(() => undefined);

    await Promise.all(
      CareTimerActivity.getInstances().map((instance) =>
        instance.end(after(dismissalDate), props, new Date())
      )
    );
  } catch (error) {
    console.warn("Care timer Live Activity could not be ended", error);
  }
}

/**
 * Uygulama öne geldiğinde yetim kartları temizler.
 *
 * Kilit ekranında asılı kalmış bir sayaç, uygulamanın güvenilirliğine dair
 * verilebilecek en kötü izlenimdir: anne saatlerdir bitmiş bir emzirmenin
 * saymaya devam ettiğini görür. Üç yetim kaynağı vardır ve üçü de burada
 * kapatılır:
 *  1. Uygulama sayaç çalışırken çöktü/öldürüldü ve kayıt diskte kaldı.
 *  2. Sayaç başka bir cihazda/ekranda durduruldu, bu cihaz haberi almadı.
 *  3. Kart 8 saatlik ActivityKit ömrünü doldurdu.
 */
export async function reconcileCareTimerLiveActivity() {
  if (Platform.OS !== "ios") return;

  try {
    const [{ default: CareTimerActivity }] = await Promise.all([
      import("@/widgets/CareTimerLiveActivity.ios")
    ]);
    const instances = CareTimerActivity.getInstances();
    if (instances.length === 0) {
      await AsyncStorage.removeItem(ACTIVE_TIMER_KEY).catch(() => undefined);
      return;
    }

    registerFinishActionListener();

    const input = await readActiveTimerInput();
    if (!input) {
      // Kartı kimin başlattığını bilmiyoruz: önceki kurulumdan kalmış.
      await dismissAllImmediately();
      return;
    }

    const startedTime = Date.parse(input.startedAt);
    if (
      !Number.isFinite(startedTime) ||
      Date.now() - startedTime > MAX_ACTIVITY_AGE_MS
    ) {
      await dismissAllImmediately();
      return;
    }

    const { getCareHandoverSnapshot } = await import("@/api/careJournal");
    const snapshot = await getCareHandoverSnapshot(input.babyId).catch(
      () => null
    );
    // Sunucuya ulaşılamadıysa karta dokunma: çevrimdışıyken çalışan bir
    // sayacı silmek, asılı kalmış bir karttan daha kötüdür.
    if (!snapshot) return;

    const stillRunning = snapshot.active_timers?.some(
      (timer) => timer.timer_type === input.timerType
    );
    if (!stillRunning) {
      await endCareTimerLiveActivity(input, null);
    }
  } catch (error) {
    console.warn("Care timer Live Activity could not be reconciled", error);
  }
}

/**
 * Kullanıcı kilit ekranı sayacını kapattığında çalışan kartları derhal kaldırır.
 * Kayıtlar etkilenmez; yalnızca kilit ekranı gösterimi durur.
 */
export async function dismissCareTimerLiveActivities() {
  if (Platform.OS !== "ios") return;
  await dismissAllImmediately().catch(() => undefined);
}

async function dismissAllImmediately() {
  const { default: CareTimerActivity } = await import(
    "@/widgets/CareTimerLiveActivity.ios"
  );
  await Promise.all(
    CareTimerActivity.getInstances().map((instance) =>
      instance.end("immediate").catch(() => undefined)
    )
  );
  await AsyncStorage.removeItem(ACTIVE_TIMER_KEY).catch(() => undefined);
}

async function readActiveTimerInput(): Promise<CareTimerActivityInput | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareTimerActivityInput;
    return typeof parsed?.babyId === "string" && typeof parsed?.startedAt === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

let finishListenerRegistered = false;

/**
 * Dynamic Island'daki "Bitir" düğmesi bir LiveActivityIntent çalıştırır; iOS
 * uygulamayı arka planda uyandırır ve expo-widgets olayı buraya iletir. Düğme
 * uygulamayı öne getirmediği için anne telefonu açmadan sayacı kapatabilir.
 *
 * Dinleyici modül düzeyinde tek sefer kurulur: Live Activity yaşam döngüsü
 * ekranlara değil, bu modüle ait.
 */
export function registerFinishActionListener() {
  if (Platform.OS !== "ios" || finishListenerRegistered) return;
  finishListenerRegistered = true;

  void (async () => {
    try {
      const [{ addUserInteractionListener }, { CARE_TIMER_FINISH_TARGET }] =
        await Promise.all([
          import("expo-widgets"),
          import("@/widgets/CareTimerLiveActivity.ios")
        ]);

      addUserInteractionListener((event) => {
        if (event.target !== CARE_TIMER_FINISH_TARGET) return;
        void finishRunningCareTimer();
      });
    } catch (error) {
      finishListenerRegistered = false;
      console.warn("Live Activity action listener could not be added", error);
    }
  })();
}

async function finishRunningCareTimer() {
  try {
    const input = await readActiveTimerInput();
    if (!input) return;

    const { getCareHandoverSnapshot, stopSharedCareTimer } = await import(
      "@/api/careJournal"
    );
    const snapshot = await getCareHandoverSnapshot(input.babyId);
    const timer = snapshot?.active_timers?.find(
      (candidate) => candidate.timer_type === input.timerType
    );

    if (!timer) {
      // Sayaç zaten durmuş; kartı kapatmak yine de doğru sonuç.
      await endCareTimerLiveActivity(input, null);
      return;
    }

    await stopSharedCareTimer(timer, null, null, input.babyName);
  } catch (error) {
    console.warn("Care timer could not be finished from Live Activity", error);
  }
}

function toProps(
  input: CareTimerActivityInput,
  status: CareTimerLiveActivityProps["status"],
  durationMs = 0
): CareTimerLiveActivityProps {
  const startedAtMs = Date.parse(input.startedAt);
  const resolvedStartedAtMs = Number.isFinite(startedAtMs)
    ? startedAtMs
    : Date.now();

  return {
    babyName: input.babyName,
    sideLine: getCareTimerSideLine({
      breastSide: input.breastSide,
      sleepKind: input.sleepKind,
      timerType: input.timerType
    }),
    startedAtMs: resolvedStartedAtMs,
    startedClock: formatClock(resolvedStartedAtMs),
    status,
    summaryLine: getCareTimerSummaryLine({
      breastSide: input.breastSide,
      durationMs,
      sleepKind: input.sleepKind,
      timerType: input.timerType
    }),
    timerType: input.timerType,
    title: getCareTimerTitle(input.timerType)
  };
}

function formatClock(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
