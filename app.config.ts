import type { ConfigContext, ExpoConfig } from "expo/config";

const isDevelopment = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDevelopment ? "Hamile Takip Dev" : "Hamile Takip",
  slug: "hamile-bebek-takip",
  scheme: "hamiletakip",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ??
      "com.burakguven.hamiletakip",
    infoPlist: {
      NSCameraUsageDescription:
        "Bebek fotoğraflarını çekebilmek için kamera erişimi kullanılır.",
      NSPhotoLibraryUsageDescription:
        "Bebek fotoğraflarını galeriye eklemek için fotoğraf erişimi kullanılır.",
      NSMicrophoneUsageDescription:
        "İleride eklenecek sesli günlük özellikleri için mikrofon izni gerekebilir.",
      UIBackgroundModes: ["audio", "remote-notification"]
    },
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    package:
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE ??
      "com.burakguven.hamiletakip",
    permissions: [
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "POST_NOTIFICATIONS",
      "FOREGROUND_SERVICE",
      "WAKE_LOCK"
    ]
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-image",
    "expo-audio",
    "expo-asset",
    "expo-secure-store",
    "expo-notifications",
    "expo-apple-authentication",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId:
          process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ??
          "ca-app-pub-3940256099942544~3347511713",
        iosAppId:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
          "ca-app-pub-3940256099942544~1458002511"
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    revenueCatAndroidApiKey:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
  }
});
