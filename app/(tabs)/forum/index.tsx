import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Baby,
  CalendarHeart,
  ChevronRight,
  Flag,
  Heart,
  HeartPulse,
  MessageCircle,
  MessageCircleHeart,
  MessagesSquare,
  LockKeyhole,
  Pin,
  Plus,
  Reply,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserX
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  blockForumAuthor,
  createForumComment,
  createForumPost,
  listBlockedForumUsers,
  listForumCategories,
  listPublicForumComments,
  listPublicForumPosts,
  isForumModerator,
  moderateForumTopic,
  reportForumContent,
  subscribeToForumConversation,
  toggleForumCommentLike,
  toggleForumPostLike,
  unblockForumAuthor,
  type BlockedForumUser,
  type ForumPostKind,
  type PublicForumComment,
  type PublicForumPost
} from "@/api/forum";
import { isCurrentUserFamilyFather } from "@/api/familyAccess";
import { getCurrentProfile } from "@/api/profiles";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CommunityAgreementGate } from "@/components/CommunityAgreementGate";
import { EmptyState } from "@/components/EmptyState";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { ForumReportDialog } from "@/features/forum/ForumReportDialog";
import { openLegalPage } from "@/config/legal";
import {
  acceptForumAgreement,
  hasAcceptedForumAgreement
} from "@/lib/legalAcceptance";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
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
        <QueryState loading description="Topluluk ipliği hazırlanıyor…" shape="forum" />
      </Screen>
    );
  }

  if (fatherRoleQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          title="Erişim doğrulanamadı"
          description="Anne forumuna erişim bilgisi doğrulanamadı. Bağlantını kontrol et ve yeniden dene."
          onRetry={() => void fatherRoleQuery.refetch()}
          retrying={fatherRoleQuery.isFetching}
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
    <ForumAgreementBoundary>
      <ForumContent />
    </ForumAgreementBoundary>
  );
}

function ForumAgreementBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const agreementQuery = useQuery({
    queryKey: ["forum-community-agreement"],
    queryFn: async () => {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) throw new Error("Topluluğa girmek için oturum açmalısın.");

      return {
        accepted: await hasAcceptedForumAgreement(user.id),
        userId: user.id
      };
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!agreementQuery.data?.userId) {
        throw new Error("Topluluk onayı için oturum bilgisi bulunamadı.");
      }

      await acceptForumAgreement(agreementQuery.data.userId);
    },
    onSuccess: () => {
      queryClient.setQueryData(["forum-community-agreement"], {
        accepted: true,
        userId: agreementQuery.data?.userId
      });
      showSuccess(
        "Topluluk kuralları bu hesap için kaydedildi.",
        "Foruma hoş geldin"
      );
    },
    onError: (error) => showError(error, "Topluluk onayı kaydedilemedi")
  });

  if (agreementQuery.isPending) {
    return (
      <Screen scroll={false}>
        <QueryState
          loading
          description="Topluluk kuralları hazırlanıyor…"
          shape="forum"
        />
      </Screen>
    );
  }

  if (agreementQuery.isError) {
    return (
      <Screen scroll={false}>
        <QueryState
          description="Topluluk onayı doğrulanamadı. Bağlantını kontrol et ve yeniden dene."
          onRetry={() => void agreementQuery.refetch()}
          retrying={agreementQuery.isFetching}
          title="Topluluk açılamadı"
        />
      </Screen>
    );
  }

  if (!agreementQuery.data.accepted) {
    return (
      <>
        <Screen scroll={false}>
          <View style={styles.agreementPreview}>
            <ShieldCheck color={colors.primary} size={32} />
            <Text style={typography.heading1}>Güvenli bir topluluk</Text>
            <Text style={styles.agreementPreviewText}>
              Üç kısa ortak kuralı kabul ettiğinde forum açılacak.
            </Text>
          </View>
        </Screen>
        <CommunityAgreementGate
          busy={acceptMutation.isPending}
          onAccept={() => acceptMutation.mutate()}
          onDecline={() => router.replace("/home")}
          visible
        />
      </>
    );
  }

  return children;
}

