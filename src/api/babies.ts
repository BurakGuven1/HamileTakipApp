import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import type { Profile } from "@/api/profiles";

export type Baby = Tables<"babies">;
export type BabyInsert = TablesInsert<"babies">;
export type BabyUpdate = TablesUpdate<"babies">;
export type BabyGender = "kiz" | "erkek" | "belirtilmemis";
export type FeedingMode = "breastfeeding" | "pumping" | "mixed" | "formula";

export type CompletePregnancyWithBirthInput = {
  babyName: string;
  birthDate: string;
  gender: BabyGender;
  feedingMode: FeedingMode;
};

export async function listBabies() {
  const { data, error } = await supabase
    .from("babies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function createBaby(input: BabyInsert) {
  const { data, error } = await supabase
    .from("babies")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("baby_profile_created", { baby_id: data.id });

  return data;
}

export async function updateBaby(id: string, input: BabyUpdate) {
  const { data, error } = await supabase
    .from("babies")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function completePregnancyWithBirth(
  input: CompletePregnancyWithBirthInput
) {
  const { data, error } = await supabase.rpc("complete_pregnancy_with_birth", {
    p_baby_name: input.babyName.trim(),
    p_birth_date: input.birthDate,
    p_gender: input.gender,
    p_feeding_mode: input.feedingMode
  });

  if (error) {
    throw error;
  }

  const result = data as unknown as { baby: Baby; profile: Profile };
  if (!result?.baby?.id || !result?.profile?.id) {
    throw new Error("Doğum sonrası geçiş tamamlanamadı. Lütfen yeniden dene.");
  }

  await trackEvent("pregnancy_completed_with_birth", {
    baby_id: result.baby.id
  }).catch(() => undefined);

  return result;
}
