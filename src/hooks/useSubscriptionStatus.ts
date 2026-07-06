import { useQuery } from "@tanstack/react-query";

import {
  getCustomerInfo,
  hasPremiumEntitlement
} from "@/lib/revenuecat";

export function useSubscriptionStatus() {
  const query = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getCustomerInfo
  });

  return {
    ...query,
    isPremium: hasPremiumEntitlement(query.data ?? null)
  };
}
