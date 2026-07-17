-- Reliable, family-aware notifications for vaccine reminders and daily support.

alter table public.profiles
  add column if not exists notify_daily_support boolean not null default true;

comment on column public.profiles.notify_daily_support is
  'Daily pregnancy/postpartum article or emotional support notification preference.';

alter table public.push_tokens
  add column if not exists project_id text,
  add column if not exists enabled boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists last_error text;

-- A token belongs to one current account. This prevents a shared device from
-- continuing to receive the previous account's private notifications.
delete from public.push_tokens older
using public.push_tokens newer
where older.expo_push_token = newer.expo_push_token
  and (
    older.updated_at < newer.updated_at
    or (older.updated_at = newer.updated_at and older.id < newer.id)
  );

alter table public.push_tokens
  drop constraint if exists push_tokens_user_id_expo_push_token_key;

create unique index if not exists push_tokens_expo_token_unique
  on public.push_tokens (expo_push_token);

create index if not exists push_tokens_enabled_user_idx
  on public.push_tokens (user_id)
  where enabled = true;

create table if not exists public.pregnancy_vaccinations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vaccine_code text not null,
  vaccine_name text not null,
  recommended_week_start int not null check (recommended_week_start between 1 and 42),
  recommended_week_end int not null check (recommended_week_end between 1 and 42),
  scheduled_date date not null,
  completed boolean not null default false,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, vaccine_code)
);

comment on table public.pregnancy_vaccinations is
  'Pregnancy vaccine tracking. Dates are reminders and must be confirmed with the family physician.';

alter table public.pregnancy_vaccinations enable row level security;

drop policy if exists "pregnancy_vaccinations_family" on public.pregnancy_vaccinations;
create policy "pregnancy_vaccinations_family"
  on public.pregnancy_vaccinations for all
  using (public.can_access_profile(profile_id))
  with check (public.can_access_profile(profile_id));

drop trigger if exists set_pregnancy_vaccinations_updated_at
  on public.pregnancy_vaccinations;
create trigger set_pregnancy_vaccinations_updated_at
  before update on public.pregnancy_vaccinations
  for each row execute function public.set_updated_at();

create index if not exists pregnancy_vaccinations_due_idx
  on public.pregnancy_vaccinations (scheduled_date)
  where completed = false;

create or replace function public.sync_pregnancy_vaccination_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_pregnant and new.due_date is not null then
    insert into public.pregnancy_vaccinations (
      profile_id,
      vaccine_code,
      vaccine_name,
      recommended_week_start,
      recommended_week_end,
      scheduled_date
    ) values (
      new.id,
      'TDAB-PREGNANCY',
      'Tdab (Tetanos-Difteri-Aselüler Boğmaca)',
      18,
      24,
      new.due_date - 154
    )
    on conflict (profile_id, vaccine_code) do update
      set vaccine_name = excluded.vaccine_name,
          recommended_week_start = excluded.recommended_week_start,
          recommended_week_end = excluded.recommended_week_end,
          scheduled_date = excluded.scheduled_date,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_pregnancy_vaccinations_on_profile
  on public.profiles;
create trigger sync_pregnancy_vaccinations_on_profile
  after insert or update on public.profiles
  for each row execute function public.sync_pregnancy_vaccination_schedule();

insert into public.pregnancy_vaccinations (
  profile_id,
  vaccine_code,
  vaccine_name,
  recommended_week_start,
  recommended_week_end,
  scheduled_date
)
select
  id,
  'TDAB-PREGNANCY',
  'Tdab (Tetanos-Difteri-Aselüler Boğmaca)',
  18,
  24,
  due_date - 154
from public.profiles
where is_pregnant = true and due_date is not null
on conflict (profile_id, vaccine_code) do update
  set scheduled_date = excluded.scheduled_date,
      updated_at = now();

create table if not exists public.vaccine_reminder_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, reminder_key, scheduled_date)
);