function ForumContent() {
  const queryClient = useQueryClient();
  const appTheme = useAppTheme();
  const { showError, showSuccess } = useFeedback();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [activePostId, setActivePostId] = useState<string>();
  const [surfaceMode, setSurfaceMode] = useState<ForumPostKind>("feed");
  const [feedMode, setFeedMode] = useState<"feed" | "mine">("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedForumUser[]>([]);
  const [optimisticallyBlockedNicknames, setOptimisticallyBlockedNicknames] =
    useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<PublicForumComment>();
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    label: string;
    type: "post" | "comment";
  }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [postSubmitAttempted, setPostSubmitAttempted] = useState(false);
  const [commentSubmitAttempted, setCommentSubmitAttempted] = useState(false);
  const [postLimit, setPostLimit] = useState(20);
  const [commentLimit, setCommentLimit] = useState(30);

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const categoriesQuery = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories
  });

  const moderatorQuery = useQuery({
    queryKey: ["forum-moderator"],
    queryFn: isForumModerator
  });

  const postsQuery = useQuery({
    queryKey: ["forum-posts", surfaceMode, selectedCategoryId, postLimit],
    queryFn: () =>
      listPublicForumPosts(selectedCategoryId, postLimit, surfaceMode)
  });

  const activePost = useMemo(
    () => postsQuery.data?.find((post) => post.id === activePostId) ?? null,
    [activePostId, postsQuery.data]
  );

  useEffect(() => {
    setCommentComposerOpen(Boolean(activePostId));
    setCommentText("");
    setReplyingTo(undefined);
  }, [activePostId]);

  useEffect(() => {
    setPostLimit(20);
    setActivePostId(undefined);
  }, [selectedCategoryId, surfaceMode]);

  useEffect(() => {
    listBlockedForumUsers().then(setBlockedUsers).catch(() => undefined);
  }, []);

  useEffect(() => {
    trackEvent("forum_viewed").catch(() => undefined);
  }, []);

  const commentsQuery = useQuery({
    queryKey: ["forum-comments", activePostId, commentLimit],
    queryFn: () => listPublicForumComments(activePostId as string, commentLimit),
    enabled: Boolean(activePostId)
  });

  useEffect(() => {
    if (!activePostId) return;
    return subscribeToForumConversation(activePostId, () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] }),
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] })
      ]);
    });
  }, [activePostId, queryClient]);

  useEffect(() => {
    setCommentLimit(30);
  }, [activePostId]);

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
        content: cleanContent,
        post_kind: surfaceMode
      });
    },
    onSuccess: async (post) => {
      setTitle("");
      setContent("");
      setComposerOpen(false);
      setPostSubmitAttempted(false);
      setActivePostId(post.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      showSuccess(
        surfaceMode === "topic"
          ? "Başlığın konu listesine eklendi."
          : "Paylaşımın topluluk ipliğine eklendi.",
        surfaceMode === "topic" ? "Başlık açıldı" : "Paylaşıldı"
      );
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
        content: cleanComment,
        parent_comment_id: replyingTo?.id ?? null
      });
    },
    onSuccess: async () => {
      setCommentText("");
      setReplyingTo(undefined);
      setCommentSubmitAttempted(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-comments", activePostId] }),
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] })
      ]);
      showSuccess(
        surfaceMode === "topic" ? "Yanıtın konuya eklendi." : "Yorumun konuşmaya eklendi.",
        "Paylaşıldı"
      );
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
    onSuccess: async () => {
      setReportTarget(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["forum-comments"] })
      ]);
      showSuccess(
        "Rapor moderasyon kuyruğuna eklendi. Tek bir rapor içeriği silmez veya otomatik kaldırmaz.",
        "Rapor alındı"
      );
    },
    onError: (error) => showError(error, "Rapor gönderilemedi")
  });

  const topicModerationMutation = useMutation({
    mutationFn: ({
      isLocked,
      isPinned,
      postId
    }: {
      isLocked: boolean;
      isPinned: boolean;
      postId: string;
    }) => moderateForumTopic(postId, isPinned, isLocked),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      showSuccess("Konu ayarları güncellendi.");
    },
    onError: (error) => showError(error, "Konu ayarları güncellenemedi")
  });

  async function blockAuthor(
    nickname: string,
    targetType: "post" | "comment",
    targetId: string
  ) {
    setOptimisticallyBlockedNicknames((current) =>
      current.includes(nickname) ? current : [...current, nickname]
    );
    setActivePostId(undefined);

    try {
      await blockForumAuthor(targetType, targetId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["forum-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["forum-comments"] })
      ]);
      const next = await listBlockedForumUsers().catch(() => blockedUsers);
      setBlockedUsers(next);
      showSuccess(
        `${nickname} ve paylaşımları artık forum akışında görünmeyecek.`,
        "Kullanıcı engellendi"
      );
    } catch (error) {
      setOptimisticallyBlockedNicknames((current) =>
        current.filter((value) => value !== nickname)
      );
      showError(error, "Kullanıcı engellenemedi");
    }
  }

  async function unblockUser(blockedUser: BlockedForumUser) {
    try {
      await unblockForumAuthor(blockedUser.blocked_user_id);
      setBlockedUsers((current) =>
        current.filter(
          (item) => item.blocked_user_id !== blockedUser.blocked_user_id
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      showSuccess(`${blockedUser.forum_nickname} için engel kaldırıldı.`);
    } catch (error) {
      showError(error, "Engel kaldırılamadı");
    }
  }

  const blockedNicknames = Array.from(
    new Set([
      ...blockedUsers.map((blockedUser) => blockedUser.forum_nickname),
      ...optimisticallyBlockedNicknames
    ])
  );
  const rawPosts = postsQuery.data ?? [];
  const hasMorePosts = rawPosts.length > postLimit;
  const posts = rawPosts.slice(0, postLimit).filter(
    (post) => !blockedNicknames.includes(post.forum_nickname)
  );
  const visiblePosts = feedMode === "mine"
    ? posts.filter((post) => post.authored_by_current_user)
    : posts;
  const categories = categoriesQuery.data ?? [];
  const rawComments = commentsQuery.data ?? [];
  const hasMoreComments = rawComments.length > commentLimit;
  const comments = rawComments.slice(0, commentLimit).filter(
    (comment) => !blockedNicknames.includes(comment.forum_nickname)
  );
  const conversationRows = buildConversationRows(comments);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: appTheme.tint }]}>
          <View style={styles.heroTop}>
            <View style={styles.iconBubble}>
              <MessageCircleHeart color={appTheme.primary} size={28} />
            </View>
            <View style={styles.privatePill}>
              <ShieldCheck color={appTheme.primary} size={16} />
              <Text style={[styles.privatePillText, { color: appTheme.primary }]}>Anonim & güvenli</Text>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={typography.eyebrow}>Anne topluluğu</Text>
            <Text style={typography.heading1}>Birlikte daha güçlüyüz</Text>
            <Text style={styles.heroText}>
              Sor, paylaş, yalnız olmadığını hisset.
            </Text>
            <Pressable
              accessibilityLabel="Topluluk kurallarını aç"
              accessibilityRole="link"
              onPress={() => {
                openLegalPage("terms").catch((error) =>
                  showError(error, "Topluluk kuralları açılamadı")
                );
              }}
              style={styles.communityRulesLink}
            >
              <Text
                style={[
                  styles.communityRulesLinkText,
                  { color: appTheme.primary }
                ]}
              >
                Topluluk kurallarını gör
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setComposerOpen((value) => !value)}
            style={({ pressed }) => [styles.sharePrompt, pressed && styles.pressed]}
          >
            <View style={[styles.avatar, { backgroundColor: appTheme.theme.primarySoft }]}>
              <UserRound color={appTheme.primary} size={21} />
            </View>
            <Text style={styles.sharePromptText}>
              {composerOpen
                ? surfaceMode === "topic" ? "Başlık açmaktan vazgeç" : "Paylaşmaktan vazgeç"
                : surfaceMode === "topic" ? "Yeni bir tartışma başlat" : "Bugün ne paylaşmak istersin?"}
            </Text>
            <View style={[styles.promptAction, { backgroundColor: appTheme.primary }]}>
              <Plus color={colors.onPrimary} size={20} />
            </View>
          </Pressable>
        </View>

        <View style={styles.feedTabs} accessibilityRole="tablist">
          <FeedTab
            active={surfaceMode === "feed"}
            label="Akış"
            onPress={() => {
              setSurfaceMode("feed");
              setComposerOpen(false);
            }}
          />
          <FeedTab
            active={surfaceMode === "topic"}
            label="Konular"
            onPress={() => {
              setSurfaceMode("topic");
              setComposerOpen(false);
            }}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterCopy}>
            <Text style={styles.filterTitle}>
              {surfaceMode === "topic" ? "Başlıklar altında derinleş" : "Gündelik akışta yanında ol"}
            </Text>
            <Text style={styles.filterHint}>
              {surfaceMode === "topic"
                ? "Son yanıt alan konular üste gelir"
                : "En yeni paylaşımlar önce görünür"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={feedMode === "mine" ? "Tüm içerikleri göster" : "Yalnız paylaşımlarımı göster"}
            accessibilityRole="button"
            accessibilityState={{ selected: feedMode === "mine" }}
            onPress={() => setFeedMode((current) => current === "mine" ? "feed" : "mine")}
            style={[
              styles.mineFilter,
              feedMode === "mine" && { backgroundColor: appTheme.primary }
            ]}
          >
            <UserRound color={feedMode === "mine" ? colors.onPrimary : appTheme.primary} size={16} />
            <Text style={[styles.mineFilterText, feedMode === "mine" && { color: colors.onPrimary }]}>
              Benimkiler
            </Text>
          </Pressable>
        </View>

        {moderatorQuery.data ? (
          <Pressable
            accessibilityHint="Bekleyen raporları ve kullanıcı işlemlerini açar"
            accessibilityRole="button"
            onPress={() => router.push("/forum/moderation")}
            style={({ pressed }) => [styles.moderationLink, pressed && styles.pressed]}
          >
            <Settings2 color={appTheme.primary} size={20} />
            <View style={styles.moderationLinkCopy}>
              <Text style={styles.moderationLinkTitle}>Moderasyon merkezi</Text>
              <Text style={styles.moderationLinkText}>Rapor kuyruğu ve hesap işlemleri</Text>
            </View>
            <ChevronRight color={colors.textMuted} size={20} />
          </Pressable>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
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
        </ScrollView>

        {composerOpen ? (
          <Card style={styles.composer}>
            <View style={{ gap: spacing.md }}>
              <Text style={typography.heading2}>
                {surfaceMode === "topic" ? "Yeni bir başlık aç" : "Deneyimini paylaş"}
              </Text>
              <Text style={styles.composerHint}>
                {surfaceMode === "topic"
                  ? "Başlığı tek bir soruya veya tartışmaya odakla; yanıtlar aynı konuşma altında toplansın."
                  : "Kısa bir soru, deneyim veya destek notu paylaş."}
              </Text>
              <TextField
                error={
                  postSubmitAttempted && title.trim().length < 4
                    ? "Başlık en az 4 karakter olmalı."
                    : undefined
                }
                label="Başlık"
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                placeholder={
                  surfaceMode === "topic"
                    ? "Örn. Hastane çantasında gerçekten neler gerekli?"
                    : "Örn. 12. haftada mide bulantısı"
                }
              />
              <TextField
                error={
                  postSubmitAttempted && content.trim().length < 8
                    ? "İçerik en az 8 karakter olmalı."
                    : undefined
                }
                label="İçerik"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={4000}
                numberOfLines={5}
                placeholder={
                  surfaceMode === "topic"
                    ? "Konuyu açan soruyu ve yararlı bağlamı yaz."
                    : "Sorunu, deneyimini veya destek istediğin konuyu yaz."
                }
                style={styles.multiline}
              />
              <Button
                label={
                  createPostMutation.isPending
                    ? surfaceMode === "topic" ? "Başlık açılıyor…" : "Paylaşılıyor…"
                    : surfaceMode === "topic" ? "Başlığı aç" : "Paylaş"
                }
                disabled={createPostMutation.isPending}
                onPress={() => {
                  setPostSubmitAttempted(true);
                  createPostMutation.mutate();
                }}
              />
            </View>
          </Card>
        ) : null}

        {postsQuery.isLoading || categoriesQuery.isLoading ? (
          <QueryState compact loading description="Topluluk ipliği hazırlanıyor…" shape="forum" />
        ) : postsQuery.isError || categoriesQuery.isError ? (
          <QueryState
            description="Forum akışı alınamadı. Bağlantını kontrol et ve yeniden dene."
            onRetry={() => {
              void Promise.all([postsQuery.refetch(), categoriesQuery.refetch()]);
            }}
            retrying={postsQuery.isFetching || categoriesQuery.isFetching}
            title="Forum yüklenemedi"
          />
        ) : visiblePosts.length === 0 ? (
          <EmptyState
            actionLabel={surfaceMode === "topic" ? "Başlık aç" : "Paylaşım yaz"}
            title={
              feedMode === "mine"
                ? surfaceMode === "topic" ? "Henüz bir başlık açmadın" : "İlk paylaşımını ipliğe ekle"
                : surfaceMode === "topic" ? "İlk tartışmayı sen başlat" : "İlk notu sen paylaş"
            }
            description={
              surfaceMode === "topic"
                ? "Net bir başlık aç; yanıtlar aynı konuşma altında düzenli biçimde biriksin."
                : "Sorunu, deneyimini veya küçük bir zaferini toplulukla paylaş."
            }
            onActionPress={() => setComposerOpen(true)}
          />
        ) : (
          <View style={styles.layout}>
            {activePost ? (
              <Card style={styles.detailCard}>
                <View style={{ gap: spacing.md }}>
                  <Pressable accessibilityRole="button" onPress={() => setActivePostId(undefined)} style={({ pressed }) => [styles.backToFeed, pressed && styles.pressed]}>
                    <ArrowLeft color={appTheme.primary} size={20} />
                    <Text style={[styles.backToFeedText, { color: appTheme.primary }]}>
                      {surfaceMode === "topic" ? "Konulara dön" : "Akışa dön"}
                    </Text>
                  </Pressable>
                  <View style={{ gap: spacing.xs }}>
                    {activePost.post_kind === "topic" ? (
                      <View style={styles.topicStateRow}>
                        {activePost.is_pinned ? (
                          <View style={[styles.topicStateBadge, { backgroundColor: appTheme.accentSoft }]}>
                            <Pin color={appTheme.accent} size={14} />
                            <Text style={[styles.topicStateText, { color: appTheme.accent }]}>Sabit konu</Text>
                          </View>
                        ) : null}
                        {activePost.is_locked ? (
                          <View style={styles.topicStateBadge}>
                            <LockKeyhole color={colors.textMuted} size={14} />
                            <Text style={styles.topicStateText}>Yanıtlara kapalı</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <AuthorLine
                      nickname={activePost.forum_nickname}
                      badge={activePost.author_badge}
                      createdAt={activePost.created_at}
                    />
                    <Text style={typography.heading2}>{activePost.title}</Text>
                    <Text style={styles.postContent}>{activePost.content}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <LikeButton
                      active={activePost.liked_by_current_user}
                      count={activePost.like_count}
                      disabled={postLikeMutation.isPending}
                      onPress={() => postLikeMutation.mutate(activePost)}
                    />
                    <View style={styles.commentCountPill}>
                      <MessageCircle color={colors.textMuted} size={17} />
                      <Text style={styles.metaText}>{activePost.comment_count} yorum</Text>
                    </View>
                    {!activePost.authored_by_current_user ? (
                      <>
                        <ActionButton
                          active={false}
                          disabled={reportMutation.isPending}
                          icon={<Flag color={colors.textMuted} size={16} />}
                          label="Raporla"
                          onPress={() => setReportTarget({
                            id: activePost.id,
                            label: activePost.title,
                            type: "post"
                          })}
                        />
                        <ActionButton
                          active={false}
                          disabled={blockedNicknames.includes(activePost.forum_nickname)}
                          icon={<UserX color={colors.textMuted} size={16} />}
                          label="Engelle"
                          onPress={() =>
                            blockAuthor(
                              activePost.forum_nickname,
                              "post",
                              activePost.id
                            )
                          }
                        />
                      </>
                    ) : null}
                  </View>

                  {moderatorQuery.data && activePost.post_kind === "topic" ? (
                    <View style={styles.topicModeratorBar}>
                      <Text style={styles.topicModeratorLabel}>Moderatör konu ayarları</Text>
                      <View style={styles.actionRow}>
                        <ActionButton
                          active={activePost.is_pinned}
                          disabled={topicModerationMutation.isPending}
                          icon={<Pin color={activePost.is_pinned ? appTheme.accent : colors.textMuted} size={16} />}
                          label={activePost.is_pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                          onPress={() => topicModerationMutation.mutate({
                            isLocked: activePost.is_locked,
                            isPinned: !activePost.is_pinned,
                            postId: activePost.id
                          })}
                        />
                        <ActionButton
                          active={activePost.is_locked}
                          disabled={topicModerationMutation.isPending}
                          icon={<LockKeyhole color={activePost.is_locked ? appTheme.accent : colors.textMuted} size={16} />}
                          label={activePost.is_locked ? "Yanıtları aç" : "Yanıtları kapat"}
                          onPress={() => topicModerationMutation.mutate({
                            isLocked: !activePost.is_locked,
                            isPinned: activePost.is_pinned,
                            postId: activePost.id
                          })}
                        />
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.divider} />

                  <Text style={typography.heading2}>
                    {surfaceMode === "topic" ? "Konuya yanıt ver" : "Sohbete katıl"}
                  </Text>
                  {activePost.is_locked && !moderatorQuery.data ? (
                    <View style={styles.lockedNotice}>
                      <LockKeyhole color={colors.textMuted} size={20} />
                      <Text style={styles.lockedNoticeText}>
                        Bu konu moderatör tarafından yeni yanıtlara kapatıldı. Mevcut konuşmayı okumaya devam edebilirsin.
                      </Text>
                    </View>
                  ) : commentComposerOpen ? (
                    <View style={styles.commentComposer}>
                      {replyingTo ? (
                        <View style={styles.replyContext}>
                          <Reply color={appTheme.primary} size={17} />
                          <Text numberOfLines={1} style={styles.replyContextText}>
                            {replyingTo.forum_nickname} adlı kullanıcıya yanıt veriyorsun
                          </Text>
                          <Pressable
                            accessibilityLabel="Yanıttan vazgeç"
                            accessibilityRole="button"
                            onPress={() => setReplyingTo(undefined)}
                            style={styles.replyCancel}
                          >
                            <Text style={[styles.replyCancelText, { color: appTheme.primary }]}>Vazgeç</Text>
                          </Pressable>
                        </View>
                      ) : null}
                      <TextField
                        error={
                          commentSubmitAttempted && commentText.trim().length < 2
                            ? "Yorum en az 2 karakter olmalı."
                            : undefined
                        }
                        label="Yorumun"
                        value={commentText}
                        onChangeText={setCommentText}
                        maxLength={2000}
                        placeholder={
                          surfaceMode === "topic"
                            ? "Konuyu ilerleten açık ve nazik bir yanıt yaz."
                            : "Destekleyici ve nazik bir yorum yaz."
                        }
                        multiline
                        style={styles.commentInput}
                      />
                      <View style={styles.composerActions}>
                        <Button
                          label={
                            createCommentMutation.isPending
                              ? "Gönderiliyor…"
                              : replyingTo ? "Yanıtı gönder" : surfaceMode === "topic" ? "Konuya yanıt ver" : "Yorum gönder"
                          }
                          disabled={createCommentMutation.isPending}
                          style={styles.sendCommentButton}
                          onPress={() => {
                            setCommentSubmitAttempted(true);
                            createCommentMutation.mutate();
                          }}
                        />
                      </View>
                    </View>
                  ) : null}

                  {commentsQuery.isLoading ? (
                    <QueryState compact loading description="Konuşma ipliği hazırlanıyor…" shape="forum" />
                  ) : commentsQuery.isError ? (
                    <QueryState
                      compact
                      description="Yorumlar alınamadı. Bağlantını kontrol et ve yeniden dene."
                      onRetry={() => void commentsQuery.refetch()}
                      retrying={commentsQuery.isFetching}
                    />
                  ) : comments.length === 0 ? (
                    <Text style={styles.metaText}>
                      İlk destek mesajını yaz; bu konuşmanın yeni düğümü olsun.
                    </Text>
                  ) : (
                    <>
                      <View style={{ gap: spacing.sm }}>
                        {conversationRows.map(({ comment, depth, parentNickname }) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          depth={surfaceMode === "topic" ? depth : 0}
                          parentNickname={surfaceMode === "topic" ? parentNickname : undefined}
                          onLike={() => commentLikeMutation.mutate(comment)}
                          onReply={surfaceMode === "topic" ? () => {
                            setReplyingTo(comment);
                            setCommentComposerOpen(true);
                          } : undefined}
                          onReport={() => setReportTarget({
                            id: comment.id,
                            label: `${comment.forum_nickname} kullanıcısının yanıtı`,
                            type: "comment"
                          })}
                          onBlock={() =>
                            blockAuthor(
                              comment.forum_nickname,
                              "comment",
                              comment.id
                            )
                          }
                          disabled={commentLikeMutation.isPending}
                        />
                        ))}
                      </View>
                      {hasMoreComments ? (
                        <Button
                          label="Daha eski yorumları göster"
                          variant="secondary"
                          onPress={() => setCommentLimit((value) => value + 30)}
                        />
                      ) : null}
                    </>
                  )}
                </View>
              </Card>
            ) : (
              <>
                <View style={styles.feedHeading}>
                  <View>
                    <Text style={typography.heading2}>
                      {feedMode === "mine"
                        ? surfaceMode === "topic" ? "Açtığın başlıklar" : "Paylaşımların"
                        : surfaceMode === "topic" ? "Tüm tartışmalar" : "Topluluk akışı"}
                    </Text>
                    <Text style={styles.feedHint}>
                      {visiblePosts.length} {surfaceMode === "topic" ? "konu" : "paylaşım"} gösteriliyor
                    </Text>
                  </View>
                  <MessagesSquare color={appTheme.primary} size={24} />
                </View>
                <View style={styles.postList}>
                  {visiblePosts.map((post) =>
                    surfaceMode === "topic" ? (
                      <TopicCard
                        categoryLabel={categories.find((category) => category.id === post.category_id)?.name}
                        key={post.id}
                        post={post}
                        onPress={() => setActivePostId(post.id)}
                      />
                    ) : (
                      <PostCard
                        key={post.id}
                        post={post}
                        onPress={() => setActivePostId(post.id)}
                        onComment={() => setActivePostId(post.id)}
                        onLike={() => postLikeMutation.mutate(post)}
                        onReport={() => setReportTarget({
                          id: post.id,
                          label: post.title,
                          type: "post"
                        })}
                        onBlock={() =>
                          blockAuthor(post.forum_nickname, "post", post.id)
                        }
                        disabled={postLikeMutation.isPending}
                      />
                    )
                  )}
                </View>
                {hasMorePosts ? (
                  <Button
                    label={surfaceMode === "topic" ? "Daha fazla konu göster" : "Daha eski paylaşımları göster"}
                    variant="secondary"
                    onPress={() => setPostLimit((value) => value + 20)}
                  />
                ) : null}
              </>
            )}
          </View>
        )}
        {blockedUsers.length > 0 ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.heading2}>Engellediğin kullanıcılar</Text>
              {blockedUsers.map((blockedUser) => (
                <View key={blockedUser.blocked_user_id} style={styles.blockedRow}>
                  <Text style={typography.label}>
                    {blockedUser.forum_nickname}
                  </Text>
                  <Button
                    label="Engeli kaldır"
                    variant="secondary"
                    onPress={() => unblockUser(blockedUser)}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : null}
        <ForumReportDialog
          busy={reportMutation.isPending}
          onClose={() => {
            if (!reportMutation.isPending) setReportTarget(undefined);
          }}
          onSubmit={(reason) => {
            if (!reportTarget) return;
            reportMutation.mutate({
              reason,
              targetId: reportTarget.id,
              targetType: reportTarget.type
            });
          }}
          targetLabel={reportTarget?.label}
          visible={Boolean(reportTarget)}
        />
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
      accessibilityState={{ selected: active }}
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
  post: PublicForumPost;
  onPress: () => void;
  onComment: () => void;
  onBlock: () => void;
  onLike: () => void;
  disabled: boolean;
  onReport: () => void;
};

function TopicCard({
  categoryLabel,
  onPress,
  post
}: {
  categoryLabel?: string;
  onPress: () => void;
  post: PublicForumPost;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityHint="Başlığı ve tüm yanıtları açar"
      accessibilityLabel={`${post.title}, ${post.comment_count} yanıt`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
    >
      <View style={styles.topicRail} pointerEvents="none">
        <View style={[styles.topicRailLine, { backgroundColor: appTheme.primary }]} />
        <View style={[styles.topicRailKnot, { borderColor: appTheme.primary }]} />
      </View>
      <View style={styles.topicBody}>
        <View style={styles.topicMetaRow}>
          <View style={styles.topicLabels}>
            {post.is_pinned ? (
              <View style={[styles.topicStateBadge, { backgroundColor: appTheme.accentSoft }]}>
                <Pin color={appTheme.accent} size={13} />
                <Text style={[styles.topicStateText, { color: appTheme.accent }]}>Sabit</Text>
              </View>
            ) : null}
            {categoryLabel ? (
              <Text style={[styles.topicCategory, { color: appTheme.primary }]}>{categoryLabel}</Text>
            ) : null}
          </View>
          {post.is_locked ? <LockKeyhole color={colors.textMuted} size={17} /> : null}
        </View>

        <Text numberOfLines={3} style={styles.topicTitle}>{post.title}</Text>
        <Text numberOfLines={2} style={styles.topicPreview}>{post.content}</Text>

        <View style={styles.topicFooter}>
          <View style={styles.topicAuthorGroup}>
            <Text numberOfLines={1} style={styles.topicAuthor}>{post.forum_nickname}</Text>
            <Text style={styles.topicTime}>{formatForumTime(post.last_activity_at)}</Text>
          </View>
          <View style={[styles.replyCount, { backgroundColor: appTheme.theme.primarySoft }]}>
            <MessageCircle color={appTheme.primary} size={16} />
            <Text style={[styles.replyCountText, { color: appTheme.primary }]}>{post.comment_count}</Text>
          </View>
        </View>
        {post.last_reply_nickname ? (
          <Text numberOfLines={1} style={styles.lastReplyText}>
            Son yanıt: {post.last_reply_nickname}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  );
}

function PostCard({
  disabled,
  onBlock,
  onComment,
  onLike,
  onPress,
  onReport,
  post
}: PostCardProps) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.threadPostRow}>
      <View style={styles.postThreadColumn} pointerEvents="none">
        <View style={[styles.postThreadRail, { backgroundColor: appTheme.primary }]} />
        <View style={[styles.postThreadBranch, { backgroundColor: appTheme.primary }]} />
        <View style={[styles.postThreadKnot, { borderColor: appTheme.primary }]} />
      </View>
      <View style={styles.postCard}>
        <View style={{ gap: spacing.md }}>
          <Pressable
            accessibilityHint="Paylaşımı ve yorumlarını açar"
            accessibilityLabel={`${post.forum_nickname} tarafından paylaşılan ${post.title}`}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.postMain, pressed && styles.pressed]}
          >
            <AuthorLine nickname={post.forum_nickname} badge={post.author_badge} createdAt={post.created_at} />
            <View style={styles.postCopy}>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text numberOfLines={4} style={styles.previewText}>{post.content}</Text>
            </View>
          </Pressable>
          <View style={styles.feedActionRow}>
            <LikeButton
              active={post.liked_by_current_user}
              count={post.like_count}
              disabled={disabled}
              onPress={onLike}
            />
            <ActionButton
              accessibilityLabel={`${post.title} paylaşımında ${post.comment_count} yorum`}
              active={false}
              disabled={disabled}
              icon={<MessageCircle color={colors.textMuted} size={17} />}
              label={`${post.comment_count} yorum`}
              onPress={onComment}
            />
            {!post.authored_by_current_user ? (
              <>
                <ActionButton
                  active={false}
                  disabled={disabled}
                  icon={<Flag color={colors.textMuted} size={16} />}
                  label="Raporla"
                  onPress={onReport}
                />
                <ActionButton
                  active={false}
                  disabled={disabled}
                  icon={<UserX color={colors.textMuted} size={16} />}
                  label="Engelle"
                  onPress={onBlock}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

type CommentRowProps = {
  comment: PublicForumComment;
  depth: number;
  parentNickname?: string;
  onLike: () => void;
  onBlock: () => void;
  onReply?: () => void;
  onReport: () => void;
  disabled: boolean;
};

function CommentRow({
  comment,
  depth,
  disabled,
  onBlock,
  onLike,
  onReply,
  onReport,
  parentNickname
}: CommentRowProps) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.commentRow, depth > 0 && { marginLeft: Math.min(depth, 2) * 22 }]}>
      <View style={styles.commentThread} pointerEvents="none">
        <View style={[styles.commentRail, { backgroundColor: appTheme.primary }]} />
        <View style={[styles.commentKnot, { borderColor: appTheme.primary }]} />
      </View>
      <View style={styles.commentContent}>
        <AuthorLine nickname={comment.forum_nickname} badge={comment.author_badge} createdAt={comment.created_at} />
        {parentNickname ? (
          <View style={styles.replyingLabel}>
            <AtSign color={appTheme.primary} size={14} />
            <Text style={[styles.replyingLabelText, { color: appTheme.primary }]}>
              {parentNickname} kullanıcısına yanıt
            </Text>
          </View>
        ) : null}
        <Text style={styles.commentText}>{comment.content}</Text>
        <LikeButton
          active={comment.liked_by_current_user}
          count={comment.like_count}
          disabled={disabled}
          onPress={onLike}
        />
        <View style={styles.actionRow}>
          {onReply ? (
            <ActionButton
              active={false}
              disabled={disabled}
              icon={<Reply color={colors.textMuted} size={16} />}
              label="Yanıtla"
              onPress={onReply}
            />
          ) : null}
          {!comment.authored_by_current_user ? (
            <>
              <ActionButton
                active={false}
                disabled={disabled}
                icon={<Flag color={colors.textMuted} size={16} />}
                label="Raporla"
                onPress={onReport}
              />
              <ActionButton
                active={false}
                disabled={disabled}
                icon={<UserX color={colors.textMuted} size={16} />}
                label="Engelle"
                onPress={onBlock}
              />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AuthorLine({ nickname, badge, createdAt }: { nickname: string; badge: string; createdAt?: string }) {
  const appTheme = useAppTheme();
  return (
    <View style={styles.authorLine}>
      <View style={[styles.authorAvatar, { backgroundColor: appTheme.theme.primarySoft }]}>
        <Text style={[styles.authorAvatarText, { color: appTheme.primary }]}>{nickname.trim().charAt(0).toLocaleUpperCase("tr-TR") || "A"}</Text>
      </View>
      <View style={styles.authorCopy}>
        <View style={styles.authorNameRow}>
          <Text numberOfLines={1} style={styles.nickname}>{nickname}</Text>
          <Badge label={badge} />
        </View>
        {createdAt ? <Text style={styles.postTime}>{formatForumTime(createdAt)}</Text> : null}
      </View>
    </View>
  );
}

function FeedTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const appTheme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.feedTab,
        active && { backgroundColor: appTheme.primary },
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.feedTabText, active && styles.feedTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function buildConversationRows(comments: PublicForumComment[]) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const children = new Map<string, PublicForumComment[]>();
  const roots: PublicForumComment[] = [];

  for (const comment of comments) {
    if (comment.parent_comment_id && byId.has(comment.parent_comment_id)) {
      const siblings = children.get(comment.parent_comment_id) ?? [];
      siblings.push(comment);
      children.set(comment.parent_comment_id, siblings);
    } else {
      roots.push(comment);
    }
  }

  const rows: Array<{
    comment: PublicForumComment;
    depth: number;
    parentNickname?: string;
  }> = [];
  const visited = new Set<string>();

  function append(comment: PublicForumComment, depth: number, parentNickname?: string) {
    if (visited.has(comment.id)) return;
    visited.add(comment.id);
    rows.push({ comment, depth: Math.min(depth, 2), parentNickname });
    for (const child of children.get(comment.id) ?? []) {
      append(child, depth + 1, comment.forum_nickname);
    }
  }

  for (const root of roots) append(root, 0);
  for (const comment of comments) append(comment, 0);
  return rows;
}

function formatForumTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} gün önce` : new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(value));
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
      accessibilityLabel={`${active ? "Beğeniyi kaldır" : "Beğen"}, ${count} beğeni`}
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
  accessibilityLabel,
  active,
  icon,
  label,
  onPress,
  disabled
}: {
  accessibilityLabel?: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
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
  agreementPreview: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    ...radii.cardLarge,
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 280,
    padding: spacing.xl
  },
  agreementPreviewText: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 320,
    textAlign: "center"
  },
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
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  communityRulesLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingRight: spacing.md
  },
  communityRulesLinkText: {
    ...typography.label,
    fontSize: 13,
    textDecorationLine: "underline"
  },
  privatePill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md
  },
  privatePillText: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18
  },
  sharePrompt: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.sm
  },
  avatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sharePromptText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    lineHeight: 21
  },
  promptAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  pressed: {
    opacity: 0.72
  },
  feedTabs: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: 4
  },
  feedTab: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  feedTabText: {
    ...typography.label,
    color: colors.textMuted
  },
  feedTabTextActive: {
    color: colors.onPrimary
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
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
    color: colors.onPrimary
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
    gap: 0
  },
  threadPostRow: {
    alignItems: "stretch",
    flexDirection: "row"
  },
  postThreadColumn: {
    position: "relative",
    width: 38
  },
  postThreadRail: {
    bottom: 0,
    left: 17,
    opacity: 0.34,
    position: "absolute",
    top: 0,
    width: 2
  },
  postThreadBranch: {
    height: 2,
    left: 17,
    opacity: 0.5,
    position: "absolute",
    top: 34,
    width: 21
  },
  postThreadKnot: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 16,
    left: 10,
    position: "absolute",
    top: 26,
    width: 16
  },
  feedHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  feedHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  postCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  postMain: {
    gap: spacing.md
  },
  postTitle: {
    ...typography.heading2,
    fontSize: 20,
    lineHeight: 26
  },
  authorLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  authorAvatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  authorAvatarText: {
    ...typography.heading3
  },
  authorCopy: {
    flex: 1,
    gap: 2
  },
  authorNameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  nickname: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1
  },
  postTime: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  postCopy: {
    gap: spacing.xs
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
  feedActionRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    minHeight: 44,
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
  backToFeed: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.md
  },
  backToFeedText: {
    ...typography.label
  },
  commentCountPill: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm
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
  sendCommentButton: {
    flex: 1
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  commentThread: {
    position: "relative",
    width: 18
  },
  commentRail: {
    bottom: -spacing.sm,
    borderRadius: radii.pill,
    left: 8,
    opacity: 0.34,
    position: "absolute",
    top: -spacing.sm,
    width: 2
  },
  commentKnot: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 12,
    left: 3,
    position: "absolute",
    top: spacing.md,
    width: 12
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
  },
  composerHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  filterCopy: { flex: 1, gap: 2 },
  filterHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  filterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  filterTitle: {
    ...typography.label,
    color: colors.text
  },
  lastReplyText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  lockedNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    ...radii.card,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  lockedNoticeText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  mineFilter: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  mineFilterText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  moderationLink: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md
  },
  moderationLinkCopy: { flex: 1, gap: 2 },
  moderationLinkText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  moderationLinkTitle: { ...typography.label, color: colors.text },
  replyCancel: { minHeight: 44, justifyContent: "center", paddingLeft: spacing.sm },
  replyCancelText: { ...typography.label, fontSize: 13, lineHeight: 18 },
  replyContext: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  replyContextText: {
    ...typography.label,
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  replyCount: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md
  },
  replyCountText: { ...typography.label, fontSize: 13, lineHeight: 18 },
  replyingLabel: { alignItems: "center", flexDirection: "row", gap: 2 },
  replyingLabelText: { ...typography.label, fontSize: 12, lineHeight: 17 },
  topicAuthor: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18
  },
  topicAuthorGroup: { flex: 1, gap: 2, minWidth: 0 },
  topicBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
  topicCategory: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 17
  },
  topicFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  topicLabels: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  topicMetaRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  topicModeratorBar: {
    backgroundColor: colors.highlightSoft,
    ...radii.card,
    gap: spacing.sm,
    padding: spacing.md
  },
  topicModeratorLabel: {
    ...typography.label,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  topicPreview: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  topicRail: { alignSelf: "stretch", position: "relative", width: 20 },
  topicRailKnot: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 14,
    left: 3,
    position: "absolute",
    top: 26,
    width: 14
  },
  topicRailLine: {
    bottom: -spacing.md,
    left: 9,
    opacity: 0.3,
    position: "absolute",
    top: -spacing.md,
    width: 2
  },
  topicRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 150,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg
  },
  topicStateBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 3,
    minHeight: 28,
    paddingHorizontal: spacing.sm
  },
  topicStateRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  topicStateText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  topicTime: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  topicTitle: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 19,
    lineHeight: 25
  }
});
