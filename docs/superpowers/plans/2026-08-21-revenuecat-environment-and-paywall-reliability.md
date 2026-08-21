# RevenueCat Environment and Paywall Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve real App Store premium through TestFlight activity, securely repair subscription state after restore/transfer, and make every confirmed premium denial open its canonical paywall while allowed Doctor PDF credits still generate and share the report.

**Architecture:** A production-preferred database writer owns the effective subscription cache. RevenueCat webhook and an authenticated server reconciliation function normalize RevenueCat data before calling that writer; clients never assert active access. Paywall callers distinguish a refreshable locked-state tap from an authoritative server denial, while shared credit policy keeps Doctor PDF and the other credit features consistent.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, RevenueCat React Native SDK 10, Supabase/PostgreSQL, Supabase Edge Functions on Deno, TanStack Query, Node 22 test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-revenuecat-environment-and-paywall-reliability-design.md`

## Global Constraints

- A `SANDBOX` event must never downgrade or replace a known `PRODUCTION` subscription.
- Active access may be written only from RevenueCat webhook data or server-side RevenueCat API verification.
- RevenueCat secret keys remain server-only and never enter Expo variables, client bundles, logs, or analytics.
- Confirmed `premium_required`, `free_credits_exhausted`, and equivalent server denials always open the paywall.
- Doctor PDF proceeds when premium is active or a free credit can be reserved; generation failure releases the reservation.
- Existing `PREMIUM_FEATURES` sources and analytics properties remain stable.
- Do not run Expo Doctor or Android Doctor.

## File Map

- Create `src/supabase/functions/_shared/revenuecatSubscription.ts` and its Deno test: normalize RevenueCat subscriber data.
- Create `src/supabase/migrations/20260821000001_protect_production_subscription_cache.sql`: provenance columns and protected cache writer.
- Create `src/supabase/functions/reconcile-revenuecat-subscription/index.ts` and its test: authenticated server verification.
- Modify `src/supabase/functions/revenuecat-webhook/index.ts` and add its test: environment-safe lifecycle and transfer handling.
- Modify `src/api/subscriptions.ts`, `src/hooks/useRevenueCatSync.ts`, and `app/(tabs)/settings/index.tsx`: invoke server reconciliation.
- Delete `src/features/subscription/reconcileSubscription.ts`: remove client-written cache reconciliation.
- Create `src/features/subscription/paywallPolicy.ts` and its Node test: required/if-needed paywall and credit decisions.
- Modify the premium surfaces under `app/(tabs)`: apply the shared policy and audit all 17 registry entries.
- Modify `.env.example` and `docs/analytics.md`: server-secret and deployment documentation.

---

### Task 1: Normalize RevenueCat subscriber data

**Files:**
- Create: `src/supabase/functions/_shared/revenuecatSubscription.ts`
- Test: `src/supabase/functions/_shared/revenuecatSubscription.test.ts`

**Interfaces:**
- Consumes: RevenueCat API v1 customer JSON and entitlement ID.
- Produces: `normalizeRevenueCatSubscriber(payload, entitlementId, now)` and `normalizeRevenueCatEnvironment(value)`.

- [ ] **Step 1: Write failing normalization tests**

```ts
import {
  normalizeRevenueCatEnvironment,
  normalizeRevenueCatSubscriber
} from "./revenuecatSubscription.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("active production entitlement is normalized with production provenance", () => {
  const result = normalizeRevenueCatSubscriber({
    subscriber: {
      entitlements: {
        premium: {
          product_identifier: "premium.yearly",
          expires_date: "2027-06-01T00:00:00Z"
        }
      },
      subscriptions: {
        "premium.yearly": {
          expires_date: "2027-06-01T00:00:00Z",
          grace_period_expires_date: null,
          is_sandbox: false,
          purchase_date: "2026-06-01T00:00:00Z",
          refunded_at: null,
          unsubscribe_detected_at: null
        }
      }
    }
  }, "premium", new Date("2026-08-21T12:00:00Z"));

  assertEquals(result, {
    environment: "PRODUCTION",
    expiresAt: "2027-06-01T00:00:00Z",
    isLifetime: false,
    productId: "premium.yearly",
    status: "active"
  });
});

