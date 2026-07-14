import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getEffectivePremiumAccess } from "@/api/subscriptions";
import {
  getCustomerInfo,
  getSubscriptionStatusFromCustomerInfo,
  SUBSCRIPTION_STATUS_QUERY_KEY
} from "@/lib/revenuecat";

export function useSubscriptionStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SUBSCRIPTION_STATUS_QUERY_KEY,
    queryFn: async () => {
      const [customerInfo, effectiveAccess] = await Promise.all([
        getCustomerInfo(),
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
        isLifetime: effectiveAccess.isLifetime,
        isPremium: true
      };
    },
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    const expirationDate = query.data?.familyTrialExpirationDate;
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
  }, [query.data?.familyTrialExpirationDate, queryClient]);

  return {
    ...query,
    accessSource: query.data?.accessSource ?? "none",
    expirationDate: query.data?.expirationDate ?? null,
    familyTrialExpirationDate: query.data?.familyTrialExpirationDate ?? null,
    familyTrialStartedAt: query.data?.familyTrialStartedAt ?? null,
    isLifetime: query.data?.isLifetime ?? false,
    isPremium: query.data?.isPremium ?? false,
    productIdentifier: query.data?.productIdentifier ?? null,
    willRenew: query.data?.willRenew ?? false
  };
}
