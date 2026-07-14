-- ============================================================
-- 0022: Article admin access and pregnancy timeline placement
-- ============================================================

alter table public.articles
  add column if not exists timeline_start_week int,
  add column if not exists timeline_end_week int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'articles_timeline_week_range_check'
  ) then
    alter table public.articles
      add constraint articles_timeline_week_range_check
      check (
        (timeline_start_week is null and timeline_end_week is null)
        or (
          timeline_start_week between 1 and 42
          and timeline_end_week between 1 and 42
          and timeline_start_week <= timeline_end_week
        )
      );
  end if;
end $$;

comment on column public.articles.timeline_start_week is
  'First pregnancy week where this article should appear in the pregnancy timeline.';
comment on column public.articles.timeline_end_week is
  'Last pregnancy week where this article should appear in the pregnancy timeline.';

update public.articles
set timeline_start_week = 10, timeline_end_week = 10
where slug = 'hamileligin-10-haftasi';

update public.articles
set timeline_start_week = 11, timeline_end_week = 11
where slug = 'hamileligin-11-haftasi';

update public.articles
set timeline_start_week = 9, timeline_end_week = 13
where slug = 'hamilelikte-3-ay';

update public.articles
set timeline_start_week = 1, timeline_end_week = 42
where slug = 'gebelikte-gunluk-rutin-ipuclari';

create table if not exists public.article_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.article_admins is
  'Authenticated users allowed to manage app articles and article cover images.';

alter table public.article_admins enable row level security;

create or replace function public.is_article_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.article_admins
    where user_id = auth.uid()
  );
$$;

drop policy if exists "article_admins_select_own" on public.article_admins;
create policy "article_admins_select_own"
  on public.article_admins for select
  using (auth.uid() = user_id);

drop policy if exists "articles_select_admin" on public.articles;
create policy "articles_select_admin"
  on public.articles for select
  using (public.is_article_admin());

drop policy if exists "articles_insert_admin" on public.articles;
create policy "articles_insert_admin"
  on public.articles for insert
  with check (public.is_article_admin());

drop policy if exists "articles_update_admin" on public.articles;
create policy "articles_update_admin"
  on public.articles for update
  using (public.is_article_admin())
  with check (public.is_article_admin());

drop policy if exists "articles_delete_admin" on public.articles;
create policy "articles_delete_admin"
  on public.articles for delete
  using (public.is_article_admin());

drop policy if exists "article_images_insert_admin" on storage.objects;
create policy "article_images_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'article-images'
    and public.is_article_admin()
  );

drop policy if exists "article_images_update_admin" on storage.objects;
create policy "article_images_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'article-images'
    and public.is_article_admin()
  )
  with check (
    bucket_id = 'article-images'
    and public.is_article_admin()
  );

drop policy if exists "article_images_delete_admin" on storage.objects;
create policy "article_images_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'article-images'
    and public.is_article_admin()
  );

grant select on public.article_admins to authenticated;
grant execute on function public.is_article_admin() to authenticated;
grant select, insert, update, delete on public.articles to authenticated;
