import { supabase } from "@/lib/supabase";

type AnalyticsProperties = Record<string, string | number | boolean | null>;

export async function trackEvent(
  eventName: string,
  properties: AnalyticsProperties = {}
) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("analytics_events").insert({
    event_name: eventName,
    properties,
    user_id: user?.id ?? null
  });

  if (error) {
    console.warn("Analytics event failed", eventName, error.message);
  }
}
