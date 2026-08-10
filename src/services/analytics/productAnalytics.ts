import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;

export type AnalyticsEventName =
  | "activated"
  | "app_opened"
  | "auth_sign_in_completed"
  | "auth_sign_in_started"
  | "auth_sign_up_started"
  | "birth_preparation_item_completed"
  | "care_alarm_snoozed"
  | "care_journal_archive_shared"
  | "care_journal_entry_added"
  | "care_journal_entry_deleted"
  | "care_journal_operation_undone"
  | "care_journal_report_shared"
  | "care_reminder_cancelled"
  | "care_reminder_scheduled"
  | "care_task_added"
  | "doctor_visit_report_created"
  | "email_verification_required"
  | "first_open"
  | "forum_comment_created"
  | "forum_comment_liked"
  | "forum_comment_unliked"
  | "forum_content_reported"
  | "forum_post_created"
  | "forum_post_liked"
  | "forum_post_unliked"
  | "forum_report_resolved"
  | "forum_user_blocked"
  | "forum_user_unblocked"
  | "forum_viewed"
  | "family_credit_exhausted"
  | "growth_record_added"
  | "home_photo_removed"
  | "home_photo_updated"
  | "life_stage_changed"
  | "lullaby_played"
  | "milk_inventory_updated"
  | "mother_wellbeing_checkin_saved"
  | "night_shift_finished"
  | "night_shift_started"
  | "notification_opened"
  | "onboarding_completed"
  | "onboarding_step_completed"
  | "onboarding_step_viewed"
  | "paywall_dismissed"
  | "paywall_error"
  | "paywall_offering_loaded"
  | "paywall_presented"
  | "paywall_requested"
  | "photo_deleted"
  | "photo_uploaded"
  | "pregnancy_completed_with_birth"
  | "pregnancy_health_entry_created"
  | "pregnancy_health_file_viewed"
  | "pregnancy_health_lab_saved"
  | "pregnancy_health_pdf_shared"
  | "pregnancy_health_reminder_created"
  | "sleep_rhythm_event_created"
  | "sleep_rhythm_event_updated"
  | "sleep_rhythm_opened"
  | "sleep_rhythm_prediction_locked_tapped"
  | "pregnancy_timeline_viewed"
  | "document_insight_completed"
  | "premium_gate_hit"
  | "purchase_cancelled"
  | "purchase_client_completed"
  | "purchase_failed"
  | "purchase_started"
  | "restore_purchases_attempted"
  | "restore_purchases_succeeded"
  | "session_started"
  | "sign_up_submitted"
  | "subscription_expired"
  | "vaccination_marked_done"
  | "vaccination_marked_pending"
  | "baby_profile_created"
  | "baby_tooth_marked"
  | "baby_tooth_unmarked";

export type AnalyticsEventOptions = {
  occurredAt?: string;
  paywallViewId?: string;
};

export type AnalyticsContext = {
  appVersion: string | null;
  installationId: string;
  platform: "android" | "ios" | "web";
  sessionId: string;
  userId: string | null;
};

type QueuedAnalyticsEvent = {
  app_version: string | null;
  event_name: AnalyticsEventName;
  event_properties: AnalyticsProperties;
  event_version: number;
  id: string;
  installation_id: string;
  occurred_at: string;
  paywall_view_id: string | null;
  platform: AnalyticsContext["platform"];
  session_id: string;
  user_id: string | null;
};

type StoredSession = {
  id: string;
  lastActiveAt: number;
};

const INSTALLATION_ID_KEY = "analytics-installation-id-v1";
const SESSION_KEY = "analytics-session-v1";
const FIRST_OPEN_KEY = "analytics-first-open-recorded-v1";
const AUTHENTICATED_SESSION_KEY = "analytics-authenticated-session-v1";
const QUEUE_KEY = "analytics-event-queue-v2";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_QUEUED_EVENTS = 500;
const CORE_ACTIVATION_EVENTS = new Set<AnalyticsEventName>([
  "baby_profile_created",
  "birth_preparation_item_completed",
  "care_journal_entry_added",
  "document_insight_completed",
  "doctor_visit_report_created",
  "growth_record_added",
  "lullaby_played",
  "pregnancy_health_entry_created",
  "pregnancy_timeline_viewed",
  "vaccination_marked_done"
]);

