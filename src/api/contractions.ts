import { createCareUuid } from "@/features/care-journal/careSync";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

export type ContractionRecord = {
  client_operation_id: string;
  created_at: string;
  created_by: string | null;
  ended_at: string | null;
  id: string;
  profile_id: string;
  started_at: string;
  updated_at: string;
};

const untypedSupabase = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

async function callRpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await untypedSupabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function listContractions(sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const data = await callRpc<ContractionRecord[]>("list_pregnancy_contractions", {
    p_since: since
  });
  return Array.isArray(data) ? data : [];
}

export async function startContraction(operationId = createCareUuid()) {
  const data = await callRpc<ContractionRecord>("start_pregnancy_contraction", {
    p_operation_id: operationId,
    p_started_at: new Date().toISOString()
  });

  await trackEvent("contraction_started");

  return data;
}

export async function stopContraction(operationId: string) {
  const data = await callRpc<ContractionRecord>("stop_pregnancy_contraction", {
    p_operation_id: operationId,
    p_ended_at: new Date().toISOString()
  });

  const durationSec =
    data?.ended_at && data?.started_at
      ? Math.round(
          (Date.parse(data.ended_at) - Date.parse(data.started_at)) / 1000
        )
      : null;

  await trackEvent("contraction_stopped", { duration_sec: durationSec });

  return data;
}

export async function deleteContraction(id: string) {
  await callRpc<null>("delete_pregnancy_contraction", { p_id: id });
}
