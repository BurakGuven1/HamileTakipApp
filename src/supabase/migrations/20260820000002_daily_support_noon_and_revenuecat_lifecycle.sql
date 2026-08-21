-- A single, useful daily nudge at 12:00 Europe/Istanbul (09:00 UTC).
-- Delivery deduplication remains enforced by notification_deliveries.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'daily-support-notifications-reliable'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'daily-support-notifications-reliable',
    '0 9 * * *',
    $cron$select net.http_post(
      url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-daily-support',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-dispatch-secret', (
          select dispatch_secret
          from public.notification_dispatch_config
          where singleton = true
        )
      ),
      body := '{}'::jsonb
    );$cron$
  );
end;
$$;

-- RevenueCat webhooks are billing lifecycle signals, not application activity.
-- The masked customer key permits lifecycle comparison without exposing UUIDs.
create or replace function public.get_revenuecat_customer_lifecycle(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  customer_key text,
  first_webhook_at timestamptz,
  last_webhook_at timestamptz,
  last_event_type text,
  last_product_id text,
  events bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;

  return query
  with period_customers as (
    select distinct event.user_id
    from public.revenuecat_events event
    where event.user_id is not null
      and event.event_at >= p_from
      and event.event_at < p_to
      and coalesce(event.environment, 'PRODUCTION') = 'PRODUCTION'
  ), lifecycle as (
    select
      event.user_id,
      min(event.event_at) as first_webhook_at,
      max(event.event_at) as last_webhook_at,
      count(*)::bigint as events
    from public.revenuecat_events event
    join period_customers customer on customer.user_id = event.user_id
    where coalesce(event.environment, 'PRODUCTION') = 'PRODUCTION'
    group by event.user_id
  ), latest_event as (
    select distinct on (event.user_id)
      event.user_id,
      event.event_type,
      event.product_id
    from public.revenuecat_events event
    join period_customers customer on customer.user_id = event.user_id
    where coalesce(event.environment, 'PRODUCTION') = 'PRODUCTION'
    order by event.user_id, event.event_at desc, event.revenuecat_event_id desc
  )
  select
    '…' || right(lifecycle.user_id::text, 8),
    lifecycle.first_webhook_at,
    lifecycle.last_webhook_at,
    latest_event.event_type,
    latest_event.product_id,
    lifecycle.events
  from lifecycle
  join latest_event on latest_event.user_id = lifecycle.user_id
  order by lifecycle.last_webhook_at desc;
end;
$$;

revoke all on function public.get_revenuecat_customer_lifecycle(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.get_revenuecat_customer_lifecycle(timestamptz, timestamptz)
  to authenticated;

comment on function public.get_revenuecat_customer_lifecycle(timestamptz, timestamptz) is
  'Masked RevenueCat billing lifecycle for customers active in the selected period; not a measure of app retention.';
