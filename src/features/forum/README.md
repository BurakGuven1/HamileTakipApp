# Forum

App-side API is in `src/api/forum.ts`.

The mobile client should read from `forum_posts_public` and `forum_comments_public` views so `author_id` is never exposed to the app.

## Surfaces

- `post_kind = feed`: the existing social stream.
- `post_kind = topic`: traditional forum topics ordered by pin and last activity.
- `parent_comment_id`: bounded reply relationships used by topic conversations.

## Moderation

Reports are stored in `forum_reports`. One report never hides or deletes content.
Three distinct reporters within 24 hours can trigger a temporary quarantine; only a
member of `forum_moderators` can dismiss, remove content or suspend the author.
The in-app queue reads `forum_moderation_queue` and all final actions are performed
through guarded RPC functions.
