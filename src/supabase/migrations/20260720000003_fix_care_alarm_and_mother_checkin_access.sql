-- Keep low-risk, first-baby alarms usable when the RevenueCat webhook-backed
-- subscription cache is delayed. Advanced/multi-baby care remains gated by
-- the existing effective Premium access check.
create or replace function public.can_create_care_reminder(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_baby(p_baby_id)
    and (
      public.has_active_family_premium(p_baby_id)
      or public.is_first_family_baby(p_baby_id)
    );
$$;

revoke all on function public.can_create_care_reminder(uuid) from public;
grant execute on function public.can_create_care_reminder(uuid) to authenticated;

comment on function public.can_create_care_reminder(uuid) is
  'Allows authorized first-baby alarms without relying on delayed Premium cache state.';

-- A wellbeing check-in belongs to the signed-in mother herself. The app keeps
-- this UI Premium-gated, while RLS verifies ownership instead of a webhook cache.
drop policy if exists "mother_checkins_premium_family"
  on public.mother_wellbeing_checkins;
drop policy if exists "mother_checkins_owner"
  on public.mother_wellbeing_checkins;

create policy "mother_checkins_owner"
  on public.mother_wellbeing_checkins
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

comment on table public.mother_wellbeing_checkins is
  'Private daily wellbeing check-ins writable only by the owning mother profile.';
