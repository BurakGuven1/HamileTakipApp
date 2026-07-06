import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type Baby = Tables<"babies">;
export type BabyInsert = TablesInsert<"babies">;
export type BabyUpdate = TablesUpdate<"babies">;

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
