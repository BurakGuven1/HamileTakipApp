# Subscription Analytics

The private dashboard is published at `/admin/analytics`. On the current Vercel
domain, the production URL is:

`https://hamile-takip-app-vqgw.vercel.app/admin/analytics`

The existing files under `public/` remain the source for the public legal pages.
The analytics route uses Supabase email/password authentication and additionally
requires the signed-in user's UUID to exist in `public.analytics_admins`.

## What is collected

- Anonymous installation and session IDs before sign-in
- Onboarding, activation, core feature, premium gate, paywall and purchase events
- Paywall source, offering/package/product, app version and platform
- Normalized RevenueCat lifecycle events, price, currency and store environment
- Aggregate funnel, subscription health, retention and data quality metrics

The dashboard separates current state from period events. `subscriptions` is
used to show active subscribers that predate normalized webhook storage, while
new purchases and lifecycle changes come from `revenuecat_events`. Legacy
`paywall_offering_loaded` events fill historical paywall gaps without creating
fake raw `paywall_views` rows.

Raw event properties must not contain names, free text, document contents, baby
IDs, post IDs or other unnecessary personal data. Raw analytics events are kept
for 15 months; daily aggregates are kept for 36 months.

## Supabase deployment

From the repository root:

```powershell
supabase db push --linked --workdir src
supabase functions deploy revenuecat-webhook --no-verify-jwt --workdir src
supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER="Bearer <strong-random-secret>" --workdir src
```

Configure the same Authorization header in the RevenueCat webhook settings.
Then add the first dashboard administrator from the Supabase SQL Editor:

```sql
insert into public.analytics_admins (user_id)
select id
from auth.users
where email = '<admin-email>'
on conflict (user_id) do nothing;
```

The admin account must already exist in Supabase Auth.

## Vercel deployment

The repository's `vercel.json` exports the Expo Router web app to `dist` and
enables clean URLs. If the Vercel project is connected to the Git repository,
push the branch used by that project. For a manual production deployment:

```powershell
npm run deploy:web
```

Required `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values
must also be configured in the Vercel project's environment variables.

## Funnel interpretation

Use the dashboard from top to bottom:

1. First open to onboarding completion shows acquisition/onboarding loss.
2. Activation shows whether users reach a meaningful core action.
3. Premium gate to paywall loaded shows technical and targeting quality.
4. Purchase started to client completion shows checkout friction.
5. RevenueCat initial purchase is the server-side conversion source of truth.
6. Renewal, cancellation, billing issue and expiration show subscriber quality.

Compare conversion by paywall source and RevenueCat offering. Run paywall A/B
tests through RevenueCat Offerings; keep assignment in RevenueCat and use the
recorded offering/package fields for analysis instead of creating a second
client-side experiment allocator.