Deno.test("environment normalization is defensive", () => {
  assertEquals(normalizeRevenueCatEnvironment("PRODUCTION"), "PRODUCTION");
  assertEquals(normalizeRevenueCatEnvironment("sandbox"), "SANDBOX");
  assertEquals(normalizeRevenueCatEnvironment(null), "UNKNOWN");
});
```

- [ ] **Step 2: Run RED**

Run: `npx deno test src/supabase/functions/_shared/revenuecatSubscription.test.ts`

Expected: FAIL because the production module does not exist.

- [ ] **Step 3: Implement the contract and parser**

```ts
export type RevenueCatEnvironment = "PRODUCTION" | "SANDBOX" | "UNKNOWN";
export type RevenueCatSubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "grace_period";

export type NormalizedRevenueCatSubscription = {
  environment: RevenueCatEnvironment;
  expiresAt: string | null;
  isLifetime: boolean;
  productId: string;
  status: RevenueCatSubscriptionStatus;
};

export function normalizeRevenueCatEnvironment(value: unknown): RevenueCatEnvironment {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  return normalized === "PRODUCTION" || normalized === "SANDBOX"
    ? normalized
    : "UNKNOWN";
}

export function normalizeRevenueCatSubscriber(
  payload: unknown,
  entitlementId: string,
  now = new Date()
): NormalizedRevenueCatSubscription | null {
  const subscriber = asRecord(asRecord(payload)?.subscriber);
  const entitlement = asRecord(asRecord(subscriber?.entitlements)?.[entitlementId]);
  const subscriptions = asRecord(subscriber?.subscriptions) ?? {};
  const entitlementProduct = stringValue(entitlement?.product_identifier);
  if (entitlementProduct) {
    return normalizeSubscription(
      entitlementProduct,
      subscriptions[entitlementProduct],
      now,
      true
    );
  }

  return Object.entries(subscriptions)
    .map(([productId, raw]) => normalizeSubscription(productId, raw, now, false))
    .filter((item): item is NormalizedRevenueCatSubscription => Boolean(item))
    .sort((left, right) =>
      Date.parse(right.expiresAt ?? "") - Date.parse(left.expiresAt ?? "")
    )[0] ?? null;
}
```

Add local record/string guards and `normalizeSubscription(productId, raw, now, entitlementActive)`. Derive `grace_period` when grace expiry is future, `active` when the matching entitlement is active and expiry is future, `cancelled` when unsubscribe exists but access is not expired, otherwise `expired`. Treat a null expiry as lifetime only for the matching active entitlement. Environment conflict resolution belongs to the protected database writer in Task 2, so an inactive API result cannot replace an existing production row merely because it is newer.

- [ ] **Step 4: Add branch tests**

Add separate literal tests for active sandbox without production, grace period, refund, expired access, lifetime access, malformed JSON, and missing entitlement.

- [ ] **Step 5: Run GREEN and commit**

Run: `npx deno test src/supabase/functions/_shared/revenuecatSubscription.test.ts`

Expected: all tests PASS.

```bash
git add src/supabase/functions/_shared/revenuecatSubscription.ts src/supabase/functions/_shared/revenuecatSubscription.test.ts
git commit -m "test: define RevenueCat subscription normalization"
```

### Task 2: Protect and repair the subscription cache

**Files:**
- Create: `src/supabase/migrations/20260821000001_protect_production_subscription_cache.sql`
- Create: `src/supabase/tests/revenuecat_subscription_precedence.sql`

**Interfaces:**
- Produces: service-role-only `public.apply_revenuecat_subscription_cache(...) returns public.subscriptions`.

- [ ] **Step 1: Write SQL regression assertions**

The transactional test must exercise these literal transitions and roll back:

```sql
-- production active + newer sandbox expired => production active
-- sandbox active + production active => production active
-- production active + older production expired => production active
-- production active + freshly verified production expired => production expired
-- production active + unknown state => production active
```

- [ ] **Step 2: Run RED**

Run the SQL file against the local/linked test database when available.

Expected: FAIL because provenance columns and `apply_revenuecat_subscription_cache` do not exist.

- [ ] **Step 3: Add provenance columns**

```sql
alter table public.subscriptions
  add column if not exists environment text not null default 'UNKNOWN',
  add column if not exists revenuecat_event_at timestamptz,
  add column if not exists verified_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_environment_check;
