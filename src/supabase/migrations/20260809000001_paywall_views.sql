create table public.paywall_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (btrim(source) <> ''),
  app_version text,
  viewed_at timestamptz not null default now()
);

create index paywall_views_user_id_idx
  on public.paywall_views(user_id);

create index paywall_views_viewed_at_idx
  on public.paywall_views(viewed_at desc);

alter table public.paywall_views enable row level security;

create policy "paywall_views_insert_own"
  on public.paywall_views
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "paywall_views_select_own"
  on public.paywall_views
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.paywall_views from anon;
revoke all on public.paywall_views from authenticated;
grant select, insert on public.paywall_views to authenticated;

comment on table public.paywall_views is
  'Immutable log of authenticated users seeing the subscription paywall.';
