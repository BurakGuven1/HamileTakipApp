import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables } from "@/types/database";

export type BabyTooth = Tables<"baby_teeth">;

export async function listBabyTeeth(babyId: string) {
  const { data, error } = await supabase
    .from("baby_teeth")
    .select("*")
    .eq("baby_id", babyId)
    .order("erupted_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function setBabyToothErupted(input: {
  babyId: string;
  toothCode: string;
  erupted: boolean;
}) {
  if (!input.erupted) {
    const { error } = await supabase
      .from("baby_teeth")
      .delete()
      .eq("baby_id", input.babyId)
      .eq("tooth_code", input.toothCode);
    if (error) throw error;
    await trackEvent("baby_tooth_unmarked", {
      tooth_code: input.toothCode
    }).catch(() => undefined);
    return null;
  }

  const { data, error } = await supabase
    .from("baby_teeth")
    .upsert(
      {
        baby_id: input.babyId,
        tooth_code: input.toothCode,
        erupted_at: new Date().toISOString().slice(0, 10)
      },
      { onConflict: "baby_id,tooth_code" }
    )
    .select()
    .single();

  if (error) throw error;
  await trackEvent("baby_tooth_marked", {
    tooth_code: input.toothCode
  }).catch(() => undefined);
  return data;
}
