-- Keep the forum strictly women-only and make each family code single-use.
-- The client also hides the forum, but these database rules are the security
-- boundary for direct API, deep-link and modified-client access.

-- Existing projects may already contain more than one father link for the same
-- owner. Keep the first link and revoke later links before adding the invariant.
with ranked_family_members as (
  select
    id,
    row_number() over (
      partition by owner_id
      order by created_at asc, id asc
    ) as link_order
  from public.family_members
)
delete from public.family_members fm
using ranked_family_members ranked
where fm.id = ranked.id
  and ranked.link_order > 1;

create unique index if not exists idx_family_members_one_father_per_owner
  on public.family_members (owner_id);

comment on index public.idx_family_members_one_father_per_owner is
  'A family code can be linked to only one father account.';

-- Keep an immutable claim even if a family_members row is later removed. This
-- prevents delete-and-redeem from turning the code into a reusable invitation.
create table if not exists public.family_code_redemptions (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  member_id uuid not null unique,
  redeemed_at timestamptz not null default now()
);

comment on table public.family_code_redemptions is
  'Permanent one-person claim for a family code; not exposed to clients.';

insert into public.family_code_redemptions (owner_id, member_id, redeemed_at)
select fm.owner_id, fm.member_id, fm.created_at
from public.family_members fm
on conflict (owner_id) do nothing;

alter table public.family_code_redemptions enable row level security;
revoke all on public.family_code_redemptions from anon, authenticated;

create or replace function public.enforce_single_father_code_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_member_id uuid;
begin
  begin
    insert into public.family_code_redemptions (owner_id, member_id, redeemed_at)
    values (new.owner_id, new.member_id, coalesce(new.created_at, now()))
    on conflict (owner_id) do nothing;
  exception
    when unique_violation then
      raise exception 'Bu hesap zaten başka bir aile koduna bağlandı.';
  end;

  select member_id into v_claimed_member_id
  from public.family_code_redemptions
  where owner_id = new.owner_id;

  if v_claimed_member_id is distinct from new.member_id then
    raise exception 'Bu aile kodu daha önce bir baba hesabına bağlandı.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_single_father_code_claim() from public, anon, authenticated;

drop trigger if exists enforce_single_father_code_claim on public.family_members;
create trigger enforce_single_father_code_claim
  before insert on public.family_members
  for each row execute function public.enforce_single_father_code_claim();

create or replace function public.is_family_father()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.family_members fm
        where fm.member_id = auth.uid()
          and fm.role = 'father'
      )
      or exists (
        select 1
        from public.family_code_redemptions redemption
        where redemption.member_id = auth.uid()
      )
    );
$$;

create or replace function public.can_access_womens_forum()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not public.is_family_father();
$$;

revoke all on function public.is_family_father() from public, anon;
revoke all on function public.can_access_womens_forum() from public, anon;
grant execute on function public.is_family_father() to authenticated;
grant execute on function public.can_access_womens_forum() to authenticated;

-- Categories are also private so a father cannot browse even the forum shell.
drop policy if exists "forum_categories_select_all" on public.forum_categories;
drop policy if exists "forum_categories_select_women" on public.forum_categories;
create policy "forum_categories_select_women"
  on public.forum_categories for select
  using (public.can_access_womens_forum());

-- Posts can only be read or changed by women. Do not use can_access_profile
-- here: family access intentionally maps a father to the mother's profile.
drop policy if exists "forum_posts_select_visible" on public.forum_posts;
drop policy if exists "forum_posts_insert_own" on public.forum_posts;
drop policy if exists "forum_posts_insert_family" on public.forum_posts;
drop policy if exists "forum_posts_update_own" on public.forum_posts;
drop policy if exists "forum_posts_update_family" on public.forum_posts;
drop policy if exists "forum_posts_delete_own" on public.forum_posts;
drop policy if exists "forum_posts_delete_family" on public.forum_posts;
drop policy if exists "forum_posts_select_women" on public.forum_posts;
drop policy if exists "forum_posts_insert_women" on public.forum_posts;
drop policy if exists "forum_posts_update_women" on public.forum_posts;
drop policy if exists "forum_posts_delete_women" on public.forum_posts;

