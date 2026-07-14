import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";
import { createCareUuid, getCareDeviceIdentity } from "./careSync";

const QUEUE_KEY = "milk-inventory-queue-v1";

export type MilkContainer = Tables<"milk_storage_containers">;
export type MilkStorageEvent = Tables<"milk_storage_events">;
export type MilkInventorySummary = {
  daily_average_ml: number;
  estimated_days: number | null;
  expiring_within_24h: number;
  freezer_ml: number;
  refrigerator_ml: number;
  thawed_ml: number;
  total_ml: number;
  use_next: MilkContainer | null;
};

type MilkQueueItem = {
  babyId: string;
  createdAt: string;
  operationId: string;
  rpc: string;
  args: Record<string, unknown>;
};

let flushPromise: Promise<void> | null = null;

export async function listMilkContainers(babyId: string) {
  await flushMilkInventoryQueue();
  const { data, error } = await supabase
    .from("milk_storage_containers")
    .select("*")
    .eq("baby_id", babyId)
    .order("status", { ascending: true })
    .order("expires_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMilkStorageEvents(babyId: string) {
  const { data, error } = await supabase
    .from("milk_storage_events")
    .select("*")
    .eq("baby_id", babyId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMilkInventorySummary(babyId: string) {
  const { data, error } = await supabase.rpc("get_milk_inventory_summary", {
    p_baby_id: babyId
  });
  if (error) throw error;
  return data as unknown as MilkInventorySummary;
}

export async function createMilkContainer(input: {
  actorName: string | null;
  amountMl: number;
  babyId: string;
  expiresAt?: string | null;
  label?: string | null;
  notes?: string | null;
  pumpedAt: string;
  storageLocation: "freezer" | "refrigerator";
}) {
  return submitMilkOperation("create_milk_storage_container", input.babyId, {
    p_actor_name: input.actorName,
    p_amount_ml: input.amountMl,
    p_baby_id: input.babyId,
    p_expires_at: input.expiresAt ?? null,
    p_label: input.label ?? null,
    p_notes: input.notes ?? null,
    p_pumped_at: input.pumpedAt,
    p_storage_location: input.storageLocation
  });
}

export async function consumeMilk(input: {
  actorName: string | null;
  amountMl: number;
  babyId: string;
  containerId?: string | null;
}) {
  return submitMilkOperation("consume_milk_stock", input.babyId, {
    p_actor_name: input.actorName,
    p_amount_ml: input.amountMl,
    p_baby_id: input.babyId,
    p_container_id: input.containerId ?? null
  });
}

export async function thawMilk(container: MilkContainer, actorName: string | null) {
  return submitMilkOperation("thaw_milk_storage_container", container.baby_id, {
    p_actor_name: actorName,
    p_container_id: container.id,
    p_thawed_at: new Date().toISOString()
  });
}

export async function discardMilk(container: MilkContainer, actorName: string | null) {
  return submitMilkOperation("discard_milk_storage_container", container.baby_id, {
    p_actor_name: actorName,
    p_container_id: container.id
  });
}

export function subscribeToMilkInventory(babyId: string, onChange: () => void) {
  const channel = supabase.channel(`milk-inventory:${babyId}`).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "milk_storage_containers", filter: `baby_id=eq.${babyId}` },
    onChange
  ).subscribe();
  return () => { supabase.removeChannel(channel).catch(() => undefined); };
}

export async function flushMilkInventoryQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) return;
    const queue = await readQueue();
    const remaining: MilkQueueItem[] = [];
    for (const item of queue) {
      const { error } = await callRpc(item.rpc, item.args);
      if (error) remaining.push(item);
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  })().finally(() => { flushPromise = null; });
  return flushPromise;
}

async function submitMilkOperation(rpc: string, babyId: string, args: Record<string, unknown>) {
  const device = await getCareDeviceIdentity();
  const item: MilkQueueItem = {
    args: {
      ...args,
      p_device_id: device.id,
      p_device_label: device.label,
      p_operation_id: createCareUuid()
    },
    babyId,
    createdAt: new Date().toISOString(),
    operationId: createCareUuid(),
    rpc
  };
  item.args.p_operation_id = item.operationId;
  const network = await NetInfo.fetch();
  if (network.isConnected === false || network.isInternetReachable === false) {
    await enqueue(item);
    return { queued: true };
  }
  const { data, error } = await callRpc(rpc, item.args);
  if (error) {
    if (/network|fetch|connection/i.test(error.message)) {
      await enqueue(item);
      return { queued: true };
    }
    throw error;
  }
  return { data, queued: false };
}

function callRpc(name: string, args: Record<string, unknown>) {
  return supabase.rpc(name as never, args as never) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

async function enqueue(item: MilkQueueItem) {
  const queue = await readQueue();
  if (!queue.some((candidate) => candidate.operationId === item.operationId)) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
  }
}

async function readQueue(): Promise<MilkQueueItem[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as MilkQueueItem[] : [];
  } catch {
    return [];
  }
}
