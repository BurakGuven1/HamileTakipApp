-- Document analysis moved fully on-device. Remove the now-unused cloud audit table.
do $$
declare v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'prune-document-analysis-events'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

drop table if exists public.document_analysis_events;
