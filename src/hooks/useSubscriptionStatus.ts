import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getEffectivePremiumAccess } from "@/api/subscriptions";
import { getIntroTrialDaysRemaining } from "@/features/subscription/introTrialPolicy";
import {
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo,
  SUBSCRIPTION_STATUS_QUERY_KEY,
  type PremiumSubscriptionStatus
} from "@/lib/revenuecat";

export function useSubscriptionStatus() {
  const queryClient = useQueryClient();
  const query = useQuery<PremiumSubscriptionStatus>({
    queryKey: SUBSCRIPTION_STATUS_QUERY_KEY,
    queryFn: async () => {
      const [customerInfo, effectiveAccess] = await Promise.all([
        getCustomerInfo().catch(() => null),
        getEffectivePremiumAccess().catch(() => null)
      ]);
      const revenueCatStatus = getSubscriptionStatusFromCustomerInfo(customerInfo);

      if (revenueCatStatus.isPremium || !effectiveAccess?.isPremium) {
        return revenueCatStatus;
      }

      return {
        ...revenueCatStatus,
        accessSource: effectiveAccess.accessSource,
        expirationDate: effectiveAccess.accessExpiresAt,
        familyTrialExpirationDate: effectiveAccess.familyTrialExpiresAt,
        familyTrialStartedAt: effectiveAccess.familyTrialStartedAt,
        introTrialExpirationDate: effectiveAccess.introTrialExpiresAt,
        introTrialStartedAt: effectiveAccess.introTrialStartedAt,
        isLifetime: effectiveAccess.isLifetime,
        isPremium: true
      };
    },
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    // Trial access has to lock itself the moment it runs out; otherwise the
    // cached status keeps the paywall hidden until the next cold start.
    const expirationDate =
      query.data?.accessSource === "family"
        ? query.data.expirationDate
        : query.data?.accessSource === "intro_trial"
          ? query.data.introTrialExpirationDate
          : query.data?.familyTrialExpirationDate;
    if (!expirationDate) {
      return;
    }

    const remainingMs = Date.parse(expirationDate) - Date.now();
    if (remainingMs <= 0) {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_STATUS_QUERY_KEY });
      return;
    }

    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_STATUS_QUERY_KEY });
    }, Math.min(remainingMs + 250, 2_147_000_000));

    return () => clearTimeout(timer);
  }, [
    query.data?.accessSource,
    query.data?.expirationDate,
    query.data?.familyTrialExpirationDate,
    query.data?.introTrialExpirationDate,
    queryClient
  ]);

  const introTrialExpirationDate =
    query.data?.introTrialExpirationDate ?? null;

  return {
    ...query,
    accessSource: query.data?.accessSource ?? "none",
    expirationDate: query.data?.expirationDate ?? null,
    familyTrialExpirationDate: query.data?.familyTrialExpirationDate ?? null,
    familyTrialStartedAt: query.data?.familyTrialStartedAt ?? null,
    introTrialDaysRemaining: getIntroTrialDaysRemaining(introTrialExpirationDate),
    introTrialExpirationDate,
    introTrialStartedAt: query.data?.introTrialStartedAt ?? null,
    isIntroTrial: query.data?.accessSource === "intro_trial",
    isLifetime: query.data?.isLifetime ?? false,
    isPremium: query.data?.isPremium ?? false,
    productIdentifier: query.data?.productIdentifier ?? null,
    willRenew: query.data?.willRenew ?? false
  };
}
