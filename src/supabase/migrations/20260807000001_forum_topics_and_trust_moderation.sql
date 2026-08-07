-- Traditional forum topics, threaded replies and abuse-resistant moderation.
-- A report is evidence for review; it never deletes content by itself.

create table if not exists public.forum_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.forum_moderators (user_id)
select user_id from public.article_admins
on conflict (user_id) do nothing;

alter table public.forum_moderators enable row level security;

create or replace function public.is_forum_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.forum_moderators moderator
      where moderator.user_id = auth.uid()
    );
$$;

revoke all on public.forum_moderators from anon, authenticated;
revoke all on function public.is_forum_moderator() from public, anon;
grant execute on function public.is_forum_moderator() to authenticated;

drop policy if exists "forum_moderators_select_own" on public.forum_moderators;
create policy "forum_moderators_select_own"
  on public.forum_moderators for select
  using (user_id = auth.uid());
grant select on public.forum_moderators to authenticated;

create or replace function public.can_access_womens_forum()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not public.is_family_father()
    and (
      public.is_forum_moderator()
      or not exists (
        select 1
        from public.forum_user_suspensions suspension
        where suspension.user_id = auth.uid()
          and (
            suspension.suspended_until is null
            or suspension.suspended_until > now()
          )
      )
    );
$$;

alter table public.forum_posts
  add column if not exists post_kind text not null default 'feed',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_locked boolean not null default false,
  add column if not exists last_activity_at timestamptz not null default now();

update public.forum_posts
set last_activity_at = greatest(created_at, updated_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'forum_posts_post_kind_check'
  ) then
    alter table public.forum_posts
      add constraint forum_posts_post_kind_check
      check (post_kind in ('feed', 'topic'));
  end if;
end $$;

