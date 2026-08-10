export type SleepEventType = "sleep" | "wake";

export type SleepEventLike = {
  event_type: SleepEventType;
  id: string;
  occurred_at: string;
};

export type SleepSession = {
  durationMs: number | null;
  endAt: string | null;
  startAt: string;
};

export type RhythmSegment = {
  endAngle: number;
  endMs: number;
  id: string;
  startAngle: number;
  startMs: number;
  type: SleepEventType;
};

export type PredictionWindow = {
  centerAt: string;
  endAt: string;
  startAt: string;
  uncertaintyMinutes: number;
};

export type SleepRhythmPrediction = {
  nextSleep: PredictionWindow;
  nextWake: PredictionWindow;
  sampleCount: number;
};

export const REQUIRED_SLEEP_SAMPLES = 7;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function sortSleepEvents<T extends SleepEventLike>(events: T[]) {
  return [...events].sort(
    (left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
  );
}

export function validateSleepEventCandidate(
  events: SleepEventLike[],
  candidate: Pick<SleepEventLike, "event_type" | "occurred_at">,
  editingId?: string | null,
  now = Date.now()
) {
  const occurredMs = Date.parse(candidate.occurred_at);
  if (!Number.isFinite(occurredMs)) return "Geçerli bir tarih ve saat seçmelisin.";
  if (occurredMs > now + 30_000) return "Bugün için gelecekte bir saat seçemezsin.";

  const remaining = sortSleepEvents(events.filter((event) => event.id !== editingId));
  if (remaining.some((event) => Date.parse(event.occurred_at) === occurredMs)) {
    return "Bu saatte zaten bir uyku kaydı var.";
  }
  const previous = [...remaining].reverse().find((event) => Date.parse(event.occurred_at) < occurredMs);
  const next = remaining.find((event) => Date.parse(event.occurred_at) > occurredMs);
  if (previous?.event_type === candidate.event_type) {
    return previous.event_type === "sleep"
      ? "Bebek zaten uyuyor görünüyor. Önce Uyandı kaydı gerekli."
      : "Bebek zaten uyanık görünüyor. Önce Uyudu kaydı gerekli.";
  }
  if (next?.event_type === candidate.event_type) {
    return "Bu kayıt sonraki olayla aynı durumda olur. Uyudu ve Uyandı sırayla ilerlemeli.";
  }
  return null;
}

export function buildSleepSessions(events: SleepEventLike[], now = Date.now()) {
  const sessions: SleepSession[] = [];
  let activeSleep: SleepEventLike | null = null;

  for (const event of sortSleepEvents(events)) {
    if (event.event_type === "sleep") {
      if (!activeSleep) activeSleep = event;
      continue;
    }
    if (!activeSleep) continue;
    const startMs = Date.parse(activeSleep.occurred_at);
    const endMs = Date.parse(event.occurred_at);
    if (endMs > startMs) {
      sessions.push({
        durationMs: endMs - startMs,
        endAt: event.occurred_at,
        startAt: activeSleep.occurred_at
      });
    }
    activeSleep = null;
  }

  if (activeSleep) {
    sessions.push({
      durationMs: Math.max(0, now - Date.parse(activeSleep.occurred_at)),
      endAt: null,
      startAt: activeSleep.occurred_at
    });
  }
  return sessions;
}

export function getCurrentSleepState(events: SleepEventLike[], now = Date.now()) {
  const current = sortSleepEvents(events).filter(
    (event) => Date.parse(event.occurred_at) <= now
  ).at(-1) ?? null;
  return current
    ? {
        event: current,
        isSleeping: current.event_type === "sleep",
        sinceMs: Math.max(0, now - Date.parse(current.occurred_at))
      }
    : null;
}

export function createRhythmSegments(
  events: SleepEventLike[],
  windowEndMs: number,
  windowDurationMs = DAY_MS
) {
  const windowStartMs = windowEndMs - windowDurationMs;
  const sorted = sortSleepEvents(events);
  const before = sorted.filter((event) => Date.parse(event.occurred_at) <= windowStartMs).at(-1);
  const inside = sorted.filter((event) => {
    const occurred = Date.parse(event.occurred_at);
    return occurred > windowStartMs && occurred <= windowEndMs;
  });
  const transitions = before ? [before, ...inside] : inside;
  const segments: RhythmSegment[] = [];

  transitions.forEach((event, index) => {
    const rawStart = index === 0 && before ? windowStartMs : Date.parse(event.occurred_at);
    const nextEvent = transitions[index + 1];
    const rawEnd = nextEvent ? Date.parse(nextEvent.occurred_at) : windowEndMs;
    const startMs = Math.max(windowStartMs, rawStart);
    const endMs = Math.min(windowEndMs, rawEnd);
    if (endMs <= startMs) return;
    segments.push({
      endAngle: -90 + ((endMs - windowStartMs) / windowDurationMs) * 360,
      endMs,
      id: `${event.id}:${startMs}:${endMs}`,
      startAngle: -90 + ((startMs - windowStartMs) / windowDurationMs) * 360,
      startMs,
      type: event.event_type
    });
  });

  return segments;
}

export function predictSleepRhythm(
  events: SleepEventLike[],
  now = Date.now()
): SleepRhythmPrediction | null {
  const sorted = sortSleepEvents(events);
  const completedDurations = getPredictionSleepDurations(sorted, now);
  const sampleCount = completedDurations.length;
  const current = getCurrentSleepState(sorted, now);
  if (!current || sampleCount < REQUIRED_SLEEP_SAMPLES) return null;

  const wakeDurations: number[] = [];
  let lastWakeMs: number | null = null;
  for (const event of sorted) {
    const occurredMs = Date.parse(event.occurred_at);
    if (event.event_type === "wake") {
      lastWakeMs = occurredMs;
    } else if (lastWakeMs !== null && occurredMs > lastWakeMs) {
      const duration = occurredMs - lastWakeMs;
      if (duration >= 10 * MINUTE_MS && duration <= 14 * 60 * MINUTE_MS) {
        wakeDurations.push(duration);
      }
      lastWakeMs = null;
    }
  }
  if (wakeDurations.length < 3) return null;

  const sleepMedian = median(completedDurations);
  const wakeMedian = median(wakeDurations.slice(-21));
  const sleepUncertainty = uncertaintyMinutes(completedDurations, sleepMedian);
  const wakeUncertainty = uncertaintyMinutes(wakeDurations, wakeMedian);
  const currentStartedMs = Date.parse(current.event.occurred_at);

  if (current.isSleeping) {
    const wakeCenter = futureCenter(currentStartedMs + sleepMedian, now);
    const sleepCenter = wakeCenter + wakeMedian;
    return {
      nextSleep: createWindow(sleepCenter, wakeUncertainty),
      nextWake: createWindow(wakeCenter, sleepUncertainty),
      sampleCount
    };
  }

  const sleepCenter = futureCenter(currentStartedMs + wakeMedian, now);
  const wakeCenter = sleepCenter + sleepMedian;
  return {
    nextSleep: createWindow(sleepCenter, wakeUncertainty),
    nextWake: createWindow(wakeCenter, sleepUncertainty),
    sampleCount
  };
}

export function getPredictionSampleCount(events: SleepEventLike[], now = Date.now()) {
  return getPredictionSleepDurations(events, now).length;
}

export function combineLocalDateAndTime(day: Date, time: Date) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  );
}

export function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function getPredictionSleepDurations(events: SleepEventLike[], now: number) {
  return buildSleepSessions(events, now)
    .filter((session) => session.endAt)
    .map((session) => session.durationMs ?? 0)
    .filter((duration) => duration >= 10 * MINUTE_MS && duration <= 18 * 60 * MINUTE_MS)
    .slice(-21);
}

function uncertaintyMinutes(values: number[], center: number) {
  const deviations = values.map((value) => Math.abs(value - center));
  return Math.round(Math.min(60, Math.max(15, median(deviations) / MINUTE_MS)));
}

function futureCenter(center: number, now: number) {
  return center < now ? now + 5 * MINUTE_MS : center;
}

function createWindow(centerMs: number, uncertainty: number): PredictionWindow {
  return {
    centerAt: new Date(centerMs).toISOString(),
    endAt: new Date(centerMs + uncertainty * MINUTE_MS).toISOString(),
    startAt: new Date(centerMs - uncertainty * MINUTE_MS).toISOString(),
    uncertaintyMinutes: uncertainty
  };
}
