import * as Linking from "expo-linking";

const defaultLegalBaseUrl = "https://hamile-takip-app-vqgw.vercel.app";
const legalBaseUrl = defaultLegalBaseUrl;

export type LegalPage =
  | "privacy"
  | "terms"
  | "accountDeletion"
  | "disclaimer"
  | "explicitConsent"
  | "kvkkDisclosure";

const legalPaths: Record<LegalPage, string> = {
  privacy: "/gizlilik-politikasi/",
  terms: "/kullanim-sartlari/",
  accountDeletion: "/delete-account/",
  disclaimer: "/sorumluluk-reddi/",
  explicitConsent: "/acik-riza-metni/",
  kvkkDisclosure: "/kvkk-aydinlatma-metni/"
};

export function getLegalUrl(page: LegalPage) {
  return `${legalBaseUrl}${legalPaths[page]}`;
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
