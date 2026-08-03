import { createCareUuid, getCareDeviceIdentity } from "@/features/care-journal/careSync";
import { supabase } from "@/lib/supabase";

export type FamilyLifeStage = "pregnancy" | "postpartum";
export type FamilyMemberRole = "father" | "caregiver";
export type FamilyParticipantRole = "mother" | FamilyMemberRole;
export type FamilyAccessScope = "full_family" | "baby_care_only";
export type FamilyTaskAssigneeScope = "mother" | "member" | "both";
export type FamilyTaskAlarmStatus =
  | "none"
  | "scheduled"
  | "sent"
  | "snoozed"
  | "dismissed"
  | "cancelled";

export type FamilyFeatureAccess = {
  allowed: boolean;
  is_premium: boolean;
  limit?: number;
  reason: string | null;
  remaining: number | null;
  reservation_id?: string | null;
  reserved?: number;
  used?: number;
};

export type FamilyParticipant = {
  access_scope: FamilyAccessScope;
  display_name: string;
  notifications_ready: boolean;
  role: FamilyParticipantRole;
  user_id: string;
};

export type FamilyCoordinationBaby = {
  birth_date: string;
  id: string;
  name: string;
};

export type FamilyCoordinationContext = {
  access_scope: FamilyAccessScope;
  babies: FamilyCoordinationBaby[];
  can_access_maternal: boolean;
  current_role: FamilyParticipantRole;
  current_user_id: string;
  feature_access: FamilyFeatureAccess;
  life_stage: FamilyLifeStage;
  owner_id: string;
  participants: FamilyParticipant[];
  profile: {
    due_date: string | null;
    id: string;
    is_pregnant: boolean | null;
  };
};

export type FamilyTaskAssignment = {
  alarm_at: string | null;
  alarm_dismissed_at: string | null;
  alarm_generation: number;
  alarm_sent_at: string | null;
  alarm_status: FamilyTaskAlarmStatus;
  created_at: string;
  display_name_snapshot: string;
  id: string;
  profile_id: string;
  role_snapshot: FamilyParticipantRole;
  task_id: string;
  updated_at: string;
  user_id: string;
};

export type FamilyTask = {
  assigned_to_name: string | null;
  assignments: FamilyTaskAssignment[];
  baby_id: string | null;
  client_operation_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  created_by: string;
  due_at: string | null;
  id: string;
  life_stage: FamilyLifeStage;
  notes: string | null;
  preset_key: string | null;
  profile_id: string;
  title: string;
  updated_at: string;
};

export type FamilyTaskMutationResult = FamilyFeatureAccess & {
  task: FamilyTask | null;
};

export type PregnancySupportSession = {
  caregiver_id: string;
  caregiver_name: string;
  caregiver_role: FamilyParticipantRole;
  client_operation_id: string;
  created_at: string;
  device_id: string;
  device_label: string | null;
  ended_at: string | null;
  ended_reason: "handed_over" | "manual" | null;
  id: string;
  profile_id: string;
  started_at: string;
  updated_at: string;
};

export type PregnancySupportSnapshot = {
  active_session: PregnancySupportSession | null;
  birth_preparation_open_count: number;
  due_date: string | null;
  generated_at: string;
  last_weight: { record_date: string; weight_kg: number } | null;
  medical_prediction: false;
  next_alarm: FamilyTaskAssignment | null;
  next_task: FamilyTask | null;
  next_vaccination: {
    id: string;
    recommended_week_end: number;
    recommended_week_start: number;
    scheduled_date: string;
    vaccine_name: string;
  } | null;
  open_task_count: number;
  pregnancy_week: number | null;
  profile_id: string;
};

export type PregnancySupportTakeoverResult = FamilyFeatureAccess & {
  session: PregnancySupportSession | null;
  snapshot: PregnancySupportSnapshot | null;
};

export type CreateFamilyTaskInput = {
  alarmAt?: Date | string | null;
  assigneeScope: FamilyTaskAssigneeScope;
  babyId?: string | null;
  dueAt?: Date | string | null;
  lifeStage: FamilyLifeStage;
  notes?: string | null;
  operationId?: string;
  presetKey?: string | null;
  title: string;
};

export type ReserveFamilyFeatureInput = {
  featureKey: string;
  lifeStage: FamilyLifeStage;
  operationId?: string;
};

const untypedSupabase = supabase as any;

export async function getFamilyCoordinationContext() {
  const data = await callRpc<FamilyCoordinationContext>(
    "get_family_coordination_context"
  );
  return {
    ...data,
    babies: Array.isArray(data.babies) ? data.babies : [],
    participants: Array.isArray(data.participants) ? data.participants : [],
    feature_access: normalizeFeatureAccess(data.feature_access)
  } satisfies FamilyCoordinationContext;
}

export async function getFamilyFeatureAccess() {
  const data = await callRpc<FamilyFeatureAccess>("get_family_feature_access");
  return normalizeFeatureAccess(data);
}

export async function reserveFamilyFeatureCredit({
  featureKey,
  lifeStage,
  operationId = createCareUuid()
}: ReserveFamilyFeatureInput) {
  const data = await callRpc<FamilyFeatureAccess>(
    "reserve_family_feature_credit",
    {
      p_feature_key: featureKey,
      p_life_stage: lifeStage,
      p_operation_id: operationId
    }
  );
  return {
    ...normalizeFeatureAccess(data),
    operationId
  };
}

