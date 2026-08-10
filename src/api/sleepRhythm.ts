import { createRealtimeChannelName } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type BabySleepEvent = Tables<"baby_sleep_events">;

export async function listBabySleepEvents(babyId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("baby_sleep_events")
    .select("*")
    .eq("baby_id", babyId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBabySleepEvent(input: {
  babyId: string;
  eventType: "sleep" | "wake";
  occurredAt: string;
  source: "quick" | "manual";
  timezoneOffsetMinutes: number;
}) {
  const { data, error } = await supabase.rpc("create_baby_sleep_event", {
    p_baby_id: input.babyId,
    p_event_type: input.eventType,
    p_occurred_at: input.occurredAt,
    p_source: input.source,
    p_timezone_offset_minutes: input.timezoneOffsetMinutes
  });
  if (error) throw error;
  return data;
}

export async function updateBabySleepEvent(input: {
  eventId: string;
  eventType: "sleep" | "wake";
  occurredAt: string;
  timezoneOffsetMinutes: number;
}) {
  const { data, error } = await supabase.rpc("update_baby_sleep_event", {
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_occurred_at: input.occurredAt,
    p_timezone_offset_minutes: input.timezoneOffsetMinutes
  });
  if (error) throw error;
  return data;
}

export async function deleteBabySleepEvent(eventId: string) {
  const { data, error } = await supabase.rpc("delete_baby_sleep_event", {
    p_event_id: eventId
  });
  if (error) throw error;
  return data;
}

export function subscribeToBabySleepEvents(babyId: string, onChange: () => void) {
  const channel = supabase
    .channel(createRealtimeChannelName("sleep-rhythm", babyId))
    .on("postgres_changes", {
      event: "*",
      filter: `baby_id=eq.${babyId}`,
      schema: "public",
      table: "baby_sleep_events"
    }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}