create policy "forum_posts_select_women"
  on public.forum_posts for select
  using (
    public.can_access_womens_forum()
    and (is_hidden = false or author_id = auth.uid())
  );

create policy "forum_posts_insert_women"
  on public.forum_posts for insert
  with check (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  );

create policy "forum_posts_update_women"
  on public.forum_posts for update
  using (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  )
  with check (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  );

create policy "forum_posts_delete_women"
  on public.forum_posts for delete
  using (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  );

drop policy if exists "forum_comments_select_visible" on public.forum_comments;
drop policy if exists "forum_comments_insert_own" on public.forum_comments;
drop policy if exists "forum_comments_insert_family" on public.forum_comments;
drop policy if exists "forum_comments_delete_own" on public.forum_comments;
drop policy if exists "forum_comments_delete_family" on public.forum_comments;
drop policy if exists "forum_comments_select_women" on public.forum_comments;
drop policy if exists "forum_comments_insert_women" on public.forum_comments;
drop policy if exists "forum_comments_delete_women" on public.forum_comments;

create policy "forum_comments_select_women"
  on public.forum_comments for select
  using (
    public.can_access_womens_forum()
    and (is_hidden = false or author_id = auth.uid())
  );

create policy "forum_comments_insert_women"
  on public.forum_comments for insert
  with check (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  );

create policy "forum_comments_delete_women"
  on public.forum_comments for delete
  using (
    public.can_access_womens_forum()
    and author_id = auth.uid()
  );

drop policy if exists "forum_reports_insert_own" on public.forum_reports;
drop policy if exists "forum_reports_insert_family" on public.forum_reports;
drop policy if exists "forum_reports_select_own" on public.forum_reports;
drop policy if exists "forum_reports_select_family" on public.forum_reports;
drop policy if exists "forum_reports_insert_women" on public.forum_reports;
drop policy if exists "forum_reports_select_women" on public.forum_reports;

create policy "forum_reports_insert_women"
  on public.forum_reports for insert
  with check (
    public.can_access_womens_forum()
    and reporter_id = auth.uid()
  );

create policy "forum_reports_select_women"
  on public.forum_reports for select
  using (
    public.can_access_womens_forum()
    and reporter_id = auth.uid()
  );

drop policy if exists "forum_post_likes_select_own" on public.forum_post_likes;
drop policy if exists "forum_post_likes_insert_own" on public.forum_post_likes;
drop policy if exists "forum_post_likes_delete_own" on public.forum_post_likes;
drop policy if exists "forum_post_likes_select_women" on public.forum_post_likes;
drop policy if exists "forum_post_likes_insert_women" on public.forum_post_likes;
drop policy if exists "forum_post_likes_delete_women" on public.forum_post_likes;

