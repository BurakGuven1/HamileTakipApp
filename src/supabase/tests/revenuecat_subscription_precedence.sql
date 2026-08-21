begin;

do $$
begin
  if public.should_apply_revenuecat_subscription_cache(
    'PRODUCTION',
    '2026-08-01T00:00:00Z'::timestamptz,
    'SANDBOX',
    '2026-08-21T00:00:00Z'::timestamptz,
    null
  ) then
    raise exception 'newer sandbox state must not replace production';
  end if;

  if not public.should_apply_revenuecat_subscription_cache(
    'SANDBOX',
    '2026-08-21T00:00:00Z'::timestamptz,
    'PRODUCTION',
    '2026-08-01T00:00:00Z'::timestamptz,
    null
  ) then
    raise exception 'production state must replace sandbox';
  end if;

  if public.should_apply_revenuecat_subscription_cache(
    'PRODUCTION',
    '2026-08-21T00:00:00Z'::timestamptz,
    'PRODUCTION',
    '2026-08-01T00:00:00Z'::timestamptz,
    null
  ) then
    raise exception 'older production event must be ignored';
  end if;

  if not public.should_apply_revenuecat_subscription_cache(
    'PRODUCTION',
    '2026-08-21T00:00:00Z'::timestamptz,
    'PRODUCTION',
    null,
    '2026-08-22T00:00:00Z'::timestamptz
  ) then
    raise exception 'verified production state must repair production cache';
  end if;

  if public.should_apply_revenuecat_subscription_cache(
    'PRODUCTION',
    '2026-08-21T00:00:00Z'::timestamptz,
    'UNKNOWN',
    '2026-08-22T00:00:00Z'::timestamptz,
    null
  ) then
    raise exception 'unknown state must not replace production';
  end if;
end;
$$;

rollback;
