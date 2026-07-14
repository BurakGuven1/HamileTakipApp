-- Premium anne + bebek bakım günlüğü.
-- Erişim hem doğrudan profil sahibi hem de aile koduyla bağlı ebeveyn için,
-- ana aile profilinin aktif Premium aboneliğine göre belirlenir.

create table if not exists public.care_journal_entries (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  caregiver_name text check (caregiver_name is null or char_length(caregiver_name) <= 80),
  entry_type text not null check (
    entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'pumping', 'medicine', 'solid_food')
  ),
  occurred_at timestamptz not null default now(),
  ended_at timestamptz,
  amount_ml numeric(7,2) check (amount_ml is null or amount_ml > 0),
  feeding_content text check (feeding_content is null or feeding_content in ('breast_milk', 'formula', 'water')),
  breast_side text check (breast_side is null or breast_side in ('left', 'right', 'both')),
  diaper_type text check (diaper_type is null or diaper_type in ('wet', 'dirty', 'both')),
  medicine_name text,
  medicine_dose text,
  food_name text,
  food_amount text,
  is_first_try boolean not null default false,
  sleep_kind text check (sleep_kind is null or sleep_kind in ('day', 'night')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= occurred_at)
);

-- SQL Editor'da yarÄ±m kalan/eski bir sÃ¼rÃ¼mÃ¼n Ã¼zerine yeniden Ã§alÄ±ÅŸabilmesi iÃ§in
-- create table if not exists'in ekleyemeyeceÄŸi kolonlarÄ± ayrÄ±ca tamamla.
alter table public.care_journal_entries
  add column if not exists caregiver_name text,
  add column if not exists feeding_content text,
  add column if not exists food_name text,
  add column if not exists food_amount text,
  add column if not exists is_first_try boolean not null default false,
  add column if not exists sleep_kind text;

-- Daha eski altÄ± kayÄ±t tÃ¼rlÃ¼ sÃ¼rÃ¼mden gelindiyse eski entry_type check'i
-- solid_food deÄŸerini reddeder. Kolona baÄŸlÄ± eski check'leri bulup tek gÃ¼ncel
-- constraint ile deÄŸiÅŸtir.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.care_journal_entries'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%entry_type%'
  loop
    execute format(
      'alter table public.care_journal_entries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.care_journal_entries
  add constraint care_journal_entries_entry_type_check
  check (entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'pumping', 'medicine', 'solid_food'));

create index if not exists idx_care_journal_baby_occurred
  on public.care_journal_entries (baby_id, occurred_at desc);

create index if not exists idx_care_journal_created_by
  on public.care_journal_entries (created_by);
create index if not exists idx_care_journal_baby_type_occurred
  on public.care_journal_entries (baby_id, entry_type, occurred_at desc);

