-- Keep TestFlight sandbox lifecycle events from overwriting a real App Store
-- subscription. RevenueCat remains the source of truth; this table is an
-- environment-aware cache used by server-side premium checks.

alter table public.subscriptions
  add column if not exists environment text not null default 'UNKNOWN',
  add column if not exists revenuecat_event_at timestamptz,
  add column if not exists verified_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_environment_check;

alter table public.subscriptions
  add constraint subscriptions_environment_check
  check (environment in ('PRODUCTION', 'SANDBOX', 'UNKNOWN'));

create or replace function public.should_apply_revenuecat_subscription_cache(
  p_current_environment text,
  p_current_event_at timestamptz,
  p_incoming_environment text,
  p_incoming_event_at timestamptz,
  p_verified_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_incoming_environment = 'PRODUCTION' then
      p_current_environment <> 'PRODUCTION'
      or p_verified_at is not null
      or (
        p_incoming_event_at is not null
        and p_incoming_event_at >= coalesce(
          p_current_event_at,
          '-infinity'::timestamptz
        )
      )
    when p_incoming_environment = 'SANDBOX' then
      p_current_environment in ('SANDBOX', 'UNKNOWN')
      and p_incoming_event_at is not null
      and p_incoming_event_at >= coalesce(
        p_current_event_at,
        '-infinity'::timestamptz
      )
    when p_incoming_environment = 'UNKNOWN' then
      p_current_environment = 'UNKNOWN'
      and p_incoming_event_at is not null
      and p_incoming_event_at >= coalesce(
        p_current_event_at,
        '-infinity'::timestamptz
      )
    else false
  end;
$$;

revoke all on function public.should_apply_revenuecat_subscription_cache(
  text,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.should_apply_revenuecat_subscription_cache(
  text,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) to service_role;

create or replace function public.apply_revenuecat_subscription_cache(
  p_user_id uuid,
  p_product_id text,
  p_status text,
  p_is_lifetime boolean,
  p_expires_at timestamptz,
  p_environment text,
  p_event_at timestamptz default null,
  p_verified_at timestamptz default null
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.subscriptions;
  v_environment text := upper(trim(coalesce(p_environment, 'UNKNOWN')));
  v_result public.subscriptions;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_product_id, '')), '') is null then
    raise exception 'product_id_required' using errcode = '22023';
  end if;
  if p_status not in ('active', 'expired', 'cancelled', 'grace_period') then
    raise exception 'invalid_subscription_status' using errcode = '22023';
  end if;
  if v_environment not in ('PRODUCTION', 'SANDBOX', 'UNKNOWN') then
    v_environment := 'UNKNOWN';
  end if;
  if p_verified_at is not null and v_environment = 'UNKNOWN' then
    raise exception 'verified_environment_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':revenuecat-subscription-cache', 0)
  );

  select * into v_current
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if found and not public.should_apply_revenuecat_subscription_cache(
    v_current.environment,
    v_current.revenuecat_event_at,
    v_environment,
    p_event_at,
    p_verified_at
  ) then
    return v_current;
  end if;

  insert into public.subscriptions (
    user_id,
    product_id,
    status,
    expires_at,
    is_lifetime,
    environment,
    revenuecat_event_at,
    verified_at,
    updated_at
  ) values (
    p_user_id,
    trim(p_product_id),
    p_status,
    case when coalesce(p_is_lifetime, false) then null else p_expires_at end,
    coalesce(p_is_lifetime, false),
    v_environment,
    p_event_at,
    p_verified_at,
    now()
  )
  on conflict (user_id) do update
  set
    product_id = excluded.product_id,
    status = excluded.status,
    expires_at = excluded.expires_at,
    is_lifetime = excluded.is_lifetime,
    environment = excluded.environment,
    revenuecat_event_at = coalesce(
      excluded.revenuecat_event_at,
      public.subscriptions.revenuecat_event_at
    ),
    verified_at = coalesce(
      excluded.verified_at,
      public.subscriptions.verified_at
    ),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.apply_revenuecat_subscription_cache(
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) is
  'Writes the effective RevenueCat cache while preventing SANDBOX or UNKNOWN states from replacing a known PRODUCTION subscription.';

revoke all on function public.apply_revenuecat_subscription_cache(
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_subscription_cache(
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  text,
  timestamptz,
  timestamptz
) to service_role;

-- Rebuild known cache provenance from the normalized event history. Production
-- history is deliberately ranked before sandbox history even when a sandbox
-- event arrived later.
with lifecycle_events as (
  select
    re.user_id,
    re.product_id,
    upper(coalesce(nullif(trim(re.environment), ''), 'UNKNOWN')) as environment,
    re.event_at,
    re.expiration_at,
    case
      when re.event_type in (
        'INITIAL_PURCHASE',
        'RENEWAL',
        'UNCANCELLATION',
        'NON_RENEWING_PURCHASE',
        'PRODUCT_CHANGE',
        'SUBSCRIPTION_EXTENDED',
        'REFUND_REVERSED'
      ) then 'active'
      when re.event_type = 'CANCELLATION'
        and re.expiration_at is not null
        and re.expiration_at > now() then 'active'
      when re.event_type = 'CANCELLATION' then 'cancelled'
      when re.event_type = 'BILLING_ISSUE' then 'grace_period'
      when re.event_type in ('EXPIRATION', 'REFUND') then 'expired'
      else null
    end as status,
    row_number() over (
      partition by re.user_id
      order by
        case upper(coalesce(re.environment, 'UNKNOWN'))
          when 'PRODUCTION' then 3
          when 'SANDBOX' then 2
          else 1
        end desc,
        re.event_at desc
    ) as priority
  from public.revenuecat_events re
  where re.user_id is not null
    and re.product_id is not null
    and re.event_type in (
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
      'SUBSCRIPTION_EXTENDED',
      'REFUND_REVERSED',
      'CANCELLATION',
      'BILLING_ISSUE',
      'EXPIRATION',
      'REFUND'
    )
), preferred as (
  select *
  from lifecycle_events
  where priority = 1 and status is not null
)
update public.subscriptions s
set
  product_id = p.product_id,
  status = p.status,
  expires_at = p.expiration_at,
  is_lifetime = false,
  environment = case
    when p.environment in ('PRODUCTION', 'SANDBOX') then p.environment
    else 'UNKNOWN'
  end,
  revenuecat_event_at = p.event_at,
  verified_at = null,
  updated_at = now()
from preferred p
where p.user_id = s.user_id;

-- Client CustomerInfo is useful for immediate UI but is not trusted to mutate
-- the server cache. Active and inactive repairs now use the authenticated Edge
-- Function backed by RevenueCat's server API.
revoke all on function public.reconcile_subscription(
  uuid,
  text,
  text,
  boolean,
  timestamptz
) from authenticated;
