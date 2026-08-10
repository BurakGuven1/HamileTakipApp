// @ts-nocheck -- Executed with Deno; kept outside the app bundle.
import {
  buildSleepSessions,
  createRhythmSegments,
  formatDuration,
  getCurrentSleepState,
  predictSleepRhythm,
  validateSleepEventCandidate
} from "./model.ts";

function event(id: string, type: "sleep" | "wake", occurredAt: string) {
  return { id, event_type: type, occurred_at: occurredAt };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("reference rhythm crosses midnight and keeps current duration", () => {
  const events = [
    event("1", "wake", "2026-08-09T08:00:00.000Z"),
    event("2", "sleep", "2026-08-09T12:00:00.000Z"),
    event("3", "wake", "2026-08-09T16:37:00.000Z"),
    event("4", "sleep", "2026-08-09T20:14:00.000Z"),
    event("5", "wake", "2026-08-10T03:07:00.000Z"),
    event("6", "sleep", "2026-08-10T05:08:00.000Z")
  ];
  const now = Date.parse("2026-08-10T07:42:00.000Z");
  const sessions = buildSleepSessions(events, now);
  assert(sessions.length === 3, "Three sleep sessions should be derived");
  assert(sessions[1].durationMs === 6 * 60 * 60_000 + 53 * 60_000, "Midnight session should be 6h53");
  assert(formatDuration(getCurrentSleepState(events, now)?.sinceMs ?? 0) === "2 sa 34 dk", "Current duration should be 2h34");
  const segments = createRhythmSegments(events, now);
  assert(segments.some((segment) => segment.type === "sleep" && segment.startMs < Date.parse("2026-08-10T00:00:00.000Z") && segment.endMs > Date.parse("2026-08-10T00:00:00.000Z")), "A sleep segment should cross midnight");
});

Deno.test("manual today entries validate chronological alternation", () => {
  const now = Date.parse("2026-08-10T16:20:00.000Z");
  const wake = event("wake", "wake", "2026-08-10T07:37:00.000Z");
  assert(validateSleepEventCandidate([wake], { event_type: "sleep", occurred_at: "2026-08-10T12:37:00.000Z" }, null, now) === null, "12:37 sleep should be valid");
  assert(Boolean(validateSleepEventCandidate([wake], { event_type: "wake", occurred_at: "2026-08-10T12:37:00.000Z" }, null, now)), "Consecutive wake should fail");
  assert(Boolean(validateSleepEventCandidate([wake], { event_type: "sleep", occurred_at: "2026-08-10T16:30:00.000Z" }, null, now)), "Future time should fail");
});

Deno.test("prediction becomes available after seven completed sleeps", () => {
  const events = [];
  const base = Date.parse("2026-08-01T06:00:00.000Z");
  for (let index = 0; index < 7; index += 1) {
    const wakeAt = base + index * 24 * 60 * 60_000;
    events.push(event(`w${index}`, "wake", new Date(wakeAt).toISOString()));
    events.push(event(`s${index}`, "sleep", new Date(wakeAt + 3 * 60 * 60_000).toISOString()));
    events.push(event(`e${index}`, "wake", new Date(wakeAt + 5 * 60 * 60_000).toISOString()));
  }
  const lastWake = Date.parse(events.at(-1).occurred_at);
  const prediction = predictSleepRhythm(events, lastWake + 60 * 60_000);
  assert(prediction?.sampleCount === 7, "Seven completed sleeps should unlock prediction data");
  assert(Date.parse(prediction.nextSleep.centerAt) > lastWake, "Next sleep must be after the last wake");
  assert(Date.parse(prediction.nextWake.centerAt) > Date.parse(prediction.nextSleep.centerAt), "Wake prediction must follow sleep prediction");
});
