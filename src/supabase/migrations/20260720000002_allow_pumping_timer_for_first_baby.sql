create or replace function public.care_entry_write_allowed(
  p_baby_id uuid,
  p_entry_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_baby(p_baby_id)
    and (
      public.has_active_family_premium(p_baby_id)
      or (
        public.is_first_family_baby(p_baby_id)
        and p_entry_type in (
          'breastfeeding', 'bottle', 'sleep', 'diaper', 'temperature', 'pumping'
        )
      )
    );
$$;

revoke all on function public.care_entry_write_allowed(uuid, text) from public;

comment on function public.care_entry_write_allowed(uuid, text) is
  'Allows core first-baby care writes, including pumping timers, while keeping advanced care types premium-gated.';
