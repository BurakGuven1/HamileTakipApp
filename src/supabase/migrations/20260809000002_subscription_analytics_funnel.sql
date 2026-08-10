-- End-to-end product and subscription analytics.

alter table public.analytics_events
  add column if not exists installation_id uuid,
  add column if not exists event_version smallint not null default 1,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists app_version text,
  add column if not exists platform text,
  add column if not exists paywall_view_id uuid references public.paywall_views(id) on delete set null;

alter table public.analytics_events
  drop constraint if exists analytics_events_platform_check;

alter table public.analytics_events
  add constraint analytics_events_platform_check
  check (platform is null or platform in ('android', 'ios', 'web'));

create index if not exists idx_analytics_events_occurred_name
  on public.analytics_events(occurred_at desc, event_name);

create index if not exists idx_analytics_events_installation
  on public.analytics_events(installation_id, occurred_at desc);

create index if not exists idx_analytics_events_paywall_view
  on public.analytics_events(paywall_view_id)
  where paywall_view_id is not null;

alter table public.paywall_views
  add column if not exists installation_id uuid,
  add column if not exists session_id text;

create index if not exists paywall_views_source_viewed_at_idx
  on public.paywall_views(source, viewed_at desc);

create table public.analytics_installation_users (
  installation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);

alter table public.analytics_installation_users enable row level security;

create policy "analytics_installation_users_insert_own"
  on public.analytics_installation_users
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.analytics_installation_users from anon, authenticated;
grant insert on public.analytics_installation_users to authenticated;

create table public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.analytics_admins enable row level security;
revoke all on public.analytics_admins from anon, authenticated;

create or replace function public.is_analytics_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.analytics_admins aa
    where aa.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_analytics_admin() from public, anon;
grant execute on function public.is_analytics_admin() to authenticated;

create table public.revenuecat_events (
  revenuecat_event_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  product_id text,
  new_product_id text,
  presented_offering_id text,
  transaction_id text,
  original_transaction_id text,
  period_type text,
  price numeric,
  currency text,
  commission_percentage numeric,
  tax_percentage numeric,
  store text,
  environment text,
  cancel_reason text,
  expiration_reason text,
  purchased_at timestamptz,
  expiration_at timestamptz,
  event_at timestamptz not null,
  received_at timestamptz not null default now()
);

alter table public.revenuecat_events enable row level security;
revoke all on public.revenuecat_events from anon, authenticated;

create index revenuecat_events_user_event_at_idx
  on public.revenuecat_events(user_id, event_at desc);

create index revenuecat_events_type_event_at_idx
  on public.revenuecat_events(event_type, event_at desc);

create index revenuecat_events_offering_event_at_idx
  on public.revenuecat_events(presented_offering_id, event_at desc)
  where presented_offering_id is not null;

drop policy if exists "analytics_events_insert_own"
  on public.analytics_events;

create policy "analytics_events_insert_anonymous"
  on public.analytics_events
  for insert
  to anon
  with check (user_id is null and installation_id is not null);

create policy "analytics_events_insert_authenticated"
  on public.analytics_events
  for insert
  to authenticated
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and installation_id is not null
  );

revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;

create table public.analytics_daily_metrics (
  metric_date date not null,
  metric_name text not null,
  dimension_key text not null default 'all',
  dimension_value text not null default 'all',
  event_count bigint not null default 0,
  unique_actors bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric_date, metric_name, dimension_key, dimension_value)
);

alter table public.analytics_daily_metrics enable row level security;
revoke all on public.analytics_daily_metrics from anon, authenticated;

create or replace function public.rollup_analytics_daily(
  p_metric_date date default ((now() at time zone 'Europe/Istanbul')::date - 1)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.analytics_daily_metrics
  where metric_date = p_metric_date;

  insert into public.analytics_daily_metrics (
    metric_date,
    metric_name,
    dimension_key,
    dimension_value,
    event_count,
    unique_actors,
    updated_at
  )
  select
    p_metric_date,
    ae.event_name,
    'all',
    'all',
    count(*),
    count(distinct coalesce(ae.user_id::text, ae.installation_id::text)),
    now()
  from public.analytics_events ae
  where (ae.occurred_at at time zone 'Europe/Istanbul')::date = p_metric_date
  group by ae.event_name;

  insert into public.analytics_daily_metrics (
    metric_date,
    metric_name,
    dimension_key,
    dimension_value,
    event_count,
    unique_actors,
    updated_at
  )
  select
    p_metric_date,
    ae.event_name,
    'source',
    ae.event_properties ->> 'source',
    count(*),
    count(distinct coalesce(ae.user_id::text, ae.installation_id::text)),
    now()
  from public.analytics_events ae
  where (ae.occurred_at at time zone 'Europe/Istanbul')::date = p_metric_date
    and nullif(ae.event_properties ->> 'source', '') is not null
  group by ae.event_name, ae.event_properties ->> 'source';

  insert into public.analytics_daily_metrics (
    metric_date,
    metric_name,
    dimension_key,
    dimension_value,
    event_count,
    unique_actors,
    updated_at
  )
  select
    p_metric_date,
    'revenuecat_' || lower(re.event_type),
    'product_id',
    coalesce(re.product_id, 'unknown'),
    count(*),
    count(distinct re.user_id),
    now()
  from public.revenuecat_events re
  where (re.event_at at time zone 'Europe/Istanbul')::date = p_metric_date
    and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
  group by re.event_type, coalesce(re.product_id, 'unknown');

  delete from public.analytics_events
  where occurred_at < now() - interval '15 months';

  delete from public.paywall_views
  where viewed_at < now() - interval '15 months';

  delete from public.revenuecat_events
  where event_at < now() - interval '15 months';

  delete from public.analytics_daily_metrics
  where metric_date < current_date - interval '36 months';
end;
$$;

revoke all on function public.rollup_analytics_daily(date) from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'analytics-daily-rollup'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'analytics-daily-rollup',
    '15 3 * * *',
    $cron$select public.rollup_analytics_daily();$cron$
  );
