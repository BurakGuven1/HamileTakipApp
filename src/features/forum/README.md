# Forum

App-side API is in `src/api/forum.ts`.

The mobile client should read from `forum_posts_public` and `forum_comments_public` views so `author_id` is never exposed to the app.
