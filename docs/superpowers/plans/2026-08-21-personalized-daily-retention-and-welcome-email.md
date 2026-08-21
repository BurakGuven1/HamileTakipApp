# Personalized Daily Retention and Welcome Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly tap-first maternal check-in, a unique personalized daily card with a 10:00 push, Premium trend upsells, and one reliable post-onboarding welcome email.

**Architecture:** PostgreSQL owns versioned prompts, responses, daily assignments, RLS, and idempotency. Focused React Native components render the home experience. Existing Supabase Edge Functions/Expo Push deliver daily notifications; a new Supabase Edge Function sends queued welcome mail through Resend.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, TanStack Query, Supabase PostgreSQL/RLS/RPC/Edge Functions, Deno, Expo Push, Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-08-21-personalized-daily-retention-and-welcome-email-design.md`

## Global Constraints

- Firebase is not part of daily delivery; use Supabase and Expo Push.
- Send daily support at 10:00 Europe/Istanbul and skip users who already opened today's card.
- Weekly check-in and basic daily card are free; history, trends, detailed plans, and PDF are Premium.
- Pregnancy and postpartum content never mix.
- Free text never enters push payloads, email copy, logs, or raw analytics.
- No diagnosis, generated medical advice, guilt streaks, or automatic marketing consent.
- Welcome delivery is one-time after onboarding completion.
- Premium email CTA requires separate explicit email consent.
- Do not run Expo Doctor or Android Doctor.

---

### Task 1: Daily experience schema and deterministic policy

**Files:**
- Create: `src/supabase/migrations/20260821000002_personalized_daily_experience.sql`
- Create: `src/supabase/tests/personalized_daily_experience.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces RPCs `get_weekly_checkin_context()`, `submit_weekly_checkin(jsonb,text)`, `get_today_daily_experience()` and `complete_daily_experience(uuid)`.
- Produces JSON fields `life_stage`, `week_key`, `needs_checkin`, `questions`, `daily_card`, `premium_preview`, and `opened_today`.

- [ ] **Step 1: Write failing SQL assertions**

Cover unique weekly response, unique daily assignment, mother-only RLS, stage separation, 160-character note limit, recent-content cooldown, and idempotent completion.

```sql
do $$
begin
  if not exists (select 1 from public.weekly_checkin_question_packs where life_stage = 'pregnancy') then
    raise exception 'pregnancy pack missing';
  end if;
  if not exists (select 1 from public.weekly_checkin_question_packs where life_stage = 'postpartum') then
    raise exception 'postpartum pack missing';
  end if;
end;
$$;
```

- [ ] **Step 2: Run RED**

Run the SQL test against a reset local Supabase database.
Expected: FAIL because the tables and RPCs do not exist.

- [ ] **Step 3: Implement schema, seeds, RLS, and RPCs**

```sql
create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  life_stage text not null check (life_stage in ('pregnancy','postpartum')),
  week_key date not null,
  pack_id uuid not null references public.weekly_checkin_question_packs(id),
  answers jsonb not null,
  focus_tags text[] not null default '{}',
  optional_note text check (char_length(optional_note) <= 160),
  created_at timestamptz not null default now(),
  unique (profile_id, life_stage, week_key)
);

create table public.daily_experience_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience_date date not null,
  life_stage text not null check (life_stage in ('pregnancy','postpartum')),
  content_key text not null,
  payload jsonb not null,
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, experience_date)
);
```

Seed eight packs and curated cards per life stage. Validate option IDs and derive allowlisted focus tags server-side. Select cards by Turkey date, life stage, pregnancy week/baby age, focus tags, day slot, and recent content keys.

- [ ] **Step 4: Run GREEN and update TypeScript declarations**

