import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { UserPlus, Users } from "lucide-react-native";
import { Share, StyleSheet, Text, View } from "react-native";

import {
  getCurrentFamilyMembership,
  listFamilyMembersForOwner
} from "@/api/familyAccess";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { trackEvent } from "@/lib/analytics";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

import {
  buildPartnerInviteMessage,
  getPartnerInviteState
} from "./partnerInvite";

/**
 * Shared care was fully built — family tasks, the night shift handover, a
 * shared credit pool — and then left behind `href: null`, reachable only from
 * a code buried in Settings. Surfacing it is both the retention story and the
 * only organic growth loop the app has: one person pays, two people use it.
 */
export function PartnerCard({
  lifeStage
}: {
  lifeStage: "pregnancy" | "postpartum";
}) {
  const appTheme = useAppTheme();
  const { showError } = useFeedback();

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const membershipQuery = useQuery({
    queryKey: ["current-family-membership"],
    queryFn: getCurrentFamilyMembership
  });
  const membersQuery = useQuery({
    queryKey: ["family-members-owner"],
    queryFn: listFamilyMembersForOwner
  });

  const profile = profileQuery.data;
  const code = profile?.family_referral_code ?? null;

  const state = getPartnerInviteState({
    hasCode: Boolean(code),
    isFamilyMember: Boolean(membershipQuery.data),
    memberCount: (membersQuery.data ?? []).length
  });

  async function sharePartnerInvite() {
    if (!code) return;

    try {
      await trackEvent("partner_invite_shared", { life_stage: lifeStage });
      await Share.share({
        message: buildPartnerInviteMessage({
          code,
          lifeStage,
          motherName: profile?.mother_name
        })
      });
    } catch (error) {
      showError(error, "Davet paylaşılamadı");
    }
  }

  if (state === "unavailable") return null;

  if (state === "invite") {
    return (
      <Card style={[styles.card, { backgroundColor: appTheme.theme.primarySoft }]}>
        <View style={styles.header}>
          <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>
            <UserPlus color={appTheme.primary} size={22} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={typography.eyebrow}>Yalnız taşıma</Text>
            <Text style={typography.heading2}>Eşini de ekle</Text>
            <Text style={styles.body}>
              {lifeStage === "pregnancy"
                ? "Randevular, doktor notları ve hazırlık listesi ikinizde de aynı anda görünür."
                : "Beslenme, uyku ve bez kayıtlarını ikiniz de görür; gece vardiyasını sırayla paylaşırsınız."}
            </Text>
          </View>
        </View>
        <Text style={styles.code}>{code?.toUpperCase()}</Text>
        <Button label="Daveti gönder" onPress={() => void sharePartnerInvite()} />
      </Card>
    );
  }

  // Both the owner with a linked partner and the partner themselves land here:
  // what they need is the way in, not another invitation.
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: appTheme.tint }]}>
          <Users color={appTheme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={typography.eyebrow}>Paylaşılan bakım</Text>
          <Text style={typography.heading2}>
            {state === "member" ? "Aile hesabındasın" : "Eşin bağlı"}
          </Text>
          <Text style={styles.body}>
            Görevler ikinizde de aynı anda görünür; tamamlanan bir görev diğer
            telefonda da tamamlanmış olur.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Aile görevleri"
          onPress={() => router.push("/family-planner")}
          style={styles.action}
          variant="secondary"
        />
        {lifeStage === "postpartum" ? (
          <Button
            label="Gece vardiyası"
            onPress={() => router.push("/night-shift")}
            style={styles.action}
            variant="secondary"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md
  },
  header: {
    flexDirection: "row",
    gap: spacing.md
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  body: {
    ...typography.body,
    color: colors.textMuted
  },
  code: {
    ...typography.heading2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    letterSpacing: 3,
    paddingVertical: spacing.sm,
    textAlign: "center"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  action: {
    flex: 1
  }
});