alter table public.subscriptions
  add constraint subscriptions_environment_check
  check (environment in ('PRODUCTION', 'SANDBOX', 'UNKNOWN'));
```

- [ ] **Step 4: Implement the protected writer**

Use `security definer set search_path = public`, lock the user row, validate status/environment, and apply only when this expression is true:

```sql
v_should_apply :=
  v_current.id is null
  or (v_environment = 'PRODUCTION' and (
        v_current.environment <> 'PRODUCTION'
        or p_verified_at is not null
        or p_event_at >= coalesce(v_current.revenuecat_event_at, '-infinity')
      ))
  or (v_environment = 'SANDBOX'
      and v_current.environment in ('SANDBOX', 'UNKNOWN')
      and p_event_at >= coalesce(v_current.revenuecat_event_at, '-infinity'))
  or (v_environment = 'UNKNOWN'
      and v_current.environment = 'UNKNOWN'
      and p_event_at >= coalesce(v_current.revenuecat_event_at, '-infinity'));
```

Revoke from `public`, `anon`, and `authenticated`; grant only to `service_role`. Revoke authenticated execution from legacy `reconcile_subscription` so the client cannot write inactive states.

- [ ] **Step 5: Backfill from recorded RevenueCat events**

Rank matching events by `environment = 'PRODUCTION'` first and event time second. Update only rows with matching user/product history. Apply the latest production lifecycle state when production history exists; otherwise use the latest sandbox state.

- [ ] **Step 6: Run GREEN and commit**

Run: `supabase db lint --workdir src`

Run the SQL regression when the database runner is available.

Expected: no new lint findings and all precedence assertions PASS.

```bash
git add src/supabase/migrations/20260821000001_protect_production_subscription_cache.sql
git add src/supabase/tests/revenuecat_subscription_precedence.sql
git commit -m "fix: protect production subscription cache"
```

Skip the second `git add` only when the SQL runner cannot support a standalone regression file and the assertions were embedded in the migration verification notes.

### Task 3: Add server reconciliation and transfer recovery

**Files:**
- Create: `src/supabase/functions/reconcile-revenuecat-subscription/index.ts`
- Test: `src/supabase/functions/reconcile-revenuecat-subscription/index.test.ts`
- Modify: `src/supabase/functions/revenuecat-webhook/index.ts`
- Test: `src/supabase/functions/revenuecat-webhook/index.test.ts`
- Modify: `.env.example`
- Modify: `docs/analytics.md`

**Interfaces:**
- Consumes: Task 1 normalizer, Task 2 RPC, authenticated JWT, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_ENTITLEMENT_ID`.
- Produces: `{ is_premium, product_id, status, expires_at, environment, repaired }`.

- [ ] **Step 1: Write failing authenticated-handler tests**

Export `createReconcileRevenueCatHandler(deps)` and test a real `Request` with injected boundaries:

```ts
const productionSubscriberFixture = {
  subscriber: {
    entitlements: {
      premium: {
        product_identifier: "premium.yearly",
        expires_date: "2027-06-01T00:00:00Z"
      }
    },
    subscriptions: {
      "premium.yearly": {
        expires_date: "2027-06-01T00:00:00Z",
        grace_period_expires_date: null,
        is_sandbox: false,
        purchase_date: "2026-06-01T00:00:00Z",
        refunded_at: null,
        unsubscribe_detected_at: null
      }
    }
  }
};

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("authenticated reconciliation writes production state", async () => {
  const writes: unknown[] = [];
  const handler = createReconcileRevenueCatHandler({
    authenticate: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
    fetchSubscriber: async () => productionSubscriberFixture,
    writeSubscription: async (input) => { writes.push(input); return true; },
    entitlementId: "premium"
  });
  const response = await handler(new Request("http://local", {
    method: "POST",
    headers: { Authorization: "Bearer valid" }
  }));
  assertEquals(response.status, 200);
  assertEquals((writes[0] as Record<string, unknown>).environment, "PRODUCTION");
});
```

