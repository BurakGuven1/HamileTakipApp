import * as Linking from "expo-linking";

const legalBaseUrl = process.env.EXPO_PUBLIC_LEGAL_BASE_URL?.replace(/\/$/, "");

export type LegalPage = "privacy" | "terms" | "accountDeletion" | "disclaimer";

const legalPaths: Record<LegalPage, string> = {
  privacy: "/gizlilik-politikasi/",
  terms: "/kullanim-sartlari/",
  accountDeletion: "/delete-account/",
  disclaimer: "/sorumluluk-reddi/"
};

export function getLegalUrl(page: LegalPage) {
  return legalBaseUrl ? `${legalBaseUrl}${legalPaths[page]}` : null;
}

export async function openLegalPage(page: LegalPage) {
  const url = getLegalUrl(page);

  if (!url) {
    throw new Error("Yasal sayfa adresi yapılandırılmamış.");
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error("Yasal sayfa açılamıyor.");
  }

  await Linking.openURL(url);
}

export const appStoreSubscriptionsUrl = "https://apps.apple.com/account/subscriptions";
