alter table public.profiles
  add column if not exists notify_premium_emails boolean not null default false,
  add column if not exists premium_email_consent_at timestamptz;

comment on column public.profiles.notify_premium_emails is
  'Explicit, default-off consent for Anne+ Premium promotional email content.';

create or replace function public.capture_premium_email_consent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.notify_premium_emails and not old.notify_premium_emails then
    new.premium_email_consent_at := now();
  elsif not new.notify_premium_emails then
    new.premium_email_consent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_premium_email_consent_on_profile on public.profiles;
create trigger capture_premium_email_consent_on_profile
before update of notify_premium_emails on public.profiles
for each row execute function public.capture_premium_email_consent();

create table if not exists public.welcome_email_deliveries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  queued_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.welcome_email_deliveries enable row level security;
revoke all on public.welcome_email_deliveries from public, anon, authenticated;

create or replace function public.queue_welcome_email_after_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.onboarding_completed
     and not old.onboarding_completed
     and exists (
       select 1
       from auth.users u
       where u.id = new.id
         and u.email is not null
         and u.email not like '%@family-login.anneplus.local'
     ) then
    insert into public.welcome_email_deliveries (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_welcome_email_on_onboarding on public.profiles;
create trigger queue_welcome_email_on_onboarding
after update of onboarding_completed on public.profiles
for each row execute function public.queue_welcome_email_after_onboarding();

create or replace function public.claim_welcome_email_deliveries(p_limit integer default 25)
returns table(
  user_id uuid,
  display_name text,
  is_pregnant boolean,
  include_premium_offer boolean,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select d.user_id
    from public.welcome_email_deliveries d
    where d.attempt_count < 5
      and d.next_attempt_at <= now()
      and (
        d.status in ('queued', 'failed')
        or (d.status = 'processing' and d.processing_at < now() - interval '15 minutes')
      )
    order by d.queued_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.welcome_email_deliveries d
    set status = 'processing',
        processing_at = now(),
        attempt_count = d.attempt_count + 1,
        updated_at = now(),
        last_error = null
    from candidates c
    where d.user_id = c.user_id
    returning d.user_id, d.attempt_count
  )
  select
    claimed.user_id,
    coalesce(nullif(trim(p.mother_name), ''), nullif(trim(p.display_name), ''), 'Anne') as display_name,
    p.is_pregnant,
    (p.notify_premium_emails and p.premium_email_consent_at is not null) as include_premium_offer,
    claimed.attempt_count
  from claimed
  join public.profiles p on p.id = claimed.user_id;
end;
$$;

revoke all on function public.claim_welcome_email_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_welcome_email_deliveries(integer)
  to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'welcome-email-delivery'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'welcome-email-delivery',
    '*/5 * * * *',
    $cron$select net.http_post(
      url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-welcome-email',
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
