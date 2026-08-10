-- Attribute activity recorded before auth recovery and avoid reporting future
-- retention checkpoints as zero.

update public.analytics_events
set occurred_at = created_at
where installation_id is null
  and created_at < occurred_at - interval '5 minutes';

create or replace function public.analytics_effective_user_activity(
  p_from timestamptz,
  p_to timestamptz
)
returns table(user_id uuid, activity_date date)
language sql
stable
security definer
set search_path = public
as $$
  select activity.actor_id, activity.local_date
  from (
    select
      coalesce(ae.user_id, installation_user.user_id) as actor_id,
      (ae.occurred_at at time zone 'Europe/Istanbul')::date as local_date
    from public.analytics_events ae
    left join public.analytics_installation_users installation_user
      on installation_user.installation_id = ae.installation_id
    where ae.occurred_at >= p_from and ae.occurred_at < p_to
  ) activity
  where activity.actor_id is not null
  group by activity.actor_id, activity.local_date;
$$;

revoke all on function public.analytics_effective_user_activity(timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.get_analytics_retention(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  cohort_date date,
  cohort_users bigint,
  d1_users bigint,
  d7_users bigint,
  d30_users bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_analytics_admin() then raise exception 'not_allowed'; end if;

  return query
  with cohorts as (
    select
      profile.id as user_id,
      (profile.created_at at time zone 'Europe/Istanbul')::date as cohort_date
    from public.profiles profile
    where profile.created_at >= p_from and profile.created_at < p_to
  ), activity as (
    select *
    from public.analytics_effective_user_activity(
      p_from,
      p_to + interval '31 days'
    )
  ), today as (
    select (now() at time zone 'Europe/Istanbul')::date as local_date
  )
  select
    cohort.cohort_date,
    count(*)::bigint,
    case when today.local_date >= cohort.cohort_date + 1 then
      count(*) filter (where exists (
        select 1 from activity
        where activity.user_id = cohort.user_id
          and activity.activity_date = cohort.cohort_date + 1
      ))::bigint
    else null end,
    case when today.local_date >= cohort.cohort_date + 7 then
      count(*) filter (where exists (
        select 1 from activity
        where activity.user_id = cohort.user_id
          and activity.activity_date = cohort.cohort_date + 7
      ))::bigint
    else null end,
    case when today.local_date >= cohort.cohort_date + 30 then
      count(*) filter (where exists (
        select 1 from activity
        where activity.user_id = cohort.user_id
          and activity.activity_date = cohort.cohort_date + 30
      ))::bigint
    else null end
  from cohorts cohort
  cross join today
  group by cohort.cohort_date, today.local_date
  order by cohort.cohort_date;
end;
$$;

create or replace function public.get_analytics_timeseries(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  metric_date date,
  paywall_viewers bigint,
  verified_purchases bigint,
  active_users bigint
)
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
  ), activity as (
    select * from public.analytics_effective_user_activity(p_from, p_to)
  )
  select
    day::date,
    (select count(distinct paywalls.user_id) from paywalls where (paywalls.viewed_at at time zone 'Europe/Istanbul')::date = day::date),
    (select count(distinct purchases.user_id) from purchases where (purchases.purchased_at at time zone 'Europe/Istanbul')::date = day::date),
    (select count(*) from activity where activity.activity_date = day::date)
  from generate_series(
    (p_from at time zone 'Europe/Istanbul')::date,
    ((p_to - interval '1 second') at time zone 'Europe/Istanbul')::date,
    interval '1 day'
  ) day;
end;
$$;

comment on function public.analytics_effective_user_activity(timestamptz, timestamptz) is
  'Aggregate-only activity signal using direct user ids or installation identity links.';
