import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database";

const DEVICE_KEY = "care-sync-device-v1";
const QUEUE_KEY = "care-sync-queue-v1";
const ENTRY_CACHE_PREFIX = "care-sync-entries-v1:";
const SNAPSHOT_CACHE_PREFIX = "care-sync-snapshot-v1:";

export type CareJournalEntry = Tables<"care_journal_entries">;
export type CareJournalInput = Omit<
  TablesInsert<"care_journal_entries">,
  | "client_operation_id"
  | "created_at"
  | "created_by"
  | "created_device_id"
  | "created_device_label"
  | "deleted_at"
  | "deleted_by"
  | "deleted_by_name"
  | "deleted_device_id"
  | "deleted_device_label"
  | "id"
  | "updated_at"
  | "updated_by"
  | "updated_by_name"
  | "updated_device_id"
  | "updated_device_label"
  | "version"
>;

export type CareJournalViewEntry = CareJournalEntry & {
  local_sync_state?: "pending" | "conflict";
};

export type CareActiveTimer = Tables<"care_active_timers">;
export type CareHandoverSession = Tables<"care_handover_sessions">;

export type CareSyncResult<T> = {
  data: T;
  operationId: string;
  queued: boolean;
};

export type CareSyncStatus = {
  conflicts: number;
  isOnline: boolean;
  pending: number;
};

export type CareSyncConflict = {
  action: string;
  createdAt: string;
  error: string;
  kind: QueueKind;
  operationId: string;
};

type QueueKind = "entry" | "handover" | "start_timer" | "stop_timer";
type QueueState = "conflict" | "pending";

type QueueItem = {
  action: string;
  actorName: string | null;
  baseVersion: number | null;
  babyId: string;
  createdAt: string;
  entityId: string;
  error: string | null;
  kind: QueueKind;
  operationId: string;
  payload: Record<string, unknown>;
  state: QueueState;
  userId: string;
};

type DeviceIdentity = { id: string; label: string };
type RpcEnvelope = {
  entry?: CareJournalEntry;
  handover?: CareHandoverSession;
  reason?: string;
  server_entry?: CareJournalEntry;
  status: "already_active" | "already_completed" | "applied" | "conflict";
  timer?: CareActiveTimer;
};

const listeners = new Set<() => void>();
let currentOnline = true;
let flushPromise: Promise<CareSyncStatus> | null = null;
let queueMutation = Promise.resolve();

export function createCareUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getCareDeviceIdentity(): Promise<DeviceIdentity> {
  const stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DeviceIdentity;
      if (parsed.id && parsed.label) return parsed;
    } catch {
      // Recreate a malformed local identity.
    }
  }

  const identity = {
    id: createCareUuid(),
    label: Platform.OS === "ios"
      ? "iOS cihazı"
      : Platform.OS === "android"
        ? "Android cihazı"
        : "Web cihazı"
  };
  await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
}

export function subscribeCareSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCareSyncOnline(isOnline: boolean) {
  if (currentOnline === isOnline) return;
  currentOnline = isOnline;
  emitChange();
}

export async function getCareSyncStatus(babyId?: string): Promise<CareSyncStatus> {
  const queue = await readQueue();
  const relevant = babyId ? queue.filter((item) => item.babyId === babyId) : queue;
  return {
    conflicts: relevant.filter((item) => item.state === "conflict").length,
    isOnline: currentOnline,
    pending: relevant.filter((item) => item.state === "pending").length
  };
}

export async function getCareSyncConflicts(babyId: string): Promise<CareSyncConflict[]> {
  return (await readQueue())
    .filter((item) => item.babyId === babyId && item.state === "conflict")
    .map((item) => ({
      action: item.action,
      createdAt: item.createdAt,
      error: item.error ?? "Sunucudaki kayıtla çakıştı.",
      kind: item.kind,
      operationId: item.operationId
    }));
}

export async function retryCareSyncConflict(operationId: string) {
  await mutateQueue((queue) => queue.map((item) => {
    if (item.operationId !== operationId) return item;
    const isMedicineCreate = item.kind === "entry" &&
      item.action === "create" && item.payload.entry_type === "medicine";
    return {
      ...item,
      error: null,
      payload: isMedicineCreate
        ? { ...item.payload, override_recent: true }
        : item.payload,
      state: "pending"
    };
  }));
  return flushCareSyncQueue();
}

