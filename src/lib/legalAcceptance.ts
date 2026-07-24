import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";

export const APP_EULA_VERSION = "eula-2026-07-24";
export const FORUM_AGREEMENT_VERSION = "forum-community-2026-07-24";

const appAgreementKey = `legal.accepted.${APP_EULA_VERSION}`;

function forumAgreementKey(userId: string) {
  return `legal.accepted.${FORUM_AGREEMENT_VERSION}.${userId}`;
}

export async function hasAcceptedAppAgreementLocally() {
  return (await AsyncStorage.getItem(appAgreementKey)) === "true";
}

export async function setAppAgreementAccepted(accepted: boolean) {
  if (accepted) {
    await AsyncStorage.setItem(appAgreementKey, "true");
    return;
  }

  await AsyncStorage.removeItem(appAgreementKey);
}

export async function hasAcceptedForumAgreement(userId: string) {
  const localAccepted =
    (await AsyncStorage.getItem(forumAgreementKey(userId))) === "true";
  if (localAccepted) return true;

  const { data, error } = await supabase.rpc("has_legal_acceptance", {
    p_version: FORUM_AGREEMENT_VERSION
  });

  if (error) throw error;

  if (data) {
    await AsyncStorage.setItem(forumAgreementKey(userId), "true");
  }

  return Boolean(data);
}

export async function recordLegalAcceptance(
  version: string,
  source: "auth" | "forum"
) {
  const { data, error } = await supabase.rpc("record_legal_acceptance", {
    p_source: source,
    p_version: version
  });

  if (error) throw error;
  return data;
}

export async function acceptForumAgreement(userId: string) {
  await recordLegalAcceptance(FORUM_AGREEMENT_VERSION, "forum");
  await AsyncStorage.setItem(forumAgreementKey(userId), "true");
}
