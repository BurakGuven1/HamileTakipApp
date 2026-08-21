import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

import { showPaywallIfNeeded } from "./showPaywallIfNeeded";

const CREDIT_EXHAUSTED_PROMPT_KEY = "family_feature_credits_exhausted_v1";
const POST_SUCCESS_DELAY_MS = 900;

type PostCreditPaywallInput = {
  feature: string;
  isPremium: boolean;
  lifeStage: "pregnancy" | "postpartum";
  remaining: number | null;
  source: string;
};

export async function showPostCreditPaywallIfNeeded({
  feature,
  isPremium,
  lifeStage,
  remaining,
  source
}: PostCreditPaywallInput) {
  if (isPremium || remaining !== 0) return false;

  const { data: claimed, error } = await supabase.rpc("claim_premium_prompt", {
    p_prompt_key: CREDIT_EXHAUSTED_PROMPT_KEY,
    p_source: source
  });

  if (error) {
    console.warn("Son hak paywall istemi kaydedilemedi", error);
    return false;
  }
  if (!claimed) return false;

  await trackEvent("family_credit_exhausted", {
    feature,
    life_stage: lifeStage,
    remaining: 0,
    source
  });

  await delay(POST_SUCCESS_DELAY_MS);
  const result = await showPaywallIfNeeded(
    source,
    {
      feature,
      life_stage: lifeStage,
      reason: "last_free_credit_used",
      remaining: 0
    },
    { mode: "required" }
  );
  return result.presented;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