Add tests for missing auth (`401`), RevenueCat error (`502`, zero writes), and malformed subscriber data (non-premium response without production downgrade).

- [ ] **Step 2: Run RED**

Run: `npx deno test src/supabase/functions/reconcile-revenuecat-subscription/index.test.ts`

Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implement the endpoint**

Authenticate with `supabase.auth.getUser(token)`, derive the UUID only from the token, then request:

```text
GET https://api.revenuecat.com/v1/subscribers/{url-encoded-user-id}
Authorization: Bearer REVENUECAT_SECRET_API_KEY
Accept: application/json
```

Normalize with Task 1 and call Task 2 through a service-role client. Return `401`, `405`, `500`, or `502` for the corresponding failures. Never accept a user ID in the client body or return raw RevenueCat payloads.

- [ ] **Step 4: Write failing webhook tests**

Extract `createRevenueCatWebhookHandler(deps)`. Test that sandbox expiration is passed to the RPC with `SANDBOX`, duplicates do not write twice, and `TRANSFER` verifies every valid UUID in `transferred_from` and `transferred_to`.

- [ ] **Step 5: Update webhook lifecycle and transfer handling**

Replace the direct `subscriptions.upsert` with Task 2’s RPC. On `TRANSFER`, fetch and normalize each valid UUID participant, write each result independently, and mask identifiers in failure logs. Report whether an event was ignored by production precedence.

- [ ] **Step 6: Document secrets**

Add this server-only command and warning:

```bash
supabase secrets set REVENUECAT_SECRET_API_KEY="sk_..." REVENUECAT_ENTITLEMENT_ID="premium" --workdir src
```

The secret key must never use an `EXPO_PUBLIC_` prefix.

- [ ] **Step 7: Run GREEN and commit**

```bash
npx deno test src/supabase/functions/_shared/revenuecatSubscription.test.ts src/supabase/functions/reconcile-revenuecat-subscription/index.test.ts src/supabase/functions/revenuecat-webhook/index.test.ts
npx deno check src/supabase/functions/reconcile-revenuecat-subscription/index.ts
npx deno check src/supabase/functions/revenuecat-webhook/index.ts
```

Expected: tests PASS and both checks exit 0.

```bash
git add src/supabase/functions/reconcile-revenuecat-subscription src/supabase/functions/revenuecat-webhook .env.example docs/analytics.md
git commit -m "fix: reconcile RevenueCat subscriptions securely"
```

### Task 4: Reconcile after login, updates, and restore

**Files:**
- Modify: `src/api/subscriptions.ts`
- Modify: `src/hooks/useRevenueCatSync.ts`
- Modify: `app/(tabs)/settings/index.tsx`
- Delete: `src/features/subscription/reconcileSubscription.ts`

**Interfaces:**
- Produces: `reconcileRevenueCatSubscription(): Promise<VerifiedSubscriptionAccess>`.

- [ ] **Step 1: Write a failing response-parser test**

Create a dependency-free parser beside the API module if Node cannot resolve app aliases. Assert a complete production response parses and invalid status/environment throws.

```ts
export type VerifiedSubscriptionAccess = {
  environment: "PRODUCTION" | "SANDBOX" | "UNKNOWN";
  expiresAt: string | null;
  isPremium: boolean;
  productId: string | null;
  repaired: boolean;
  status: SubscriptionCacheStatus | "none";
};
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/features/subscription/verifiedSubscriptionAccess.test.ts`

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement the client call**

```ts
export async function reconcileRevenueCatSubscription() {
  const { data, error } = await supabase.functions.invoke(
    "reconcile-revenuecat-subscription",
    { method: "POST" }
  );
  if (error) throw error;
  return parseVerifiedSubscriptionAccess(data);
}
```

- [ ] **Step 4: Replace client cache reconciliation**

Use one module-level in-flight promise in `useRevenueCatSync`. Invoke server reconciliation after RevenueCat login, customer-info listener updates, and active-state refresh. On success invalidate `subscription-status`, `family-feature-access`, `family-coordination-context`, and `baby-gallery-access`. Delete the old client reconciliation module and API RPC writer.

- [ ] **Step 5: Repair settings restore**

