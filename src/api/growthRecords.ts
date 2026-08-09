import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type GrowthRecord = Tables<"growth_records">;
export type GrowthRecordInsert = TablesInsert<"growth_records">;
export type GrowthRecordUpdate = TablesUpdate<"growth_records">;

export async function listGrowthRecords(babyId: string) {
  const { data, error } = await supabase
    .from("growth_records")
    .select("*")
    .eq("baby_id", babyId)
    .order("record_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function addGrowthRecord(record: GrowthRecordInsert) {
  const { data, error } = await supabase
    .from("growth_records")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("growth_record_added");

  return data;
}

export async function updateGrowthRecord(id: string, record: GrowthRecordUpdate) {
  const { data, error } = await supabase
    .from("growth_records")
    .update(record)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteGrowthRecord(id: string) {
  const { error } = await supabase.from("growth_records").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
