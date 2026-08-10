import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_AUTH_HEADER =
  Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER") ?? "";

const LIFETIME_PRODUCT_IDS: string[] = [];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueCatEvent = Record<string, unknown> & {
  aliases?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  type?: unknown;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!WEBHOOK_AUTH_HEADER || authHeader !== `Bearer ${WEBHOOK_AUTH_HEADER}`) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "server_not_configured" }, 500);
  }

  try {
    const payload = await request.json();
    const event = payload?.event as RevenueCatEvent | undefined;
    if (!event || typeof event.type !== "string") {
      return json({ error: "invalid_event" }, 400);
    }

    if (event.type === "TEST") {
      return json({ ignored: "test", success: true });
    }

    const eventId = stringValue(event.id);
    const eventTimestampMs = numberValue(event.event_timestamp_ms);
    if (!eventId || eventTimestampMs === null) {
      return json({ error: "missing_event_identity" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const userId = await resolveUserId(supabase, event);
    const productId = stringValue(event.product_id);
    const expirationAtMs = numberValue(event.expiration_at_ms);
    const eventAt = toIsoDate(eventTimestampMs) ?? new Date().toISOString();

    const { data: insertedEvent, error: eventError } = await supabase
      .from("revenuecat_events")
      .upsert(
        {
          revenuecat_event_id: eventId,
          user_id: userId,
          event_type: event.type,
          product_id: productId,
          new_product_id: stringValue(event.new_product_id),
          presented_offering_id: stringValue(event.presented_offering_id),
          transaction_id: stringValue(event.transaction_id),
          original_transaction_id: stringValue(event.original_transaction_id),
          period_type: stringValue(event.period_type),
          price: numberValue(event.price),
          currency: stringValue(event.currency),
          commission_percentage: numberValue(event.commission_percentage),
          tax_percentage: numberValue(event.tax_percentage),
          store: stringValue(event.store),
          environment: stringValue(event.environment),
          cancel_reason: stringValue(event.cancel_reason),
          expiration_reason: stringValue(event.expiration_reason),
          purchased_at: toIsoDate(numberValue(event.purchased_at_ms)),
          expiration_at: toIsoDate(expirationAtMs),
          event_at: eventAt,
        },
        {
          ignoreDuplicates: true,
          onConflict: "revenuecat_event_id",
        },
      )
      .select("revenuecat_event_id")
      .maybeSingle();

    if (eventError) {
      console.error("RevenueCat event insert failed", eventError);
      return json({ error: eventError.message }, 500);
    }

    const duplicate = !insertedEvent;

    const status = mapEventTypeToStatus(
      event.type,
      expirationAtMs,
    );

    if (!status || !userId || !productId) {
      return json({
        duplicate,
        recorded: true,
        subscription_updated: false,
        success: true,
      });
    }

    const { data: currentSubscription, error: currentSubscriptionError } =
      await supabase
        .from("subscriptions")
        .select("updated_at")
        .eq("user_id", userId)
        .maybeSingle();

    if (currentSubscriptionError) {
      console.error(
        "Current subscription lookup failed",
        currentSubscriptionError,
      );
      return json({ error: currentSubscriptionError.message }, 500);
    }

    if (
      currentSubscription?.updated_at &&
      new Date(currentSubscription.updated_at).getTime() >
        new Date(eventAt).getTime()
    ) {
      return json({
        duplicate,
        recorded: true,
        stale: true,
        subscription_updated: false,
        success: true,
      });
    }

    const isLifetime = LIFETIME_PRODUCT_IDS.includes(productId);
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          product_id: productId,
          status,
          is_lifetime: isLifetime,
          expires_at: isLifetime ? null : toIsoDate(expirationAtMs),
          updated_at: eventAt,
        },
        { onConflict: "user_id" },
      );

    if (subscriptionError) {
      console.error("Subscription cache update failed", subscriptionError);
      return json({ error: subscriptionError.message }, 500);
    }

    return json({
      duplicate,
      recorded: true,
      subscription_updated: true,
      success: true,
    });
  } catch (error) {
    console.error("RevenueCat webhook failed", error);
    return json({ error: String(error) }, 500);
  }
});

export function mapEventTypeToStatus(
  eventType: string,
  expirationAtMs: number | null,
): "active" | "cancelled" | "expired" | "grace_period" | null {
  const expiresInFuture =
    expirationAtMs !== null && expirationAtMs > Date.now();

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "REFUND_REVERSED":
      return "active";
    case "CANCELLATION":
      return expiresInFuture ? "active" : "cancelled";
    case "EXPIRATION":
      return "expired";
    case "BILLING_ISSUE":
      return "grace_period";
    default:
      return null;
  }
}

async function resolveUserId(
  supabase: ReturnType<typeof createClient<any>>,
  event: RevenueCatEvent,
) {
  const aliases = Array.isArray(event.aliases) ? event.aliases : [];
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...aliases,
  ].filter((value): value is string =>
    typeof value === "string" && UUID_PATTERN.test(value)
  );

  for (const candidate of [...new Set(candidates)]) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
  }

  return null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toIsoDate(value: number | null) {
  return value === null ? null : new Date(value).toISOString();
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
