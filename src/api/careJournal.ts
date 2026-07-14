import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database";
import {
  createCareEntryOfflineFirst,
  cacheCareEntries,
  cacheCareSnapshot,
  deleteCareEntryOfflineFirst,
  discardCareSyncConflict,
  getCareSyncConflicts,
  getCachedCareEntries,
  getCachedCareSnapshot,
  getPendingCareCoordination,
  mergePendingCareEntries,
  retryCareSyncConflict,
  startSharedTimerOfflineFirst,
  stopSharedTimerOfflineFirst,
  takeOverCareOfflineFirst,
  undoCareOperation,
  type CareActiveTimer,
  type CareHandoverSession,
  type CareJournalInput,
  type CareJournalViewEntry,
  type CareSyncResult
} from "@/features/care-journal/careSync";

export type CareJournalEntry = Tables<"care_journal_entries">;
export type MilkInventoryMovement = Tables<"milk_inventory">;
export type CareTask = Tables<"care_tasks">;
export type CareReminder = Tables<"care_reminders">;
export type SleepPrediction = Tables<"sleep_predictions">;
export type CareEntryType = CareJournalEntry["entry_type"];
export type { CareActiveTimer, CareHandoverSession, CareJournalInput, CareJournalViewEntry, CareSyncResult };
export type CareJournalActivity = Tables<"care_journal_entry_events">;

export type CareHandoverSnapshot = {
  active_reminder_count: number;
  active_timer: CareActiveTimer | null;
  active_timers: CareActiveTimer[];
  handover: CareHandoverSession | null;
  last_diaper: CareJournalEntry | null;
  last_feed: CareJournalEntry | null;
  last_medicine: CareJournalEntry | null;
  last_sleep: CareJournalEntry | null;
  last_temperature: CareJournalEntry | null;
  next_medicine_reminder: CareReminder | null;
  open_task_count: number;
  vitamin_given_today: boolean;
};

export type RecentMedicineDose = {
  entry_id: string;
  medicine_name: string;
  medicine_dose: string | null;
  caregiver_name: string | null;
  occurred_at: string;
};

export class RecentMedicineDoseError extends Error {
  recentDose: RecentMedicineDose | null;

  constructor(recentDose: RecentMedicineDose | null) {
    super("Bu ilaç veya vitamin için yakın zamanda başka bir kayıt var.");
    this.name = "RecentMedicineDoseError";
    this.recentDose = recentDose;
  }
}

export async function listCareJournalEntries(babyId: string, limit = 100) {
  const { data, error } = await supabase
    .from("care_journal_entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    const cached = await getCachedCareEntries(babyId);
    if (cached.length === 0) throw error;
    return mergePendingCareEntries(babyId, cached.slice(0, limit));
  }
  await cacheCareEntries(babyId, data ?? []);
  return mergePendingCareEntries(babyId, data ?? []);
}

export async function listLatestCoreCareEntries(babyId: string) {
  const { data, error } = await supabase
    .from("care_journal_entries")
    .select("*")
    .eq("baby_id", babyId)
    .in("entry_type", ["breastfeeding", "bottle", "sleep", "diaper"])
    .order("occurred_at", { ascending: false })
    .limit(40);
  if (error) {
    const cached = await getCachedCareEntries(babyId);
    if (cached.length === 0) throw error;
    return mergePendingCareEntries(babyId, cached.filter((entry) => ["breastfeeding", "bottle", "sleep", "diaper"].includes(entry.entry_type)).slice(0, 40));
  }
  return mergePendingCareEntries(babyId, data ?? []);
}

export async function hasFamilyPremiumCareAccess(babyId: string) {
  const { data, error } = await supabase.rpc("has_active_family_premium", { p_baby_id: babyId });
  if (error) throw error;
  return data;
}

export async function listCareJournalEntriesSince(babyId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("care_journal_entries")
    .select("*")
    .eq("baby_id", babyId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });
  if (error) {
    const cached = await getCachedCareEntries(babyId);
    if (cached.length === 0) throw error;
    return mergePendingCareEntries(babyId, cached.filter((entry) => Date.parse(entry.occurred_at) >= Date.parse(since)));
  }
  return mergePendingCareEntries(babyId, data ?? []);
}

