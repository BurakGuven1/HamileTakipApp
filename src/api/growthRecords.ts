import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert } from "@/types/database";

export type GrowthRecord = Tables<"growth_records">;
export type GrowthRecordInsert = TablesInsert<"growth_records">;

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

  await trackEvent("growth_record_added", { baby_id: record.baby_id });

  return data;
}
