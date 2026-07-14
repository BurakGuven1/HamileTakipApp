-- ============================================================
-- 0025: RevenueCat reconciliation RPCs
-- ============================================================
-- RevenueCat remains the source of truth. These RPCs only keep the
-- Supabase subscriptions cache in sync when webhooks are delayed/missed.

create or replace function public.reconcile_subscription(
  p_user_id uuid,
  p_product_id text,
  p_status text,
  p_is_lifetime boolean default false,
  p_expires_at timestamptz default null
)
returns public.subscriptions
language plpgsql
security definer set search_path = public
as $$
declare
  v_subscription public.subscriptions;
begin
  if auth.uid() is null or p_user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  if p_status not in ('active', 'expired', 'cancelled', 'grace_period') then
    raise exception 'invalid_subscription_status';
  end if;

  if p_status = 'active' then
    raise exception 'active_subscription_reconciliation_requires_revenuecat_webhook';
  end if;

  insert into public.subscriptions (
    user_id,
    product_id,
    status,
    is_lifetime,
    expires_at,
    updated_at
  )
  values (
    p_user_id,
    p_product_id,
    p_status,
    coalesce(p_is_lifetime, false),
    case when coalesce(p_is_lifetime, false) then null else p_expires_at end,
    now()
  )
  on conflict (user_id) do update
    set product_id = excluded.product_id,
        status = excluded.status,
        is_lifetime = excluded.is_lifetime,
        expires_at = excluded.expires_at,
        updated_at = now()
  returning * into v_subscription;

  return v_subscription;
end;
$$;

comment on function public.reconcile_subscription(uuid, text, text, boolean, timestamptz) is
  'Allows an authenticated user to reconcile only inactive own RevenueCat-derived subscription cache states. Active premium cache rows must come from the RevenueCat webhook.';

grant execute on function public.reconcile_subscription(uuid, text, text, boolean, timestamptz)
  to authenticated;

create or replace function public.is_day5_offer_eligible()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.created_at <= now() - interval '5 days'
      and exists (
        select 1
        from public.babies b
        join public.baby_vaccinations bv on bv.baby_id = b.id
        where b.parent_id = p.id
          and bv.completed = true
      )
      and exists (
        select 1
        from public.analytics_events ae
        where ae.user_id = p.id
          and ae.event_name = 'forum_viewed'
      )
      and not exists (
        select 1
        from public.subscriptions s
        where s.user_id = p.id
          and s.status = 'active'
          and (s.expires_at is null or s.expires_at > now())
      )
  );
$$;

comment on function public.is_day5_offer_eligible() is
  'Returns true when the current user has reached the day-5 premium offer criteria.';

grant execute on function public.is_day5_offer_eligible() to authenticated;