alter table public.forum_comments
  add column if not exists parent_comment_id uuid
    references public.forum_comments(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.forum_comments
set updated_at = created_at
where updated_at is null;

create index if not exists idx_forum_posts_kind_activity
  on public.forum_posts(post_kind, is_pinned desc, last_activity_at desc)
  where is_hidden = false;
create index if not exists idx_forum_comments_parent
  on public.forum_comments(parent_comment_id, created_at)
  where is_hidden = false;

drop trigger if exists set_forum_comments_updated_at on public.forum_comments;
create trigger set_forum_comments_updated_at
  before update on public.forum_comments
  for each row execute function public.set_updated_at();

create or replace function public.validate_forum_post_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := trim(regexp_replace(coalesce(new.title, ''), '\s+', ' ', 'g'));
  new.content := trim(coalesce(new.content, ''));

  if char_length(new.title) not between 4 and 120 then
    raise exception 'Başlık 4–120 karakter arasında olmalı.';
  end if;

  if char_length(new.content) not between 8 and 4000 then
    raise exception 'İçerik 8–4000 karakter arasında olmalı.';
  end if;

  if tg_op = 'INSERT' and not public.is_forum_moderator() then
    if (
      select count(*) >= 5
      from public.forum_posts post
      where post.author_id = new.author_id
        and post.created_at >= now() - interval '10 minutes'
    ) then
      raise exception 'Çok hızlı paylaşım yapıyorsun. Birkaç dakika sonra yeniden dene.';
    end if;

    if (
      select count(*) >= 20
      from public.forum_posts post
      where post.author_id = new.author_id
        and post.created_at >= now() - interval '24 hours'
    ) then
      raise exception 'Günlük paylaşım sınırına ulaştın. Yarın yeniden deneyebilirsin.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and pg_trigger_depth() = 1
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_forum_moderator()
  then
    if new.is_hidden is distinct from old.is_hidden
      or new.is_flagged is distinct from old.is_flagged
      or new.flagged_reason is distinct from old.flagged_reason
      or new.is_pinned is distinct from old.is_pinned
      or new.is_locked is distinct from old.is_locked
      or new.post_kind is distinct from old.post_kind
    then
      raise exception 'Bu alanları yalnızca forum moderatörü değiştirebilir.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.last_activity_at := coalesce(new.last_activity_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists validate_forum_post_write on public.forum_posts;
create trigger validate_forum_post_write
  before insert or update on public.forum_posts
  for each row execute function public.validate_forum_post_write();

create or replace function public.validate_forum_comment_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_locked boolean;
  v_parent_post_id uuid;
begin
  new.content := trim(coalesce(new.content, ''));

  if char_length(new.content) not between 2 and 2000 then
    raise exception 'Yanıt 2–2000 karakter arasında olmalı.';
  end if;

  select post.is_locked into v_post_locked
  from public.forum_posts post
  where post.id = new.post_id;

  if v_post_locked is null then
    raise exception 'Konuşma bulunamadı.';
  end if;

  if v_post_locked and not public.is_forum_moderator() then
    raise exception 'Bu konu yeni yanıtlara kapatıldı.';
  end if;

  if new.parent_comment_id is not null then
    select comment.post_id into v_parent_post_id
    from public.forum_comments comment
    where comment.id = new.parent_comment_id
      and comment.is_hidden = false;

    if v_parent_post_id is null or v_parent_post_id <> new.post_id then
      raise exception 'Yanıtlanan mesaj bu konuşmada bulunamadı.';
    end if;
  end if;

  if tg_op = 'INSERT' and not public.is_forum_moderator() then
    if (
      select count(*) >= 20
      from public.forum_comments comment
      where comment.author_id = new.author_id
        and comment.created_at >= now() - interval '10 minutes'
    ) then
      raise exception 'Çok hızlı yanıt gönderiyorsun. Birkaç dakika sonra yeniden dene.';
    end if;

    if (
      select count(*) >= 100
      from public.forum_comments comment
      where comment.author_id = new.author_id
        and comment.created_at >= now() - interval '24 hours'
    ) then
      raise exception 'Günlük yanıt sınırına ulaştın. Yarın yeniden deneyebilirsin.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_forum_comment_write on public.forum_comments;
create trigger validate_forum_comment_write
  before insert or update on public.forum_comments
  for each row execute function public.validate_forum_comment_write();

create or replace function public.refresh_forum_post_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
begin
  update public.forum_posts post
  set last_activity_at = greatest(
    post.created_at,
    coalesce(
      (
        select max(comment.created_at)
        from public.forum_comments comment
        where comment.post_id = v_post_id
          and comment.is_hidden = false
      ),
      post.created_at
    )
  )
  where post.id = v_post_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_forum_post_activity on public.forum_comments;
create trigger refresh_forum_post_activity
  after insert or update of is_hidden or delete on public.forum_comments
  for each row execute function public.refresh_forum_post_activity();

-- Replace the old single-report quarantine behavior with a trust threshold.
drop trigger if exists quarantine_forum_report_after_insert on public.forum_reports;

create or replace function public.prepare_forum_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'Rapor yalnızca kendi hesabından gönderilebilir.';
  end if;

  new.reason := trim(regexp_replace(coalesce(new.reason, ''), '\s+', ' ', 'g'));
  if char_length(new.reason) not between 3 and 240 then
    raise exception 'Rapor nedeni 3–240 karakter arasında olmalı.';
  end if;

  if (
    select count(*) >= 5
    from public.forum_reports report
    where report.reporter_id = new.reporter_id
      and report.created_at >= now() - interval '1 hour'
  ) then
    raise exception 'Saatlik rapor sınırına ulaştın. Daha sonra yeniden dene.';
  end if;

  if (
    select count(*) >= 15
    from public.forum_reports report
    where report.reporter_id = new.reporter_id
      and report.created_at >= now() - interval '24 hours'
  ) then
    raise exception 'Günlük rapor sınırına ulaştın. Acil güvenlik durumlarında destek ekibiyle iletişime geç.';
  end if;

  if new.target_type = 'post' then
    select post.author_id into new.reported_author_id
    from public.forum_posts post
    where post.id = new.target_id;
  elsif new.target_type = 'comment' then
    select comment.author_id into new.reported_author_id
    from public.forum_comments comment
    where comment.id = new.target_id;
  else
    raise exception 'Geçersiz içerik türü.';
  end if;

  if new.reported_author_id is null then
    raise exception 'Raporlanacak içerik bulunamadı.';
  end if;

  if new.reported_author_id = new.reporter_id then
    raise exception 'Kendi içeriğini raporlayamazsın.';
  end if;

  new.review_due_at := now() + interval '24 hours';
  new.status := 'pending';
  return new;
end;
$$;

create or replace function public.evaluate_forum_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_reporter_count integer;
begin
  select count(distinct report.reporter_id)::int
    into v_recent_reporter_count
  from public.forum_reports report
  where report.target_type = new.target_type
    and report.target_id = new.target_id
    and report.status = 'pending'
    and report.created_at >= now() - interval '24 hours';

  if v_recent_reporter_count >= 3 then
    if new.target_type = 'post' then
      update public.forum_posts
      set
        is_hidden = true,
        is_flagged = true,
        flagged_reason = 'coklu_rapor_esigi_incelemede'
      where id = new.target_id
        and flagged_reason is distinct from 'moderator_tarafindan_kaldirildi';
    else
      update public.forum_comments
      set
        is_hidden = true,
        is_flagged = true,
        flagged_reason = 'coklu_rapor_esigi_incelemede'
      where id = new.target_id
        and flagged_reason is distinct from 'moderator_tarafindan_kaldirildi';
    end if;

    update public.forum_reports
    set moderation_action = 'coklu_rapor_esigiyle_gecici_karantina'
    where id = new.id;
  else
    update public.forum_reports
    set moderation_action = 'moderasyon_kuyruguna_alindi'
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists evaluate_forum_report_threshold_after_insert on public.forum_reports;
create trigger evaluate_forum_report_threshold_after_insert
  after insert on public.forum_reports
  for each row execute function public.evaluate_forum_report_threshold();

drop policy if exists "forum_reports_select_moderators" on public.forum_reports;
create policy "forum_reports_select_moderators"
  on public.forum_reports for select
  using (public.is_forum_moderator());

create or replace function public.resolve_forum_report(
  p_report_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.forum_reports%rowtype;
begin
  if not public.is_forum_moderator() then
    raise exception 'Bu işlem için moderatör yetkisi gerekli.';
  end if;

  select * into v_report
  from public.forum_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Rapor bulunamadı.';
  end if;

  if p_action not in ('dismiss', 'remove_content', 'remove_and_eject') then
    raise exception 'Geçersiz moderasyon işlemi.';
  end if;

  if p_action = 'dismiss' then
    if v_report.target_type = 'post' then
      update public.forum_posts
      set is_hidden = false, is_flagged = false, flagged_reason = null
      where id = v_report.target_id
        and flagged_reason = 'coklu_rapor_esigi_incelemede';
    else
      update public.forum_comments
      set is_hidden = false, is_flagged = false, flagged_reason = null
      where id = v_report.target_id
        and flagged_reason = 'coklu_rapor_esigi_incelemede';
    end if;
  else
    if v_report.target_type = 'post' then
      update public.forum_posts
      set
        is_hidden = true,
        is_flagged = true,
        flagged_reason = 'moderator_tarafindan_kaldirildi'
      where id = v_report.target_id;
    else
      update public.forum_comments
      set
        is_hidden = true,
        is_flagged = true,
        flagged_reason = 'moderator_tarafindan_kaldirildi'
      where id = v_report.target_id;
    end if;
  end if;

  if p_action = 'remove_and_eject' then
    insert into public.forum_user_suspensions (
      user_id,
      reason,
      suspended_until,
      created_from_report_id
    )
    values (
      v_report.reported_author_id,
      coalesce(nullif(trim(p_note), ''), 'Doğrulanmış topluluk kuralı ihlali'),
      null,
      p_report_id
    )
    on conflict (user_id)
    do update set
      reason = excluded.reason,
      suspended_at = now(),
      suspended_until = null,
      created_from_report_id = excluded.created_from_report_id;

    update public.forum_posts
    set is_hidden = true, is_flagged = true, flagged_reason = 'hesap_topluluktan_cikarildi'
    where author_id = v_report.reported_author_id;

    update public.forum_comments
    set is_hidden = true, is_flagged = true, flagged_reason = 'hesap_topluluktan_cikarildi'
    where author_id = v_report.reported_author_id;
  end if;

  update public.forum_reports
  set
    status = case when p_action = 'dismiss' then 'dismissed' else 'reviewed' end,
    reviewed_at = now(),
    moderation_action = concat_ws(': ', p_action, nullif(trim(p_note), ''))
  where target_type = v_report.target_type
    and target_id = v_report.target_id
    and status = 'pending';
end;
$$;

revoke all on function public.resolve_forum_report(uuid, text, text)
  from public, anon;
grant execute on function public.resolve_forum_report(uuid, text, text)
  to authenticated, service_role;

create or replace function public.moderate_forum_topic(
  p_post_id uuid,
  p_is_pinned boolean,
  p_is_locked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_forum_moderator() then
    raise exception 'Bu işlem için moderatör yetkisi gerekli.';
  end if;

  update public.forum_posts
  set is_pinned = p_is_pinned, is_locked = p_is_locked
  where id = p_post_id
    and post_kind = 'topic';

  if not found then
    raise exception 'Konu bulunamadı.';
  end if;
end;
$$;

create or replace function public.reinstate_forum_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_forum_moderator() then
    raise exception 'Bu işlem için moderatör yetkisi gerekli.';
  end if;

  delete from public.forum_user_suspensions
  where user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.moderate_forum_topic(uuid, boolean, boolean)
  from public, anon;
revoke all on function public.reinstate_forum_user(uuid)
  from public, anon;
grant execute on function public.moderate_forum_topic(uuid, boolean, boolean)
  to authenticated;
grant execute on function public.reinstate_forum_user(uuid)
  to authenticated;

drop view if exists public.forum_comments_public;
drop view if exists public.forum_posts_public;

create view public.forum_posts_public
with (security_invoker = false) as
select
  post.id,
  post.category_id,
  post.forum_nickname,
  public.get_public_badge(post.author_id) as author_badge,
  post.title,
  post.content,
  post.created_at,
  post.updated_at,
  (
    select count(*)::int
    from public.forum_comments comment
    where comment.post_id = post.id
      and comment.is_hidden = false
      and not exists (
        select 1
        from public.forum_user_blocks blocked_comment_author
        where blocked_comment_author.blocker_id = auth.uid()
          and blocked_comment_author.blocked_user_id = comment.author_id
      )
  ) as comment_count,
  (
    select count(*)::int
    from public.forum_post_likes post_like
    where post_like.post_id = post.id
  ) as like_count,
  exists (
    select 1
    from public.forum_post_likes post_like
    where post_like.post_id = post.id
      and post_like.user_id = auth.uid()
  ) as liked_by_current_user,
  post.post_kind,
  post.is_pinned,
  post.is_locked,
  post.last_activity_at,
  (
    select comment.forum_nickname
    from public.forum_comments comment
    where comment.post_id = post.id
      and comment.is_hidden = false
    order by comment.created_at desc
    limit 1
  ) as last_reply_nickname,
  post.author_id = auth.uid() as authored_by_current_user
from public.forum_posts post
where post.is_hidden = false
  and public.can_access_womens_forum()
  and not exists (
    select 1
    from public.forum_user_blocks blocked_author
    where blocked_author.blocker_id = auth.uid()
      and blocked_author.blocked_user_id = post.author_id
  );

create view public.forum_comments_public
with (security_invoker = false) as
select
  comment.id,
  comment.post_id,
  comment.forum_nickname,
  public.get_public_badge(comment.author_id) as author_badge,
  comment.content,
  comment.created_at,
  (
    select count(*)::int
    from public.forum_comment_likes comment_like
    where comment_like.comment_id = comment.id
  ) as like_count,
  exists (
    select 1
    from public.forum_comment_likes comment_like
    where comment_like.comment_id = comment.id
      and comment_like.user_id = auth.uid()
  ) as liked_by_current_user,
  comment.parent_comment_id,
  comment.updated_at,
  comment.author_id = auth.uid() as authored_by_current_user
from public.forum_comments comment
where comment.is_hidden = false
  and public.can_access_womens_forum()
  and not exists (
    select 1
    from public.forum_user_blocks blocked_author
    where blocked_author.blocker_id = auth.uid()
      and blocked_author.blocked_user_id = comment.author_id
  );

revoke all on public.forum_posts_public from anon;
revoke all on public.forum_comments_public from anon;
grant select on public.forum_posts_public to authenticated;
grant select on public.forum_comments_public to authenticated;

create or replace view public.forum_moderation_queue
with (security_invoker = false) as
select
  report.id,
  report.target_type,
  report.target_id,
  report.reason,
  report.status,
  report.created_at,
  report.review_due_at,
  report.reviewed_at,
  report.moderation_action,
  report.reported_author_id,
  reporter.forum_nickname as reporter_nickname,
  coalesce(post.title, 'Yorum') as target_title,
  coalesce(post.content, comment.content, 'İçerik artık mevcut değil.') as target_content,
  coalesce(post.forum_nickname, comment.forum_nickname, 'Bilinmeyen kullanıcı') as target_nickname,
  coalesce(post.post_kind, 'feed') as post_kind,
  coalesce(post.is_hidden, comment.is_hidden, true) as target_is_hidden,
  (
    select count(distinct grouped_report.reporter_id)::int
    from public.forum_reports grouped_report
    where grouped_report.target_type = report.target_type
      and grouped_report.target_id = report.target_id
      and grouped_report.status = 'pending'
  ) as pending_report_count,
  (
    select count(*)::int
    from public.forum_reports reporter_history
    where reporter_history.reporter_id = report.reporter_id
  ) as reporter_total_reports,
  (
    select count(*)::int
    from public.forum_reports reporter_history
    where reporter_history.reporter_id = report.reporter_id
      and reporter_history.status = 'dismissed'
  ) as reporter_dismissed_reports
from public.forum_reports report
left join public.profiles reporter on reporter.id = report.reporter_id
left join public.forum_posts post
  on report.target_type = 'post' and post.id = report.target_id
left join public.forum_comments comment
  on report.target_type = 'comment' and comment.id = report.target_id
where public.is_forum_moderator();

create or replace view public.forum_suspensions_admin
with (security_invoker = false) as
select
  suspension.user_id,
  profile.forum_nickname,
  suspension.reason,
  suspension.suspended_at,
  suspension.suspended_until
from public.forum_user_suspensions suspension
join public.profiles profile on profile.id = suspension.user_id
where public.is_forum_moderator();

revoke all on public.forum_moderation_queue from anon;
revoke all on public.forum_suspensions_admin from anon;
grant select on public.forum_moderation_queue to authenticated;
grant select on public.forum_suspensions_admin to authenticated;

comment on table public.forum_moderators is
  'Users allowed to triage reports, hide content, lock topics and suspend forum accounts.';
comment on column public.forum_posts.post_kind is
  'feed keeps the social stream; topic powers the traditional discussion-board surface.';
comment on column public.forum_comments.parent_comment_id is
  'Optional reply relationship used to render a bounded conversation tree.';
comment on view public.forum_moderation_queue is
  'Moderator-only report queue with target snapshots and reporter history signals.';