export async function mergePendingCareEntries(
  babyId: string,
  serverEntries: CareJournalEntry[]
) {
  const queue = (await readQueue()).filter((item) => item.babyId === babyId);
  const hiddenIds = new Set(
    queue
      .filter((item) => item.kind === "entry" && item.action === "delete")
      .map((item) => item.entityId)
  );
  const visible = serverEntries.filter((entry) => !hiddenIds.has(entry.id));
  const localCreates = queue
    .filter((item) => item.kind === "entry" && item.action === "create")
    .map(queueItemToEntry);

  return [...localCreates, ...visible]
    .filter((entry, index, entries) => entries.findIndex((item) => item.id === entry.id) === index)
    .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at));
}

export async function cacheCareEntries(babyId: string, entries: CareJournalEntry[]) {
  await AsyncStorage.setItem(`${ENTRY_CACHE_PREFIX}${babyId}`, JSON.stringify(entries.slice(0, 300)));
}

export async function getCachedCareEntries(babyId: string): Promise<CareJournalEntry[]> {
  const stored = await AsyncStorage.getItem(`${ENTRY_CACHE_PREFIX}${babyId}`);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as CareJournalEntry[] : [];
  } catch {
    return [];
  }
}

export async function cacheCareSnapshot(babyId: string, snapshot: unknown) {
  await AsyncStorage.setItem(`${SNAPSHOT_CACHE_PREFIX}${babyId}`, JSON.stringify(snapshot));
}

