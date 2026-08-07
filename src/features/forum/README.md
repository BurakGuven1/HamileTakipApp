# Forum

App-side API is in `src/api/forum.ts`.

The mobile client should read from `forum_posts_public` and `forum_comments_public` views so `author_id` is never exposed to the app.

## Surfaces

- `post_kind = feed`: the existing social stream.
- `post_kind = topic`: traditional forum topics ordered by pin and last activity.
- `parent_comment_id`: bounded reply relationships used by topic conversations.

## Moderation

Reports are stored in `forum_reports`. One report never hides or deletes content.
Three distinct reporters within 24 hours can trigger a temporary quarantine. Only
the authenticated product-owner account (`burakguven351999@gmail.com`) can dismiss
reports, remove content, suspend authors, or change topic pin/lock state. The
database verifies the account email on every moderation RPC; membership in
`forum_moderators` alone does not grant access.
The in-app queue reads `forum_moderation_queue` and all final actions are performed
through guarded RPC functions.
