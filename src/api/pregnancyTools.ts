import { getCurrentProfile } from "@/api/profiles";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database";

export type PregnancyWeightRecord = Tables<"pregnancy_weight_records">;
export type PregnancyDailyCounter = Tables<"pregnancy_daily_counters">;

export type PregnancyWeightInput = Pick<
  TablesInsert<"pregnancy_weight_records">,
  "notes" | "record_date" | "weight_kg"
>;

async function requirePregnantProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Oturum gerekli.");
  }

  if (!profile.is_pregnant) {
    throw new Error("Bu araçlar yalnızca hamilelik profillerinde kullanılabilir.");
  }

  return profile;
}

export async function listPregnancyWeightRecords() {
  const profile = await requirePregnantProfile();

  const { data, error } = await supabase
    .from("pregnancy_weight_records")
    .select("*")
    .eq("profile_id", profile.id)
    .order("record_date", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function savePregnancyWeightRecord(input: PregnancyWeightInput) {
  const profile = await requirePregnantProfile();

  const { data, error } = await supabase
    .from("pregnancy_weight_records")
    .upsert(
      {
        profile_id: profile.id,
        record_date: input.record_date,
        weight_kg: input.weight_kg,
        notes: input.notes ?? null
      },
      { onConflict: "profile_id,record_date" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePregnancyWeightRecord(id: string) {
  const { error } = await supabase
    .from("pregnancy_weight_records")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listPregnancyDailyCounters(limit = 30) {
  const profile = await requirePregnantProfile();

  const { data, error } = await supabase
    .from("pregnancy_daily_counters")
    .select("*")
    .eq("profile_id", profile.id)
    .order("counter_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function addPregnancyCounterDelta({
  contractionDelta,
  counterDate,
  kickDelta
}: {
  contractionDelta?: number;
  counterDate: string;
  kickDelta?: number;
}) {
  const { data, error } = await supabase.rpc("add_pregnancy_counter_delta", {
    p_counter_date: counterDate,
    p_kick_delta: kickDelta ?? 0,
    p_contraction_delta: contractionDelta ?? 0
  });

  if (error) {
    throw error;
  }

  return data;
}