create policy "forum_post_likes_select_women"
  on public.forum_post_likes for select
  using (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

create policy "forum_post_likes_insert_women"
  on public.forum_post_likes for insert
  with check (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

create policy "forum_post_likes_delete_women"
  on public.forum_post_likes for delete
  using (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

drop policy if exists "forum_comment_likes_select_own" on public.forum_comment_likes;
drop policy if exists "forum_comment_likes_insert_own" on public.forum_comment_likes;
drop policy if exists "forum_comment_likes_delete_own" on public.forum_comment_likes;
drop policy if exists "forum_comment_likes_select_women" on public.forum_comment_likes;
drop policy if exists "forum_comment_likes_insert_women" on public.forum_comment_likes;
drop policy if exists "forum_comment_likes_delete_women" on public.forum_comment_likes;

create policy "forum_comment_likes_select_women"
  on public.forum_comment_likes for select
  using (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

create policy "forum_comment_likes_insert_women"
  on public.forum_comment_likes for insert
  with check (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

create policy "forum_comment_likes_delete_women"
  on public.forum_comment_likes for delete
  using (
    public.can_access_womens_forum()
    and user_id = auth.uid()
  );

-- The read models are security-definer views so their own predicate must apply
-- the role gate; base-table RLS alone cannot protect these views.
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
where fp.is_hidden = false
  and public.can_access_womens_forum();

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
where fc.is_hidden = false
  and public.can_access_womens_forum();

revoke all on public.forum_categories from anon;
revoke all on public.forum_posts from anon;
revoke all on public.forum_comments from anon;
revoke all on public.forum_reports from anon;
revoke all on public.forum_post_likes from anon;
revoke all on public.forum_comment_likes from anon;
revoke all on public.forum_posts_public from anon;
revoke all on public.forum_comments_public from anon;

grant select on public.forum_categories to authenticated;
grant select, insert, update, delete on public.forum_posts to authenticated;
grant select, insert, delete on public.forum_comments to authenticated;
grant select, insert on public.forum_reports to authenticated;
grant select, insert, delete on public.forum_post_likes to authenticated;
grant select, insert, delete on public.forum_comment_likes to authenticated;
grant select on public.forum_posts_public to authenticated;
grant select on public.forum_comments_public to authenticated;

comment on view public.forum_posts_public is
  'Women-only forum read model. It never exposes author_id and rejects family father sessions.';
comment on view public.forum_comments_public is
  'Women-only forum comment read model. It never exposes author_id and rejects family father sessions.';

-- Keep the RPC fallback subject to the same one-father rule. Repeating the
-- request from the already linked account is idempotent; every other account
-- receives a clear error. The unique index closes concurrent request races.
create or replace function public.redeem_family_referral_code(p_code text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_owner_id uuid;
  v_existing_owner_id uuid;
  v_linked_member_id uuid;
  v_claimed_member_id uuid;
  v_clean_code text;
  v_profile public.profiles;
begin
  if v_member_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  v_clean_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  if length(v_clean_code) <> 7 then
    raise exception 'Aile kodu 7 haneli olmalı.';
  end if;

  select id into v_owner_id
  from public.profiles
  where family_referral_code = v_clean_code;

  if v_owner_id is null then
    raise exception 'Aile kodu bulunamadı.';
  end if;

  if v_owner_id = v_member_id then
    raise exception 'Kendi aile kodunu kullanamazsın.';
  end if;

  select owner_id into v_existing_owner_id
  from public.family_members
  where member_id = v_member_id;

  if v_existing_owner_id is not null and v_existing_owner_id <> v_owner_id then
    raise exception 'Bu hesap zaten başka bir aile profiline bağlı.';
  end if;

  select member_id into v_claimed_member_id
  from public.family_code_redemptions
  where owner_id = v_owner_id;

  if v_claimed_member_id is not null and v_claimed_member_id <> v_member_id then
    raise exception 'Bu aile kodu daha önce bir baba hesabına bağlandı.';
  end if;

  select member_id into v_linked_member_id
  from public.family_members
  where owner_id = v_owner_id
  limit 1;

  if v_linked_member_id is not null and v_linked_member_id <> v_member_id then
    raise exception 'Bu aile kodu daha önce bir baba hesabına bağlandı.';
  end if;

  if v_existing_owner_id is null then
    begin
      insert into public.family_members (owner_id, member_id, role)
      values (v_owner_id, v_member_id, 'father');
    exception
      when unique_violation then
        raise exception 'Bu aile kodu daha önce bir baba hesabına bağlandı.';
    end;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_owner_id;

  return v_profile;
end;
$$;

revoke all on function public.redeem_family_referral_code(text) from public, anon;
grant execute on function public.redeem_family_referral_code(text) to authenticated;

comment on column public.profiles.family_referral_code is
  'Seven digit, single-use family access code. It can be linked to only one father account.';
