import { supabase } from "@/lib/supabase";
import type { PremiumAccessSource } from "@/lib/revenuecat";
import {
  parseVerifiedSubscriptionAccess,
  type VerifiedSubscriptionAccess
} from "@/features/subscription/verifiedSubscriptionAccess";
import type { Tables } from "@/types/database";

export type Subscription = Tables<"subscriptions">;
export type EffectivePremiumAccess = {
  accessExpiresAt: string | null;
  accessSource: PremiumAccessSource;
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
  if (value === "own" || value === "family" || value === "family_trial") {
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

let reconciliationPromise: Promise<VerifiedSubscriptionAccess> | null = null;

export function reconcileRevenueCatSubscription() {
  if (reconciliationPromise) return reconciliationPromise;

  reconciliationPromise = invokeRevenueCatReconciliation().finally(() => {
    reconciliationPromise = null;
  });
  return reconciliationPromise;
}

async function invokeRevenueCatReconciliation() {
  const { data, error } = await supabase.functions.invoke(
    "reconcile-revenuecat-subscription",
    { method: "POST" }
  );
  if (error) throw error;
  return parseVerifiedSubscriptionAccess(data);
}

export async function isDay5OfferEligible() {
  const { data, error } = await supabase.rpc("is_day5_offer_eligible");

  if (error) {
    throw error;
  }

  return Boolean(data);
}
