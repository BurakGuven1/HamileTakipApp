import { Platform } from "react-native";

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  revenueCatAndroidApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  revenueCatEntitlementId:
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "premium",
  legalBaseUrl: process.env.EXPO_PUBLIC_LEGAL_BASE_URL
} as const;

export function getRevenueCatApiKey() {
  const apiKey = Platform.select({
    ios: env.revenueCatIosApiKey,
    android: env.revenueCatAndroidApiKey,
    default: undefined
  });

  return apiKey?.trim();
}