Run SQL assertions and `npm run typecheck`.
Expected: SQL transaction exits without exception and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git add src/supabase/migrations/20260821000002_personalized_daily_experience.sql src/supabase/tests/personalized_daily_experience.sql src/types/database.ts
git commit -m "feat: add personalized daily experience data"
```

---

### Task 2: Client API and accessible home cards

**Files:**
- Create: `src/api/dailyExperience.ts`
- Create: `src/features/daily-experience/dailyExperiencePolicy.ts`
- Create: `src/features/daily-experience/dailyExperiencePolicy.test.mjs`
- Create: `src/features/daily-experience/WeeklyCheckInCard.tsx`
- Create: `src/features/daily-experience/DailyForYouCard.tsx`
- Modify: `app/(tabs)/home/index.tsx`
- Modify: `src/services/analytics/productAnalytics.ts`

**Interfaces:**
- Consumes Task 1 RPCs.
- Produces `DAILY_EXPERIENCE_QUERY_KEY`, `getDailyExperience()`, `submitWeeklyCheckIn()`, and `completeDailyExperience()`.

- [ ] **Step 1: Write failing policy tests**

```ts
test("weekly state and premium CTA are deterministic", () => {
  assert.equal(getWeeklyCardState({ needsCheckin: true, dismissed: false }), "expanded");
  assert.equal(getWeeklyCardState({ needsCheckin: false, dismissed: false }), "hidden");
  assert.equal(getDailyCtaMode({ premiumRequired: true, isPremium: false }), "paywall");
});
```

- [ ] **Step 2: Run RED**

Run: `node --experimental-strip-types --test src/features/daily-experience/dailyExperiencePolicy.test.mjs`
Expected: FAIL because policy functions do not exist.

- [ ] **Step 3: Implement defensive API parsing and policy**

Reject missing question/option/card identifiers, title, body, action label, or destination. Keep the optional note only in the submit payload and never pass it to analytics.

- [ ] **Step 4: Implement the two home cards**

`WeeklyCheckInCard` uses one question per step, 48dp option chips, progress, Back/Continue, and one optional 160-character field. `DailyForYouCard` renders one insight, one action, a stage fact, completed state, and a clearly labeled Premium preview. Place both before general home content and invalidate queries after submit/complete.

- [ ] **Step 5: Wire Premium and analytics**

Call `showPaywallIfNeeded("daily_personal_insight", ..., { mode: "required" })` only when the locked CTA is tapped. Add privacy-safe events `weekly_checkin_viewed`, `weekly_checkin_completed`, `daily_experience_viewed`, `daily_experience_completed`, and `daily_experience_premium_tapped`; never attach answers, note, name, or IDs.

- [ ] **Step 6: Run GREEN and commit**

Run the Node policy test, `npm run typecheck`, and `git diff --check`, then commit the listed files with message `feat: add weekly check-in and daily value card`.

---

### Task 3: Personalized daily push at 10:00

**Files:**
- Modify: `src/supabase/functions/send-daily-support/index.ts`
- Modify: `src/supabase/functions/send-daily-support/dailySupportCopy.ts`
- Modify: `src/supabase/functions/send-daily-support/dailySupportCopy.test.ts`
- Create: `src/supabase/migrations/20260821000003_daily_experience_at_ten.sql`
- Modify: `src/hooks/useNotificationNavigation.ts`

**Interfaces:**
- Consumes Task 1 daily assignment.
- Produces push data `{ type: "daily_experience", screen: "home", content_key, life_stage }`.

- [ ] **Step 1: Write failing notification tests**

```ts
Deno.test("opened card is skipped", () => {
  assertEquals(shouldSendDailyExperience({ openedAt: "2026-08-21T06:00:00Z" }), false);
});
```

- [ ] **Step 2: Run RED**

Run: `npx deno test src/supabase/functions/send-daily-support/dailySupportCopy.test.ts`
Expected: FAIL because the eligibility helper does not exist.

- [ ] **Step 3: Use daily assignments and skip opened cards**

For each eligible owner, obtain today's assignment through a service-role RPC, skip non-null `opened_at`, use distinct pregnancy/postpartum copy, preserve `notification_deliveries` deduplication, and include no free text or sensitive tags.

- [ ] **Step 4: Move the reliable cron to 07:00 UTC**

Replace the existing job with `0 7 * * *`, which is 10:00 in Turkey's UTC+3 time zone, while retaining the secured `net.http_post` body and header.

- [ ] **Step 5: Run GREEN and commit**

Run the Deno test, Deno check for `send-daily-support/index.ts`, and `git diff --check`; commit with message `feat: send personalized daily support at ten`.

---

### Task 4: One-time consent-aware welcome email

**Files:**
- Create: `src/supabase/migrations/20260821000004_welcome_email_delivery.sql`
- Create: `src/supabase/tests/welcome_email_delivery.sql`
- Create: `src/supabase/functions/send-welcome-email/welcomeEmail.ts`
- Create: `src/supabase/functions/send-welcome-email/welcomeEmail.test.ts`
- Create: `src/supabase/functions/send-welcome-email/index.ts`
- Modify: `app/(auth)/onboarding.tsx`
- Modify: `app/(tabs)/settings/index.tsx`
- Modify: `src/types/database.ts`
- Modify: `.env.example`
- Modify: `docs/analytics.md`

**Interfaces:**
- Produces profile fields `notify_premium_emails` and `premium_email_consent_at`.
- Produces unique queue `welcome_email_deliveries(user_id)` and Edge Function `send-welcome-email`.
- Requires server-only `RESEND_API_KEY`, `WELCOME_EMAIL_FROM`, and `WELCOME_EMAIL_REPLY_TO`.

- [ ] **Step 1: Write failing renderer tests**

```ts
Deno.test("unconsented welcome has no purchase CTA", () => {
  const mail = buildWelcomeEmail({ lifeStage: "pregnancy", name: "Elif", premiumConsent: false });
  assert(mail.html.includes("Ücretsiz kullanabileceğin"));
  assert(!mail.html.includes("Premium'u incele"));
});
```

- [ ] **Step 2: Run RED**

Run: `npx deno test src/supabase/functions/send-welcome-email/welcomeEmail.test.ts`
Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Add consent and idempotent queue schema**

Add default-off email consent fields. Create `pending/sending/sent/failed` delivery state, attempt count, provider ID, timestamps, and unique user ID. A false-to-true onboarding trigger inserts one pending row. A five-minute cron invokes the Edge Function using the existing notification dispatch secret.

- [ ] **Step 4: Implement Resend delivery**

Authorize the dispatch header, atomically claim bounded rows, obtain email using `auth.admin.getUserById`, render Turkish HTML/plain text, call `https://api.resend.com/emails`, and mark sent/failed without logging email or provider body. Stop after three attempts.

