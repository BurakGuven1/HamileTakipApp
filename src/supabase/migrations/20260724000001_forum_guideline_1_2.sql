-- App Store Review Guideline 1.2: agreement, filtering, reporting and blocking.

create table if not exists public.user_legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_version text not null,
  source text not null check (source in ('auth', 'forum')),
  accepted_at timestamptz not null default now(),
  primary key (user_id, agreement_version)
);

alter table public.user_legal_acceptances enable row level security;

drop policy if exists "user_legal_acceptances_select_own" on public.user_legal_acceptances;
create policy "user_legal_acceptances_select_own"
  on public.user_legal_acceptances for select
  using (user_id = auth.uid());

drop policy if exists "user_legal_acceptances_insert_own" on public.user_legal_acceptances;
create policy "user_legal_acceptances_insert_own"
  on public.user_legal_acceptances for insert
  with check (user_id = auth.uid());

drop policy if exists "user_legal_acceptances_update_own" on public.user_legal_acceptances;
create policy "user_legal_acceptances_update_own"
  on public.user_legal_acceptances for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.record_legal_acceptance(
  p_version text,
  p_source text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Oturum açman gerekiyor.';
  end if;

  if p_source not in ('auth', 'forum') then
    raise exception 'Geçersiz kabul kaynağı.';
  end if;

  insert into public.user_legal_acceptances (
    user_id,
    agreement_version,
    source,
    accepted_at
  )
  values (auth.uid(), trim(p_version), p_source, v_accepted_at)
  on conflict (user_id, agreement_version)
  do update set
    source = excluded.source,
    accepted_at = excluded.accepted_at;

  return v_accepted_at;
end;
$$;

create or replace function public.has_legal_acceptance(p_version text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_legal_acceptances ula
    where ula.user_id = auth.uid()
      and ula.agreement_version = trim(p_version)
  );
$$;

revoke all on public.user_legal_acceptances from anon;
revoke all on function public.record_legal_acceptance(text, text) from public, anon;
revoke all on function public.has_legal_acceptance(text) from public, anon;
grant select, insert, update on public.user_legal_acceptances to authenticated;
grant execute on function public.record_legal_acceptance(text, text) to authenticated;
grant execute on function public.has_legal_acceptance(text) to authenticated;

create table if not exists public.forum_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

alter table public.forum_user_blocks enable row level security;

drop policy if exists "forum_user_blocks_select_own" on public.forum_user_blocks;
create policy "forum_user_blocks_select_own"
  on public.forum_user_blocks for select
  using (blocker_id = auth.uid());

drop policy if exists "forum_user_blocks_insert_own" on public.forum_user_blocks;
create policy "forum_user_blocks_insert_own"
  on public.forum_user_blocks for insert
  with check (blocker_id = auth.uid());

drop policy if exists "forum_user_blocks_delete_own" on public.forum_user_blocks;
create policy "forum_user_blocks_delete_own"
  on public.forum_user_blocks for delete
  using (blocker_id = auth.uid());

create table if not exists public.forum_user_suspensions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null,
  suspended_at timestamptz not null default now(),
  suspended_until timestamptz,
  created_from_report_id uuid references public.forum_reports(id) on delete set null
);

alter table public.forum_user_suspensions enable row level security;
revoke all on public.forum_user_suspensions from anon, authenticated;

create or replace function public.can_access_womens_forum()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not public.is_family_father()
    and not exists (
      select 1
      from public.forum_user_suspensions fus
      where fus.user_id = auth.uid()
        and (fus.suspended_until is null or fus.suspended_until > now())
    );
$$;