After `restorePremiumPurchases`, await server reconciliation before showing the result. Success is local active entitlement or verified server premium. If store restore succeeds but server verification fails, show a synchronization retry error rather than “purchase not found.”

- [ ] **Step 6: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/features/subscription/verifiedSubscriptionAccess.test.ts`

Run: `npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

```bash
git add src/api/subscriptions.ts src/hooks/useRevenueCatSync.ts "app/(tabs)/settings/index.tsx" src/features/subscription/reconcileSubscription.ts src/features/subscription/verifiedSubscriptionAccess.ts src/features/subscription/verifiedSubscriptionAccess.test.ts
git commit -m "fix: repair premium after login and restore"
```

### Task 5: Define paywall modes and fix shared-credit flows

**Files:**
- Create: `src/features/subscription/paywallPolicy.ts`
- Test: `src/features/subscription/paywallPolicy.test.ts`
- Modify: `src/features/subscription/showPaywallIfNeeded.ts`
- Modify: `app/(tabs)/doctor-visit.tsx`
- Modify: `app/(tabs)/document-insight.tsx`
- Modify: `app/(tabs)/family-planner.tsx`

**Interfaces:**
- Produces: `PremiumPaywallMode`, `shouldCheckPremiumBeforePaywall`, and `getCreditGateDecision`.

- [ ] **Step 1: Write failing policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  getCreditGateDecision,
  shouldCheckPremiumBeforePaywall
} from "./paywallPolicy.ts";

test("required paywall does not repeat a stale premium check", () => {
  assert.equal(shouldCheckPremiumBeforePaywall("required"), false);
});

test("if-needed paywall refreshes access first", () => {
  assert.equal(shouldCheckPremiumBeforePaywall("if_needed"), true);
});

test("Doctor PDF proceeds with credit or premium", () => {
  assert.equal(getCreditGateDecision({ allowed: true, isPremium: false, remaining: 1 }), "proceed");
  assert.equal(getCreditGateDecision({ allowed: true, isPremium: true, remaining: null }), "proceed");
});

test("Doctor PDF denial or zero credit requires paywall", () => {
  assert.equal(getCreditGateDecision({ allowed: false, isPremium: false, remaining: 1 }), "required_paywall");
  assert.equal(getCreditGateDecision({ isPremium: false, remaining: 0 }), "required_paywall");
});
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/features/subscription/paywallPolicy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement policy and presentation mode**

```ts
export type PremiumPaywallMode = "if_needed" | "required";

export function shouldCheckPremiumBeforePaywall(mode: PremiumPaywallMode) {
  return mode === "if_needed";
}

export function getCreditGateDecision(access: {
  allowed?: boolean;
  isPremium: boolean;
  remaining: number | null;
}) {
  return access.isPremium || (access.allowed !== false && access.remaining !== 0)
    ? "proceed" as const
    : "required_paywall" as const;
}
```

Change `showPaywallIfNeeded` to accept third argument `{ mode?: PremiumPaywallMode }`, default `if_needed`. Only repeat the RevenueCat/Supabase premium check in `if_needed`; always navigate in `required`. Track `presentation_mode` with `premium_gate_hit` and `paywall_requested`.

- [ ] **Step 4: Fix Doctor PDF exactly**

Use `getCreditGateDecision` for both loaded access and reservation response. When the result is `required_paywall`, call the existing canonical source with `{ mode: "required" }`. When it is `proceed`, preserve sharing check, reservation, PDF generation, commit, sharing, and cleanup. This makes remaining credit `1..3` work and remaining credit `0` open the paywall.

- [ ] **Step 5: Fix the other shared-credit features**

Use required mode after authoritative exhaustion/denial in document insight, family timed alarms, and pregnancy support handover. Preserve free untimed family tasks and all existing reservation release behavior.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --experimental-strip-types --test src/features/subscription/paywallPolicy.test.ts`

Run: `npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

```bash
git add src/features/subscription/paywallPolicy.ts src/features/subscription/paywallPolicy.test.ts src/features/subscription/showPaywallIfNeeded.ts "app/(tabs)/doctor-visit.tsx" "app/(tabs)/document-insight.tsx" "app/(tabs)/family-planner.tsx"
git commit -m "fix: enforce credit paywalls across premium tools"
```

