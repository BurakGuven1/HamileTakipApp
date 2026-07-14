import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type Subscription = Tables<"subscriptions">;
export type SubscriptionCacheStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "grace_period";

export type EffectivePremiumAccess = {
  accessExpiresAt: string | null;
  accessSource: "family_trial" | "none" | "own";
  familyTrialExpiresAt: string | null;
  familyTrialStartedAt: string | null;
  isLifetime: boolean;
  isPremium: boolean;
};

const NO_PREMIUM_ACCESS: EffectivePremiumAccess = {
  accessExpiresAt: null,
  accessSource: "none",
  familyTrialExpiresAt: null,
  familyTrialStartedAt: null,
  isLifetime: false,
  isPremium: false
};

export async function getEffectivePremiumAccess(): Promise<EffectivePremiumAccess> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return NO_PREMIUM_ACCESS;
  }

  const { data, error } = await supabase.rpc("get_effective_premium_access");

  if (error) {
    throw error;
  }

  const row = data?.[0];
  if (!row) {
    return NO_PREMIUM_ACCESS;
  }

  return {
    accessExpiresAt: row.access_expires_at,
    accessSource: normalizeAccessSource(row.access_source),
    familyTrialExpiresAt: row.family_trial_expires_at,
    familyTrialStartedAt: row.family_trial_started_at,
    isLifetime: row.is_lifetime,
    isPremium: row.is_premium
  };
}

function normalizeAccessSource(value: string): EffectivePremiumAccess["accessSource"] {
  if (value === "own" || value === "family_trial") {
    return value;
  }

  return "none";
}

export async function getActiveSubscription() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function reconcileSubscription({
  expiresAt,
  isLifetime,
  productId,
  status
}: {
  expiresAt: string | null;
  isLifetime: boolean;
  productId: string;
  status: SubscriptionCacheStatus;
}) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc("reconcile_subscription", {
    p_expires_at: expiresAt,
    p_is_lifetime: isLifetime,
    p_product_id: productId,
    p_status: status,
    p_user_id: user.id
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function isDay5OfferEligible() {
  const { data, error } = await supabase.rpc("is_day5_offer_eligible");

  if (error) {
    throw error;
  }

  return Boolean(data);
}
