-- Remove duplicate forum categories, preserve their posts, and prevent recurrence.

with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name))
      order by sort_order, id
    ) as canonical_id,
    row_number() over (
      partition by lower(btrim(name))
      order by sort_order, id
    ) as duplicate_rank
  from public.forum_categories
), duplicate_categories as (
  select id, canonical_id
  from ranked_categories
  where duplicate_rank > 1
)
update public.forum_posts as post
set category_id = duplicate.canonical_id
from duplicate_categories as duplicate
where post.category_id = duplicate.id;

with ranked_categories as (
  select
    id,
    row_number() over (
      partition by lower(btrim(name))
      order by sort_order, id
    ) as duplicate_rank
  from public.forum_categories
)
delete from public.forum_categories as category
using ranked_categories as ranked
where category.id = ranked.id
  and ranked.duplicate_rank > 1;

update public.forum_categories
set name = btrim(name)
where name <> btrim(name);

create unique index if not exists forum_categories_normalized_name_unique
  on public.forum_categories (lower(btrim(name)));
