import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type Subscription = Tables<"subscriptions">;

export async function getActiveSubscription() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
