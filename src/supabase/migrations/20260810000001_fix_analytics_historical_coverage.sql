-- Keep the dashboard accurate across the analytics cutover. New normalized
-- tables remain authoritative, while trusted legacy records fill only gaps.

create or replace function public.analytics_effective_paywall_impressions(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  user_id uuid,
  paywall_view_id uuid,
  source text,
  offering_id text,
  viewed_at timestamptz,
  is_legacy_fallback boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pv.user_id,
    pv.id,
    coalesce(nullif(pv.source, ''), 'unknown'),
    nullif(offering.event_properties ->> 'offering_id', ''),
    pv.viewed_at,
    false
  from public.paywall_views pv
  left join lateral (
    select ae.event_properties
    from public.analytics_events ae
    where ae.event_name = 'paywall_offering_loaded'
      and ae.paywall_view_id = pv.id
    order by ae.occurred_at
    limit 1
  ) offering on true
  where pv.viewed_at >= p_from and pv.viewed_at < p_to

  union all

  select
    ae.user_id,
    coalesce(ae.paywall_view_id, ae.id),
    coalesce(nullif(ae.event_properties ->> 'source', ''), 'unknown'),
    nullif(ae.event_properties ->> 'offering_id', ''),
    ae.occurred_at,
    true
  from public.analytics_events ae
  where ae.event_name = 'paywall_offering_loaded'
    and ae.occurred_at >= p_from and ae.occurred_at < p_to
    and not exists (
      select 1 from public.paywall_views pv
      where pv.id = ae.paywall_view_id
    );
$$;

revoke all on function public.analytics_effective_paywall_impressions(timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.analytics_effective_verified_purchases(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  user_id uuid,
  purchased_at timestamptz,
  product_id text,
  is_subscription_cache_fallback boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select re.user_id, re.event_at, re.product_id, false
  from public.revenuecat_events re
  where re.user_id is not null
    and re.event_type = 'INITIAL_PURCHASE'
    and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
    and re.event_at >= p_from and re.event_at < p_to

  union all

  select s.user_id, s.updated_at, s.product_id, true
  from public.subscriptions s
  where s.status = 'active'
    and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
    and s.updated_at >= p_from and s.updated_at < p_to
    and not exists (
      select 1 from public.revenuecat_events re
      where re.user_id = s.user_id
        and re.event_type = 'INITIAL_PURCHASE'
        and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
    );
$$;

revoke all on function public.analytics_effective_verified_purchases(timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.get_analytics_overview(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;

  select jsonb_build_object(
    'first_opens', (select count(distinct installation_id) from public.analytics_events where event_name = 'first_open' and occurred_at >= p_from and occurred_at < p_to),
    'accounts', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
    'onboarding_completed', (select count(distinct user_id) from public.analytics_events where event_name = 'onboarding_completed' and occurred_at >= p_from and occurred_at < p_to),
    'activated', (select count(distinct user_id) from public.analytics_events where event_name = 'activated' and occurred_at >= p_from and occurred_at < p_to),
    'paywall_viewers', (select count(distinct user_id) from public.analytics_effective_paywall_impressions(p_from, p_to)),
    'verified_customers', (select count(distinct user_id) from public.analytics_effective_verified_purchases(p_from, p_to)),
    'active_subscribers', (
      select count(*) from public.subscriptions
      where status = 'active'
        and (is_lifetime or expires_at is null or expires_at > now())
    ),
    'paywall_conversion_7d', (
      with first_views as (
        select user_id, min(viewed_at) as viewed_at
        from public.analytics_effective_paywall_impressions(p_from, p_to)
        where user_id is not null
        group by user_id
      )
      select coalesce(round(
        100.0 * count(*) filter (where exists (
          select 1
          from public.analytics_effective_verified_purchases(fv.viewed_at, fv.viewed_at + interval '7 days') purchase
          where purchase.user_id = fv.user_id
        )) / nullif(count(*), 0), 2
      ), 0)
      from first_views fv
    ),
    'median_hours_to_purchase', (
      with first_views as (
        select user_id, min(viewed_at) as viewed_at
        from public.analytics_effective_paywall_impressions(p_from, p_to)
        where user_id is not null
        group by user_id
      ), first_purchases as (
        select user_id, min(purchased_at) as purchased_at
        from public.analytics_effective_verified_purchases(p_from, p_to + interval '7 days')
        group by user_id
      )
      select round((percentile_cont(0.5) within group (
        order by extract(epoch from (fp.purchased_at - fv.viewed_at)) / 3600
      ))::numeric, 1)
      from first_views fv
      join first_purchases fp on fp.user_id = fv.user_id
      where fp.purchased_at >= fv.viewed_at
        and fp.purchased_at < fv.viewed_at + interval '7 days'
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_analytics_funnel(
  p_from timestamptz,
  p_to timestamptz
)
returns table(step_key text, step_order integer, users bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return query
  select 'first_open', 1, count(distinct installation_id) from public.analytics_events where event_name = 'first_open' and occurred_at >= p_from and occurred_at < p_to
  union all select 'account_created', 2, count(*) from public.profiles where created_at >= p_from and created_at < p_to
  union all select 'onboarding_completed', 3, count(distinct user_id) from public.analytics_events where event_name = 'onboarding_completed' and occurred_at >= p_from and occurred_at < p_to
  union all select 'activated', 4, count(distinct user_id) from public.analytics_events where event_name = 'activated' and occurred_at >= p_from and occurred_at < p_to
  union all select 'premium_gate_hit', 5, count(distinct user_id) from public.analytics_events where event_name = 'premium_gate_hit' and occurred_at >= p_from and occurred_at < p_to
  union all select 'paywall_presented', 6, count(distinct user_id) from public.analytics_effective_paywall_impressions(p_from, p_to)
  union all select 'purchase_started', 7, count(distinct user_id) from public.analytics_events where event_name = 'purchase_started' and occurred_at >= p_from and occurred_at < p_to
  union all select 'verified_purchase', 8, count(distinct user_id) from public.analytics_effective_verified_purchases(p_from, p_to)
  order by 2;
end;
$$;

create or replace function public.get_paywall_source_performance(
  p_from timestamptz,
  p_to timestamptz
)
returns table(source text, impressions bigint, unique_viewers bigint, verified_conversions bigint, conversion_rate numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return query
  select
    impression.source,
    count(*)::bigint,
    count(distinct impression.user_id)::bigint,
    count(distinct impression.user_id) filter (where exists (
      select 1
      from public.analytics_effective_verified_purchases(impression.viewed_at, impression.viewed_at + interval '7 days') purchase
      where purchase.user_id = impression.user_id
    ))::bigint,
    coalesce(round(
      100.0 * count(distinct impression.user_id) filter (where exists (
        select 1
        from public.analytics_effective_verified_purchases(impression.viewed_at, impression.viewed_at + interval '7 days') purchase
        where purchase.user_id = impression.user_id
      )) / nullif(count(distinct impression.user_id), 0), 2
    ), 0)
  from public.analytics_effective_paywall_impressions(p_from, p_to) impression
  group by impression.source
  order by 5 desc, 2 desc;
end;
$$;

create or replace function public.get_offering_performance(
  p_from timestamptz,
  p_to timestamptz
)
returns table(offering_id text, impressions bigint, purchase_starts bigint, verified_purchases bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return query
  select
    coalesce(impression.offering_id, 'unknown'),
    count(*)::bigint,
    count(*) filter (where exists (
      select 1 from public.analytics_events started
      where started.event_name = 'purchase_started'
        and (
          started.paywall_view_id = impression.paywall_view_id
          or (
            impression.user_id is not null
            and started.user_id = impression.user_id
            and started.occurred_at >= impression.viewed_at
            and started.occurred_at < impression.viewed_at + interval '2 hours'
          )
        )
    ))::bigint,
    count(distinct impression.user_id) filter (where exists (
      select 1
      from public.analytics_effective_verified_purchases(impression.viewed_at, impression.viewed_at + interval '7 days') purchase
      where purchase.user_id = impression.user_id
    ))::bigint
  from public.analytics_effective_paywall_impressions(p_from, p_to) impression
  group by coalesce(impression.offering_id, 'unknown')
  order by 4 desc, 2 desc;
end;
$$;

create or replace function public.get_subscription_health(
  p_from timestamptz,
  p_to timestamptz
)
returns table(event_type text, events bigint, customers bigint, gross_revenue numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return query
  select health.event_type, health.events, health.customers, health.gross_revenue
  from (
    select re.event_type, count(*)::bigint as events,
      count(distinct re.user_id)::bigint as customers,
      coalesce(sum(re.price) filter (where re.event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE')), 0) as gross_revenue
    from public.revenuecat_events re
    where re.event_at >= p_from and re.event_at < p_to
      and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
    group by re.event_type
    union all
    select 'CURRENT_ACTIVE'::text, count(*)::bigint, count(*)::bigint, 0::numeric
    from public.subscriptions s
    where s.status = 'active'
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
  ) health
  order by health.events desc, health.event_type;
end;
$$;

create or replace function public.get_analytics_timeseries(
  p_from timestamptz,
  p_to timestamptz
)
returns table(metric_date date, paywall_viewers bigint, verified_purchases bigint, active_users bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return query
  with paywalls as (
    select * from public.analytics_effective_paywall_impressions(p_from, p_to)
  ), purchases as (
    select * from public.analytics_effective_verified_purchases(p_from, p_to)
  )
  select day::date,
    (select count(distinct paywalls.user_id) from paywalls where (paywalls.viewed_at at time zone 'Europe/Istanbul')::date = day::date),
    (select count(distinct purchases.user_id) from purchases where (purchases.purchased_at at time zone 'Europe/Istanbul')::date = day::date),
    (select count(distinct coalesce(ae.user_id::text, ae.installation_id::text)) from public.analytics_events ae where (ae.occurred_at at time zone 'Europe/Istanbul')::date = day::date and ae.event_name = 'session_started')
  from generate_series(
    (p_from at time zone 'Europe/Istanbul')::date,
    ((p_to - interval '1 second') at time zone 'Europe/Istanbul')::date,
    interval '1 day'
  ) day;
end;
$$;

create or replace function public.get_analytics_data_quality(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'client_completions', (select count(*) from public.analytics_events where event_name = 'purchase_client_completed' and occurred_at >= p_from and occurred_at < p_to),
    'verified_purchases', (select count(*) from public.analytics_effective_verified_purchases(p_from, p_to)),
    'legacy_paywall_fallbacks', (select count(*) from public.analytics_effective_paywall_impressions(p_from, p_to) where is_legacy_fallback),
    'subscription_cache_fallbacks', (select count(*) from public.analytics_effective_verified_purchases(p_from, p_to) where is_subscription_cache_fallback),
    'missing_paywall_source', (select count(*) from public.analytics_effective_paywall_impressions(p_from, p_to) where source in ('unknown', 'direct_navigation')),
    'missing_offering', (select count(*) from public.analytics_effective_paywall_impressions(p_from, p_to) where offering_id is null),
    'sandbox_webhooks', (select count(*) from public.revenuecat_events where environment = 'SANDBOX' and event_at >= p_from and event_at < p_to)
  );
end;
$$;

comment on function public.analytics_effective_paywall_impressions(timestamptz, timestamptz) is
  'Internal aggregate-only helper that fills paywall log gaps from legacy offering-loaded events.';
comment on function public.analytics_effective_verified_purchases(timestamptz, timestamptz) is
  'Internal aggregate-only helper that fills pre-webhook purchase gaps from trusted active subscription cache rows.';
