import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, Views } from "@/types/database";

export type ForumCategory = Tables<"forum_categories">;
export type PublicForumPost = Views<"forum_posts_public">;
export type PublicForumComment = Views<"forum_comments_public">;

export async function listForumCategories() {
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function listPublicForumPosts(categoryId?: string) {
  let query = supabase
    .from("forum_posts_public")
    .select("*")
    .order("created_at", { ascending: false });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function listPublicForumComments(postId: string) {
  const { data, error } = await supabase
    .from("forum_comments_public")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

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

  await trackEvent("forum_post_created", { post_id: data.id });

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

  await trackEvent("forum_comment_created", { comment_id: data.id });

  return data;
}

export async function reportForumContent(report: TablesInsert<"forum_reports">) {
  const { data, error } = await supabase
    .from("forum_reports")
    .insert(report)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("forum_post_reported", {
    target_type: report.target_type,
    target_id: report.target_id
  });

  return data;
}
