import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesUpdate } from "@/types/database";

export type BabyVaccination = Tables<"baby_vaccinations">;
export type VaccineScheduleItem = Tables<"vaccine_schedule">;
export type BabyVaccinationWithSchedule = BabyVaccination & {
  vaccine_schedule: VaccineScheduleItem | null;
};

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
