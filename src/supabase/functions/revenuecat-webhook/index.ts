import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  buildWebhookSubscriptionWrite,
  getTransferUserIds,
  getWebhookIdentityCandidates,
  type RevenueCatWebhookEvent
} from "../_shared/revenuecatWebhook.ts";
import { normalizeRevenueCatSubscriber } from "../_shared/revenuecatSubscription.ts";

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
const REVENUECAT_SECRET_API_KEY =
  Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const REVENUECAT_ENTITLEMENT_ID =
  Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "premium";

type RevenueCatEvent = RevenueCatWebhookEvent & { id?: unknown };

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

    if (event.type === "TRANSFER") {
      if (!REVENUECAT_SECRET_API_KEY) {
        return json({ error: "revenuecat_server_key_missing" }, 500);
      }
      const transferResult = await reconcileTransferUsers(
        supabase,
        getTransferUserIds(event)
      );
      return json({
        duplicate,
        recorded: true,
        subscription_updated: transferResult.updated > 0,
        transfer_failed: transferResult.failed,
        transfer_reconciled: transferResult.updated,
        success: transferResult.failed === 0
      }, transferResult.failed === 0 ? 200 : 207);
    }

    const cacheWrite = userId
      ? buildWebhookSubscriptionWrite(event, userId)
      : null;

    if (!cacheWrite || !userId || !productId) {
      return json({
        duplicate,
        recorded: true,
        subscription_updated: false,
        success: true,
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase.rpc(
      "apply_revenuecat_subscription_cache",
      {
        p_environment: cacheWrite.environment,
        p_event_at: cacheWrite.eventAt,
        p_expires_at: cacheWrite.expiresAt,
        p_is_lifetime: cacheWrite.isLifetime,
        p_product_id: cacheWrite.productId,
        p_status: cacheWrite.status,
        p_user_id: cacheWrite.userId,
        p_verified_at: cacheWrite.verifiedAt
      }
    );

    if (subscriptionError) {
      console.error("Subscription cache update failed", subscriptionError);
      return json({ error: subscriptionError.message }, 500);
    }

    const applied = Boolean(
      subscription
      && subscription.environment === cacheWrite.environment
      && subscription.revenuecat_event_at === cacheWrite.eventAt
    );

    return json({
      environment_precedence_ignored: !applied,
      duplicate,
      recorded: true,
      subscription_updated: applied,
      success: true,
    });
  } catch (error) {
    console.error("RevenueCat webhook failed", error);
    return json({ error: String(error) }, 500);
  }
});

async function resolveUserId(
  supabase: ReturnType<typeof createClient<any>>,
  event: RevenueCatEvent,
) {
  const candidates = getWebhookIdentityCandidates(event);

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

async function reconcileTransferUsers(
  supabase: ReturnType<typeof createClient<any>>,
  userIds: string[]
) {
  let updated = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}`
          },
          signal: AbortSignal.timeout(15_000)
        }
      );
      if (!response.ok) throw new Error(`RevenueCat HTTP ${response.status}`);

      const normalized = normalizeRevenueCatSubscriber(
        await response.json(),
        REVENUECAT_ENTITLEMENT_ID
      );
      const verifiedAt = new Date().toISOString();
      let write = normalized
        ? {
            environment: normalized.environment,
            expiresAt: normalized.expiresAt,
            isLifetime: normalized.isLifetime,
            productId: normalized.productId,
            status: normalized.status
          }
        : null;

      if (!write) {
        const { data: current, error: currentError } = await supabase
          .from("subscriptions")
          .select("environment,product_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (currentError) throw currentError;
        if (current?.product_id && current.environment !== "UNKNOWN") {
          write = {
            environment: current.environment,
            expiresAt: verifiedAt,
            isLifetime: false,
            productId: current.product_id,
            status: "expired" as const
          };
        }
      }

      if (!write) continue;
      const { error } = await supabase.rpc(
        "apply_revenuecat_subscription_cache",
        {
          p_environment: write.environment,
          p_event_at: null,
          p_expires_at: write.expiresAt,
          p_is_lifetime: write.isLifetime,
          p_product_id: write.productId,
          p_status: write.status,
          p_user_id: userId,
          p_verified_at: verifiedAt
        }
      );
      if (error) throw error;
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `RevenueCat transfer reconciliation failed (...${userId.slice(-6)})`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return { failed, updated };
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