create or replace function public.block_forum_author(
  p_target_type text,
  p_target_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_nickname text;
begin
  if not public.can_access_womens_forum() then
    raise exception 'Foruma erişimin bulunmuyor.';
  end if;

  if p_target_type = 'post' then
    select fp.author_id, fp.forum_nickname
      into v_author_id, v_nickname
    from public.forum_posts fp
    where fp.id = p_target_id;
  elsif p_target_type = 'comment' then
    select fc.author_id, fc.forum_nickname
      into v_author_id, v_nickname
    from public.forum_comments fc
    where fc.id = p_target_id;
  else
    raise exception 'Geçersiz içerik türü.';
  end if;

  if v_author_id is null then
    raise exception 'Kullanıcı bulunamadı.';
  end if;

  if v_author_id = auth.uid() then
    raise exception 'Kendi hesabını engelleyemezsin.';
  end if;

  insert into public.forum_user_blocks (blocker_id, blocked_user_id)
  values (auth.uid(), v_author_id)
  on conflict do nothing;

  return v_nickname;
end;
$$;

create or replace function public.unblock_forum_author(p_blocked_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  delete from public.forum_user_blocks fub
  where fub.blocker_id = auth.uid()
    and fub.blocked_user_id = p_blocked_user_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

create or replace function public.list_forum_blocks()
returns table (
  blocked_user_id uuid,
  forum_nickname text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select fub.blocked_user_id, p.forum_nickname, fub.created_at
  from public.forum_user_blocks fub
  join public.profiles p on p.id = fub.blocked_user_id
  where fub.blocker_id = auth.uid()
  order by fub.created_at desc;
$$;

revoke all on public.forum_user_blocks from anon;
revoke all on function public.block_forum_author(text, uuid) from public, anon;
revoke all on function public.unblock_forum_author(uuid) from public, anon;
revoke all on function public.list_forum_blocks() from public, anon;
grant select, insert, delete on public.forum_user_blocks to authenticated;
grant execute on function public.block_forum_author(text, uuid) to authenticated;
grant execute on function public.unblock_forum_author(uuid) to authenticated;
grant execute on function public.list_forum_blocks() to authenticated;

create or replace function public.enforce_forum_content_filter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text;
  v_compact text;
begin
  if tg_table_name = 'forum_posts' then
    v_text := coalesce(new.title, '') || ' ' || coalesce(new.content, '');
  else
    v_text := coalesce(new.content, '');
  end if;

  v_text := lower(replace(v_text, 'İ', 'i'));
  v_compact := regexp_replace(v_text, '[^[:alnum:]çğıöşü]+', '', 'g');

  if
    v_text ~ '(^|[^[:alnum:]_])(orospu|şerefsiz|pezevenk|gerizekalı|siktir|sikik|amk|porno|pornografi|escort|onlyfans)([^[:alnum:]_]|$)'
    or v_text ~ '(seni|sizi).{0,18}(öldür|gebert|döver|tecavüz)'
    or v_compact ~ '(seniöldür|siziöldür|senigebert|sizigebert|çıplakfotoğrafgönder|nudegönder)'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Bu metin topluluk kurallarıyla uyuşmuyor. Hakaret, tehdit veya uygunsuz ifadeyi kaldırıp yeniden paylaş.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_forum_posts_content_filter on public.forum_posts;
create trigger enforce_forum_posts_content_filter
  before insert or update of title, content on public.forum_posts
  for each row execute function public.enforce_forum_content_filter();

drop trigger if exists enforce_forum_comments_content_filter on public.forum_comments;
create trigger enforce_forum_comments_content_filter
  before insert or update of content on public.forum_comments
  for each row execute function public.enforce_forum_content_filter();

alter table public.forum_reports
  add column if not exists reported_author_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_due_at timestamptz not null default (now() + interval '24 hours'),
  add column if not exists reviewed_at timestamptz,
  add column if not exists moderation_action text;

with duplicate_reports as (
  select
    id,
    row_number() over (
      partition by reporter_id, target_type, target_id
      order by created_at asc, id asc
    ) as duplicate_order
  from public.forum_reports
)
delete from public.forum_reports report
using duplicate_reports duplicate
where report.id = duplicate.id
  and duplicate.duplicate_order > 1;

create unique index if not exists idx_forum_reports_reporter_target
  on public.forum_reports(reporter_id, target_type, target_id);
create index if not exists idx_forum_reports_review_due
  on public.forum_reports(status, review_due_at)
  where status = 'pending';

create or replace function public.prepare_forum_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'post' then
    select fp.author_id into new.reported_author_id
    from public.forum_posts fp
    where fp.id = new.target_id;
  else
    select fc.author_id into new.reported_author_id
    from public.forum_comments fc
    where fc.id = new.target_id;
  end if;

  if new.reported_author_id is null then
    raise exception 'Raporlanacak içerik bulunamadı.';
  end if;

  if new.reported_author_id = new.reporter_id then
    raise exception 'Kendi içeriğini raporlayamazsın.';
  end if;

  new.review_due_at := now() + interval '24 hours';
  return new;
end;
$$;

create or replace function public.quarantine_reported_forum_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'post' then
    update public.forum_posts
    set
      is_hidden = true,
      is_flagged = true,
      flagged_reason = 'kullanici_raporu_incelemede'
    where id = new.target_id;
  else
    update public.forum_comments
    set
      is_hidden = true,
      is_flagged = true,
      flagged_reason = 'kullanici_raporu_incelemede'
    where id = new.target_id;
  end if;

  update public.forum_reports
  set moderation_action = 'icerik_inceleme_suresince_gizlendi'
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists prepare_forum_report_before_insert on public.forum_reports;
create trigger prepare_forum_report_before_insert
  before insert on public.forum_reports
  for each row execute function public.prepare_forum_report();

drop trigger if exists quarantine_forum_report_after_insert on public.forum_reports;
create trigger quarantine_forum_report_after_insert
  after insert on public.forum_reports
  for each row execute function public.quarantine_reported_forum_content();

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
  select *
    into v_report
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
        and flagged_reason = 'kullanici_raporu_incelemede';
    else
      update public.forum_comments
      set is_hidden = false, is_flagged = false, flagged_reason = null
      where id = v_report.target_id
        and flagged_reason = 'kullanici_raporu_incelemede';
    end if;

    update public.forum_reports
    set
      status = 'dismissed',
      reviewed_at = now(),
      moderation_action = concat_ws(': ', 'ihlal_yok_icerik_geri_yayinlandi', nullif(trim(p_note), ''))
    where id = p_report_id;
    return;
  end if;

  if v_report.target_type = 'post' then
    update public.forum_posts
    set is_hidden = true, is_flagged = true, flagged_reason = 'moderator_tarafindan_kaldirildi'
    where id = v_report.target_id;
  else
    update public.forum_comments
    set is_hidden = true, is_flagged = true, flagged_reason = 'moderator_tarafindan_kaldirildi'
    where id = v_report.target_id;
  end if;

  if p_action = 'remove_and_eject' then
    if v_report.reported_author_id is null then
      raise exception 'İhlal sahibi bulunamadı.';
    end if;

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
    status = 'reviewed',
    reviewed_at = now(),
    moderation_action = concat_ws(': ', p_action, nullif(trim(p_note), ''))
  where id = p_report_id;
end;
$$;

revoke all on function public.resolve_forum_report(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_forum_report(uuid, text, text)
  to service_role;

create or replace view public.forum_posts_public
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
    where c.post_id = fp.id
      and c.is_hidden = false
      and not exists (
        select 1
        from public.forum_user_blocks cb
        where cb.blocker_id = auth.uid()
          and cb.blocked_user_id = c.author_id
      )
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
where fp.is_hidden = false
  and public.can_access_womens_forum()
  and not exists (
    select 1
    from public.forum_user_blocks b
    where b.blocker_id = auth.uid()
      and b.blocked_user_id = fp.author_id
  );

create or replace view public.forum_comments_public
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
where fc.is_hidden = false
  and public.can_access_womens_forum()
  and not exists (
    select 1
    from public.forum_user_blocks b
    where b.blocker_id = auth.uid()
      and b.blocked_user_id = fc.author_id
  );

comment on table public.user_legal_acceptances is
  'Versioned EULA and community-rule acceptances used for App Store Guideline 1.2 evidence.';
comment on table public.forum_user_blocks is
  'Server-side abusive-user blocks. Public forum views exclude blocked authors.';
comment on table public.forum_user_suspensions is
  'Moderation ejections. Active rows prevent all forum access.';
comment on column public.forum_reports.review_due_at is
  'Operational moderation deadline: every report must be resolved within 24 hours.';