export async function addCareJournalEntry(input: CareJournalInput) {
  const result = await createCareEntryOfflineFirst(input);
  await trackEvent("care_journal_entry_added", {
    baby_id: input.baby_id,
    entry_type: input.entry_type,
    queued_offline: result.queued
  });
  return result;
}

export async function getSleepPrediction(babyId: string) {
  const { data, error } = await supabase
    .from("sleep_predictions")
    .select("*")
    .eq("baby_id", babyId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentMedicineDose(
  babyId: string,
  medicineName: string
) {
  if (medicineName.trim().length < 2) return null;

  const { data, error } = await supabase.rpc("get_recent_medicine_dose", {
    p_baby_id: babyId,
    p_medicine_name: medicineName
  });

  if (error) throw error;
  return (data?.[0] as RecentMedicineDose | undefined) ?? null;
}

export async function addMedicineCareEntrySafely({
  babyId,
  caregiverName,
  medicineDose,
  medicineName,
  notes,
  occurredAt,
  overrideRecent = false
}: {
  babyId: string;
  caregiverName: string | null;
  medicineDose: string | null;
  medicineName: string;
  notes: string | null;
  occurredAt: string;
  overrideRecent?: boolean;
}) {
  try {
    const result = await createCareEntryOfflineFirst({
      amount_ml: null,
      baby_id: babyId,
      breast_side: null,
      caregiver_name: caregiverName,
      diaper_type: null,
      ended_at: null,
      entry_type: "medicine",
      feeding_content: null,
      food_amount: null,
      food_name: null,
      is_first_try: false,
      medicine_dose: medicineDose,
      medicine_name: medicineName,
      notes,
      occurred_at: occurredAt,
      sleep_kind: null,
      temperature_c: null,
      temperature_site: null
    }, { overrideRecent });
    await trackEvent("care_journal_entry_added", {
      baby_id: babyId,
      entry_type: "medicine",
      queued_offline: result.queued,
      recent_override: overrideRecent
    });
    if (!result.queued) triggerCareIntelligenceDelivery();
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("RECENT_MEDICINE_DOSE")) {
      let recentDose: RecentMedicineDose | null = null;
      const details = "details" in error && typeof error.details === "string"
        ? error.details
        : null;
      if (details) {
        try {
          recentDose = JSON.parse(details) as RecentMedicineDose;
        } catch {
          recentDose = null;
        }
      }
      throw new RecentMedicineDoseError(recentDose);
    }
    throw error;
  }
}

export function triggerCareIntelligenceDelivery() {
  supabase.functions
    .invoke("send-care-reminders", { body: {} })
    .catch(() => undefined);
}

export function subscribeToCareJournalEntries(
  babyId: string,
  onInsert: (entry: CareJournalEntry) => void,
  onChange: () => void
) {
  const channel = supabase
    .channel(`care-journal:${babyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "care_journal_entries",
        filter: `baby_id=eq.${babyId}`
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          onInsert(payload.new as CareJournalEntry);
        }
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

export async function deleteCareJournalEntry(
  entry: CareJournalEntry,
  caregiverName: string | null
) {
  const result = await deleteCareEntryOfflineFirst(entry, caregiverName);
  await trackEvent("care_journal_entry_deleted", { queued_offline: result.queued });
  return result;
}

export async function undoCareJournalOperation(
  operationId: string,
  caregiverName: string | null
) {
  const result = await undoCareOperation(operationId, caregiverName);
  await trackEvent("care_journal_operation_undone");
  return result;
}

export { discardCareSyncConflict, getCareSyncConflicts, retryCareSyncConflict };

export async function getCareHandoverSnapshot(babyId: string) {
  const pending = await getPendingCareCoordination(babyId);
  const { data, error } = await supabase.rpc("get_care_handover_snapshot", {
    p_baby_id: babyId
  });
  if (error) {
    const cached = await getCachedCareSnapshot<CareHandoverSnapshot>(babyId);
    if (!cached && !pending.handover && !pending.timer) throw error;
    return {
      ...(cached ?? {
      active_reminder_count: 0,
      active_timer: null,
      active_timers: [],
      handover: null,
      last_diaper: null,
      last_feed: null,
      last_medicine: null,
      last_sleep: null,
      last_temperature: null,
      next_medicine_reminder: null,
      open_task_count: 0,
      vitamin_given_today: false
      }),
      active_timer: pending.timer ?? cached?.active_timer ?? null,
      handover: pending.handover ?? cached?.handover ?? null
    } satisfies CareHandoverSnapshot;
  }
  const { data: activeTimers, error: activeTimersError } = await supabase
    .from("care_active_timers")
    .select("*")
    .eq("baby_id", babyId)
    .is("ended_at", null)
    .order("started_at", { ascending: true });
  if (activeTimersError) throw activeTimersError;
  const snapshot = {
    ...(data as unknown as CareHandoverSnapshot),
    active_timers: activeTimers ?? []
  };
  await cacheCareSnapshot(babyId, snapshot);
  return {
    ...snapshot,
    active_timer: pending.timer ?? snapshot.active_timer,
    handover: pending.handover ?? snapshot.handover
  };
}

export async function listCareJournalActivity(babyId: string, limit = 12) {
  const { data, error } = await supabase
    .from("care_journal_entry_events")
    .select("*")
    .eq("baby_id", babyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export function startSharedCareTimer(args: Parameters<typeof startSharedTimerOfflineFirst>[0]) {
  return startSharedTimerOfflineFirst(args);
}

export function stopSharedCareTimer(timer: CareActiveTimer, actorName: string | null, amountMl: number | null = null) {
  return stopSharedTimerOfflineFirst(timer, actorName, amountMl);
}

export async function listAllCareJournalEntries(babyId: string) {
  const rows: CareJournalEntry[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("care_journal_entries")
      .select("*")
      .eq("baby_id", babyId)
      .order("occurred_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export function takeOverBabyCare(babyId: string, caregiverName: string) {
  return takeOverCareOfflineFirst(babyId, caregiverName);
}

export function subscribeToCareCoordination(babyId: string, onChange: () => void) {
  const channel = supabase
    .channel(`care-coordination:${babyId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "care_active_timers", filter: `baby_id=eq.${babyId}`
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "care_handover_sessions", filter: `baby_id=eq.${babyId}`
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "care_journal_entry_events", filter: `baby_id=eq.${babyId}`
    }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

export async function listMilkInventory(babyId: string) {
  const { data, error } = await supabase.from("milk_inventory").select("*").eq("baby_id", babyId).order("occurred_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addMilkInventoryMovement(input: TablesInsert<"milk_inventory">) {
  const { data, error } = await supabase.from("milk_inventory").insert(input).select().single();
  if (error) throw error;
  await trackEvent("milk_inventory_updated", { movement_type: input.movement_type });
  return data;
}

export async function listCareTasks(babyId: string) {
  const { data, error } = await supabase.from("care_tasks").select("*").eq("baby_id", babyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addCareTask(input: TablesInsert<"care_tasks">) {
  const { data, error } = await supabase.from("care_tasks").insert(input).select().single();
  if (error) throw error;
  await trackEvent("care_task_added");
  return data;
}

export async function toggleCareTask(task: CareTask) {
  const { data, error } = await supabase.from("care_tasks").update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq("id", task.id).select().single();
  if (error) throw error;
  return data;
}

export async function saveMotherWellbeingCheckin(input: TablesInsert<"mother_wellbeing_checkins">) {
  const { data, error } = await supabase.from("mother_wellbeing_checkins").upsert(input, { onConflict: "profile_id,checkin_date" }).select().single();
  if (error) throw error;
  await trackEvent("mother_wellbeing_checkin_saved");
  return data;
}

export async function listCareReminders(babyId: string) {
  const { data, error } = await supabase
    .from("care_reminders")
    .select("*")
    .eq("baby_id", babyId)
    .eq("status", "scheduled")
    .gte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getCurrentCareUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function addCareReminder(input: TablesInsert<"care_reminders">) {
  const { data, error } = await supabase.from("care_reminders").insert(input).select().single();
  if (error) throw error;
  await trackEvent("care_reminder_scheduled", { entry_type: input.entry_type });
  return data;
}

export async function cancelCareReminder(id: string) {
  const { data, error } = await supabase
    .from("care_reminders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await trackEvent("care_reminder_cancelled");
  return data;
}
