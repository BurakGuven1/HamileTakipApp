-- ============================================================
-- 0016: Push Notification Token'ları
-- ============================================================
-- Client (React Native), expo-notifications ile token aldıktan sonra
-- bu tabloya kaydeder. Edge Function'lar (send-vaccine-reminders,
-- send-weekly-pregnancy-update) bildirim göndermek için bu tabloyu okur.

create table if not exists public.push_tokens (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  expo_push_token    text not null,
  device_type        text check (device_type in ('ios', 'android')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

comment on table public.push_tokens is
  'Kullanıcının cihaz(lar)ına ait Expo push notification token''ları. Bir kullanıcının birden fazla cihazı olabilir.';

alter table public.push_tokens enable row level security;

create policy "push_tokens_all_own"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);
