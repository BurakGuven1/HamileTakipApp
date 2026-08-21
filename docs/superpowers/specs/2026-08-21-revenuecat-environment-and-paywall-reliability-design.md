# RevenueCat Environment Isolation and Paywall Reliability

## Goal

Protect paid production access from TestFlight sandbox lifecycle events, recover RevenueCat-backed premium access after reinstall or purchase transfer, and ensure every confirmed premium denial opens the correct paywall.

Success means:

- a `SANDBOX` webhook can never downgrade or replace a known `PRODUCTION` subscription;
- the server can securely rebuild the subscription cache from RevenueCat after login, restore, or transfer;
- a server-confirmed `premium_required` or `free_credits_exhausted` result always presents the paywall;
- all entries in `PREMIUM_FEATURES` have an intentional, tested paywall path;
- premium customers keep access to all server-gated family and PDF features after moving between TestFlight and the App Store build.

## Current Failure

The `subscriptions` table has one row per user but no store-environment field. The RevenueCat webhook orders all events only by timestamp, so a newer sandbox expiration can overwrite an older, still-active production purchase.

The client reconciliation path intentionally refuses to write active access to Supabase. This avoids trusting a client assertion, but it also means a valid RevenueCat entitlement cannot repair a cache row that a sandbox event downgraded. RevenueCat transfer events are recorded but do not update the cache because they have no product identifier and the webhook maps no status for `TRANSFER`.

The paywall helper performs another client/server premium check before navigating. When the feature RPC says access is denied but cached RevenueCat customer information still says premium, that second check suppresses the paywall. The Doctor PDF flow therefore returns without either producing the report or showing the purchase screen.

## Chosen Approach

Use production-preferred cache writes plus server-verified RevenueCat reconciliation and explicit paywall presentation modes.

This is preferred over only ignoring sandbox expirations because a guard alone cannot recover missed webhooks, reinstalls, aliases, or transfers. A fully separate Supabase and RevenueCat project for TestFlight would provide stronger operational isolation, but it is a much larger release/configuration change and is unnecessary once environment precedence and server verification are correct.

## Subscription Cache Model

Add provenance to `public.subscriptions`:

- `environment`: normalized `PRODUCTION`, `SANDBOX`, or `UNKNOWN`;
- `revenuecat_event_at`: the RevenueCat event timestamp used to build the cached state;
- `verified_at`: the last successful server-side RevenueCat API verification time.

Keep one effective row per user so existing premium SQL remains stable. All cache writes go through one database function with these precedence rules:

1. A verified `PRODUCTION` state may replace any existing state.
2. A `SANDBOX` state may replace `SANDBOX` or `UNKNOWN` only when it is newer.
3. A `SANDBOX` state must never replace a `PRODUCTION` state, regardless of event timestamp.
4. An inactive production result may downgrade an existing production state when it is newer or comes from a fresh server verification.
5. A verified active production entitlement repairs any stale sandbox or inactive row immediately.
6. Unknown environments never downgrade a known environment.

The migration will backfill provenance from the newest matching row in `revenuecat_events`. For users with both production and sandbox history, valid production history wins. The migration must be idempotent and preserve users whose history is incomplete; those rows are repaired on the next verified reconciliation.

## Webhook Processing

The RevenueCat webhook will normalize `event.environment` and call the shared cache-write RPC rather than directly upserting `subscriptions`.

Normal purchase lifecycle events continue to map to active, cancelled, expired, or grace-period states. Duplicate and stale-event protection remains in place, but staleness is evaluated inside the same environment instead of globally.

For a `TRANSFER` event:

- resolve UUID destinations from `transferred_to`;
- verify each destination through the RevenueCat REST API;
- refresh the destination cache using the returned entitlement;
- verify UUID sources from `transferred_from` when present so access removed by the transfer is also reflected;
- record failures without accepting an unverified active client assertion.

Webhook responses and logs must not expose API keys or full customer payloads.

## Secure Reconciliation

Add an authenticated Supabase Edge Function for reconciliation. It will:

