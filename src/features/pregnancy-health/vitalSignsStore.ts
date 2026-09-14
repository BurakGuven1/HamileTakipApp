import { getCurrentProfile } from "@/api/profiles";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

import {
  encodeVitalSignNote,
  parseTemperatureNote,
  sortByMeasuredAt,
  type VitalSignReading
} from "@/features/pregnancy-health/vitalSigns";

/**
 * Reading and writing the manual blood pressure / temperature entries.
 *
 * These rows live in `pregnancy_visit_measurements`, the table the health file
 * already shows on its timeline, so a reading entered here appears in the PDF
 * archive and the timeline without any extra plumbing. Temperature has no column
 * of its own in that table, so it travels inside the row's note in the one fixed
 * shape `vitalSigns.encodeVitalSignNote` writes and `parseTemperatureNote` reads
 * back. See the comment there for why, and for what to change if a column is
 * ever added.
 *
 * `source: "self"` marks these as the reader's own measurements rather than
 * something a health professional recorded — the same distinction the timeline
 * already draws.
 */

export const VITAL_SIGNS_QUERY_KEY = ["pregnancy-vital-signs"] as const;

type MeasurementRow = Tables<"pregnancy_visit_measurements">;

export async function listVitalSigns(): Promise<VitalSignReading[]> {
  const profile = await requireProfile();
  const { data, error } = await supabase
    .from("pregnancy_visit_measurements")
    .select("*")
    .eq("profile_id", profile.id)
    .order("measured_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return sortByMeasuredAt((data ?? []).map(toReading));
}

export async function saveVitalSign(reading: VitalSignReading) {
  const profile = await requireProfile();
  const { data, error } = await supabase
    .from("pregnancy_visit_measurements")
    .insert({
      profile_id: profile.id,
      measured_at: reading.measuredAt,
      source: "self",
      systolic_bp: reading.systolic,
      diastolic_bp: reading.diastolic,
      notes: encodeVitalSignNote(reading.temperatureCelsius, reading.note)
    })
    .select("*")
    .single();
  if (error) throw error;
  return toReading(data);
}

function toReading(row: MeasurementRow): VitalSignReading {
  const { temperatureCelsius, note } = parseTemperatureNote(row.notes);
  return {
    measuredAt: row.measured_at,
    systolic: row.systolic_bp,
    diastolic: row.diastolic_bp,
    temperatureCelsius,
    note
  };
}

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Hamilelik profili bulunamadı.");
  return profile;
}
