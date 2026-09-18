# Subscription

RevenueCat logic is centralized in `src/lib/revenuecat.ts` and `src/hooks/useSubscriptionStatus.ts`.

Supabase subscription rows should be updated by a RevenueCat webhook Edge Function.

`get_effective_premium_access()` combines the current user's own RevenueCat-backed
subscription with the one-time family-code Premium window. When an owner is
Premium, the first father link starts a one-calendar-month grant. The grant is
stored by owner, cannot be restarted by signing in again, and never overrides a
father's own active subscription.

## Intro trial

`get_effective_premium_access()` also reports a one-time seven day intro trial
(`public.intro_premium_trials`, source `intro_trial`). The row is created by a
trigger on profile insert and was backfilled for every account that existed
before the trial shipped, so those accounts get a fresh window rather than a
backdated one.

The trial is deliberately the *last* source checked: a paid entitlement always
wins, which keeps purchase classification and revenue analytics honest.

Because it flows through `has_effective_premium_access()`, the trial unlocks RLS
policies, premium RPCs and the client gates with one definition. Habit-forming
features (sleep prediction, care history, insights, medicine log) are the point:
they were fully locked before, so nobody ever felt what Premium does for an
ordinary day.

`IntroTrialBanner` shows the countdown on Home, and `useIntroTrialTracking`
emits `intro_trial_started` / `intro_trial_ended` so the funnel can separate
"never had access" from "had access and let it lapse".

## Feature credits

Credit features draw on their own monthly allowance
(`public.family_feature_credit_quota`), not one shared lifetime pool of three.
Two problems are fixed by that: a parent who spent three tries on document
insight used to never see the doctor report at all, and an exhausted pool never
renewed, so a free account had no reason to return. Allowances reset on calendar
month boundaries.

`getFamilyFeatureAccess(featureKey)` reports one feature's balance; called with
no argument it returns the account aggregate plus a per-feature `features`
breakdown.

## Bundles

`PREMIUM_BUNDLES` groups all seventeen features into three promises
(Sağlık Arşivi, Akıllı Bakım, Aile Paylaşımı). Gates lead with the bundle
promise, and every `premium_gate_hit` / `paywall_requested` event carries the
`bundle` property so conversion can be read per promise. The paywall screen
itself renders RevenueCat's remote template, so its headline copy lives in the
RevenueCat dashboard, not here.