let queueMutation: Promise<void> = Promise.resolve();
let flushPromise: Promise<void> | null = null;
let initializationPromise: Promise<void> | null = null;

export function createAnalyticsEventId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const nibble = value === "x" ? random : (random & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export async function getAnalyticsContext(
  forceNewSession = false
): Promise<AnalyticsContext> {
  const [installationId, session, authSession] = await Promise.all([
    getInstallationId(),
    getSession(forceNewSession),
    supabase.auth.getSession()
  ]);

  return {
    appVersion:
      Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
    installationId,
    platform: normalizePlatform(),
    sessionId: session.id,
    userId: authSession.data.session?.user.id ?? null
  };
}

export async function initializeAnalytics(): Promise<void> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const context = await getAnalyticsContext(true);
    const hasRecordedFirstOpen = await AsyncStorage.getItem(FIRST_OPEN_KEY);

    if (!hasRecordedFirstOpen) {
      await AsyncStorage.setItem(FIRST_OPEN_KEY, "true");
      await enqueueEvent("first_open", {}, context);
    }

    await enqueueEvent("session_started", {}, context);
    await markAuthenticatedSession(context);
    await linkAnalyticsIdentity(context);
    await flushAnalyticsEvents();
  })();

  return initializationPromise;
}

export async function trackSessionStartedIfNeeded(): Promise<void> {
  const stored = await readStoredSession();
  const shouldStart =
    !stored || Date.now() - stored.lastActiveAt >= SESSION_TIMEOUT_MS;
  const context = await getAnalyticsContext(shouldStart);

  if (shouldStart) {
    await enqueueEvent("session_started", {}, context);
    await markAuthenticatedSession(context);
  }

  await linkAnalyticsIdentity(context);
  await flushAnalyticsEvents();
}

export async function trackAuthenticatedSessionStartedIfNeeded(): Promise<void> {
  try {
    const context = await getAnalyticsContext();
    if (!context.userId) return;

    const marker = await readAuthenticatedSessionMarker();

    if (
      marker?.sessionId !== context.sessionId ||
      marker.userId !== context.userId
    ) {
      await enqueueEvent(
        "session_started",
        { identity_state: "authenticated" },
        context
      );
      await markAuthenticatedSession(context);
    }

    await linkAnalyticsIdentity(context);
    await flushAnalyticsEvents();
  } catch (error) {
    console.warn("Authenticated analytics session failed", error);
  }
}

export async function linkAnalyticsIdentity(
  suppliedContext?: AnalyticsContext
): Promise<void> {
  try {
    const context = suppliedContext ?? (await getAnalyticsContext());
    if (!context.userId) return;

    const { error } = await supabase
      .from("analytics_installation_users")
      .upsert(
        {
          installation_id: context.installationId,
          user_id: context.userId
        },
        { ignoreDuplicates: true, onConflict: "installation_id" }
      );

    if (error) {
      console.warn("Analytics identity link failed", error.message);
    }
  } catch (error) {
    console.warn("Analytics identity link failed", error);
  }
}

export async function trackProductEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: AnalyticsEventOptions = {}
): Promise<void> {
  try {
    const context = await getAnalyticsContext();
    await enqueueEvent(eventName, properties, context, options);
    await enqueueActivationIfNeeded(eventName, context);
    await flushAnalyticsEvents();
  } catch (error) {
    console.warn("Analytics event failed", eventName, error);
  }
}

