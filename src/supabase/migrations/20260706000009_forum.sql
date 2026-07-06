-- ============================================================
-- 0009: Sosyal Forum (Anonim Kimlik + Moderasyon Altyapısı)
-- ============================================================

-- ------------------------------------------------------------
-- Kategoriler
-- ------------------------------------------------------------
create table if not exists public.forum_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  icon         text,
  sort_order   int not null default 0
);

alter table public.forum_categories enable row level security;

create policy "forum_categories_select_all"
  on public.forum_categories for select
  using (true);

-- ------------------------------------------------------------
-- Gönderiler
-- ------------------------------------------------------------
create table if not exists public.forum_posts (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.forum_categories(id),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  forum_nickname  text not null,
  title           text not null,
  content         text not null,
  is_flagged      boolean not null default false,
  flagged_reason  text,
  is_hidden       boolean not null default false,   -- moderasyon tarafından gizlendiyse true
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.forum_posts is
  'author_id RLS ile korunur ve client''a asla doğrudan expose edilmemelidir. Uygulama tarafında forum_posts_public view''i kullanılmalıdır.';

alter table public.forum_posts enable row level security;

create policy "forum_posts_select_visible"
  on public.forum_posts for select
  using (is_hidden = false or author_id = auth.uid());

create policy "forum_posts_insert_own"
  on public.forum_posts for insert
  with check (auth.uid() = author_id);

create policy "forum_posts_update_own"
  on public.forum_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "forum_posts_delete_own"
  on public.forum_posts for delete
  using (auth.uid() = author_id);

create trigger set_forum_posts_updated_at
  before update on public.forum_posts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Yorumlar
-- ------------------------------------------------------------
create table if not exists public.forum_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.forum_posts(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  forum_nickname  text not null,
  content         text not null,
  is_flagged      boolean not null default false,
  flagged_reason  text,
  is_hidden       boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.forum_comments enable row level security;

create policy "forum_comments_select_visible"
  on public.forum_comments for select
  using (is_hidden = false or author_id = auth.uid());

create policy "forum_comments_insert_own"
  on public.forum_comments for insert
  with check (auth.uid() = author_id);

create policy "forum_comments_delete_own"
  on public.forum_comments for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- Raporlama (kullanıcı şikayetleri)
-- ------------------------------------------------------------
create table if not exists public.forum_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  target_type   text not null check (target_type in ('post', 'comment')),
  target_id     uuid not null,
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at    timestamptz not null default now()
);

alter table public.forum_reports enable row level security;

create policy "forum_reports_insert_own"
  on public.forum_reports for insert
  with check (auth.uid() = reporter_id);

create policy "forum_reports_select_own"
  on public.forum_reports for select
  using (auth.uid() = reporter_id);

-- Not: forum_reports üzerindeki inceleme (status güncelleme) sadece service_role
-- (admin panel / Edge Function) tarafından yapılır, bu yüzden update policy tanımlanmadı.

-- ------------------------------------------------------------
-- author_id'yi asla dışarı sızdırmayan public view'lar
-- Uygulama forumu listelerken/gösterirken DAİMA bu view'ları kullanmalı.
-- ------------------------------------------------------------
create or replace view public.forum_posts_public
with (security_invoker = false) as
select
  fp.id,
  fp.category_id,
  fp.forum_nickname,
  fp.title,
  fp.content,
  fp.created_at,
  fp.updated_at,
  (
    select count(*) from public.forum_comments c
    where c.post_id = fp.id and c.is_hidden = false
  ) as comment_count
from public.forum_posts fp
where fp.is_hidden = false;

create or replace view public.forum_comments_public
with (security_invoker = false) as
select
  fc.id,
  fc.post_id,
  fc.forum_nickname,
  fc.content,
  fc.created_at
from public.forum_comments fc
where fc.is_hidden = false;

grant select on public.forum_posts_public to authenticated, anon;
grant select on public.forum_comments_public to authenticated, anon;

create index if not exists idx_forum_posts_category_created on public.forum_posts(category_id, created_at desc) where is_hidden = false;
create index if not exists idx_forum_comments_post_created on public.forum_comments(post_id, created_at) where is_hidden = false;
create index if not exists idx_forum_reports_status on public.forum_reports(status);
