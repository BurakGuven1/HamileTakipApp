-- Forum moderation is intentionally restricted to the single product-owner account.
-- The table remains as an audit/provisioning record, but authorization never trusts
-- table membership alone.

delete from public.forum_moderators moderator
where not exists (
  select 1
  from auth.users admin_user
  where admin_user.id = moderator.user_id
    and lower(coalesce(admin_user.email, '')) = 'burakguven351999@gmail.com'
);

insert into public.forum_moderators (user_id)
select admin_user.id
from auth.users admin_user
where lower(coalesce(admin_user.email, '')) = 'burakguven351999@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.is_forum_moderator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from auth.users admin_user
      where admin_user.id = auth.uid()
        and lower(coalesce(admin_user.email, '')) = 'burakguven351999@gmail.com'
    );
$$;

revoke all on function public.is_forum_moderator() from public, anon;
grant execute on function public.is_forum_moderator() to authenticated;

drop policy if exists "forum_moderators_select_own" on public.forum_moderators;
drop policy if exists "forum_moderators_select_owner" on public.forum_moderators;
create policy "forum_moderators_select_owner"
  on public.forum_moderators for select
  using (
    user_id = auth.uid()
    and public.is_forum_moderator()
  );

comment on function public.is_forum_moderator() is
  'Returns true only for the authenticated product-owner account. All report and topic moderation RPCs depend on this check.';

comment on table public.forum_moderators is
  'Audit/provisioning record for the single forum owner. Membership alone never grants moderation authority.';
