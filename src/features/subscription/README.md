# Subscription

RevenueCat logic is centralized in `src/lib/revenuecat.ts` and `src/hooks/useSubscriptionStatus.ts`.

Supabase subscription rows should be updated by a RevenueCat webhook Edge Function.

`get_effective_premium_access()` combines the current user's own RevenueCat-backed
subscription with the one-time family-code Premium window. When an owner is
Premium, the first father link starts a one-calendar-month grant. The grant is
stored by owner, cannot be restarted by signing in again, and never overrides a
father's own active subscription.
