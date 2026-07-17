import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesUpdate } from "@/types/database";
import { toDateOnly } from "@/lib/dates";

export type BabyVaccination = Tables<"baby_vaccinations">;
export type VaccineScheduleItem = Tables<"vaccine_schedule">;
export type BabyVaccinationWithSchedule = BabyVaccination & {
  vaccine_schedule: VaccineScheduleItem | null;
};

export type ActiveVaccineReminder = {
  reminder_key: string;
  source: "baby" | "pregnancy";
  vaccination_id: string;
  subject_name: string;
  vaccine_name: string;
  scheduled_date: string;
  recommended_week_start: number | null;
  recommended_week_end: number | null;
};

export type UpcomingVaccinationContext = {
  completed: boolean;
  scheduledDate: string;
  subjectName: string;
  vaccineName: string;
};

export async function listActiveVaccineReminders() {
  const { data, error } = await supabase.rpc(
    "get_active_vaccine_reminders",
    { p_today: toDateOnly(new Date()) }
  );

  if (error) throw error;
  return (data ?? []) as ActiveVaccineReminder[];
}

export async function dismissVaccineReminders(
  reminders: ActiveVaccineReminder[]
) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Oturum gerekli.");
  if (reminders.length === 0) return;

  const { error } = await supabase.from("vaccine_reminder_dismissals").upsert(
    reminders.map((reminder) => ({
      user_id: user.id,
      reminder_key: reminder.reminder_key,
      scheduled_date: reminder.scheduled_date
    })),
    { onConflict: "user_id,reminder_key,scheduled_date" }
  );

  if (error) throw error;
}

export async function listVaccinationsForBaby(
  babyId: string
): Promise<BabyVaccinationWithSchedule[]> {
  const { data, error } = await supabase
    .from("baby_vaccinations")
    .select("*, vaccine_schedule(*)")
    .eq("baby_id", babyId)
    .order("scheduled_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data as unknown as BabyVaccinationWithSchedule[];
}

export async function getNextUpcomingVaccination(
  babyId: string | null,
  babyName = "Bebeğin"
): Promise<UpcomingVaccinationContext | null> {
  const today = toDateOnly(new Date());
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const [babyResult, pregnancyResult] = await Promise.all([
    babyId
      ? supabase
          .from("baby_vaccinations")
          .select("scheduled_date, completed, vaccine_schedule(vaccine_name)")
          .eq("baby_id", babyId)
          .eq("completed", false)
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("pregnancy_vaccinations")
      .select("scheduled_date, completed, vaccine_name")
      .eq("profile_id", user.id)
      .eq("completed", false)
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  if (babyResult.error && pregnancyResult.error) {
    throw babyResult.error;
  }

  const babyRow = babyResult.data as unknown as {
    completed: boolean;
    scheduled_date: string;
    vaccine_schedule: { vaccine_name: string } | null;
  } | null;
  const pregnancyRow = pregnancyResult.data;
  const candidates: UpcomingVaccinationContext[] = [];

  if (babyRow) {
    candidates.push({
      completed: babyRow.completed,
      scheduledDate: babyRow.scheduled_date,
      subjectName: babyName,
      vaccineName: babyRow.vaccine_schedule?.vaccine_name ?? "Bebek aşısı"
    });
  }
  if (pregnancyRow) {
    candidates.push({
      completed: pregnancyRow.completed,
      scheduledDate: pregnancyRow.scheduled_date,
      subjectName: "Gebelik",
      vaccineName: pregnancyRow.vaccine_name
    });
  }

  return candidates.sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate)
  )[0] ?? null;
}

export async function markVaccinationDone(
  vaccinationId: string,
  completedAt = new Date().toISOString()
) {
  const update: TablesUpdate<"baby_vaccinations"> = {
    completed: true,
    completed_date: completedAt.slice(0, 10),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("baby_vaccinations")
    .update(update)
    .eq("id", vaccinationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("vaccination_marked_done", {
    vaccination_id: vaccinationId
  });

  return data;
}

export async function markVaccinationPending(vaccinationId: string) {
  const update: TablesUpdate<"baby_vaccinations"> = {
    completed: false,
    completed_date: null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("baby_vaccinations")
    .update(update)
    .eq("id", vaccinationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("vaccination_marked_pending", {
    vaccination_id: vaccinationId
  });

  return data;
}

export async function updateVaccinationNotes(
  vaccinationId: string,
  notes: string | null
) {
  const { data, error } = await supabase
    .from("baby_vaccinations")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", vaccinationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