### Task 6: Audit all premium gates and verify delivery

**Files:**
- Modify: `app/(tabs)/gallery/index.tsx`
- Modify: `app/(tabs)/pregnancy-health-file.tsx`
- Review and preserve if already correct: `app/(tabs)/care-journal.tsx`
- Review and preserve if already correct: `app/(tabs)/sleep-rhythm.tsx`
- Review and preserve if already correct: `app/(tabs)/settings/index.tsx`
- Review and preserve if all surfaces are registered: `src/features/subscription/premiumFeatures.ts`

**Interfaces:**
- Consumes: Task 5 paywall modes and the existing registry.
- Produces: intentional paywall coverage for all 17 premium features.

- [ ] **Step 1: Apply required mode to server denials**

Use required mode for gallery limit denial, pregnancy health-file server denial, and any care mutation that returns a premium-required error. Keep default `if_needed` for care locked cards/chips, sleep prediction tiles, and settings toggles whose state may be refreshed before presentation.

- [ ] **Step 2: Check the exact registry matrix**

```text
documentInsight, advancedPumping, babyMemoryGallery, careHistory,
careFamilyReminders, careInsights, careMedicine, careMultiBaby,
careSolidFood, doctorVisitReport, familyTaskAlarm,
pregnancySupportHandover, pregnancyHealthFileSave,
pregnancyHealthFileReminder, pregnancyHealthFilePdf,
sleepPrediction, milkInventory
```

For each key confirm a reachable locked CTA or server-denial path, canonical source, feature analytics value, life stage where relevant, visible helper errors, and no silent return after confirmed denial.

- [ ] **Step 3: Run the audit query**

Run: `rg -n "PREMIUM_FEATURES\.|showPaywallIfNeeded\(" app src/features/subscription -g '*.ts' -g '*.tsx'`

Compare results manually to the matrix. This is an audit artifact, not a source-text unit test.

- [ ] **Step 4: Read the UI delivery rules and inspect changed interactions**

Read `C:/Users/burak/.codex/skills/ui-ux-pro-max/references/pro-rules.md`. Confirm busy/disabled feedback, accessibility labels, visible error feedback, and predictable paywall navigation on changed buttons.

- [ ] **Step 5: Run all focused verification**

```bash
npx deno test src/supabase/functions/_shared/revenuecatSubscription.test.ts src/supabase/functions/reconcile-revenuecat-subscription/index.test.ts src/supabase/functions/revenuecat-webhook/index.test.ts
node --experimental-strip-types --test src/features/subscription/verifiedSubscriptionAccess.test.ts src/features/subscription/paywallPolicy.test.ts
npx deno check src/supabase/functions/reconcile-revenuecat-subscription/index.ts
npx deno check src/supabase/functions/revenuecat-webhook/index.ts
npm run typecheck
supabase db lint --workdir src
git diff --check
```

Expected: all tests PASS, checks exit 0, database lint has no new errors, and diff check has no output.

- [ ] **Step 6: Confirm deployment prerequisites without exposing values**

Run: `supabase secrets list --workdir src`

Confirm `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_ENTITLEMENT_ID` names exist. If either is absent, stop before deployment and request the missing value/authorization.

After prerequisites are satisfied, deployment order is:

```bash
supabase db push --workdir src
supabase functions deploy reconcile-revenuecat-subscription --workdir src
supabase functions deploy revenuecat-webhook --workdir src
```

- [ ] **Step 7: Run acceptance scenarios**

1. Production subscriber with sandbox history stays premium after app launch and restore.
2. New sandbox expiration cannot change the production cache row.
3. Non-premium user with one Doctor PDF credit generates/shares one PDF and decrements once.
4. Non-premium user with zero credits taps Doctor PDF and sees the RevenueCat paywall.
5. One CTA from each registry group opens its canonical paywall when locked.

- [ ] **Step 8: Request review, correct in-scope findings, and commit**

Use `superpowers:requesting-code-review`, repeat Step 5 after corrections, stage only the changed in-scope files reported by `git status --short`, then commit:

```bash
git commit -m "test: verify subscription and paywall reliability"
```

Do not create an empty commit.