export async function getCachedCareSnapshot<T>(babyId: string): Promise<T | null> {
  const stored = await AsyncStorage.getItem(`${SNAPSHOT_CACHE_PREFIX}${babyId}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}

export async function getPendingCareCoordination(babyId: string) {
  const queue = (await readQueue())
    .filter((item) => item.babyId === babyId && item.state === "pending")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const device = await getCareDeviceIdentity();
  const latestStart = [...queue].reverse().find((item) => item.kind === "start_timer");
  const stoppedTimerIds = new Set(queue.filter((item) => item.kind === "stop_timer").map((item) => item.entityId));
  const timer = latestStart && !stoppedTimerIds.has(latestStart.entityId)
    ? ({
      baby_id: babyId,
      breast_side: latestStart.payload.timerType === "breastfeeding" || latestStart.payload.timerType === "pumping" ? latestStart.payload.breastSide : null,
      created_at: latestStart.createdAt,
      ended_at: null,
      ended_by: null,
      ended_by_name: null,
      ended_device_id: null,
      ended_device_label: null,
      id: latestStart.entityId,
      journal_entry_id: null,
      sleep_kind: latestStart.payload.timerType === "sleep" ? latestStart.payload.sleepKind : null,
      started_at: latestStart.createdAt,
      started_by: latestStart.userId,
      started_by_name: latestStart.actorName,
      started_device_id: device.id,
      started_device_label: device.label,
      timer_type: latestStart.payload.timerType,
      updated_at: latestStart.createdAt
    } as CareActiveTimer)
    : null;
  const latestHandover = [...queue].reverse().find((item) => item.kind === "handover");
  const handover = latestHandover
    ? ({
      baby_id: babyId,
      caregiver_id: latestHandover.userId,
      caregiver_name: String(latestHandover.payload.caregiverName),
      caregiver_role: "caregiver",
      created_at: latestHandover.createdAt,
      device_id: device.id,
      device_label: device.label,
      ended_at: null,
      ended_reason: null,
      id: latestHandover.entityId,
      started_at: latestHandover.createdAt
    } as CareHandoverSession)
    : null;
  return { handover, timer };
}

export async function createCareEntryOfflineFirst(
  input: CareJournalInput,
  options?: { overrideRecent?: boolean }
): Promise<CareSyncResult<CareJournalViewEntry>> {
  const item = await makeQueueItem({
    action: "create",
    actorName: input.caregiver_name ?? null,
    babyId: input.baby_id,
    entityId: createCareUuid(),
    kind: "entry",
    payload: { ...input, override_recent: Boolean(options?.overrideRecent) }
  });
  const result = await submitOrQueue(item);
  const entry = result.envelope.entry ?? queueItemToEntry(item);
  return {
    data: result.queued
      ? { ...entry, local_sync_state: "pending" }
      : entry,
    operationId: item.operationId,
    queued: result.queued
  };
}

export async function deleteCareEntryOfflineFirst(
  entry: CareJournalEntry,
  actorName: string | null
): Promise<CareSyncResult<CareJournalViewEntry>> {
  const item = await makeQueueItem({
    action: "delete",
    actorName,
    baseVersion: entry.version,
    babyId: entry.baby_id,
    entityId: entry.id,
    kind: "entry",
    payload: {}
  });
  const result = await submitOrQueue(item);
  return {
    data: (result.envelope.entry ?? entry) as CareJournalViewEntry,
    operationId: item.operationId,
    queued: result.queued
  };
}

export async function undoCareOperation(
  originalOperationId: string,
  actorName: string | null
) {
  const queue = await readQueue();
  const queuedOriginal = queue.find((item) => item.operationId === originalOperationId);
  if (queuedOriginal?.state === "pending") {
    await mutateQueue((current) => current.filter((item) => item.operationId !== originalOperationId));
    return { queuedCancellation: true };
  }

  const device = await getCareDeviceIdentity();
  const { data, error } = await callRpc("undo_care_sync_operation", {
    p_actor_name: actorName,
    p_device_id: device.id,
    p_device_label: device.label,
    p_original_operation_id: originalOperationId,
    p_undo_operation_id: createCareUuid()
  });
  if (error) throw error;
  emitChange();
  return data as RpcEnvelope;
}

export async function startSharedTimerOfflineFirst({
  actorName,
  babyId,
  breastSide,
  sleepKind,
  timerType
}: {
  actorName: string | null;
  babyId: string;
  breastSide: "both" | "left" | "right";
  sleepKind: "day" | "night";
  timerType: "breastfeeding" | "sleep" | "pumping";
}): Promise<CareSyncResult<CareActiveTimer>> {
  const timerId = createCareUuid();
  const item = await makeQueueItem({
    action: "start_timer",
    actorName,
    babyId,
    entityId: timerId,
    kind: "start_timer",
    payload: { breastSide, sleepKind, timerType }
  });
  const result = await submitOrQueue(item);
  const device = await getCareDeviceIdentity();
  const timer = result.envelope.timer ?? {
    baby_id: babyId,
    breast_side: timerType === "breastfeeding" || timerType === "pumping" ? breastSide : null,
    created_at: item.createdAt,
    ended_at: null,
    ended_by: null,
    ended_by_name: null,
    ended_device_id: null,
    ended_device_label: null,
    id: timerId,
    journal_entry_id: null,
    sleep_kind: timerType === "sleep" ? sleepKind : null,
    started_at: item.createdAt,
    started_by: item.userId,
    started_by_name: actorName,
    started_device_id: device.id,
    started_device_label: device.label,
    timer_type: timerType,
    updated_at: item.createdAt
  };
  return { data: timer, operationId: item.operationId, queued: result.queued };
}

export async function stopSharedTimerOfflineFirst(
  timer: CareActiveTimer,
  actorName: string | null,
  amountMl: number | null = null
): Promise<CareSyncResult<CareActiveTimer>> {
  const item = await makeQueueItem({
    action: "stop_timer",
    actorName,
    babyId: timer.baby_id,
    entityId: timer.id,
    kind: "stop_timer",
    payload: { amountMl }
  });
  const result = await submitOrQueue(item);
  return {
    data: result.envelope.timer ?? { ...timer, ended_at: new Date().toISOString() },
    operationId: item.operationId,
    queued: result.queued
  };
}

export async function takeOverCareOfflineFirst(
  babyId: string,
  caregiverName: string
): Promise<CareSyncResult<CareHandoverSession>> {
  const sessionId = createCareUuid();
  const item = await makeQueueItem({
    action: "take_over",
    actorName: caregiverName,
    babyId,
    entityId: sessionId,
    kind: "handover",
    payload: { caregiverName }
  });
  const result = await submitOrQueue(item);
  const device = await getCareDeviceIdentity();
  const handover = result.envelope.handover ?? {
    baby_id: babyId,
    caregiver_id: item.userId,
    caregiver_name: caregiverName,
    caregiver_role: "caregiver",
    created_at: item.createdAt,
    device_id: device.id,
    device_label: device.label,
    ended_at: null,
    ended_reason: null,
    id: sessionId,
    started_at: item.createdAt
  };
  return { data: handover, operationId: item.operationId, queued: result.queued };
}

export async function flushCareSyncQueue(): Promise<CareSyncStatus> {
  if (flushPromise) return flushPromise;
  flushPromise = flushQueueInternal().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

export async function discardCareSyncConflict(operationId: string) {
  await mutateQueue((queue) => queue.filter((item) => item.operationId !== operationId));
}

async function flushQueueInternal() {
  const network = await NetInfo.fetch();
  currentOnline = network.isConnected !== false && network.isInternetReachable !== false;
  if (!currentOnline) return getCareSyncStatus();

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return getCareSyncStatus();

  const queue = await readQueue();
  for (const item of queue.filter((candidate) => candidate.userId === userId && candidate.state === "pending")) {
    try {
      const envelope = await executeItem(item);
      const timerRace = item.kind === "start_timer" &&
        envelope.status === "already_active" &&
        envelope.timer?.id !== item.entityId;
      if (envelope.status === "conflict" || timerRace) {
        await updateQueueItem(item.operationId, {
          baseVersion: envelope.server_entry?.version ?? item.baseVersion,
          error: timerRace
            ? "Başka bir bakıcı çevrimdışıyken bu bebek için zamanlayıcı başlattı."
            : envelope.reason ?? "Sunucudaki kayıt bu sırada değişti.",
          state: "conflict"
        });
        if (timerRace) {
          await mutateQueue((current) => current.map((candidate) =>
            candidate.kind === "stop_timer" && candidate.entityId === item.entityId
              ? { ...candidate, error: "Yerel zamanlayıcı sunucudaki aktif zamanlayıcıyla çakıştı.", state: "conflict" }
              : candidate
          ));
        }
      } else {
        await mutateQueue((current) => current.filter((candidate) => candidate.operationId !== item.operationId));
      }
    } catch (error) {
      if (await isConnectivityFailure(error)) {
        currentOnline = false;
        emitChange();
        break;
      }
      await updateQueueItem(item.operationId, {
        error: error instanceof Error ? error.message : String(error),
        state: "conflict"
      });
    }
  }
  emitChange();
  return getCareSyncStatus();
}

async function submitOrQueue(item: QueueItem) {
  const network = await NetInfo.fetch();
  currentOnline = network.isConnected !== false && network.isInternetReachable !== false;
  if (!currentOnline) {
    await enqueue(item);
    return { envelope: {} as RpcEnvelope, queued: true };
  }

  try {
    const envelope = await executeItem(item);
    if (envelope.status === "conflict") {
      await enqueue({ ...item, error: envelope.reason ?? "Çakışma", state: "conflict" });
    }
    return { envelope, queued: envelope.status === "conflict" };
  } catch (error) {
    if (!(await isConnectivityFailure(error))) throw error;
    currentOnline = false;
    await enqueue(item);
    return { envelope: {} as RpcEnvelope, queued: true };
  }
}

async function executeItem(item: QueueItem): Promise<RpcEnvelope> {
  const device = await getCareDeviceIdentity();
  let response: { data: unknown; error: { message: string; details?: string } | null };
  if (item.kind === "entry") {
    response = await callRpc("apply_care_sync_operation", {
      p_action: item.action,
      p_actor_name: item.actorName,
      p_base_version: item.baseVersion,
      p_device_id: device.id,
      p_device_label: device.label,
      p_entry_id: item.entityId,
      p_operation_id: item.operationId,
      p_payload: item.payload
    });
  } else if (item.kind === "start_timer") {
    response = await callRpc("start_shared_care_timer", {
      p_actor_name: item.actorName,
      p_baby_id: item.babyId,
      p_breast_side: item.payload.breastSide,
      p_device_id: device.id,
      p_device_label: device.label,
      p_operation_id: item.operationId,
      p_sleep_kind: item.payload.sleepKind,
      p_timer_id: item.entityId,
      p_timer_type: item.payload.timerType
    });
  } else if (item.kind === "stop_timer") {
    response = await callRpc("stop_shared_care_timer_v2", {
      p_actor_name: item.actorName,
      p_device_id: device.id,
      p_device_label: device.label,
      p_operation_id: item.operationId,
      p_amount_ml: item.payload.amountMl ?? null,
      p_timer_id: item.entityId
    });
  } else {
    response = await callRpc("take_over_baby_care", {
      p_baby_id: item.babyId,
      p_caregiver_name: item.payload.caregiverName,
      p_device_id: device.id,
      p_device_label: device.label,
      p_operation_id: item.operationId,
      p_session_id: item.entityId
    });
  }

  if (response.error) {
    const error = new Error(response.error.message) as Error & { details?: string };
    error.details = response.error.details;
    throw error;
  }
  return response.data as RpcEnvelope;
}

async function makeQueueItem({
  action,
  actorName,
  babyId,
  entityId,
  kind,
  payload,
  baseVersion = null
}: {
  action: string;
  actorName: string | null;
  babyId: string;
  baseVersion?: number | null;
  entityId: string;
  kind: QueueKind;
  payload: Record<string, unknown>;
}): Promise<QueueItem> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw error ?? new Error("Bakım kaydı için oturum gerekli.");
  return {
    action,
    actorName,
    babyId,
    baseVersion,
    createdAt: new Date().toISOString(),
    entityId,
    error: null,
    kind,
    operationId: createCareUuid(),
    payload,
    state: "pending",
    userId: data.session.user.id
  };
}

function queueItemToEntry(item: QueueItem): CareJournalViewEntry {
  const payload = item.payload;
  return {
    amount_ml: numberOrNull(payload.amount_ml),
    baby_id: item.babyId,
    breast_side: stringOrNull(payload.breast_side) as CareJournalEntry["breast_side"],
    caregiver_name: item.actorName,
    client_operation_id: item.operationId,
    created_at: item.createdAt,
    created_by: item.userId,
    created_device_id: null,
    created_device_label: null,
    deleted_at: null,
    deleted_by: null,
    deleted_by_name: null,
    deleted_device_id: null,
    deleted_device_label: null,
    diaper_type: stringOrNull(payload.diaper_type) as CareJournalEntry["diaper_type"],
    ended_at: stringOrNull(payload.ended_at),
    entry_type: String(payload.entry_type) as CareJournalEntry["entry_type"],
    feeding_content: stringOrNull(payload.feeding_content) as CareJournalEntry["feeding_content"],
    food_amount: stringOrNull(payload.food_amount),
    food_name: stringOrNull(payload.food_name),
    id: item.entityId,
    is_first_try: Boolean(payload.is_first_try),
    local_sync_state: item.state,
    medicine_dose: stringOrNull(payload.medicine_dose),
    medicine_name: stringOrNull(payload.medicine_name),
    notes: stringOrNull(payload.notes),
    occurred_at: stringOrNull(payload.occurred_at) ?? item.createdAt,
    sleep_kind: stringOrNull(payload.sleep_kind) as CareJournalEntry["sleep_kind"],
    temperature_c: numberOrNull(payload.temperature_c),
    temperature_site: stringOrNull(payload.temperature_site) as CareJournalEntry["temperature_site"],
    updated_at: item.createdAt,
    updated_by: item.userId,
    updated_by_name: item.actorName,
    updated_device_id: null,
    updated_device_label: null,
    version: 1
  };
}

async function enqueue(item: QueueItem) {
  await mutateQueue((queue) => {
    if (queue.some((candidate) => candidate.operationId === item.operationId)) return queue;
    return [...queue, item];
  });
}

async function updateQueueItem(operationId: string, patch: Partial<QueueItem>) {
  await mutateQueue((queue) => queue.map((item) =>
    item.operationId === operationId ? { ...item, ...patch } : item
  ));
}

async function mutateQueue(mutator: (queue: QueueItem[]) => QueueItem[]) {
  queueMutation = queueMutation.then(async () => {
    const queue = await readQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(mutator(queue)));
    emitChange();
  });
  await queueMutation;
}

async function readQueue(): Promise<QueueItem[]> {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as QueueItem[] : [];
  } catch {
    return [];
  }
}

async function isConnectivityFailure(error: unknown) {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || state.isInternetReachable === false) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|networkerror|connection.*lost|internet.*offline/i.test(message);
}

function callRpc(name: string, args: Record<string, unknown>) {
  return supabase.rpc(name as never, args as never) as unknown as Promise<{
    data: unknown;
    error: { message: string; details?: string } | null;
  }>;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
