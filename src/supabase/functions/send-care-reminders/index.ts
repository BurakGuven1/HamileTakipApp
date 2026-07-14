import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

type ReminderRow = {
  id: string;
  baby_id: string;
  body: string;
  created_by: string;
  creator_push_token: string | null;
  entry_type: string;
  title: string;
};

type IntelligenceRow = {
  id: string;
  baby_id: string;
  body: string;
  exclude_user_id: string | null;
  kind: "sleep_prediction" | "medicine_safety" | "development_period" | "milk_expiry";
  payload: Record<string, unknown> | null;
  requires_premium: boolean;
  title: string;
};

type BabyRow = { id: string; parent_id: string };
type FamilyMemberRow = { member_id: string; owner_id: string };
type FamilyPremiumTrialRow = { expires_at: string; owner_id: string };
type PushTokenRow = { expo_push_token: string; user_id: string };
type NotificationPreferenceRow = {
  id: string;
  notify_development_periods: boolean;
  notify_medicine_safety: boolean;
  notify_sleep_predictions: boolean;
  notify_milk_inventory: boolean;
};
type SubscriptionRow = {
  expires_at: string | null;
  is_lifetime: boolean;
  status: string;
  user_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (!await isAuthorized(req, supabase)) {
      return json({ error: "unauthorized" }, 401);
    }

    const now = new Date().toISOString();

    const [reminderResult, intelligenceResult] = await Promise.all([
      supabase
        .from("care_reminders")
        .select("id,baby_id,created_by,creator_push_token,entry_type,title,body")
        .eq("status", "scheduled")
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(100),
      supabase
        .from("care_intelligence_notifications")
        .select("id,baby_id,exclude_user_id,kind,title,body,payload,requires_premium")
        .eq("status", "scheduled")
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(100),
    ]);

    if (reminderResult.error) {
      return json({ error: reminderResult.error.message }, 500);
    }
    if (intelligenceResult.error) {
      return json({ error: intelligenceResult.error.message }, 500);
    }

    const reminders = (reminderResult.data ?? []) as ReminderRow[];
    const intelligence = (intelligenceResult.data ?? []) as IntelligenceRow[];
    if (reminders.length === 0 && intelligence.length === 0) {
      return json({ success: true, sent: 0 });
    }

    const babyIds = [...new Set([
      ...reminders.map((item) => item.baby_id),
      ...intelligence.map((item) => item.baby_id),
    ])];
    const { data: babyData, error: babyError } = await supabase
      .from("babies")
      .select("id,parent_id")
      .in("id", babyIds);
    if (babyError) return json({ error: babyError.message }, 500);

    const babies = (babyData ?? []) as BabyRow[];
    const ownerByBaby = new Map(babies.map((baby) => [baby.id, baby.parent_id]));
    const ownerIds = [...new Set(babies.map((baby) => baby.parent_id))];

    const { data: preferenceData, error: preferenceError } = await supabase
      .from("profiles")
      .select(
        "id,notify_sleep_predictions,notify_medicine_safety,notify_development_periods,notify_milk_inventory",
      )
      .in("id", ownerIds);
    if (preferenceError) return json({ error: preferenceError.message }, 500);
    const preferencesByOwner = new Map(
      ((preferenceData ?? []) as NotificationPreferenceRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("user_id,status,is_lifetime,expires_at")
      .in("user_id", ownerIds);
    if (subscriptionError) return json({ error: subscriptionError.message }, 500);

    const premiumOwners = activeSubscriptionUsers(
      (subscriptionData ?? []) as SubscriptionRow[],
    );

    const { data: memberData, error: memberError } = await supabase
      .from("family_members")
      .select("owner_id,member_id")
      .in("owner_id", ownerIds);
    if (memberError) return json({ error: memberError.message }, 500);
    const members = (memberData ?? []) as FamilyMemberRow[];
    const memberIds = [...new Set(members.map((member) => member.member_id))];

    const memberSubscriptionResult = memberIds.length > 0
      ? await supabase
        .from("subscriptions")
        .select("user_id,status,is_lifetime,expires_at")
        .in("user_id", memberIds)
      : { data: [], error: null };
    if (memberSubscriptionResult.error) {
      return json({ error: memberSubscriptionResult.error.message }, 500);
    }
    const premiumMembers = activeSubscriptionUsers(
      (memberSubscriptionResult.data ?? []) as SubscriptionRow[],
    );

    const { data: trialData, error: trialError } = await supabase
      .from("family_premium_trials")
      .select("owner_id,expires_at")
      .in("owner_id", ownerIds);
    if (trialError) return json({ error: trialError.message }, 500);
    const activeTrialOwners = new Set(
      ((trialData ?? []) as FamilyPremiumTrialRow[])
        .filter((trial) => Date.parse(trial.expires_at) > Date.now())
        .map((trial) => trial.owner_id),
    );

    const allFamilyRecipientsByOwner = new Map<string, Set<string>>();
    const premiumRecipientsByOwner = new Map<string, Set<string>>();
    for (const ownerId of ownerIds) {
      allFamilyRecipientsByOwner.set(ownerId, new Set([ownerId]));
      premiumRecipientsByOwner.set(
        ownerId,
        premiumOwners.has(ownerId) ? new Set([ownerId]) : new Set(),
      );
    }

    for (const member of members) {
      const allFamily = allFamilyRecipientsByOwner.get(member.owner_id) ?? new Set();
      allFamily.add(member.member_id);
      allFamilyRecipientsByOwner.set(member.owner_id, allFamily);

      const premiumFamily = premiumRecipientsByOwner.get(member.owner_id) ?? new Set();
      if (
        premiumMembers.has(member.member_id) ||
        activeTrialOwners.has(member.owner_id)
      ) {
        premiumFamily.add(member.member_id);
      }
      premiumRecipientsByOwner.set(member.owner_id, premiumFamily);
    }

    const allRecipientIds = [...new Set(
      [...allFamilyRecipientsByOwner.values()].flatMap((set) => [...set]),
    )];
    const tokenResult = allRecipientIds.length > 0
      ? await supabase
        .from("push_tokens")
        .select("user_id,expo_push_token")
        .in("user_id", allRecipientIds)
      : { data: [], error: null };
    if (tokenResult.error) return json({ error: tokenResult.error.message }, 500);

    const tokensByUser = new Map<string, string[]>();
    for (const token of (tokenResult.data ?? []) as PushTokenRow[]) {
      tokensByUser.set(token.user_id, [
        ...(tokensByUser.get(token.user_id) ?? []),
        token.expo_push_token,
      ]);
    }

    const messages: Record<string, unknown>[] = [];
    for (const reminder of reminders) {
      const ownerId = ownerByBaby.get(reminder.baby_id);
      const eligibleRecipients = ownerId
        ? premiumRecipientsByOwner.get(ownerId)
        : undefined;
      if (!ownerId || !eligibleRecipients?.has(reminder.created_by)) continue;

      for (const userId of eligibleRecipients) {
        for (const token of tokensByUser.get(userId) ?? []) {
          if (token === reminder.creator_push_token) continue;
          messages.push({
            to: token,
            title: reminder.title,
            body: reminder.body,
            sound: "baby_reminder.wav",
            channelId: "care-reminders",
            priority: "high",
            data: {
              screen: "care-journal",
              type: "care_reminder",
              entry: reminder.entry_type,
              reminder_id: reminder.id,
            },
          });
        }
      }
    }

    for (const notification of intelligence) {
      const ownerId = ownerByBaby.get(notification.baby_id);
      if (!ownerId) continue;
      const preference = preferencesByOwner.get(ownerId);
      if (
        (notification.kind === "sleep_prediction" &&
          preference?.notify_sleep_predictions === false) ||
        (notification.kind === "medicine_safety" &&
          preference?.notify_medicine_safety === false) ||
        (notification.kind === "development_period" &&
          preference?.notify_development_periods === false) ||
        (notification.kind === "milk_expiry" &&
          preference?.notify_milk_inventory === false)
      ) continue;
      const eligibleRecipients = notification.requires_premium
        ? premiumRecipientsByOwner.get(ownerId)
        : allFamilyRecipientsByOwner.get(ownerId);

      for (const userId of eligibleRecipients ?? []) {
        if (notification.exclude_user_id === userId) continue;
        for (const token of tokensByUser.get(userId) ?? []) {
          messages.push({
            to: token,
            title: notification.title,
            body: notification.body,
            sound: notification.kind === "sleep_prediction"
              ? "baby_reminder.wav"
              : "default",
            channelId: notification.kind === "medicine_safety"
              ? "care-safety"
              : notification.kind === "sleep_prediction"
                ? "sleep-insights"
              : notification.kind === "milk_expiry"
                ? "milk-inventory"
                : "development-insights",
            priority: "high",
            data: {
              ...(notification.payload ?? {}),
              screen: "care-journal",
              type: notification.kind,
              intelligence_id: notification.id,
            },
          });
        }
      }
    }

    for (let index = 0; index < messages.length; index += 100) {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages.slice(index, index + 100)),
      });
      if (!response.ok) return json({ error: await response.text() }, 502);
    }

    if (reminders.length > 0) {
      const { error: updateError } = await supabase
        .from("care_reminders")
        .update({ status: "sent", sent_at: now })
        .in("id", reminders.map((item) => item.id));
      if (updateError) return json({ error: updateError.message }, 500);
    }

    if (intelligence.length > 0) {
      const { error: intelligenceUpdateError } = await supabase
        .from("care_intelligence_notifications")
        .update({ status: "sent", sent_at: now })
        .in("id", intelligence.map((item) => item.id));
      if (intelligenceUpdateError) {
        return json({ error: intelligenceUpdateError.message }, 500);
      }
    }

    return json({
      success: true,
      reminders: reminders.length,
      intelligence: intelligence.length,
      sent: messages.length,
    });
  } catch (error) {
    console.error("send-care-reminders failed", error);
    return json({ error: String(error) }, 500);
  }
});

function activeSubscriptionUsers(rows: SubscriptionRow[]) {
  return new Set(
    rows
      .filter((item) =>
        (item.status === "active" || item.status === "grace_period") &&
        (item.is_lifetime || !item.expires_at || Date.parse(item.expires_at) > Date.now())
      )
      .map((item) => item.user_id),
  );
}

async function isAuthorized(
  req: Request,
  supabase: ReturnType<typeof createClient<any>>,
) {
  const dispatchSecret = req.headers.get("x-care-dispatch-secret");
  if (dispatchSecret) {
    const { data } = await supabase
      .from("care_dispatch_config")
      .select("dispatch_secret")
      .eq("singleton", true)
      .maybeSingle();
    if (
      typeof data?.dispatch_secret === "string" &&
      safeEqual(dispatchSecret, data.dispatch_secret)
    ) {
      return true;
    }
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
