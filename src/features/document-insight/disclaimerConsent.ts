import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The medical disclaimer is acknowledged once, explicitly, before the first
 * analysis, and the acknowledgement is stored with the version of the text that
 * was shown. Changing the wording therefore asks again rather than silently
 * inheriting consent for a sentence the user never read.
 */

export const DOCUMENT_DISCLAIMER_VERSION = "document-insight-medical-disclaimer-v1";

export const DOCUMENT_DISCLAIMER_TITLE = "Önce bunu okumanı istiyoruz";

export const DOCUMENT_DISCLAIMER_BODY =
  "Anne+ belgendeki değerleri ve laboratuvarın kendi referans aralığını anlaşılır dile çevirir; ne anlama geldiğini anlatır ve doktoruna sorman için hazırlar. Tanı koymaz, tedavi veya ilaç önermez, aciliyet değerlendirmesi yapmaz. Emin olmadığı değerleri yorumlamadan bırakır.";

export const DOCUMENT_DISCLAIMER_ACKNOWLEDGEMENT =
  "Bu bilginin tıbbi tavsiye olmadığını, tanı ve tedavi için doktoruma başvurmam gerektiğini anladım.";

const STORAGE_KEY = "document-insight-disclaimer-ack-v1";

type StoredAcknowledgement = {
  acknowledgedAt: string;
  version: string;
};

export async function hasAcknowledgedDocumentDisclaimer() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredAcknowledgement;
    return parsed?.version === DOCUMENT_DISCLAIMER_VERSION;
  } catch {
    // An unreadable record is treated as no record: asking twice is harmless,
    // skipping the disclaimer is not.
    return false;
  }
}

export async function acknowledgeDocumentDisclaimer() {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        acknowledgedAt: new Date().toISOString(),
        version: DOCUMENT_DISCLAIMER_VERSION
      } satisfies StoredAcknowledgement)
    );
    return true;
  } catch (error) {
    console.warn("Belge uyarısı onayı kaydedilemedi", error);
    return false;
  }
}
