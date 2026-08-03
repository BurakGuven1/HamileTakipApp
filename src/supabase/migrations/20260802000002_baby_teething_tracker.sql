-- Doğum sonrası süt dişi takibi: aynı bebeğe erişen aile üyeleri ortak kaydı görür.
create table if not exists public.baby_teeth (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  tooth_code text not null check (tooth_code in (
    'UR-CI', 'UR-LI', 'UR-C', 'UR-M1', 'UR-M2',
    'UL-CI', 'UL-LI', 'UL-C', 'UL-M1', 'UL-M2',
    'LR-CI', 'LR-LI', 'LR-C', 'LR-M1', 'LR-M2',
    'LL-CI', 'LL-LI', 'LL-C', 'LL-M1', 'LL-M2'
  )),
  erupted_at date not null default current_date,
  recorded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (baby_id, tooth_code)
);

comment on table public.baby_teeth is
  'Bebeğin 20 süt dişinin çıkma kayıtları. Tarihler yaklaşık gelişim özeti için tutulur.';

alter table public.baby_teeth enable row level security;

drop policy if exists "baby_teeth_select_family" on public.baby_teeth;
create policy "baby_teeth_select_family"
  on public.baby_teeth for select
  using (public.can_access_baby(baby_id));

drop policy if exists "baby_teeth_insert_family" on public.baby_teeth;
create policy "baby_teeth_insert_family"
  on public.baby_teeth for insert
  with check (public.can_access_baby(baby_id) and recorded_by = auth.uid());

drop policy if exists "baby_teeth_update_family" on public.baby_teeth;
create policy "baby_teeth_update_family"
  on public.baby_teeth for update
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

drop policy if exists "baby_teeth_delete_family" on public.baby_teeth;
create policy "baby_teeth_delete_family"
  on public.baby_teeth for delete
  using (public.can_access_baby(baby_id));

create index if not exists idx_baby_teeth_baby_erupted_at
  on public.baby_teeth(baby_id, erupted_at);

drop trigger if exists set_baby_teeth_updated_at on public.baby_teeth;
create trigger set_baby_teeth_updated_at
  before update on public.baby_teeth
  for each row execute function public.set_updated_at();
