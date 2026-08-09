import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, Views } from "@/types/database";

export type ForumCategory = Tables<"forum_categories">;
export type PublicForumPost = Views<"forum_posts_public">;
export type PublicForumComment = Views<"forum_comments_public">;
export type ForumModerationQueueItem = Views<"forum_moderation_queue">;
export type ForumSuspension = Views<"forum_suspensions_admin">;
export type ForumPostKind = "feed" | "topic";
export type ForumReportAction =
  | "dismiss"
  | "remove_content"
  | "remove_and_eject";
const FORUM_OWNER_EMAIL = "burakguven351999@gmail.com";
export type BlockedForumUser = {
  blocked_at: string;
  blocked_user_id: string;
  forum_nickname: string;
};

export async function listForumCategories() {
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  const seenCategoryNames = new Set<string>();

  return data.filter((category) => {
    const normalizedName = category.name
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (seenCategoryNames.has(normalizedName)) {
      return false;
    }

    seenCategoryNames.add(normalizedName);
    return true;
  });
}

export async function listPublicForumPosts(
  categoryId?: string,
  limit = 20,
  postKind: ForumPostKind = "feed"
) {
  let query = supabase
    .from("forum_posts_public")
    .select("*")
    .eq("post_kind", postKind)
    .limit(limit + 1);

  query = postKind === "topic"
    ? query
        .order("is_pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
    : query.order("created_at", { ascending: false });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function listPublicForumComments(postId: string, limit = 30) {
  const { data, error } = await supabase
    .from("forum_comments_public")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit + 1);

  if (error) {
    throw error;
  }

  return data;
}

export async function createForumPost(
  post: TablesInsert<"forum_posts">
) {
  const { data, error } = await supabase
    .from("forum_posts")
    .insert(post)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("forum_post_created");

  return data;
}

export async function createForumComment(
  comment: TablesInsert<"forum_comments">
) {
  const { data, error } = await supabase
    .from("forum_comments")
    .insert(comment)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("forum_comment_created");

  return data;
}

async function getCurrentUserId() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Oturum açman gerekiyor.");
  }

  return user.id;
}

export async function toggleForumPostLike(post: PublicForumPost) {
  const userId = await getCurrentUserId();

  if (post.liked_by_current_user) {
    const { error } = await supabase
      .from("forum_post_likes")
      .delete()
      .match({ post_id: post.id, user_id: userId });

    if (error) {
      throw error;
    }

    await trackEvent("forum_post_unliked");
    return { liked: false };
  }

  const { error } = await supabase
    .from("forum_post_likes")
    .upsert(
      { post_id: post.id, user_id: userId },
      { onConflict: "post_id,user_id", ignoreDuplicates: true }
    );

  if (error) {
    throw error;
  }

  await trackEvent("forum_post_liked");
  return { liked: true };
}

export async function toggleForumCommentLike(comment: PublicForumComment) {
  const userId = await getCurrentUserId();

  if (comment.liked_by_current_user) {
    const { error } = await supabase
      .from("forum_comment_likes")
      .delete()
      .match({ comment_id: comment.id, user_id: userId });

    if (error) {
      throw error;
    }

    await trackEvent("forum_comment_unliked");
    return { liked: false };
  }

  const { error } = await supabase
    .from("forum_comment_likes")
    .upsert(
      { comment_id: comment.id, user_id: userId },
      { onConflict: "comment_id,user_id", ignoreDuplicates: true }
    );

  if (error) {
    throw error;
  }

  await trackEvent("forum_comment_liked");
  return { liked: true };
}

export async function reportForumContent(report: TablesInsert<"forum_reports">) {
  const { data, error } = await supabase
    .from("forum_reports")
    .insert(report)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Bu içeriği daha önce raporladın. Mevcut rapor moderasyon kuyruğunda."
      );
    }
    throw error;
  }

  await trackEvent("forum_content_reported", {
    target_type: report.target_type
  });

  return data;
}

export async function isForumModerator() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (user?.email?.trim().toLocaleLowerCase("tr-TR") !== FORUM_OWNER_EMAIL) {
    return false;
  }

  const { data, error } = await supabase.rpc("is_forum_moderator");

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function listForumModerationQueue(
  status: ForumModerationQueueItem["status"] = "pending",
  limit = 50
) {
  const { data, error } = await supabase
    .from("forum_moderation_queue")
    .select("*")
    .eq("status", status)
    .order("review_due_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const seenTargets = new Set<string>();
  return data.filter((report) => {
    const targetKey = `${report.target_type}:${report.target_id}`;
    if (seenTargets.has(targetKey)) return false;
    seenTargets.add(targetKey);
    return true;
  });
}

export async function resolveForumReport(
  reportId: string,
  action: ForumReportAction,
  note?: string
) {
  const { error } = await supabase.rpc("resolve_forum_report", {
    p_action: action,
    p_note: note?.trim() || null,
    p_report_id: reportId
  });

  if (error) {
    throw error;
  }

  await trackEvent("forum_report_resolved", {
    action
  });
}

export async function moderateForumTopic(
  postId: string,
  isPinned: boolean,
  isLocked: boolean
) {
  const { error } = await supabase.rpc("moderate_forum_topic", {
    p_is_locked: isLocked,
    p_is_pinned: isPinned,
    p_post_id: postId
  });

  if (error) {
    throw error;
  }
}

export async function listForumSuspensions() {
  const { data, error } = await supabase
    .from("forum_suspensions_admin")
    .select("*")
    .order("suspended_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function reinstateForumUser(userId: string) {
  const { data, error } = await supabase.rpc("reinstate_forum_user", {
    p_user_id: userId
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export function subscribeToForumConversation(
  postId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`forum-conversation:${postId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `post_id=eq.${postId}`,
        schema: "public",
        table: "forum_comments"
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function listBlockedForumUsers() {
  const { data, error } = await supabase.rpc("list_forum_blocks");

  if (error) {
    throw error;
  }

  return (data ?? []) as BlockedForumUser[];
}

export async function blockForumAuthor(
  targetType: "post" | "comment",
  targetId: string
) {
  const { data, error } = await supabase.rpc("block_forum_author", {
    p_target_id: targetId,
    p_target_type: targetType
  });

  if (error) {
    throw error;
  }

  await trackEvent("forum_user_blocked", {
    target_type: targetType
  });

  return data;
}

export async function unblockForumAuthor(blockedUserId: string) {
  const { data, error } = await supabase.rpc("unblock_forum_author", {
    p_blocked_user_id: blockedUserId
  });

  if (error) {
    throw error;
  }

  await trackEvent("forum_user_unblocked");

  return data;
}