alter table public.vaccine_reminder_dismissals enable row level security;

grant select, insert, update on public.pregnancy_vaccinations to authenticated;
grant select, insert on public.vaccine_reminder_dismissals to authenticated;

drop policy if exists "vaccine_dismissals_own" on public.vaccine_reminder_dismissals;
create policy "vaccine_dismissals_own"
  on public.vaccine_reminder_dismissals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  kind text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ticketed', 'delivered', 'failed')),
  expo_ticket_id text,
  error text,
  attempts int not null default 1 check (attempts between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (dedupe_key, push_token_id)
);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;

drop trigger if exists set_notification_deliveries_updated_at
  on public.notification_deliveries;
create trigger set_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

create index if not exists notification_deliveries_receipt_idx
  on public.notification_deliveries (status, updated_at)
  where status = 'ticketed';

create or replace function public.get_active_vaccine_reminders(
  p_today date default (timezone('Europe/Istanbul', now()))::date
)
returns table (
  reminder_key text,
  source text,
  vaccination_id uuid,
  subject_name text,
  vaccine_name text,
  scheduled_date date,
  recommended_week_start int,
  recommended_week_end int
)
language sql
security definer
set search_path = public
stable
as $$
  with reminders as (
    select
      'baby:' || bv.id::text as reminder_key,
      'baby'::text as source,
      bv.id as vaccination_id,
      b.name as subject_name,
      vs.vaccine_name,
      bv.scheduled_date,
      null::int as recommended_week_start,
      null::int as recommended_week_end
    from public.baby_vaccinations bv
    join public.babies b on b.id = bv.baby_id
    join public.vaccine_schedule vs on vs.id = bv.vaccine_schedule_id
    where bv.completed = false
      and public.can_access_baby(bv.baby_id)
      and bv.scheduled_date between p_today and p_today + 1

    union all

    select
      'pregnancy:' || pv.id::text,
      'pregnancy'::text,
      pv.id,
      coalesce(nullif(trim(p.mother_name), ''), 'Anne'),
      pv.vaccine_name,
      pv.scheduled_date,
      pv.recommended_week_start,
      pv.recommended_week_end
    from public.pregnancy_vaccinations pv
    join public.profiles p on p.id = pv.profile_id
    where pv.completed = false
      and p.is_pregnant = true
      and public.can_access_profile(pv.profile_id)
      and pv.scheduled_date between p_today and p_today + 1
  )
  select r.*
  from reminders r
  where not exists (
    select 1
    from public.vaccine_reminder_dismissals d
    where d.user_id = auth.uid()
      and d.reminder_key = r.reminder_key
      and d.scheduled_date = r.scheduled_date
  )
  order by r.scheduled_date, r.subject_name, r.vaccine_name;
$$;

grant execute on function public.get_active_vaccine_reminders(date) to authenticated;

create table if not exists public.notification_dispatch_config (
  singleton boolean primary key default true check (singleton = true),
  dispatch_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

insert into public.notification_dispatch_config (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.notification_dispatch_config enable row level security;
revoke all on public.notification_dispatch_config from anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
    where jobname in (
      'daily-vaccine-reminder',
      'daily-vaccine-reminders-reliable',
      'daily-support-notifications-reliable',
      'weekly-pregnancy-update'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  -- Three attempts cover transient network errors; delivery keys prevent duplicates.
  perform cron.schedule(
    'daily-vaccine-reminders-reliable',
    '0,20,40 7 * * *',
    $cron$
      select net.http_post(
        url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-vaccine-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-notification-dispatch-secret', (
            select dispatch_secret
            from public.notification_dispatch_config
            where singleton = true
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  );

  perform cron.schedule(
    'daily-support-notifications-reliable',
    '30,50 7,8 * * *',
    $cron$
      select net.http_post(
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
      );
    $cron$
  );
end;
$$;

comment on table public.notification_dispatch_config is
  'Server-only secret used by pg_cron to authorize scheduled notification functions.';
