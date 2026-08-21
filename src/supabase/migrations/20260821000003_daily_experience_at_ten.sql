-- Supabase cron runs in UTC. 07:00 UTC is 10:00 Europe/Istanbul year-round.
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
    '0 7 * * *',
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
