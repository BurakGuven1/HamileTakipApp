import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  createForumComment,
  createForumPost,
  listForumCategories,
  listPublicForumComments,
  listPublicForumPosts,
  toggleForumCommentLike,
  toggleForumPostLike,
  type PublicForumComment,
  type PublicForumPost
} from "@/api/forum";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { colors, radii, spacing, typography } from "@/theme";

export default function ForumScreen() {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [activePostId, setActivePostId] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const categoriesQuery = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories
  });

  const postsQuery = useQuery({
    queryKey: ["forum-posts", selectedCategoryId],
    queryFn: () => listPublicForumPosts(selectedCategoryId)
  });

  const activePost = useMemo(
    () => postsQuery.data?.find((post) => post.id === activePostId) ?? null,
    [activePostId, postsQuery.data]
  );

  useEffect(() => {
    if (!activePostId && postsQuery.data?.[0]) {
      setActivePostId(postsQuery.data[0].id);
    }
  }, [activePostId, postsQuery.data]);

  const commentsQuery = useQuery({
    queryKey: ["forum-comments", activePostId],
    queryFn: () => listPublicForumComments(activePostId as string),
    enabled: Boolean(activePostId)
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const profile = profileQuery.data;
      const categoryId = selectedCategoryId ?? categoriesQuery.data?.[0]?.id;

      if (!profile) {
        throw new Error("Gonderi olusturmak icin giris yapmalisin.");
      }

      if (!categoryId) {
        throw new Error("Once bir kategori sec.");
      }

      const cleanTitle = title.trim();
      const cleanContent = content.trim();

      if (cleanTitle.length < 4 || cleanContent.length < 8) {
        throw new Error("Baslik ve icerik biraz daha acik olmali.");
      }

      return createForumPost({
        category_id: categoryId,
        author_id: profile.id,
        forum_nickname: profile.forum_nickname ?? "Anne",
        title: cleanTitle,
        content: cleanContent
      });
    },
    onSuccess: async (post) => {
      setTitle("");
      setContent("");
      setComposerOpen(false);
      setActivePostId(post.id);
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
    onError: (error) => {
      Alert.alert("Gonderi olusturulamadi", error.message);
    }
  });

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const profile = profileQuery.data;
      const cleanComment = commentText.trim();

      if (!profile || !activePost) {
        throw new Error("Yorum yazmak icin giris yapmalisin.");
      }

      if (cleanComment.length < 2) {
        throw new Error("Yorum cok kisa.");
      }

      return createForumComment({
        post_id: activePost.id,
        author_id: profile.id,
        forum_nickname: profile.forum_nickname ?? "Anne",
        content: cleanComment
      });
    },
    onSuccess: async () => {
      setCommentText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] }),
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] })
      ]);
    },
    onError: (error) => {
      Alert.alert("Yorum eklenemedi", error.message);
    }
  });

  const postLikeMutation = useMutation({
    mutationFn: toggleForumPostLike,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
    onError: (error) => Alert.alert("Begeni guncellenemedi", error.message)
  });

  const commentLikeMutation = useMutation({
    mutationFn: toggleForumCommentLike,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] });
    },
    onError: (error) => Alert.alert("Begeni guncellenemedi", error.message)
  });

  const posts = postsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Anne toplulugu</Text>
            <Text style={typography.heading1}>Forum</Text>
            <Text style={styles.heroText}>
              Gercek profil bilgileri gizli kalir; sadece takma ad ve anonim rozet
              gorunur.
            </Text>
          </View>
          <Button
            label={composerOpen ? "Vazgec" : "Yeni gonderi"}
            variant={composerOpen ? "ghost" : "secondary"}
            onPress={() => setComposerOpen((value) => !value)}
          />
        </View>

        <View style={styles.categoryRow}>
          <Chip
            active={!selectedCategoryId}
            label="Tumu"
            onPress={() => {
              setSelectedCategoryId(undefined);
              setActivePostId(undefined);
            }}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={selectedCategoryId === category.id}
              label={`${category.icon ?? ""} ${category.name}`.trim()}
              onPress={() => {
                setSelectedCategoryId(category.id);
                setActivePostId(undefined);
              }}
            />
          ))}
        </View>

        {composerOpen ? (
          <Card style={styles.composer}>
            <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>Deneyimini paylas</Text>
              <TextField
                label="Baslik"
                value={title}
                onChangeText={setTitle}
                placeholder="Orn. 12. haftada mide bulantisi"
              />
              <TextField
                label="Icerik"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={5}
                placeholder="Sorunu, deneyimini veya destek istedigin konuyu yaz."
                style={styles.multiline}
              />
              <Button
                label={createPostMutation.isPending ? "Paylasiliyor..." : "Paylas"}
                disabled={createPostMutation.isPending}
                onPress={() => createPostMutation.mutate()}
              />
            </View>
          </Card>
        ) : null}

        {postsQuery.isLoading || categoriesQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Bu kategoride ilk sen yaz"
            description="Sorular, kucuk zaferler ve destek mesajlari burada birikir."
          />
        ) : (
          <View style={styles.layout}>
            <View style={styles.postList}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  active={activePostId === post.id}
                  post={post}
                  onPress={() => setActivePostId(post.id)}
                  onLike={() => postLikeMutation.mutate(post)}
                  disabled={postLikeMutation.isPending}
                />
              ))}
            </View>

            {activePost ? (
              <Card style={styles.detailCard}>
                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={typography.heading2}>{activePost.title}</Text>
                    <AuthorLine
                      nickname={activePost.forum_nickname}
                      badge={activePost.author_badge}
                    />
                    <Text style={styles.postContent}>{activePost.content}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <ActionButton
                      active={activePost.liked_by_current_user}
                      label={`${activePost.liked_by_current_user ? "♥" : "♡"} ${activePost.like_count}`}
                      onPress={() => postLikeMutation.mutate(activePost)}
                      disabled={postLikeMutation.isPending}
                    />
                    <Text style={styles.metaText}>{activePost.comment_count} yorum</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={typography.heading2}>Yorumlar</Text>
                  <View style={{ gap: spacing.sm }}>
                    <TextField
                      label="Yorumun"
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Destekleyici ve nazik bir yorum yaz."
                      multiline
                      style={styles.commentInput}
                    />
                    <Button
                      label={
                        createCommentMutation.isPending
                          ? "Gonderiliyor..."
                          : "Yorum gonder"
                      }
                      disabled={createCommentMutation.isPending}
                      onPress={() => createCommentMutation.mutate()}
                    />
                  </View>

                  {commentsQuery.isLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (commentsQuery.data ?? []).length === 0 ? (
                    <Text style={styles.metaText}>Henuz yorum yok.</Text>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {(commentsQuery.data ?? []).map((comment) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          onLike={() => commentLikeMutation.mutate(comment)}
                          disabled={commentLikeMutation.isPending}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Card>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

type ChipProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function Chip({ active, label, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

type PostCardProps = {
  active: boolean;
  post: PublicForumPost;
  onPress: () => void;
  onLike: () => void;
  disabled: boolean;
};

function PostCard({ active, post, onPress, onLike, disabled }: PostCardProps) {
  return (
    <Pressable onPress={onPress} style={[styles.postCard, active && styles.postCardActive]}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.postTitle}>{post.title}</Text>
          <AuthorLine nickname={post.forum_nickname} badge={post.author_badge} />
        </View>
        <Text numberOfLines={3} style={styles.previewText}>
          {post.content}
        </Text>
        <View style={styles.actionRow}>
          <ActionButton
            active={post.liked_by_current_user}
            label={`${post.liked_by_current_user ? "♥" : "♡"} ${post.like_count}`}
            onPress={onLike}
            disabled={disabled}
          />
          <Text style={styles.metaText}>{post.comment_count} yorum</Text>
        </View>
      </View>
    </Pressable>
  );
}

type CommentRowProps = {
  comment: PublicForumComment;
  onLike: () => void;
  disabled: boolean;
};

function CommentRow({ comment, onLike, disabled }: CommentRowProps) {
  return (
    <View style={styles.commentRow}>
      <View style={{ gap: spacing.xs }}>
        <AuthorLine nickname={comment.forum_nickname} badge={comment.author_badge} />
        <Text style={styles.commentText}>{comment.content}</Text>
      </View>
      <ActionButton
        active={comment.liked_by_current_user}
        label={`${comment.liked_by_current_user ? "♥" : "♡"} ${comment.like_count}`}
        onPress={onLike}
        disabled={disabled}
      />
    </View>
  );
}

function AuthorLine({ nickname, badge }: { nickname: string; badge: string }) {
  return (
    <View style={styles.authorLine}>
      <Text style={styles.nickname}>{nickname}</Text>
      <Text style={styles.badge}>{badge}</Text>
    </View>
  );
}

function ActionButton({
  active,
  label,
  onPress,
  disabled
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, active && styles.actionButtonActive]}
    >
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg
  },
  heroText: {
    ...typography.body,
    color: colors.text
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    ...typography.label,
    color: colors.textMuted
  },
  chipTextActive: {
    color: colors.surface
  },
  composer: {
    borderColor: colors.accent,
    backgroundColor: colors.surface
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: "top"
  },
  layout: {
    gap: spacing.lg
  },
  postList: {
    gap: spacing.md
  },
  postCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md
  },
  postCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#FBFFFD"
  },
  postTitle: {
    ...typography.heading2,
    fontSize: 18,
    lineHeight: 24
  },
  authorLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  nickname: {
    ...typography.label,
    color: colors.text
  },
  badge: {
    ...typography.label,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    color: colors.accent,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  previewText: {
    ...typography.body,
    color: colors.text
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  actionButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionButtonActive: {
    backgroundColor: colors.accentSoft
  },
  actionText: {
    ...typography.label,
    color: colors.textMuted
  },
  actionTextActive: {
    color: colors.accent
  },
  metaText: {
    ...typography.label,
    color: colors.textMuted
  },
  detailCard: {
    backgroundColor: colors.surface
  },
  postContent: {
    ...typography.body,
    color: colors.text
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth
  },
  commentInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  commentRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.sm,
    padding: spacing.md
  },
  commentText: {
    ...typography.body,
    color: colors.text
  }
});
