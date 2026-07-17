import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  Baby,
  CalendarHeart,
  Heart,
  HeartPulse,
  MessageCircle,
  MessageCircleHeart,
  MessagesSquare,
  ShieldCheck,
  Sparkles
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  reportForumContent,
  toggleForumCommentLike,
  toggleForumPostLike,
  type PublicForumComment,
  type PublicForumPost
} from "@/api/forum";
import { isCurrentUserFamilyFather } from "@/api/familyAccess";
import { getCurrentProfile } from "@/api/profiles";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { PremiumFeatureBoundary } from "@/features/subscription/PremiumFeatureBoundary";
import {
  blockForumNickname,
  getBlockedForumNicknames,
  unblockForumNickname
} from "@/lib/forumBlocks";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

export default function ForumScreen() {
  const appTheme = useAppTheme();
  const fatherRoleQuery = useQuery({
    queryKey: ["current-user-is-family-father"],
    queryFn: isCurrentUserFamilyFather
  });

  if (fatherRoleQuery.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.roleGateLoading}>
          <ActivityIndicator color={appTheme.primary} />
        </View>
      </Screen>
    );
  }

  if (fatherRoleQuery.isError) {
    return (
      <Screen scroll={false}>
        <EmptyState
          title="Erişim doğrulanamadı"
          description="Anne forumuna erişim bilgisi şu anda doğrulanamıyor. Lütfen bağlantını kontrol edip tekrar dene."
        />
      </Screen>
    );
  }

  if (fatherRoleQuery.data) {
    return (
      <Screen scroll={false}>
        <EmptyState
          title="Bu alan yalnızca annelere özel"
          description="Anne forumu, kadınların hassas deneyimlerini güvenle paylaşabilmesi için baba hesaplarına kapalıdır."
        />
      </Screen>
    );
  }

  return (
    <PremiumFeatureBoundary
      description="Anonim anne topluluğunda soru sormak, yorum yapmak ve güvenli forum akışına katılmak Premium ile açılır."
      featureKey="mother_forum"
      title="Anne forumu"
    >
      <ForumContent />
    </PremiumFeatureBoundary>
  );
}

