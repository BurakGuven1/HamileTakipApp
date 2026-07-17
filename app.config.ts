import type { ConfigContext, ExpoConfig } from "expo/config";

const isDevelopment = process.env.APP_VARIANT === "development";
const expoOwner = process.env.EXPO_OWNER ?? "burakguven351999";
const easProjectId =
  process.env.EAS_PROJECT_ID ?? "710c02c1-ddbb-4433-818f-00dadd19a758";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: expoOwner,
  name: isDevelopment ? "Anne+ Dev" : "Anne+",
  slug: "hamileliktakipapp",
  scheme: "hamiletakip",
  version: "0.1.0",
  icon: "./assets/branding/app-icon.png",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    icon: "./assets/branding/app-icon.png",
    supportsTablet: false,
    // TestFlight requires a new, monotonically increasing build number for
    // every upload. The GitHub Actions workflow supplies a Unix timestamp.
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "1",
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ??
      "com.burakguven.hamiletakip",
    infoPlist: {
      NSCameraUsageDescription:
        "Bebek fotoğraflarını çekebilmek için kamera erişimi kullanılır.",
      NSPhotoLibraryUsageDescription:
        "Bebek fotoğraflarını galeriye eklemek için fotoğraf erişimi kullanılır.",
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
    adaptiveIcon: {
      backgroundColor: "#FBF6EF",
      foregroundImage: "./assets/branding/adaptive-icon.png"
    },
    permissions: [
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "POST_NOTIFICATIONS",
      "SCHEDULE_EXACT_ALARM",
      "FOREGROUND_SERVICE",
      "WAKE_LOCK"
    ]
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-image",
    [
      "expo-audio",
      {
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
        microphonePermission: false
      }
    ],
    "expo-asset",
    "expo-secure-store",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FBF6EF",
        image: "./assets/branding/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain"
      }
    ],
    [
      "expo-notifications",
      {
        sounds: ["./assets/audio/baby_reminder.wav"],
        defaultChannel: "care-reminders",
        color: "#6E8F7C"
      }
    ],
    [
      "expo-widgets",
      {
        bundleIdentifier: `${process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ?? "com.burakguven.hamiletakip"}.widgets`,
        groupIdentifier: `group.${process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ?? "com.burakguven.hamiletakip"}`,
        enablePushNotifications: true,
        widgets: [
          {
            name: "CareQuickWidget",
            displayName: "Anne+ · Şu an ne önemli?",
            description: "Uyku, yaklaşan aşı, gece vardiyası ve sıradaki hatırlatmayı tek kartta gör.",
            supportedFamilies: [
              "systemSmall",
              "systemMedium",
              "accessoryRectangular",
              "accessoryInline"
            ],
            contentMarginsDisabled: true,
            android: null
          }
        ]
      }
    ],
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "CareQuickWidget",
            label: "Anne+ Hızlı Bakım",
            description: "Emzirme, uyku ve bez kaydına hızlı ulaş.",
            minWidth: "250dp",
            minHeight: "110dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1800000
          }
        ]
      }
    ],
    "expo-apple-authentication",
    "@react-native-community/datetimepicker"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: easProjectId
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    legalBaseUrl: process.env.EXPO_PUBLIC_LEGAL_BASE_URL,
    revenueCatAndroidApiKey:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
  }
});