```ts
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from, to: [email], subject, html, text, reply_to: replyTo })
});
```

- [ ] **Step 5: Add explicit email consent controls**

On onboarding add an unchecked control labeled `Anne+ Premium yeniliklerini e-posta ile almak istiyorum.` Save boolean and timestamp with onboarding completion. Add the same preference in Settings; disabling clears the timestamp. Never reuse push consent.

- [ ] **Step 6: Run GREEN and commit**

Run the renderer tests, SQL welcome assertions, Deno check, `npm run typecheck`, and `git diff --check`; commit with message `feat: send consent-aware welcome email`.

---

### Task 5: Deploy and verify

**Files:**
- Modify only if verification finds an in-scope defect.

**Interfaces:**
- Consumes Tasks 1–4.
- Produces active migrations and Edge Functions.

- [ ] **Step 1: Run focused local verification**

Run all new Node/Deno tests, SQL assertions where PostgreSQL is available, Deno checks for changed functions, `npm run typecheck`, and `git diff --check`.

- [ ] **Step 2: Verify server prerequisites without printing values**

Confirm `RESEND_API_KEY`, `WELCOME_EMAIL_FROM`, and `WELCOME_EMAIL_REPLY_TO` secret names and a verified sender domain. Never add them to Expo variables or repository files.

- [ ] **Step 3: Apply database changes**

Run `supabase db push --workdir src --dry-run`, verify only migrations `20260821000002` through `20260821000004`, then run `supabase db push --workdir src --yes`.

- [ ] **Step 4: Deploy functions**

```powershell
supabase functions deploy send-daily-support --no-verify-jwt --workdir src
supabase functions deploy send-welcome-email --no-verify-jwt --workdir src
```

- [ ] **Step 5: Verify remote state and acceptance scenarios**

Confirm migrations match remote, both functions are ACTIVE, unauthorized dispatch calls return 401, pregnancy/postpartum cards differ, a pre-10:00 open suppresses push, weekly check-in does not repeat, locked Premium detail opens paywall, and one onboarding completion creates exactly one welcome delivery.
