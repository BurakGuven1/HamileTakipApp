-- Secure, self-contained dispatcher schedule. The secret is generated inside
-- Postgres and never appears in source control or client-readable tables.

create table if not exists public.care_dispatch_config (
  singleton boolean primary key default true check (singleton = true),
  dispatch_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

insert into public.care_dispatch_config (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.care_dispatch_config enable row level security;
revoke all on public.care_dispatch_config from anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'dispatch-care-notifications-every-minute'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'dispatch-care-notifications-every-minute',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-care-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-care-dispatch-secret', (
            select dispatch_secret
            from public.care_dispatch_config
            where singleton = true
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
end;
$$;

comment on table public.care_dispatch_config is
  'Server-only secret used by pg_cron to authorize the care notification dispatcher.';
