-- Privacy-minimised audit events for the ephemeral "Belgeyi Anla" workflow.
-- No original document, OCR text, extracted value or model output is persisted.

create table if not exists public.document_analysis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mime_type text not null,
  byte_size int not null check (byte_size between 1 and 8388608),
  status text not null check (status in ('accepted', 'completed', 'rejected', 'failed')),
  error_code text,
  consent_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists document_analysis_events_user_created_idx
  on public.document_analysis_events (user_id, created_at desc);

alter table public.document_analysis_events enable row level security;
revoke all on public.document_analysis_events from anon, authenticated;

do $$
declare v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'prune-document-analysis-events'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'prune-document-analysis-events',
    '17 3 * * *',
    'delete from public.document_analysis_events where created_at < now() - interval ''30 days'';'
  );
end $$;

comment on table public.document_analysis_events is
  'Minimal security/rate-limit metadata for document analysis. Never stores files, OCR text, results, names or filenames.';
