import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables } from "@/types/database";

export type Lullaby = Tables<"lullabies">;

const bucketName = "lullabies";

export async function listLullabies(durationMinutes?: 15 | 30 | 60) {
  let query = supabase
    .from("lullabies")
    .select("*")
    .order("duration_minutes", { ascending: true });

  if (durationMinutes) {
    query = query.eq("duration_minutes", durationMinutes);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export function getLullabyPublicUrl(storagePath: string) {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function recordLullabyPlayed(
  lullabyId: string,
  durationSeconds: number
) {
  await trackEvent("lullaby_played", {
    lullaby_id: lullabyId,
    duration: durationSeconds
  });
}
