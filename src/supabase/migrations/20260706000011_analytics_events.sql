-- ============================================================
-- 0011: Funnel / Analytics Event Takibi
-- ============================================================

create table if not exists public.analytics_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  event_name         text not null,             -- örn: 'paywall_viewed', 'ad_completed'
  event_properties   jsonb not null default '{}'::jsonb,
  session_id         text,
  created_at         timestamptz not null default now()
);

comment on table public.analytics_events is
  'Tüm kullanıcı aksiyonlarının loglandığı funnel/analytics event tablosu. Sadece insert edilir, kullanıcı select edemez (raporlama service_role ile yapılır).';

alter table public.analytics_events enable row level security;

create policy "analytics_events_insert_own"
  on public.analytics_events for insert
  with check (auth.uid() = user_id or user_id is null);

-- Bilerek select policy tanımlanmadı: event verisi sadece service_role
-- (admin dashboard / raporlama) tarafından okunur, kullanıcı kendi ham
-- event log'unu görüntüleyemez.

create index if not exists idx_analytics_events_name_date on public.analytics_events(event_name, created_at desc);
create index if not exists idx_analytics_events_user on public.analytics_events(user_id, created_at desc);
create index if not exists idx_analytics_events_properties on public.analytics_events using gin (event_properties);
