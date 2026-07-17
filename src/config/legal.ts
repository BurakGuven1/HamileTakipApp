import * as Linking from "expo-linking";

const defaultLegalBaseUrl = "https://hamile-takip-app-vqgw.vercel.app";
const legalBaseUrl = defaultLegalBaseUrl;

export type LegalPage =
  | "appleEula"
  | "privacy"
  | "terms"
  | "accountDeletion"
  | "disclaimer"
  | "explicitConsent"
  | "kvkkDisclosure";

const appleStandardEulaUrl =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

const legalPaths: Record<Exclude<LegalPage, "appleEula">, string> = {
  privacy: "/gizlilik-politikasi/",
  terms: "/kullanim-sartlari/",
  accountDeletion: "/delete-account/",
  disclaimer: "/sorumluluk-reddi/",
  explicitConsent: "/acik-riza-metni/",
  kvkkDisclosure: "/kvkk-aydinlatma-metni/"
};

export function getLegalUrl(page: LegalPage) {
  if (page === "appleEula") {
    return appleStandardEulaUrl;
  }

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
