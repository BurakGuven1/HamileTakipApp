-- Pumping was added to the first-baby write path in 20260720000002, but the
-- matching read/update policies still omitted it. That made successful pump
-- timer entries invisible to the timeline and doctor report.
drop policy if exists "care_journal_select_free_or_premium_family"
  on public.care_journal_entries;
drop policy if exists "care_journal_update_premium_family"
  on public.care_journal_entries;

create policy "care_journal_select_free_or_premium_family"
  on public.care_journal_entries
  for select
  using (
    deleted_at is null
    and public.can_access_baby(baby_id)
    and (
      public.has_active_family_premium(baby_id)
      or (
        public.is_first_family_baby(baby_id)
        and entry_type in (
          'breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature', 'pumping'
        )
        and occurred_at >= now() - interval '24 hours'
      )
    )
  );

create policy "care_journal_update_premium_family"
  on public.care_journal_entries
  for update
  using (
    deleted_at is null
    and (
      public.has_active_family_premium(baby_id)
      or (
        public.is_first_family_baby(baby_id)
        and created_by = auth.uid()
        and entry_type in (
          'breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature', 'pumping'
        )
        and occurred_at >= now() - interval '24 hours'
      )
    )
  )
  with check (
    deleted_at is null
    and public.can_access_baby(baby_id)
  );
