-- The analytics enrichment rollout requires an installation id for anonymous
-- events. Older signed-in app releases do not send that id, so preserve their
-- authenticated product events until the updated app release is adopted.
-- Anonymous legacy events remain blocked because they cannot be attributed
-- safely enough for retention or acquisition reporting.

drop policy if exists "analytics_events_insert_authenticated"
  on public.analytics_events;

create policy "analytics_events_insert_authenticated"
  on public.analytics_events
  for insert
  to authenticated
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and (
      installation_id is not null
      or user_id = (select auth.uid())
    )
  );

comment on policy "analytics_events_insert_authenticated" on public.analytics_events is
  'Allows enriched analytics events and authenticated legacy events; anonymous events always require an installation id.';