1. validate the caller's Supabase JWT and derive the user ID from the token;
2. query RevenueCat's customer endpoint using server-only `REVENUECAT_SECRET_API_KEY`;
3. inspect the configured `premium` entitlement and its product, expiry, grace period, and store environment;
4. update `subscriptions` through the same production-preferred cache-write RPC;
5. return only the normalized premium result needed by the client.

The function never accepts an arbitrary user ID for an ordinary client request. Internal webhook reconciliation may call shared server logic for transfer participants.

Client integration points:

- after RevenueCat login during app bootstrap;
- after the app becomes active when identity changed or the cache is stale;
- after a successful `restorePurchases` call;
- after a purchase or entitlement update.

Calls are deduplicated and failures are non-destructive: a network or RevenueCat API error cannot downgrade an existing production subscription. The settings restore action reports whether access was found and invalidates all subscription and family-feature queries after reconciliation.

## Paywall Presentation Contract

Split paywall intent into two explicit paths:

- `if_needed`: used when a user taps a visually locked premium feature. It refreshes premium state and skips the paywall if access is now valid.
- `required`: used after an authoritative feature-access response has already returned `premium_required`, `free_credits_exhausted`, or an equivalent limit denial. It records analytics and opens the paywall without repeating a stale entitlement check.

Both paths use the existing RevenueCat paywall route and preserve feature, life-stage, reason, remaining-credit, and placement analytics. Navigation failures surface a visible error and interactive buttons retain loading/disabled feedback while work is in progress.

The Doctor PDF flow will use `required` both when the loaded server access state is exhausted and when reservation is denied. It will not consume a credit unless PDF creation succeeds, and it will release a reservation on generation failure as it does today.

## Premium Gate Audit

Every registry entry will be checked against its UI and server-denial path:

- credit features: document insight, Doctor PDF, family task alarms, and pregnancy support handover;
- pregnancy premium features: health-file save, reminders, and PDF archive;
- postpartum premium features: advanced pumping, memory gallery, care history, family reminders, care insights, medicine, multiple babies, solid food, sleep prediction, and milk inventory.

Audit rules:

- a locked CTA must have a paywall action;
- a confirmed server denial must use `required` mode;
- a local locked-state tap may use `if_needed` mode;
- failed access checks show an error instead of silently returning;
- each paywall event carries the canonical `PREMIUM_FEATURES` source;
- premium users are not shown a paywall after a successful refresh;
- no premium operation is executed solely from a client boolean when the server protects the operation.

## Testing

Tests will be written before implementation and will cover:

- production state cannot be overwritten by newer sandbox expiration;
- production state replaces sandbox state;
- newer same-environment events update while older events are ignored;
- server verification repairs an overwritten or stale cache row;
- transfer reconciliation refreshes destination and source users;
- verification failure does not revoke cached production access;
- `required` paywall mode always navigates after a server denial;
- `if_needed` mode suppresses navigation for verified premium access;
- every `PREMIUM_FEATURES` definition has at least one registered gate mapping;
- Doctor PDF, document insight, family alarms, pregnancy handover, gallery limits, and health-file denials choose the correct presentation mode.

Verification remains scoped to the affected TypeScript, Deno, and SQL behavior. It includes focused tests, TypeScript checking, Deno checking/tests for changed Edge Functions, Supabase database lint where available, and a source-to-registry premium gate coverage check.

## Deployment and Recovery

Deployment order:

1. set `REVENUECAT_SECRET_API_KEY` and the entitlement identifier in Supabase Edge Function secrets;
2. apply the database migration;
3. deploy the reconciliation and updated webhook functions;
4. release the client changes.

Existing affected customers are repaired by the migration when production event history is sufficient and otherwise by server verification on their next app launch or restore. The friend in the reported scenario should regain access after opening the updated production app; “Satın alımları geri yükle” remains the explicit fallback.

Operational metrics will distinguish sandbox events ignored due to production precedence, successful cache repairs, reconciliation failures, forced paywall requests, and paywall navigation success. No customer identifiers or purchase payloads are added to client analytics.
