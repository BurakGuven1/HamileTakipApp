import { supabase } from "@/lib/supabase";
import {
  isDailyDestination,
  type DailyDestination
} from "@/features/daily-experience/dailyExperiencePolicy";

export const DAILY_EXPERIENCE_QUERY_KEY = ["daily-experience"] as const;
export const WEEKLY_CHECKIN_QUERY_KEY = ["weekly-checkin-context"] as const;

export type WeeklyCheckInOption = {
  focusTag: string;
  id: string;
  label: string;
};

export type WeeklyCheckInQuestion = {
  id: string;
  options: WeeklyCheckInOption[];
  text: string;
};

export type WeeklyCheckInContext = {
  lifeStage: "pregnancy" | "postpartum";
  needsCheckIn: boolean;
  packId: string;
  packVersion: number;
  questions: WeeklyCheckInQuestion[];
  title: string;
  weekKey: string;
};

export type DailyExperience = {
  completedAt: string | null;
  contentKey: string;
  experienceDate: string;
  id: string;
  lifeStage: "pregnancy" | "postpartum";
  openedAt: string;
  payload: {
    actionLabel: string;
    body: string;
    destination: DailyDestination;
    premiumBody: string;
    premiumTitle: string;
    stageFact: string;
    title: string;
  };
};

export async function getWeeklyCheckInContext() {
  const { data, error } = await rpc("get_weekly_checkin_context");
  if (error) throw error;
  return parseWeeklyContext(data);
}

export async function getTodayDailyExperience() {
  const { data, error } = await rpc("get_today_daily_experience");
  if (error) throw error;
  return data == null ? null : parseDailyExperience(data);
}

export async function submitWeeklyCheckIn(input: {
  answers: Record<string, string>;
  optionalNote: string;
}) {
  const { data, error } = await rpc("submit_weekly_checkin", {
    p_answers: input.answers,
    p_optional_note: input.optionalNote.trim() || null
  });
  if (error) throw error;
  return data;
}

export async function completeDailyExperience(assignmentId: string) {
  const { data, error } = await rpc("complete_daily_experience", {
    p_assignment_id: assignmentId
  });
  if (error) throw error;
  return data;
}

function rpc(name: string, args?: Record<string, unknown>) {
  return supabase.rpc(name as never, args as never) as unknown as Promise<{
    data: unknown;
    error: Error | null;
  }>;
}

function parseWeeklyContext(value: unknown): WeeklyCheckInContext {
  const row = record(value);
  const questions = Array.isArray(row.questions)
    ? row.questions.map(parseQuestion)
    : [];
  const lifeStage = parseLifeStage(row.life_stage);

  if (
    typeof row.week_key !== "string"
    || typeof row.needs_checkin !== "boolean"
    || typeof row.pack_id !== "string"
    || typeof row.pack_version !== "number"
    || typeof row.title !== "string"
    || questions.length < 1
  ) {
    throw new Error("Haftalık check-in hazırlanamadı.");
  }

  return {
    lifeStage,
    needsCheckIn: row.needs_checkin,
    packId: row.pack_id,
    packVersion: row.pack_version,
    questions,
    title: row.title,
    weekKey: row.week_key
  };
}

function parseQuestion(value: unknown): WeeklyCheckInQuestion {
  const row = record(value);
  const options = Array.isArray(row.options)
    ? row.options.map((option) => {
        const item = record(option);
        if (
          typeof item.id !== "string"
          || typeof item.label !== "string"
          || typeof item.focus_tag !== "string"
        ) {
          throw new Error("Haftalık seçenek okunamadı.");
        }
        return { focusTag: item.focus_tag, id: item.id, label: item.label };
      })
    : [];
  if (typeof row.id !== "string" || typeof row.text !== "string" || !options.length) {
    throw new Error("Haftalık soru okunamadı.");
  }
  return { id: row.id, options, text: row.text };
}

function parseDailyExperience(value: unknown): DailyExperience {
  const row = record(value);
  const payload = record(row.payload);
  const destination = payload.destination;
  if (
    typeof row.id !== "string"
    || typeof row.experience_date !== "string"
    || typeof row.content_key !== "string"
    || typeof row.opened_at !== "string"
    || (row.completed_at !== null && typeof row.completed_at !== "string")
    || typeof payload.title !== "string"
    || typeof payload.body !== "string"
    || typeof payload.action_label !== "string"
    || typeof payload.stage_fact !== "string"
    || typeof payload.premium_title !== "string"
    || typeof payload.premium_body !== "string"
    || !isDailyDestination(destination)
  ) {
    throw new Error("Bugünün kişisel kartı okunamadı.");
  }
  return {
    completedAt: row.completed_at,
    contentKey: row.content_key,
    experienceDate: row.experience_date,
    id: row.id,
    lifeStage: parseLifeStage(row.life_stage),
    openedAt: row.opened_at,
    payload: {
      actionLabel: payload.action_label,
      body: payload.body,
      destination,
      premiumBody: payload.premium_body,
      premiumTitle: payload.premium_title,
      stageFact: payload.stage_fact,
      title: payload.title
    }
  };
}

function parseLifeStage(value: unknown) {
  if (value === "pregnancy" || value === "postpartum") return value;
  throw new Error("Yaşam evresi okunamadı.");
}

function record(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Günlük deneyim yanıtı okunamadı.");
  }
  return value as Record<string, unknown>;
}
