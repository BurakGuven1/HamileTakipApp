import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  normalizeRevenueCatSubscriber,
  type RevenueCatEnvironment,
  type RevenueCatSubscriptionStatus
} from "../_shared/revenuecatSubscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export type SubscriptionCacheRow = {
  environment: RevenueCatEnvironment;
  expires_at: string | null;
  is_lifetime: boolean;
  product_id: string | null;
  status: RevenueCatSubscriptionStatus;
  verified_at: string | null;
};

export type SubscriptionCacheWrite = {
  environment: RevenueCatEnvironment;
  eventAt: string | null;
  expiresAt: string | null;
  isLifetime: boolean;
  productId: string;
  status: RevenueCatSubscriptionStatus;
  userId: string;
  verifiedAt: string;
};

export type ReconcileRevenueCatDependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  entitlementId: string;
  fetchSubscriber: (userId: string) => Promise<unknown>;
  now: () => Date;
  readSubscription: (userId: string) => Promise<SubscriptionCacheRow | null>;
  reportError?: (message: string, detail: string) => void;
  writeSubscription: (
    input: SubscriptionCacheWrite
  ) => Promise<SubscriptionCacheRow | null>;
};

export function createReconcileRevenueCatHandler(
  dependencies: ReconcileRevenueCatDependencies
) {
  return async function reconcileRevenueCat(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const userId = await dependencies.authenticate(request).catch(() => null);
    if (!userId) {
      return json({ error: "unauthorized" }, 401);
    }

    let subscriberPayload: unknown;
    try {
      subscriberPayload = await dependencies.fetchSubscriber(userId);
    } catch (error) {
      reportError(
        dependencies,
        "RevenueCat subscriber verification failed",
        error
      );
      return json({ error: "revenuecat_unavailable" }, 502);
    }

    const verifiedAt = dependencies.now().toISOString();
    const normalized = normalizeRevenueCatSubscriber(
      subscriberPayload,
      dependencies.entitlementId,
      new Date(verifiedAt)
    );

    let cached: SubscriptionCacheRow | null;
    try {
      cached = await dependencies.readSubscription(userId);
    } catch (error) {
      reportError(dependencies, "Subscription cache lookup failed", error);
      return json({ error: "subscription_cache_unavailable" }, 500);
    }

    if (!normalized && (!cached?.product_id || cached.environment === "UNKNOWN")) {
      return json({
        environment: cached?.environment ?? "UNKNOWN",
        expires_at: cached?.expires_at ?? null,
        is_premium: false,
        product_id: cached?.product_id ?? null,
        repaired: false,
        status: "none"
      });
    }

    const write: SubscriptionCacheWrite = normalized
      ? {
          environment: normalized.environment,
          eventAt: null,
          expiresAt: normalized.expiresAt,
          isLifetime: normalized.isLifetime,
          productId: normalized.productId,
          status: normalized.status,
          userId,
          verifiedAt
        }
      : {
          environment: cached!.environment,
          eventAt: null,
          expiresAt: dependencies.now().toISOString(),
          isLifetime: false,
          productId: cached!.product_id!,
          status: "expired",
          userId,
          verifiedAt
        };

    try {
      const row = await dependencies.writeSubscription(write);
      if (!row) {
        return json({ error: "subscription_cache_write_failed" }, 500);
      }
      return json({
        environment: row.environment,
        expires_at: row.expires_at,
        is_premium: hasActiveAccess(row, dependencies.now()),
        product_id: row.product_id,
        repaired: row.verified_at === verifiedAt,
        status: row.status
      });
    } catch (error) {
      reportError(dependencies, "Subscription cache write failed", error);
      return json({ error: "subscription_cache_write_failed" }, 500);
    }
  };
}

function hasActiveAccess(row: SubscriptionCacheRow, now: Date) {
  if (row.status !== "active" && row.status !== "grace_period") return false;
  if (row.is_lifetime || !row.expires_at) return true;
  const expiration = Date.parse(row.expires_at);
  return Number.isFinite(expiration) && expiration > now.getTime();
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function reportError(
  dependencies: ReconcileRevenueCatDependencies,
  message: string,
  error: unknown
) {
  const reporter = dependencies.reportError ?? console.error;
  reporter(message, safeError(error));
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function createDefaultDependencies(): ReconcileRevenueCatDependencies | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const revenueCatSecretKey = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
  const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "premium";
  if (!supabaseUrl || !serviceRoleKey || !revenueCatSecretKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  return {
    authenticate: async (request) => {
      const authorization = request.headers.get("authorization") ?? "";
      const token = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!token) return null;
      const { data, error } = await supabase.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    entitlementId,
    fetchSubscriber: async (userId) => {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${revenueCatSecretKey}`
          },
          signal: AbortSignal.timeout(15_000)
        }
      );
      if (!response.ok) throw new Error(`RevenueCat HTTP ${response.status}`);
      return response.json();
    },
    now: () => new Date(),
    readSubscription: async (userId) => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "environment,expires_at,is_lifetime,product_id,status,verified_at"
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionCacheRow | null;
    },
    writeSubscription: async (input) => {
      const { data, error } = await supabase.rpc(
        "apply_revenuecat_subscription_cache",
        {
          p_environment: input.environment,
          p_event_at: input.eventAt,
          p_expires_at: input.expiresAt,
          p_is_lifetime: input.isLifetime,
          p_product_id: input.productId,
          p_status: input.status,
          p_user_id: input.userId,
          p_verified_at: input.verifiedAt
        }
      );
      if (error) throw error;
      return data as SubscriptionCacheRow | null;
    }
  };
}

if (import.meta.main) {
  const dependencies = createDefaultDependencies();
  if (!dependencies) {
    Deno.serve(() => json({ error: "server_not_configured" }, 500));
  } else {
    Deno.serve(createReconcileRevenueCatHandler(dependencies));
  }
}
