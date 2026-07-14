-- ============================================================
-- 0026: Premium campaign notification deduplication
-- ============================================================

create table if not exists public.premium_campaign_notification_logs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null,
  campaign_year int not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, campaign_key, campaign_year)
);

comment on table public.premium_campaign_notification_logs is
  'Prevents sending the same seasonal Premium campaign push notification to a user more than once per campaign year.';

alter table public.premium_campaign_notification_logs enable row level security;

drop policy if exists "premium_campaign_logs_select_own"
  on public.premium_campaign_notification_logs;
create policy "premium_campaign_logs_select_own"
  on public.premium_campaign_notification_logs for select
  using (auth.uid() = user_id);

grant select on public.premium_campaign_notification_logs to authenticated;

create index if not exists idx_premium_campaign_logs_campaign
  on public.premium_campaign_notification_logs(campaign_key, campaign_year);

-- Optional cron example. Run once daily around local Turkey morning.
-- Requires pg_cron + pg_net. Prefer using Supabase Dashboard > Database > Cron Jobs
-- and keep service role keys in Vault instead of inline SQL.
--
-- select cron.schedule(
--   'seasonal-premium-campaigns',
--   '0 6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-seasonal-premium-campaigns',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