function ForumContent() {
  const queryClient = useQueryClient();
  const appTheme = useAppTheme();
  const { showError, showSuccess } = useFeedback();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [activePostId, setActivePostId] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [blockedNicknames, setBlockedNicknames] = useState<string[]>([]);
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

  useEffect(() => {
    setCommentComposerOpen(false);
    setCommentText("");
  }, [activePostId]);

  useEffect(() => {
    getBlockedForumNicknames().then(setBlockedNicknames).catch(() => undefined);
  }, []);

  useEffect(() => {
    trackEvent("forum_viewed").catch(() => undefined);
  }, []);

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
        throw new Error("Gönderi oluşturmak için giriş yapmalısın.");
      }

      if (!categoryId) {
        throw new Error("Önce bir kategori seç.");
      }

      const cleanTitle = title.trim();
      const cleanContent = content.trim();

      if (cleanTitle.length < 4 || cleanContent.length < 8) {
        throw new Error("Başlık ve içerik biraz daha açık olmalı.");
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
    onError: (error) => showError(error, "Gönderi oluşturulamadı")
  });

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const profile = profileQuery.data;
      const cleanComment = commentText.trim();

      if (!profile || !activePost) {
        throw new Error("Yorum yazmak için giriş yapmalısın.");
      }

      if (cleanComment.length < 2) {
        throw new Error("Yorum çok kısa.");
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
      setCommentComposerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] }),
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] })
      ]);
    },
    onError: (error) => showError(error, "Yorum eklenemedi")
  });

  const postLikeMutation = useMutation({
    mutationFn: toggleForumPostLike,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
    onError: (error) => showError(error, "Beğeni güncellenemedi")
  });

  const commentLikeMutation = useMutation({
    mutationFn: toggleForumCommentLike,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] });
    },
    onError: (error) => showError(error, "Beğeni güncellenemedi")
  });

  const reportMutation = useMutation({
    mutationFn: async ({
      reason,
      targetId,
      targetType
    }: {
      reason: string;
      targetId: string;
      targetType: "post" | "comment";
    }) => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error("Raporlamak için giriş yapmalısın.");
      }

      return reportForumContent({
        reporter_id: profile.id,
        target_id: targetId,
        target_type: targetType,
        reason
      });
    },
    onSuccess: () => showSuccess("Raporun moderasyon kuyruğuna iletildi."),
    onError: (error) => showError(error, "Rapor gönderilemedi")
  });

  async function blockNickname(nickname: string) {
    try {
      const next = await blockForumNickname(nickname);
      setBlockedNicknames(next);
      showSuccess(`${nickname} artık forum akışında gizlenecek.`);
    } catch (error) {
      showError(error, "Kullanıcı engellenemedi");
    }
  }

  async function unblockNickname(nickname: string) {
    try {
      const next = await unblockForumNickname(nickname);
      setBlockedNicknames(next);
      showSuccess(`${nickname} engeli kaldırıldı.`);
    } catch (error) {
      showError(error, "Engel kaldırılamadı");
    }
  }

  const posts = (postsQuery.data ?? []).filter(
    (post) => !blockedNicknames.includes(post.forum_nickname)
  );
  const categories = categoriesQuery.data ?? [];
  const comments = (commentsQuery.data ?? []).filter(
    (comment) => !blockedNicknames.includes(comment.forum_nickname)
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.tint }]}>
          <View style={styles.iconBubble}>
            <MessageCircleHeart color={appTheme.primary} size={28} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Anne topluluğu</Text>
            <Text style={typography.heading1}>Forum</Text>
            <Text style={styles.heroText}>
              Gerçek profil bilgileri gizli kalır; sadece takma ad ve anonim rozet
              görünür.
            </Text>
          </View>
          <Button
            label={composerOpen ? "Vazgeç" : "Yeni gönderi"}
            variant={composerOpen ? "ghost" : "secondary"}
            onPress={() => setComposerOpen((value) => !value)}
          />
        </View>

        <View style={styles.categoryRow}>
          <Chip
            active={!selectedCategoryId}
            icon={
              <Sparkles
                color={!selectedCategoryId ? colors.surface : appTheme.primary}
                size={18}
              />
            }
            label="Tümü"
            onPress={() => {
              setSelectedCategoryId(undefined);
              setActivePostId(undefined);
            }}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={selectedCategoryId === category.id}
              icon={getCategoryIcon(
                category.name,
                category.icon,
                selectedCategoryId === category.id
                  ? colors.surface
                  : appTheme.primary
              )}
              label={category.name}
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
              <Text style={typography.heading2}>Deneyimini paylaş</Text>
              <TextField
                label="Başlık"
                value={title}
                onChangeText={setTitle}
                placeholder="Örn. 12. haftada mide bulantısı"
              />
              <TextField
                label="İçerik"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={5}
                placeholder="Sorunu, deneyimini veya destek istediğin konuyu yaz."
                style={styles.multiline}
              />
              <Button
                label={createPostMutation.isPending ? "Paylaşılıyor..." : "Paylaş"}
                disabled={createPostMutation.isPending}
                onPress={() => createPostMutation.mutate()}
              />
            </View>
          </Card>
        ) : null}

        {postsQuery.isLoading || categoriesQuery.isLoading ? (
          <ActivityIndicator color={appTheme.primary} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Bu kategoride ilk sen yaz"
            description="Sorular, küçük zaferler ve destek mesajları burada birikir."
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
                  onReport={() =>
                    reportMutation.mutate({
                      reason: "Kullanıcı tarafından uygunsuz içerik olarak raporlandı.",
                      targetId: post.id,
                      targetType: "post"
                    })
                  }
                  onBlock={() => blockNickname(post.forum_nickname)}
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
                    <LikeButton
                      active={activePost.liked_by_current_user}
                      count={activePost.like_count}
                      disabled={postLikeMutation.isPending}
                      onPress={() => postLikeMutation.mutate(activePost)}
                    />
                    <ActionButton
                      active={commentComposerOpen}
                      icon={
                        <MessageCircle
                          color={
                            commentComposerOpen ? appTheme.primary : colors.textMuted
                          }
                          size={16}
                        />
                      }
                      label="Yorum yap"
                      onPress={() => setCommentComposerOpen((value) => !value)}
                      disabled={createCommentMutation.isPending}
                    />
                    <ActionButton
                      active={false}
                      disabled={reportMutation.isPending}
                      icon={<ShieldCheck color={colors.textMuted} size={16} />}
                      label="Raporla"
                      onPress={() =>
                        reportMutation.mutate({
                          reason: "Kullanıcı tarafından uygunsuz gönderi olarak raporlandı.",
                          targetId: activePost.id,
                          targetType: "post"
                        })
                      }
                    />
                    <ActionButton
                      active={false}
                      disabled={blockedNicknames.includes(activePost.forum_nickname)}
                      icon={<ShieldCheck color={colors.textMuted} size={16} />}
                      label="Engelle"
                      onPress={() => blockNickname(activePost.forum_nickname)}
                    />
                    <Text style={styles.metaText}>{activePost.comment_count} yorum</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={typography.heading2}>Yorumlar</Text>
                  {commentComposerOpen ? (
                    <View style={styles.commentComposer}>
                      <TextField
                        label="Yorumun"
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder="Destekleyici ve nazik bir yorum yaz."
                        multiline
                        style={styles.commentInput}
                      />
                      <View style={styles.composerActions}>
                        <Button
                          label="Vazgeç"
                          variant="ghost"
                          style={styles.composerButton}
                          onPress={() => setCommentComposerOpen(false)}
                        />
                        <Button
                          label={
                            createCommentMutation.isPending
                              ? "Gönderiliyor..."
                              : "Yorum gönder"
                          }
                          disabled={createCommentMutation.isPending}
                          style={styles.composerButton}
                          onPress={() => createCommentMutation.mutate()}
                        />
                      </View>
                    </View>
                  ) : null}

                  {commentsQuery.isLoading ? (
                    <ActivityIndicator color={appTheme.primary} />
                  ) : comments.length === 0 ? (
                    <Text style={styles.metaText}>Henüz yorum yok.</Text>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {comments.map((comment) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          onLike={() => commentLikeMutation.mutate(comment)}
                          onReport={() =>
                            reportMutation.mutate({
                              reason:
                                "Kullanıcı tarafından uygunsuz yorum olarak raporlandı.",
                              targetId: comment.id,
                              targetType: "comment"
                            })
                          }
                          onBlock={() => blockNickname(comment.forum_nickname)}
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
        {blockedNicknames.length > 0 ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.heading2}>Gizlenen takma adlar</Text>
              {blockedNicknames.map((nickname) => (
                <View key={nickname} style={styles.blockedRow}>
                  <Text style={typography.label}>{nickname}</Text>
                  <Button
                    label="Engeli kaldır"
                    variant="secondary"
                    onPress={() => unblockNickname(nickname)}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

type ChipProps = {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

function Chip({ active, icon, label, onPress }: ChipProps) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        active && {
          backgroundColor: appTheme.primary,
          borderColor: appTheme.primary
        }
      ]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function getCategoryIcon(name: string, icon: string | null, color: string) {
  const key = `${name} ${icon ?? ""}`.toLocaleLowerCase("tr-TR");
  if (key.includes("hamile") || key.includes("gebelik")) {
    return <CalendarHeart color={color} size={18} />;
  }
  if (key.includes("doğum") || key.includes("bebek")) {
    return <Baby color={color} size={18} />;
  }
  if (key.includes("kayıp") || key.includes("destek")) {
    return <ShieldCheck color={color} size={18} />;
  }
  if (key.includes("sohbet") || key.includes("genel")) {
    return <MessagesSquare color={color} size={18} />;
  }
  return <HeartPulse color={color} size={18} />;
}

type PostCardProps = {
  active: boolean;
  post: PublicForumPost;
  onPress: () => void;
  onLike: () => void;
  onBlock: () => void;
  disabled: boolean;
  onReport: () => void;
};

function PostCard({
  active,
  disabled,
  onBlock,
  onLike,
  onPress,
  onReport,
  post
}: PostCardProps) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.postCard,
        active && styles.postCardActive,
        active && { backgroundColor: appTheme.tint, borderColor: appTheme.primary }
      ]}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.postTitle}>{post.title}</Text>
          <AuthorLine nickname={post.forum_nickname} badge={post.author_badge} />
        </View>
        <Text numberOfLines={3} style={styles.previewText}>
          {post.content}
        </Text>
        <View style={styles.actionRow}>
          <LikeButton
            active={post.liked_by_current_user}
            count={post.like_count}
            disabled={disabled}
            onPress={onLike}
          />
          <ActionButton
            active={false}
            disabled={disabled}
            icon={<ShieldCheck color={colors.textMuted} size={16} />}
            label="Raporla"
            onPress={onReport}
          />
          <ActionButton
            active={false}
            disabled={disabled}
            icon={<ShieldCheck color={colors.textMuted} size={16} />}
            label="Engelle"
            onPress={onBlock}
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
  onBlock: () => void;
  onReport: () => void;
  disabled: boolean;
};

function CommentRow({
  comment,
  disabled,
  onBlock,
  onLike,
  onReport
}: CommentRowProps) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentRail} />
      <View style={styles.commentContent}>
        <AuthorLine nickname={comment.forum_nickname} badge={comment.author_badge} />
        <Text style={styles.commentText}>{comment.content}</Text>
        <LikeButton
          active={comment.liked_by_current_user}
          count={comment.like_count}
          disabled={disabled}
          onPress={onLike}
        />
        <View style={styles.actionRow}>
          <ActionButton
            active={false}
            disabled={disabled}
            icon={<ShieldCheck color={colors.textMuted} size={16} />}
            label="Raporla"
            onPress={onReport}
          />
          <ActionButton
            active={false}
            disabled={disabled}
            icon={<ShieldCheck color={colors.textMuted} size={16} />}
            label="Engelle"
            onPress={onBlock}
          />
        </View>
      </View>
    </View>
  );
}

function AuthorLine({ nickname, badge }: { nickname: string; badge: string }) {
  return (
    <View style={styles.authorLine}>
      <Text style={styles.nickname}>{nickname}</Text>
      <Badge label={badge} />
    </View>
  );
}

function LikeButton({
  active,
  count,
  disabled,
  onPress
}: {
  active: boolean;
  count: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <ActionButton
      active={active}
      disabled={disabled}
      icon={
        <Heart
          color={active ? appTheme.accent : colors.textMuted}
          fill={active ? appTheme.accent : "transparent"}
          size={16}
        />
      }
      label={`${count}`}
      onPress={onPress}
    />
  );
}

function ActionButton({
  active,
  icon,
  label,
  onPress,
  disabled
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        active && styles.actionButtonActive,
        active && { backgroundColor: appTheme.accentSoft }
      ]}
    >
      {icon}
      <Text
        style={[
          styles.actionText,
          active && styles.actionTextActive,
          active && { color: appTheme.accent }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  roleGateLoading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  container: {
    gap: spacing.lg
  },
  hero: {
    backgroundColor: colors.primarySoft,
    ...radii.cardLarge,
    gap: spacing.md,
    padding: spacing.lg
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: "center",
    width: 52
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
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
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
    ...radii.card,
    borderWidth: 1,
    padding: spacing.md
  },
  postCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
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
  previewText: {
    ...typography.body,
    color: colors.text
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
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
  commentComposer: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    gap: spacing.md,
    padding: spacing.md
  },
  commentInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  composerActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  composerButton: {
    flex: 1
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  commentRail: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    width: 3
  },
  commentContent: {
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  commentText: {
    ...typography.body,
    color: colors.text
  },
  blockedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  }
});