export async function flushAnalyticsEvents(): Promise<void> {
  await queueMutation;
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    try {
      const queue = await readQueue();
      if (queue.length === 0) return;

      const { error } = await supabase
        .from("analytics_events")
        .upsert(queue, { ignoreDuplicates: true, onConflict: "id" });

      if (error) {
        console.warn("Analytics queue flush failed", error.message);
        return;
      }

      const sentIds = new Set(queue.map((event) => event.id));
      queueMutation = queueMutation.then(async () => {
        const currentQueue = await readQueue();
        const remaining = currentQueue.filter((event) => !sentIds.has(event.id));
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      });
      await queueMutation;
    } catch (error) {
      console.warn("Analytics queue flush failed", error);
    } finally {
      flushPromise = null;
    }
  })();

  return flushPromise;
}

async function enqueueEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties,
  context: AnalyticsContext,
  options: AnalyticsEventOptions = {}
) {
  const event: QueuedAnalyticsEvent = {
    app_version: context.appVersion,
    event_name: eventName,
    event_properties: properties,
    event_version: 1,
    id: createAnalyticsEventId(),
    installation_id: context.installationId,
    occurred_at: options.occurredAt ?? new Date().toISOString(),
    paywall_view_id: options.paywallViewId ?? null,
    platform: context.platform,
    session_id: context.sessionId,
    user_id: context.userId
  };

  queueMutation = queueMutation.then(async () => {
    const queue = await readQueue();
    const nextQueue = [...queue, event].slice(-MAX_QUEUED_EVENTS);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(nextQueue));
  });

  await queueMutation;
}

async function enqueueActivationIfNeeded(
  eventName: AnalyticsEventName,
  context: AnalyticsContext
) {
  if (!CORE_ACTIVATION_EVENTS.has(eventName)) return;

  const actorKey = context.userId ?? context.installationId;
  const storageKey = `analytics-activated-v1:${actorKey}`;
  if (await AsyncStorage.getItem(storageKey)) return;

  await AsyncStorage.setItem(storageKey, new Date().toISOString());
  await enqueueEvent(
    "activated",
    { activation_key: eventName },
    context
  );
}

async function getInstallationId() {
  const stored = await readInstallationId();
  if (stored) return stored;

  const installationId = createAnalyticsEventId();
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);
  } else {
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
  }
  return installationId;
}

async function readInstallationId() {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(INSTALLATION_ID_KEY);
  }

  return SecureStore.getItemAsync(INSTALLATION_ID_KEY);
}

async function getSession(forceNew: boolean): Promise<StoredSession> {
  const now = Date.now();
  const stored = await readStoredSession();
  const isExpired = !stored || now - stored.lastActiveAt >= SESSION_TIMEOUT_MS;
  const session =
    forceNew || isExpired
      ? { id: createAnalyticsEventId(), lastActiveAt: now }
      : { ...stored, lastActiveAt: now };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function readStoredSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.id !== "string" || typeof parsed.lastActiveAt !== "number") {
      return null;
    }
    return { id: parsed.id, lastActiveAt: parsed.lastActiveAt };
  } catch {
    return null;
  }
}

async function readQueue(): Promise<QueuedAnalyticsEvent[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

async function markAuthenticatedSession(context: AnalyticsContext) {
  if (!context.userId) return;
  await AsyncStorage.setItem(
    AUTHENTICATED_SESSION_KEY,
    JSON.stringify({ sessionId: context.sessionId, userId: context.userId })
  );
}

async function readAuthenticatedSessionMarker() {
  const rawMarker = await AsyncStorage.getItem(AUTHENTICATED_SESSION_KEY);
  if (!rawMarker) return null;

  try {
    return JSON.parse(rawMarker) as { sessionId?: string; userId?: string };
  } catch {
    return null;
  }
}

function normalizePlatform(): AnalyticsContext["platform"] {
  if (Platform.OS === "web") return "web";
  if (Platform.OS === "android") return "android";
  return "ios";
}