export async function commitFamilyFeatureCredit(operationId: string) {
  const data = await callRpc<FamilyFeatureAccess>(
    "commit_family_feature_credit",
    { p_operation_id: operationId }
  );
  return normalizeFeatureAccess(data);
}

export async function releaseFamilyFeatureCredit(operationId: string) {
  const data = await callRpc<FamilyFeatureAccess>(
    "release_family_feature_credit",
    { p_operation_id: operationId }
  );
  return normalizeFeatureAccess(data);
}

export async function createFamilyTask(input: CreateFamilyTaskInput) {
  const operationId = input.operationId ?? createCareUuid();
  const data = await callRpc<FamilyTaskMutationResult>("create_family_task", {
    p_alarm_at: toIso(input.alarmAt),
    p_assignee_scope: input.assigneeScope,
    p_baby_id: input.babyId ?? null,
    p_due_at: toIso(input.dueAt),
    p_life_stage: input.lifeStage,
    p_notes: cleanOptional(input.notes),
    p_operation_id: operationId,
    p_preset_key: cleanOptional(input.presetKey),
    p_title: input.title.trim()
  });

  return {
    ...normalizeFeatureAccess(data),
    task: normalizeTask(data.task),
    operationId
  };
}

export async function listFamilyTasks({
  babyId = null,
  includeCompleted = false,
  lifeStage
}: {
  babyId?: string | null;
  includeCompleted?: boolean;
  lifeStage: FamilyLifeStage;
}) {
  const data = await callRpc<unknown[]>("list_family_tasks", {
    p_baby_id: babyId,
    p_include_completed: includeCompleted,
    p_life_stage: lifeStage
  });
  return (Array.isArray(data) ? data : [])
    .map(normalizeTask)
    .filter((task): task is FamilyTask => Boolean(task));
}

export async function completeFamilyTask(
  taskId: string,
  completed = true
) {
  const data = await callRpc<FamilyTask>("complete_family_task", {
    p_completed: completed,
    p_task_id: taskId
  });
  const task = normalizeTask(data);
  if (!task) throw new Error("Görev yanıtı hazırlanamadı.");
  return task;
}

export async function snoozeFamilyTaskAlarm(
  assignmentId: string,
  scheduledFor: Date | string
) {
  return callRpc<FamilyTaskAssignment>("snooze_family_task_alarm", {
    p_assignment_id: assignmentId,
    p_scheduled_for: toIso(scheduledFor)
  });
}

export async function cancelFamilyTaskAlarm(assignmentId: string) {
  return callRpc<FamilyTaskAssignment>("cancel_family_task_alarm", {
    p_assignment_id: assignmentId
  });
}

export async function takeOverPregnancySupport({
  caregiverName,
  operationId = createCareUuid()
}: {
  caregiverName?: string | null;
  operationId?: string;
} = {}) {
  const device = await getCareDeviceIdentity();
  const data = await callRpc<PregnancySupportTakeoverResult>(
    "take_over_pregnancy_support",
    {
      p_caregiver_name: cleanOptional(caregiverName),
      p_device_id: device.id,
      p_device_label: device.label,
      p_operation_id: operationId
    }
  );
  return {
    ...normalizeFeatureAccess(data),
    session: data.session ?? null,
    snapshot: data.snapshot ?? null,
    operationId
  };
}

export async function getPregnancySupportSnapshot() {
  return callRpc<PregnancySupportSnapshot>(
    "get_pregnancy_support_snapshot"
  );
}

export function subscribeToFamilyCoordination(
  profileId: string,
  onChange: () => void
) {
  const channel = untypedSupabase
    .channel(`family-coordination:${profileId}:${createCareUuid()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `profile_id=eq.${profileId}`,
        schema: "public",
        table: "care_tasks"
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `profile_id=eq.${profileId}`,
        schema: "public",
        table: "care_task_assignments"
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `profile_id=eq.${profileId}`,
        schema: "public",
        table: "pregnancy_support_sessions"
      },
      onChange
    )
    .subscribe();

  return () => {
    untypedSupabase.removeChannel(channel).catch(() => undefined);
  };
}

async function callRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {}
) {
  const { data, error } = await untypedSupabase.rpc(functionName, args);
  if (error) throw error;
  return data as T;
}

function normalizeFeatureAccess(value: Partial<FamilyFeatureAccess> | null | undefined) {
  return {
    ...value,
    allowed: Boolean(value?.allowed),
    is_premium: Boolean(value?.is_premium),
    reason: typeof value?.reason === "string" ? value.reason : null,
    remaining:
      typeof value?.remaining === "number" ? value.remaining : null
  } as FamilyFeatureAccess;
}

function normalizeTask(value: unknown): FamilyTask | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FamilyTask>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return null;
  }
  return {
    ...(candidate as FamilyTask),
    assignments: Array.isArray(candidate.assignments)
      ? candidate.assignments
      : []
  };
}

function cleanOptional(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function toIso(value?: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Geçerli bir tarih ve saat gerekli.");
  }
  return date.toISOString();
}