create or replace function public.has_active_family_premium(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.babies b
    join public.subscriptions s on s.user_id = b.parent_id
    where b.id = p_baby_id
      and public.can_access_baby(b.id)
      and s.status in ('active', 'grace_period')
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.has_active_family_premium(uuid) from public;
grant execute on function public.has_active_family_premium(uuid) to authenticated;

create or replace function public.has_active_profile_premium(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_profile(p_profile_id) and exists (
    select 1 from public.subscriptions s
    where s.user_id = p_profile_id and s.status in ('active', 'grace_period')
      and (s.is_lifetime or s.expires_at is null or s.expires_at > now())
  );
$$;
revoke all on function public.has_active_profile_premium(uuid) from public;
grant execute on function public.has_active_profile_premium(uuid) to authenticated;

create or replace function public.is_first_family_baby(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.babies b
    where b.id = p_baby_id and public.can_access_baby(b.id)
      and not exists (
        select 1 from public.babies older
        where older.parent_id = b.parent_id
          and (older.created_at, older.id) < (b.created_at, b.id)
      )
  );
$$;
revoke all on function public.is_first_family_baby(uuid) from public;
grant execute on function public.is_first_family_baby(uuid) to authenticated;

alter table public.care_journal_entries enable row level security;

-- PostgreSQL create policy/trigger iÃ§in IF NOT EXISTS desteklemez. Migration daha
-- Ã¶nce kÄ±smen Ã§alÄ±ÅŸtÄ±ysa hem gÃ¼ncel hem eski policy adlarÄ±nÄ± temizle.
drop policy if exists "care_journal_select_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_insert_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_update_own_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_delete_own_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_select_free_or_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_insert_free_or_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_update_premium_family" on public.care_journal_entries;
drop policy if exists "care_journal_delete_premium_family" on public.care_journal_entries;

create policy "care_journal_select_free_or_premium_family"
  on public.care_journal_entries for select
  using (
    public.can_access_baby(baby_id)
    and (
      public.has_active_family_premium(baby_id)
      or (public.is_first_family_baby(baby_id) and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper') and occurred_at >= now() - interval '24 hours')
    )
  );

create policy "care_journal_insert_free_or_premium_family"
  on public.care_journal_entries for insert
  with check (
    created_by = auth.uid()
    and public.can_access_baby(baby_id)
    and ((public.is_first_family_baby(baby_id) and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper')) or public.has_active_family_premium(baby_id))
  );

create policy "care_journal_update_premium_family"
  on public.care_journal_entries for update
  using (public.has_active_family_premium(baby_id) or (public.is_first_family_baby(baby_id) and created_by = auth.uid() and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper') and occurred_at >= now() - interval '24 hours'))
  with check (public.has_active_family_premium(baby_id) or (public.is_first_family_baby(baby_id) and created_by = auth.uid() and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper') and occurred_at >= now() - interval '24 hours'));

create policy "care_journal_delete_premium_family"
  on public.care_journal_entries for delete
  using (public.has_active_family_premium(baby_id) or (public.is_first_family_baby(baby_id) and created_by = auth.uid() and entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper') and occurred_at >= now() - interval '24 hours'));

drop trigger if exists set_care_journal_entries_updated_at on public.care_journal_entries;
create trigger set_care_journal_entries_updated_at
  before update on public.care_journal_entries
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.care_journal_entries to authenticated;

comment on table public.care_journal_entries is
  'Shared baby care log. Basic feeding/sleep/diaper logging has a 24-hour free history; advanced types and history require Premium.';

create table if not exists public.milk_inventory (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  amount_ml numeric(7,2) not null check (amount_ml > 0),
  movement_type text not null check (movement_type in ('stored', 'used')),
  occurred_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to_name text,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.milk_inventory enable row level security;
alter table public.care_tasks enable row level security;

drop policy if exists "milk_inventory_premium_family" on public.milk_inventory;
drop policy if exists "care_tasks_premium_family" on public.care_tasks;

create policy "milk_inventory_premium_family" on public.milk_inventory for all
  using (public.has_active_family_premium(baby_id))
  with check (created_by = auth.uid() and public.has_active_family_premium(baby_id));
create policy "care_tasks_premium_family" on public.care_tasks for all
  using (public.has_active_family_premium(baby_id))
  with check (public.has_active_family_premium(baby_id));

grant select, insert, update, delete on public.milk_inventory, public.care_tasks to authenticated;

create table if not exists public.mother_wellbeing_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  rest smallint not null check (rest between 1 and 5),
  self_care_note text check (self_care_note is null or char_length(self_care_note) <= 300),
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (profile_id, checkin_date)
);
alter table public.mother_wellbeing_checkins enable row level security;
drop policy if exists "mother_checkins_premium_family" on public.mother_wellbeing_checkins;
create policy "mother_checkins_premium_family" on public.mother_wellbeing_checkins for all
  using (public.has_active_profile_premium(profile_id))
  with check (public.has_active_profile_premium(profile_id));
grant select, insert, update, delete on public.mother_wellbeing_checkins to authenticated;

-- BakÄ±m alarmlarÄ±: alarmÄ± kuran cihaz yerel bildirim alÄ±r; diÄŸer aile
-- cihazlarÄ±na send-care-reminders Edge Function push gÃ¶nderir.
create table if not exists public.care_reminders (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entry_type text not null check (
    entry_type in ('breastfeeding', 'bottle', 'sleep', 'diaper', 'pumping', 'medicine', 'solid_food')
  ),
  scheduled_for timestamptz not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 300),
  local_notification_id text,
  creator_push_token text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'cancelled')),
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_for > created_at - interval '1 minute')
);
alter table public.care_reminders
  add column if not exists creator_push_token text;

create index if not exists idx_care_reminders_due
  on public.care_reminders (scheduled_for)
  where status = 'scheduled';
create index if not exists idx_care_reminders_baby_status
  on public.care_reminders (baby_id, status, scheduled_for);

create or replace function public.can_create_care_reminder(p_baby_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_baby(p_baby_id) and (
    public.has_active_family_premium(p_baby_id)
    or not exists (
      select 1 from public.care_reminders r
      where r.created_by = auth.uid()
        and r.status = 'scheduled'
        and r.scheduled_for > now()
    )
  );
$$;
revoke all on function public.can_create_care_reminder(uuid) from public;
grant execute on function public.can_create_care_reminder(uuid) to authenticated;

alter table public.care_reminders enable row level security;
drop policy if exists "care_reminders_select_family" on public.care_reminders;
drop policy if exists "care_reminders_insert_allowed" on public.care_reminders;
drop policy if exists "care_reminders_update_family" on public.care_reminders;
drop policy if exists "care_reminders_delete_family" on public.care_reminders;

create policy "care_reminders_select_family" on public.care_reminders for select
  using (public.can_access_baby(baby_id) and (created_by = auth.uid() or public.has_active_family_premium(baby_id)));
create policy "care_reminders_insert_allowed" on public.care_reminders for insert
  with check (created_by = auth.uid() and public.can_create_care_reminder(baby_id));
create policy "care_reminders_update_family" on public.care_reminders for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "care_reminders_delete_family" on public.care_reminders for delete
  using (created_by = auth.uid());

drop trigger if exists set_care_reminders_updated_at on public.care_reminders;
create trigger set_care_reminders_updated_at before update on public.care_reminders
  for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.care_reminders to authenticated;

-- Dashboard > Database > Cron Jobs Ã¼zerinden her dakika Ã§alÄ±ÅŸtÄ±rÄ±labilir.
-- Service role anahtarÄ±nÄ± SQL'e yazmak yerine Supabase Vault kullan.
-- select cron.schedule(
--   'send-care-reminders-every-minute',
--   '* * * * *',
--   $$ select net.http_post(
--     url := 'https://shqnrshyaqlcpsjkdndl.supabase.co/functions/v1/send-care-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   ); $$
-- );
