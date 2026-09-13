import { useEffect } from "react";

import { trackIntroTrialLifecycle } from "@/features/subscription/introTrial";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

/**
 * Reports the two edges of the seven day intro trial. Without them the funnel
 * cannot separate "never had access" from "had access and let it lapse", which
 * are very different signals about why someone did not subscribe.
 */
export function useIntroTrialTracking() {
  const { introTrialExpirationDate, introTrialStartedAt, isIntroTrial, isPending } =
    useSubscriptionStatus();

  useEffect(() => {
    // A pending query reports isIntroTrial false, which would otherwise look
    // like the trial ended on every cold start.
    if (isPending) return;

    trackIntroTrialLifecycle({
      expiresAt: introTrialExpirationDate,
      isActive: isIntroTrial,
      startedAt: introTrialStartedAt
    }).catch((error) => {
      console.warn("Intro trial lifecycle tracking failed", error);
    });
  }, [introTrialExpirationDate, introTrialStartedAt, isIntroTrial, isPending]);
}
