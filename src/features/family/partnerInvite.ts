export type PartnerInviteInput = {
  code: string;
  lifeStage: "pregnancy" | "postpartum";
  motherName?: string | null;
};

/**
 * The invite is sent from one phone to another in WhatsApp, so it has to make
 * sense on its own: who is inviting, what the other person gets, and the code,
 * without the recipient having to ask a follow-up question.
 */
export function buildPartnerInviteMessage({
  code,
  lifeStage,
  motherName
}: PartnerInviteInput) {
  const trimmedCode = code.trim().toUpperCase();
  const inviter = motherName?.trim();
  const opening = inviter
    ? `${inviter} seni Hamile & Bebek Takip'e davet ediyor.`
    : "Seni Hamile & Bebek Takip'e davet ediyorum.";

  const value =
    lifeStage === "pregnancy"
      ? "Randevuları, doktor notlarını ve hazırlık listesini birlikte takip edebiliriz."
      : "Beslenme, uyku ve bez kayıtlarını ikimiz de görebilir, gece vardiyasını paylaşabiliriz.";

  return [
    opening,
    value,
    "",
    `Aile kodu: ${trimmedCode}`,
    "",
    "Uygulamayı indirip giriş ekranında bu kodu gir."
  ].join("\n");
}

export type PartnerInviteState = "invite" | "linked" | "member" | "unavailable";

/**
 * The mother sees an invite until someone joins; a linked partner sees the
 * shared-care entry points instead of an invite for an account they are already
 * part of.
 */
export function getPartnerInviteState({
  hasCode,
  isFamilyMember,
  memberCount
}: {
  hasCode: boolean;
  isFamilyMember: boolean;
  memberCount: number;
}): PartnerInviteState {
  if (isFamilyMember) return "member";
  if (memberCount > 0) return "linked";
  if (!hasCode) return "unavailable";
  return "invite";
}
