import { getCurrentProfile } from "@/api/profiles";
import type { DocumentInsightValue } from "@/features/document-insight/types";
import { supabase } from "@/lib/supabase";
import { createRealtimeChannelName } from "@/lib/realtime";
import type { Tables } from "@/types/database";

export const HEALTH_FILE_CONSENT_VERSION = "health-file-selected-values-v1";

export type PregnancyHealthEntry = Tables<"pregnancy_health_entries">;
export type PregnancyHealthLabValue = Tables<"pregnancy_health_lab_values">;
export type PregnancyHealthReminder = Tables<"pregnancy_health_reminders">;

export type PregnancyHealthTimelineItem = {
  canDelete: boolean;
  details: string | null;
  id: string;
  kind:
    | "appointment"
    | "doctor_item"
    | "lab_report"
    | "note"
    | "vaccination"
    | "visit_measurement"
    | "weight";
  labValues: PregnancyHealthLabValue[];
  occurredAt: string;
  sourceId: string;
  title: string;
};

export async function listPregnancyHealthTimeline() {
  const profile = await requireProfile();
  const [
    entriesResult,
    weightsResult,
    measurementsResult,
    vaccinationsResult,
    doctorItemsResult,
    remindersResult
  ] = await Promise.all([
    supabase
      .from("pregnancy_health_entries")
      .select("*")
      .eq("profile_id", profile.id),
    supabase
      .from("pregnancy_weight_records")
      .select("*")
      .eq("profile_id", profile.id),
    supabase
      .from("pregnancy_visit_measurements")
      .select("*")
      .eq("profile_id", profile.id),
    supabase
      .from("pregnancy_vaccinations")
      .select("*")
      .eq("profile_id", profile.id),
    supabase
      .from("doctor_visit_items")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("subject", "pregnancy"),
    supabase
      .from("pregnancy_health_reminders")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("status", "scheduled")
  ]);

  const firstError = [
    entriesResult.error,
    weightsResult.error,
    measurementsResult.error,
    vaccinationsResult.error,
    doctorItemsResult.error,
    remindersResult.error
  ].find(Boolean);
  if (firstError) throw firstError;

  const entries = entriesResult.data ?? [];
  const entryIds = entries.map((entry) => entry.id);
  const labResult = entryIds.length
    ? await supabase
        .from("pregnancy_health_lab_values")
        .select("*")
        .in("entry_id", entryIds)
        .order("ordinal", { ascending: true })
    : { data: [] as PregnancyHealthLabValue[], error: null };
  if (labResult.error) throw labResult.error;

  const labsByEntry = new Map<string, PregnancyHealthLabValue[]>();
  for (const value of labResult.data ?? []) {
    const values = labsByEntry.get(value.entry_id) ?? [];
    values.push(value);
    labsByEntry.set(value.entry_id, values);
  }

  const timeline: PregnancyHealthTimelineItem[] = [
    ...entries.map((entry) => ({
      canDelete: true,
      details: entry.notes,
      id: `health-${entry.id}`,
      kind: entry.kind,
      labValues: labsByEntry.get(entry.id) ?? [],
      occurredAt: entry.occurred_at,
      sourceId: entry.id,
      title: entry.title
    } satisfies PregnancyHealthTimelineItem)),
    ...(weightsResult.data ?? []).map((record) => ({
      canDelete: false,
      details: record.notes,
      id: `weight-${record.id}`,
      kind: "weight" as const,
      labValues: [],
      occurredAt: `${record.record_date}T12:00:00.000Z`,
      sourceId: record.id,
      title: `${formatDecimal(record.weight_kg)} kg`
    })),
    ...(measurementsResult.data ?? []).map((measurement) => ({
      canDelete: false,
      details: measurementDetails(measurement),
      id: `measurement-${measurement.id}`,
      kind: "visit_measurement" as const,
      labValues: [],
      occurredAt: measurement.measured_at,
      sourceId: measurement.id,
      title: measurement.source === "health_team" ? "Sağlık ekibi ölçümü" : "Kendi ölçümüm"
    })),
    ...(vaccinationsResult.data ?? []).map((vaccination) => ({
      canDelete: false,
      details: vaccination.completed
        ? "Tamamlandı"
        : `Planlanan tarih: ${formatDate(vaccination.scheduled_date)}`,
      id: `vaccination-${vaccination.id}`,
      kind: "vaccination" as const,
      labValues: [],
      occurredAt: `${vaccination.completed_date ?? vaccination.scheduled_date}T12:00:00.000Z`,
      sourceId: vaccination.id,
      title: vaccination.vaccine_name
    })),
    ...(doctorItemsResult.data ?? []).map((item) => ({
      canDelete: false,
      details: item.details,
      id: `doctor-${item.id}`,
      kind: "doctor_item" as const,
      labValues: [],
      occurredAt: item.started_at ?? item.created_at,
      sourceId: item.id,
      title: item.title
    }))
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return {
    profile,
    reminders: (remindersResult.data ?? []) as PregnancyHealthReminder[],
    timeline
  };
}

export async function createPregnancyHealthEntry(input: {
  kind: "appointment" | "note";
  notes?: string | null;
  occurredAt: string;
  title: string;
}) {
  const profile = await requireProfile();
  const title = input.title.trim();
  const notes = input.notes?.trim() || null;
  if (title.length < 1 || title.length > 140) throw new Error("Başlık 1–140 karakter olmalı.");
  if (notes && notes.length > 2000) throw new Error("Not en fazla 2000 karakter olabilir.");

  const { data, error } = await supabase
    .from("pregnancy_health_entries")
    .insert({
      kind: input.kind,
      notes,
      occurred_at: input.occurredAt,
      profile_id: profile.id,
      source: "manual",
      title
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deletePregnancyHealthEntry(entryId: string) {
  const { error } = await supabase
    .from("pregnancy_health_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw error;
}

export async function savePregnancyHealthLabResults(input: {
  recordedAt: string;
  title: string;
  values: DocumentInsightValue[];
}) {
  const { data, error } = await supabase.rpc("save_pregnancy_health_lab_results", {
    p_consent_version: HEALTH_FILE_CONSENT_VERSION,
    p_recorded_at: input.recordedAt,
    p_title: input.title.trim(),
    p_values: input.values.map((value) => ({
      document_marker: value.documentMarker,
      reference_range: value.referenceRange,
      reference_status: value.referenceStatus,
      result: value.result,
      test_name: value.testName,
      unit: value.unit
    }))
  });
  if (error) throw error;
  return data;
}

export async function setPregnancyHealthReminder(input: {
  entryId: string;
  recipientScope: "self" | "full_family";
  scheduledFor: string;
}) {
  const { data, error } = await supabase.rpc("set_pregnancy_health_reminder", {
    p_entry_id: input.entryId,
    p_recipient_scope: input.recipientScope,
    p_scheduled_for: input.scheduledFor
  });
  if (error) throw error;
  return data;
}

export async function cancelPregnancyHealthReminder(reminderId: string) {
  const { data, error } = await supabase.rpc("cancel_pregnancy_health_reminder", {
    p_reminder_id: reminderId
  });
  if (error) throw error;
  return data;
}

export function subscribeToPregnancyHealthFile(profileId: string, onChange: () => void) {
  const channel = supabase
    .channel(createRealtimeChannelName("pregnancy-health-file", profileId))
    .on("postgres_changes", {
      event: "*",
      filter: `profile_id=eq.${profileId}`,
      schema: "public",
      table: "pregnancy_health_entries"
    }, onChange)
    .on("postgres_changes", {
      event: "*",
      filter: `profile_id=eq.${profileId}`,
      schema: "public",
      table: "pregnancy_health_reminders"
    }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Hamilelik profili bulunamadı.");
  return profile;
}

function measurementDetails(measurement: Tables<"pregnancy_visit_measurements">) {
  const values = [
    measurement.systolic_bp != null && measurement.diastolic_bp != null
      ? `Tansiyon ${measurement.systolic_bp}/${measurement.diastolic_bp}`
      : null,
    measurement.pulse_bpm != null ? `Nabız ${measurement.pulse_bpm}` : null,
    measurement.fundal_height_cm != null ? `Fundal yükseklik ${formatDecimal(measurement.fundal_height_cm)} cm` : null,
    measurement.fetal_heart_rate_bpm != null ? `Bebek kalp hızı ${measurement.fetal_heart_rate_bpm}` : null,
    measurement.notes
  ].filter(Boolean);
  return values.join(" · ") || null;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}
