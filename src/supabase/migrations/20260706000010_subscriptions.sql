-- ============================================================
-- 0010: Abonelik Durumu (RevenueCat ile senkronize edilir)
-- ============================================================
-- Bu tablo tek gerçek kaynak (source of truth) değildir; RevenueCat'in kendisi
-- gerçek kaynaktır. Bu tablo, uygulamanın hızlı sorgu yapabilmesi ve Supabase
-- RLS/analytics ile entegre çalışabilmesi için RevenueCat webhook'undan
-- Edge Function aracılığıyla senkronize edilen bir "cache" görevi görür.

create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  product_id    text,                 -- 'premium_monthly' | 'premium_lifetime'
  status        text not null default 'expired'
                  check (status in ('active', 'expired', 'cancelled', 'grace_period')),
  expires_at    timestamptz,          -- lifetime ise null olabilir
  is_lifetime   boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Insert/update sadece service_role (RevenueCat webhook Edge Function) tarafından
-- yapılır; kullanıcıya bu yönde policy verilmemiştir (kendi abonelik durumunu
-- client'tan manipüle edememesi için kasıtlı olarak boş bırakıldı).

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index if not exists idx_subscriptions_status on public.subscriptions(status);
