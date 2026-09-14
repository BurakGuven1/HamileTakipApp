/**
 * When the paywall may interrupt a document analysis.
 *
 * The old flow asked for money 900 ms after the result appeared, which reaches
 * the user while they are still reading the first real value the app ever gave
 * them. The order that works is: upload → see the whole result → do something
 * with it → *then* the offer. This module owns that ordering as pure data so it
 * can be tested, and the screen only reports what happened.
 */

export type DocumentInsightAction =
  | "pick_document"
  | "view_result"
  | "expand_value"
  | "copy_questions"
  | "save_to_health_file";

export type ValueMomentState = {
  /** True once a result with at least one readable value was rendered. */
  hasSeenResult: boolean;
  isPremium: boolean;
  /** Remaining free analyses reported by the server, null when unknown. */
  remaining: number | null;
  /** True once the paywall already ran for this result. */
  alreadyOffered: boolean;
};

export type ValueMomentDecision =
  | { present: false; reason: null }
  | { present: true; reason: ValueMomentReason; mode: "required" };

export type ValueMomentReason =
  | "last_free_credit_used"
  | "free_credits_exhausted"
  | "premium_feature_selected";

export function resolveValueMomentPaywall(
  action: DocumentInsightAction,
  state: ValueMomentState
): ValueMomentDecision {
  if (state.isPremium) return NONE;

  // Saving into the health file is a Premium feature in its own right, and the
  // user asked for it — this is the one moment an offer is not an interruption.
  if (action === "save_to_health_file") {
    return { present: true, reason: "premium_feature_selected", mode: "required" };
  }

  // Nothing is offered before a real result has been seen. This is the rule the
  // whole module exists for.
  if (!state.hasSeenResult) return NONE;
  if (state.alreadyOffered) return NONE;

  // Seeing the result is the value moment, not the decision moment.
  if (action === "view_result") return NONE;

  const exhausted = state.remaining === 0;

  // Reaching for a second document with nothing left is the clearest signal of
  // intent there is.
  if (action === "pick_document") {
    return exhausted
      ? { present: true, reason: "free_credits_exhausted", mode: "required" }
      : NONE;
  }

  // Engaging with the result they just spent their last free analysis on.
  if (exhausted) {
    return { present: true, reason: "last_free_credit_used", mode: "required" };
  }

  return NONE;
}

/** Calm, non-threatening counter shown under the result. */
export function getRemainingAnalysisCopy(isPremium: boolean, remaining: number | null) {
  if (isPremium) return "Premium · sınırsız belge analizi";
  if (remaining === null) return "";
  if (remaining <= 0) return "Bu ayki ücretsiz analiz hakkın doldu.";
  if (remaining === 1) return "1 ücretsiz analiz hakkın kaldı.";
  return `${remaining} ücretsiz analiz hakkın kaldı.`;
}

const NONE = { present: false, reason: null } as const;
