import { Platform } from "react-native";

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  revenueCatAndroidApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  revenueCatEntitlementId:
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "premium",
  admobInterstitialAndroidId:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID_ID,
  admobInterstitialIosId: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS_ID
} as const;

export function getRevenueCatApiKey() {
  return Platform.select({
    ios: env.revenueCatIosApiKey,
    android: env.revenueCatAndroidApiKey,
    default: undefined
  });
}

export function getInterstitialAdUnitId() {
  return Platform.select({
    ios:
      env.admobInterstitialIosId ??
      "ca-app-pub-3940256099942544/4411468910",
    android:
      env.admobInterstitialAndroidId ??
      "ca-app-pub-3940256099942544/1033173712",
    default: undefined
  });
}
