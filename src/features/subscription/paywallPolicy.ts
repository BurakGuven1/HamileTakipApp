export type PremiumPaywallMode = "if_needed" | "required";

export type CreditGateAccess = {
  allowed?: boolean;
  isPremium: boolean;
  remaining: number | null;
};

export function shouldCheckPremiumBeforePaywall(mode: PremiumPaywallMode) {
  return mode === "if_needed";
}

export function getCreditGateDecision(access: CreditGateAccess) {
  if (access.allowed === false) return "required_paywall" as const;
  if (access.isPremium) return "proceed" as const;
  return typeof access.remaining === "number" && access.remaining > 0
    ? "proceed" as const
    : "required_paywall" as const;
}
