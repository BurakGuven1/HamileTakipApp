import AsyncStorage from "@react-native-async-storage/async-storage";

const DAILY_WATER_INTAKE_KEY = "daily-water-intake-v1";

export const MIN_DAILY_WATER_GLASSES = 7;
export const MAX_DAILY_WATER_GLASSES = 16;
export const DEFAULT_DAILY_WATER_GLASSES = 10;

export type DailyWaterIntake = {
  consumed: number;
  date: string;
  goal: number | null;
};

export async function getDailyWaterIntake(now = new Date()) {
  const today = getLocalDateKey(now);
  const stored = parseDailyWaterIntake(
    await AsyncStorage.getItem(DAILY_WATER_INTAKE_KEY)
  );

  if (!stored || stored.date !== today) {
    const freshState = createFreshDailyWaterIntake(today);
    await persistDailyWaterIntake(freshState);
    return freshState;
  }

  return stored;
}

export async function setDailyWaterGoal(goal: number, now = new Date()) {
  const current = await getDailyWaterIntake(now);
  const normalizedGoal = clampInteger(
    goal,
    MIN_DAILY_WATER_GLASSES,
    MAX_DAILY_WATER_GLASSES
  );
  const nextState: DailyWaterIntake = {
    ...current,
    consumed: Math.min(current.consumed, normalizedGoal),
    goal: normalizedGoal
  };

  await persistDailyWaterIntake(nextState);
  return nextState;
}

export async function setDailyWaterProgress(consumed: number, now = new Date()) {
  const current = await getDailyWaterIntake(now);
  if (current.goal === null) return current;

  const nextState: DailyWaterIntake = {
    ...current,
    consumed: clampInteger(consumed, 0, current.goal)
  };

  await persistDailyWaterIntake(nextState);
  return nextState;
}

export function getMillisecondsUntilNextLocalDay(now = new Date()) {
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    100
  );

  return Math.max(1_000, nextDay.getTime() - now.getTime());
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createFreshDailyWaterIntake(date: string): DailyWaterIntake {
  return {
    consumed: 0,
    date,
    goal: null
  };
}

async function persistDailyWaterIntake(state: DailyWaterIntake) {
  await AsyncStorage.setItem(DAILY_WATER_INTAKE_KEY, JSON.stringify(state));
}

function parseDailyWaterIntake(value: string | null): DailyWaterIntake | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.date !== "string") return null;

    const goal =
      typeof parsed.goal === "number" &&
      Number.isInteger(parsed.goal) &&
      parsed.goal >= MIN_DAILY_WATER_GLASSES &&
      parsed.goal <= MAX_DAILY_WATER_GLASSES
        ? parsed.goal
        : null;
    const consumed =
      goal !== null && typeof parsed.consumed === "number"
        ? clampInteger(parsed.consumed, 0, goal)
        : 0;

    return {
      consumed,
      date: parsed.date,
      goal
    };
  } catch {
    return null;
  }
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
