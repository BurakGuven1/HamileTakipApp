import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import { getCurrentProfile } from "@/api/profiles";
import type { Tables, TablesUpdate } from "@/types/database";
import { toDateOnly } from "@/lib/dates";

export type BabyVaccination = Tables<"baby_vaccinations">;
export type PregnancyVaccination = Tables<"pregnancy_vaccinations">;
export type VaccinationSource = "baby" | "pregnancy";
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

export async function listPregnancyVaccinations(
  profileId: string
): Promise<PregnancyVaccination[]> {
  const { data, error } = await supabase
    .from("pregnancy_vaccinations")
    .select("*")
    .eq("profile_id", profileId)
    .order("scheduled_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getNextUpcomingVaccination(
  babyId: string | null,
  babyName = "Bebeğin"
): Promise<UpcomingVaccinationContext | null> {
  const today = toDateOnly(new Date());
  const profile = await getCurrentProfile();
  if (!profile) return null;

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
    profile.is_pregnant
      ? supabase
          .from("pregnancy_vaccinations")
          .select("scheduled_date, completed, vaccine_name")
          .eq("profile_id", profile.id)
          .eq("completed", false)
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

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

  if (candidates.length === 0) {
    if (babyResult.error) throw babyResult.error;
    if (pregnancyResult.error) throw pregnancyResult.error;
  }

  return candidates.sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate)
  )[0] ?? null;
}

export async function markVaccinationDone(
  vaccinationId: string,
  completedAt = new Date().toISOString()
) {
  return setVaccinationCompleted({
    completed: true,
    completedAt,
    source: "baby",
    vaccinationId
  });
}

export async function markVaccinationPending(vaccinationId: string) {
  return setVaccinationCompleted({
    completed: false,
    source: "baby",
    vaccinationId
  });
}

export async function updateVaccinationNotes(
  vaccinationId: string,
  notes: string | null
) {
  return updateVaccinationNotesForSource({
    notes,
    source: "baby",
    vaccinationId
  });
}

export async function setVaccinationCompleted({
  completed,
  completedAt = new Date().toISOString(),
  source,
  vaccinationId
}: {
  completed: boolean;
  completedAt?: string;
  source: VaccinationSource;
  vaccinationId: string;
}) {
  const update = {
    completed,
    completed_date: completed ? completedAt.slice(0, 10) : null,
    updated_at: new Date().toISOString()
  };
  const result = source === "pregnancy"
    ? await supabase
        .from("pregnancy_vaccinations")
        .update(update satisfies TablesUpdate<"pregnancy_vaccinations">)
        .eq("id", vaccinationId)
        .select()
        .single()
    : await supabase
        .from("baby_vaccinations")
        .update(update satisfies TablesUpdate<"baby_vaccinations">)
        .eq("id", vaccinationId)
        .select()
        .single();

  if (result.error) throw result.error;

  await trackEvent(
    completed ? "vaccination_marked_done" : "vaccination_marked_pending",
    { source }
  );

  return result.data;
}

export async function updateVaccinationNotesForSource({
  notes,
  source,
  vaccinationId
}: {
  notes: string | null;
  source: VaccinationSource;
  vaccinationId: string;
}) {
  const update = { notes, updated_at: new Date().toISOString() };
  const result = source === "pregnancy"
    ? await supabase
        .from("pregnancy_vaccinations")
        .update(update satisfies TablesUpdate<"pregnancy_vaccinations">)
        .eq("id", vaccinationId)
        .select()
        .single()
    : await supabase
        .from("baby_vaccinations")
        .update(update satisfies TablesUpdate<"baby_vaccinations">)
        .eq("id", vaccinationId)
        .select()
        .single();

  if (result.error) throw result.error;

  return result.data;
}
