-- ============================================================
-- 0017: Onboarding, public forum badges, likes and notification prefs
-- ============================================================

-- ------------------------------------------------------------
-- 1) Profile onboarding + notification preferences
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step text not null default 'welcome',
  add column if not exists notify_forum_comments boolean not null default true,
  add column if not exists notify_forum_likes boolean not null default true,
  add column if not exists notify_vaccine_reminders boolean not null default true,
  add column if not exists notify_weekly_pregnancy_updates boolean not null default true;

comment on column public.profiles.onboarding_completed is
  'When true, onboarding has been completed or skipped once and should not be shown again.';
comment on column public.profiles.onboarding_step is
  'Stores the last onboarding step so the app can resume after interruption.';
comment on column public.profiles.notify_forum_comments is
  'Controls push notifications for new comments on the user''s forum posts.';
comment on column public.profiles.notify_forum_likes is
  'Controls push notifications for likes on the user''s forum posts and comments.';
comment on column public.profiles.notify_vaccine_reminders is
  'Controls push notifications for vaccine reminders.';
comment on column public.profiles.notify_weekly_pregnancy_updates is
  'Controls push notifications for weekly pregnancy updates.';

-- ------------------------------------------------------------
-- 2) Case-insensitive forum nickname availability
-- ------------------------------------------------------------
create unique index if not exists idx_profiles_forum_nickname_lower
  on public.profiles (lower(forum_nickname))
  where forum_nickname is not null;

create or replace function public.is_nickname_available(nickname text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    length(trim(coalesce(nickname, ''))) >= 3
    and not exists (
      select 1
      from public.profiles
      where lower(forum_nickname) = lower(trim(nickname))
        and id <> auth.uid()
    );
$$;

-- ------------------------------------------------------------
-- 3) Public badge calculation
-- ------------------------------------------------------------
create or replace function public.get_public_badge(p_profile_id uuid)
returns text
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_is_pregnant boolean;
  v_due_date date;
  v_latest_birth_date date;
  v_pregnancy_week int;
  v_age_months int;
  v_years int;
  v_remaining_months int;
begin
  select is_pregnant, due_date
    into v_is_pregnant, v_due_date
    from public.profiles
    where id = p_profile_id;

  if v_is_pregnant and v_due_date is not null then
    v_pregnancy_week := greatest(1, least(42,
      floor((280 - (v_due_date - current_date)) / 7.0)::int
    ));
    return v_pregnancy_week || '. hafta hamile';
  end if;

  select max(birth_date) into v_latest_birth_date
    from public.babies
    where parent_id = p_profile_id;

  if v_latest_birth_date is not null then
    v_age_months :=
      (date_part('year', age(current_date, v_latest_birth_date)) * 12
       + date_part('month', age(current_date, v_latest_birth_date)))::int;

    if v_age_months < 1 then
      return 'Yeni doğum yaptı';
    elsif v_age_months < 12 then
      return v_age_months || ' aylık bebek annesi';
    else
      v_years := v_age_months / 12;
      v_remaining_months := v_age_months % 12;
      if v_remaining_months = 0 then
        return v_years || ' yaşında çocuk annesi';
      else
        return v_years || ' yaş ' || v_remaining_months || ' aylık çocuk annesi';
      end if;
    end if;
  end if;

  return 'Topluluk üyesi';
end;
$$;

comment on function public.get_public_badge(uuid) is
  'Returns only an anonymous public forum badge. Raw due dates and birth dates are never exposed by this function.';

-- ------------------------------------------------------------
-- 4) Forum likes
-- ------------------------------------------------------------
create table if not exists public.forum_post_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.forum_comment_likes (
  comment_id uuid not null references public.forum_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.forum_post_likes enable row level security;
alter table public.forum_comment_likes enable row level security;

drop policy if exists "forum_post_likes_select_own" on public.forum_post_likes;
create policy "forum_post_likes_select_own"
  on public.forum_post_likes for select
  using (auth.uid() = user_id);

drop policy if exists "forum_post_likes_insert_own" on public.forum_post_likes;
create policy "forum_post_likes_insert_own"
  on public.forum_post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "forum_post_likes_delete_own" on public.forum_post_likes;
create policy "forum_post_likes_delete_own"
  on public.forum_post_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "forum_comment_likes_select_own" on public.forum_comment_likes;
create policy "forum_comment_likes_select_own"
  on public.forum_comment_likes for select
  using (auth.uid() = user_id);

drop policy if exists "forum_comment_likes_insert_own" on public.forum_comment_likes;
create policy "forum_comment_likes_insert_own"
  on public.forum_comment_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "forum_comment_likes_delete_own" on public.forum_comment_likes;
create policy "forum_comment_likes_delete_own"
  on public.forum_comment_likes for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.forum_post_likes to authenticated;
grant select, insert, delete on public.forum_comment_likes to authenticated;

create index if not exists idx_forum_post_likes_post on public.forum_post_likes(post_id);
create index if not exists idx_forum_comment_likes_comment on public.forum_comment_likes(comment_id);

-- ------------------------------------------------------------
-- 5) Recreate public forum views
-- ------------------------------------------------------------
-- Postgres cannot change an existing view column order with create or replace
-- when a new column is inserted in the middle, so we drop and recreate these
-- read-only public views.
drop view if exists public.forum_comments_public;
drop view if exists public.forum_posts_public;

create view public.forum_posts_public
with (security_invoker = false) as
select
  fp.id,
  fp.category_id,
  fp.forum_nickname,
  public.get_public_badge(fp.author_id) as author_badge,
  fp.title,
  fp.content,
  fp.created_at,
  fp.updated_at,
  (
    select count(*)::int
    from public.forum_comments c
    where c.post_id = fp.id and c.is_hidden = false
  ) as comment_count,
  (
    select count(*)::int
    from public.forum_post_likes l
    where l.post_id = fp.id
  ) as like_count,
  exists (
    select 1
    from public.forum_post_likes l
    where l.post_id = fp.id and l.user_id = auth.uid()
  ) as liked_by_current_user
from public.forum_posts fp
where fp.is_hidden = false;

create view public.forum_comments_public
with (security_invoker = false) as
select
  fc.id,
  fc.post_id,
  fc.forum_nickname,
  public.get_public_badge(fc.author_id) as author_badge,
  fc.content,
  fc.created_at,
  (
    select count(*)::int
    from public.forum_comment_likes l
    where l.comment_id = fc.id
  ) as like_count,
  exists (
    select 1
    from public.forum_comment_likes l
    where l.comment_id = fc.id and l.user_id = auth.uid()
  ) as liked_by_current_user
from public.forum_comments fc
where fc.is_hidden = false;

grant select on public.forum_posts_public to authenticated, anon;
grant select on public.forum_comments_public to authenticated, anon;

comment on view public.forum_posts_public is
  'Public forum read model. It never exposes author_id; use forum_nickname, author_badge and aggregate counts only.';
comment on view public.forum_comments_public is
  'Public forum comment read model. It never exposes author_id; use forum_nickname, author_badge and aggregate counts only.';