end;
$$;

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
  if not public.is_analytics_admin() then
    raise exception 'not_allowed';
  end if;

  select jsonb_build_object(
    'first_opens', (
      select count(distinct installation_id)
      from public.analytics_events
      where event_name = 'first_open'
        and occurred_at >= p_from and occurred_at < p_to
    ),
    'accounts', (
      select count(*) from public.profiles
      where created_at >= p_from and created_at < p_to
    ),
    'onboarding_completed', (
      select count(distinct user_id)
      from public.analytics_events
      where event_name = 'onboarding_completed'
        and occurred_at >= p_from and occurred_at < p_to
    ),
    'activated', (
      select count(distinct user_id)
      from public.analytics_events
      where event_name = 'activated'
        and occurred_at >= p_from and occurred_at < p_to
    ),
    'paywall_viewers', (
      select count(distinct user_id)
      from public.paywall_views
      where viewed_at >= p_from and viewed_at < p_to
    ),
    'verified_customers', (
      select count(distinct user_id)
      from public.revenuecat_events
      where event_type = 'INITIAL_PURCHASE'
        and coalesce(environment, 'PRODUCTION') = 'PRODUCTION'
        and event_at >= p_from and event_at < p_to
    ),
    'paywall_conversion_7d', (
      with first_views as (
        select distinct on (user_id) user_id, viewed_at
        from public.paywall_views
        where viewed_at >= p_from and viewed_at < p_to
        order by user_id, viewed_at
      )
      select coalesce(
        round(
          100.0 * count(*) filter (where exists (
            select 1 from public.revenuecat_events re
            where re.user_id = fv.user_id
              and re.event_type = 'INITIAL_PURCHASE'
              and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
              and re.event_at >= fv.viewed_at
              and re.event_at < fv.viewed_at + interval '7 days'
          )) / nullif(count(*), 0),
          2
        ),
        0
      )
      from first_views fv
    ),
    'median_hours_to_purchase', (
      with first_views as (
        select user_id, min(viewed_at) as viewed_at
        from public.paywall_views
        where viewed_at >= p_from and viewed_at < p_to
        group by user_id
      ), first_purchases as (
        select user_id, min(event_at) as purchased_at
        from public.revenuecat_events
        where event_type = 'INITIAL_PURCHASE'
          and coalesce(environment, 'PRODUCTION') = 'PRODUCTION'
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
  union all select 'paywall_presented', 6, count(distinct user_id) from public.paywall_views where viewed_at >= p_from and viewed_at < p_to
  union all select 'purchase_started', 7, count(distinct user_id) from public.analytics_events where event_name = 'purchase_started' and occurred_at >= p_from and occurred_at < p_to
  union all select 'verified_purchase', 8, count(distinct user_id) from public.revenuecat_events where event_type = 'INITIAL_PURCHASE' and coalesce(environment, 'PRODUCTION') = 'PRODUCTION' and event_at >= p_from and event_at < p_to
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
    pv.source,
    count(*)::bigint,
    count(distinct pv.user_id)::bigint,
    count(distinct pv.user_id) filter (where exists (
      select 1 from public.revenuecat_events re
      where re.user_id = pv.user_id
        and re.event_type = 'INITIAL_PURCHASE'
        and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
        and re.event_at >= pv.viewed_at
        and re.event_at < pv.viewed_at + interval '7 days'
    ))::bigint,
    coalesce(round(100.0 * count(distinct pv.user_id) filter (where exists (
      select 1 from public.revenuecat_events re
      where re.user_id = pv.user_id
        and re.event_type = 'INITIAL_PURCHASE'
        and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
        and re.event_at >= pv.viewed_at
        and re.event_at < pv.viewed_at + interval '7 days'
    )) / nullif(count(distinct pv.user_id), 0), 2), 0)
  from public.paywall_views pv
  where pv.viewed_at >= p_from and pv.viewed_at < p_to
  group by pv.source
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
  with impressions as (
    select
      ae.user_id,
      ae.paywall_view_id,
      ae.occurred_at,
      coalesce(nullif(ae.event_properties ->> 'offering_id', ''), 'unknown') as offering_id
    from public.analytics_events ae
    where ae.event_name = 'paywall_offering_loaded'
      and ae.occurred_at >= p_from and ae.occurred_at < p_to
  )
  select
    i.offering_id,
    count(*)::bigint,
    count(*) filter (where exists (
      select 1 from public.analytics_events ps
      where ps.paywall_view_id = i.paywall_view_id
        and ps.event_name = 'purchase_started'
    ))::bigint,
    count(distinct i.user_id) filter (where exists (
      select 1 from public.revenuecat_events re
      where re.user_id = i.user_id
        and re.event_type = 'INITIAL_PURCHASE'
        and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
        and re.event_at >= i.occurred_at
        and re.event_at < i.occurred_at + interval '7 days'
    ))::bigint
  from impressions i
  group by i.offering_id
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
  select
    re.event_type,
    count(*)::bigint,
    count(distinct re.user_id)::bigint,
    coalesce(sum(re.price) filter (where re.event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE')), 0)
  from public.revenuecat_events re
  where re.event_at >= p_from and re.event_at < p_to
    and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'
  group by re.event_type
  order by count(*) desc;
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
  select
    day::date,
    (select count(distinct pv.user_id) from public.paywall_views pv where (pv.viewed_at at time zone 'Europe/Istanbul')::date = day::date),
    (select count(distinct re.user_id) from public.revenuecat_events re where (re.event_at at time zone 'Europe/Istanbul')::date = day::date and re.event_type = 'INITIAL_PURCHASE' and coalesce(re.environment, 'PRODUCTION') = 'PRODUCTION'),
    (select count(distinct coalesce(ae.user_id::text, ae.installation_id::text)) from public.analytics_events ae where (ae.occurred_at at time zone 'Europe/Istanbul')::date = day::date and ae.event_name = 'session_started')
  from generate_series((p_from at time zone 'Europe/Istanbul')::date, ((p_to - interval '1 second') at time zone 'Europe/Istanbul')::date, interval '1 day') day;
end;
$$;

create or replace function public.get_analytics_retention(
  p_from timestamptz,
  p_to timestamptz
)
returns table(cohort_date date, cohort_users bigint, d1_users bigint, d7_users bigint, d30_users bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;

  return query
  with cohorts as (
    select p.id as user_id, (p.created_at at time zone 'Europe/Istanbul')::date as cohort_date
    from public.profiles p
    where p.created_at >= p_from and p.created_at < p_to
  )
  select
    c.cohort_date,
    count(*)::bigint,
    count(*) filter (where exists (select 1 from public.analytics_events ae where ae.user_id = c.user_id and ae.event_name = 'session_started' and (ae.occurred_at at time zone 'Europe/Istanbul')::date = c.cohort_date + 1))::bigint,
    count(*) filter (where exists (select 1 from public.analytics_events ae where ae.user_id = c.user_id and ae.event_name = 'session_started' and (ae.occurred_at at time zone 'Europe/Istanbul')::date = c.cohort_date + 7))::bigint,
    count(*) filter (where exists (select 1 from public.analytics_events ae where ae.user_id = c.user_id and ae.event_name = 'session_started' and (ae.occurred_at at time zone 'Europe/Istanbul')::date = c.cohort_date + 30))::bigint
  from cohorts c
  group by c.cohort_date
  order by c.cohort_date;
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
    'verified_purchases', (select count(*) from public.revenuecat_events where event_type = 'INITIAL_PURCHASE' and coalesce(environment, 'PRODUCTION') = 'PRODUCTION' and event_at >= p_from and event_at < p_to),
    'missing_paywall_source', (select count(*) from public.paywall_views where viewed_at >= p_from and viewed_at < p_to and source = 'direct_navigation'),
    'missing_offering', (select count(*) from public.analytics_events where event_name = 'paywall_offering_loaded' and occurred_at >= p_from and occurred_at < p_to and nullif(event_properties ->> 'offering_id', '') is null),
    'sandbox_webhooks', (select count(*) from public.revenuecat_events where environment = 'SANDBOX' and event_at >= p_from and event_at < p_to)
  );
end;
$$;

revoke all on function public.get_analytics_overview(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_analytics_funnel(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_paywall_source_performance(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_offering_performance(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_subscription_health(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_analytics_timeseries(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_analytics_retention(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_analytics_data_quality(timestamptz, timestamptz) from public, anon;

grant execute on function public.get_analytics_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_analytics_funnel(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_paywall_source_performance(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_offering_performance(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_subscription_health(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_analytics_timeseries(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_analytics_retention(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_analytics_data_quality(timestamptz, timestamptz) to authenticated;

comment on table public.revenuecat_events is
  'Idempotent, normalized RevenueCat webhook events. RevenueCat is the verified commerce source of truth.';

comment on table public.analytics_admins is
  'UUID allowlist for aggregate-only analytics dashboard access. Populate with a trusted auth.users id using a server-side SQL command.';
