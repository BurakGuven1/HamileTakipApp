import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchPushes, type PushCandidate } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("FORUM_NOTIFICATION_WEBHOOK_SECRET") ?? "";

type WebhookTable = "forum_comments" | "forum_post_likes" | "forum_comment_likes";

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: WebhookTable;
  record: Record<string, unknown>;
}

interface PushTarget {
  userId: string;
  preference: "notify_forum_comments" | "notify_forum_likes";
  title: string;
  body: string;
  data: Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function snippet(value: string, maxLength = 72) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}...`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload: DatabaseWebhookPayload = await req.json();
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ success: true, action: "ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let target: PushTarget | null = null;

    if (payload.table === "forum_comments") {
      const postId = asString(payload.record.post_id);
      const actorId = asString(payload.record.author_id);
      const actorName = asString(payload.record.forum_nickname) ?? "Bir üye";
      const content = asString(payload.record.content) ?? "";

      if (!postId || !actorId) {
        throw new Error("Invalid forum_comments payload");
      }

      const { data: post, error } = await supabase
        .from("forum_posts")
        .select("author_id, title")
        .eq("id", postId)
        .single();

      if (error) throw error;

      if (post.author_id !== actorId) {
        target = {
          userId: post.author_id,
          preference: "notify_forum_comments",
          title: "Gönderine yeni yorum geldi",
          body: `${actorName}: ${snippet(content)}`,
          data: { type: "forum_comment", post_id: postId },
        };
      }
    }

    if (payload.table === "forum_post_likes") {
      const postId = asString(payload.record.post_id);
      const actorId = asString(payload.record.user_id);

      if (!postId || !actorId) {
        throw new Error("Invalid forum_post_likes payload");
      }

      const [{ data: post, error: postError }, { data: actor }] = await Promise.all([
        supabase.from("forum_posts").select("author_id, title").eq("id", postId).single(),
        supabase.from("profiles").select("forum_nickname").eq("id", actorId).maybeSingle(),
      ]);

      if (postError) throw postError;

      if (post.author_id !== actorId) {
        target = {
          userId: post.author_id,
          preference: "notify_forum_likes",
          title: "Gönderin beğenildi",
          body: `${actor?.forum_nickname ?? "Bir üye"} gönderini beğendi: ${snippet(post.title)}`,
          data: { type: "forum_post_like", post_id: postId },
        };
      }
    }

    if (payload.table === "forum_comment_likes") {
      const commentId = asString(payload.record.comment_id);
      const actorId = asString(payload.record.user_id);

      if (!commentId || !actorId) {
        throw new Error("Invalid forum_comment_likes payload");
      }

      const [{ data: comment, error: commentError }, { data: actor }] = await Promise.all([
        supabase
          .from("forum_comments")
          .select("author_id, post_id, content")
          .eq("id", commentId)
          .single(),
        supabase.from("profiles").select("forum_nickname").eq("id", actorId).maybeSingle(),
      ]);

      if (commentError) throw commentError;

      if (comment.author_id !== actorId) {
        target = {
          userId: comment.author_id,
          preference: "notify_forum_likes",
          title: "Yorumun beğenildi",
          body: `${actor?.forum_nickname ?? "Bir üye"} yorumunu beğendi: ${snippet(comment.content)}`,
          data: {
            type: "forum_comment_like",
            post_id: comment.post_id,
            comment_id: commentId,
          },
        };
      }
    }

    if (!target) {
      return new Response(JSON.stringify({ success: true, action: "skipped" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("notify_forum_comments, notify_forum_likes")
      .eq("id", target.userId)
      .single();

    if (profileError) throw profileError;

    if (!profile[target.preference]) {
      return new Response(JSON.stringify({ success: true, action: "preference_off" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id,user_id,expo_push_token")
      .eq("user_id", target.userId)
      .eq("enabled", true);

    if (tokenError) throw tokenError;

    const eventId = asString(payload.record.id) ??
      asString(payload.record.comment_id) ??
      asString(payload.record.post_id) ??
      crypto.randomUUID();
    const candidates: PushCandidate[] = (tokens ?? []).map((token) => ({
      dedupeKey: `forum:${payload.table}:${eventId}`,
      kind: String(target.data.type ?? "forum_notification"),
      tokenId: token.id,
      token: token.expo_push_token,
      userId: target.userId,
      message: {
        title: target.title,
        body: target.body,
        sound: "default",
        data: { ...target.data, screen: "forum" },
      },
    }));
    const delivery = await dispatchPushes(supabase, candidates);

    return new Response(JSON.stringify({ success: delivery.failed === 0, ...delivery }), {
      status: delivery.failed > 0 ? 502 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-forum-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
