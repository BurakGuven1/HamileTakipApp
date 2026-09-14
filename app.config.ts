import type { ConfigContext, ExpoConfig } from "expo/config";

const isDevelopment = process.env.APP_VARIANT === "development";
const expoOwner = process.env.EXPO_OWNER || "burakguven351999";
const easProjectId =
  process.env.EAS_PROJECT_ID || "710c02c1-ddbb-4433-818f-00dadd19a758";
const metaAppId = process.env.META_APP_ID?.trim();
const metaClientToken = process.env.META_CLIENT_TOKEN?.trim();
const metaTrackingPermission =
  "Reklamların etkinliğini ölçmek ve sana daha ilgili reklamlar sunmak için cihaz tanımlayıcının kullanılmasına izin ver.";
// Google Ads (and Meta) can only attribute an install when the postback is
// allowed to reach the ad network. Without these identifiers iOS silently
// drops every SKAdNetwork postback, so the campaign never learns which click
// produced the download and the bidder cannot optimise for installs.
const skAdNetworkIdentifiers = [
  // Google (Ads / AdMob) - the one that makes App campaigns measurable.
  "cstr6suwn9",
  "4fzdc2evr5",
  "4pfyvq9l8r",
  "2fnua5tdw4",
  "ydx93a7ass",
  "5a6flpkh64",
  "p78axxw75g",
  "v72qych5uu",
  "ludvb6z3bs",
  "cp8zw746q7",
  "3sh42y64q3",
  "c6k4g5qg8m",
  "s39g8k73mm",
  "3qy4746246",
  "hs6bdukanm",
  "v4nxqhlyqp",
  "wzmmz9fp6w",
  "yclnxrl5pm",
  "t38b2kh725",
  "7ug5zh24hu",
  "9rd848q2bz",
  "y5ghdn5j9k",
  "n6fk4nfna4",
  "47vhws6wlr",
  "kbd757ywx3",
  "9t245vhmpl",
  "a2p9lx4jpn",
  "22mmun2rn5",
  "4468km3ulz",
  "2u9pt9hc89",
  "8s468mfl3y",
  "klf5c3l5u5",
  "ppxm28t8ap",
  "ecpz2srf59",
  "uw77j35x4d",
  "pwa73g5rt2",
  "mlmmfzh3r3",
  "578prtvx9j",
  "4dzt52r2t5",
  "gta9lk7p23",
  "e5fvkxwrpn",
  "8c4e2ghe7u",
  "zq492l623r",
  "3rd42ekr43",
  "3qcr597p9d",
  // Meta.
  "v9wttpbfk9",
  "n38lu8286q",
  "f38h382jlk"
].map((skAdNetworkIdentifier) => ({
  SKAdNetworkIdentifier: `${skAdNetworkIdentifier}.skadnetwork`
}));

// The ATT prompt is required for IDFA-based attribution in BOTH Firebase
// (Google Ads) and Meta, so it is no longer gated behind the Meta credentials.
const trackingTransparencyPlugin: NonNullable<ExpoConfig["plugins"]>[number] = [
  "expo-tracking-transparency",
  {
    userTrackingPermission: metaTrackingPermission
  }
];

const metaPlugins: NonNullable<ExpoConfig["plugins"]> =
  metaAppId && metaClientToken
    ? [
        [
          "react-native-fbsdk-next",
          {
            appID: metaAppId,
            clientToken: metaClientToken,
            displayName: "Anne+",
            scheme: `fb${metaAppId}`,
            advertiserIDCollectionEnabled: false,
            autoLogAppEventsEnabled: true,
            isAutoInitEnabled: false,
            iosUserTrackingPermission: metaTrackingPermission
          }
        ]
      ]
    : [];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: expoOwner,
  name: isDevelopment ? "Anne+ Dev" : "Anne+",
  slug: "hamileliktakipapp",
  scheme: "hamiletakip",
  version: "1.2.2",
  icon: "./assets/branding/app-icon.png",
  orientation: "portrait",
  userInterfaceStyle: "light",
  web: {
    bundler: "metro",
    output: "static"
  },
  ios: {
    icon: "./assets/branding/app-icon.png",
    supportsTablet: false,
    // TestFlight requires a new, monotonically increasing build number for
    // every upload. The GitHub Actions workflow supplies a Unix timestamp.
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "3",
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ||
      "com.burakguven.hamiletakip",
    googleServicesFile: "./assets/GoogleService-Info.plist",
    appStoreUrl: process.env.EXPO_PUBLIC_IOS_APP_STORE_URL,
    infoPlist: {
      NSCameraUsageDescription:
        "Bebek fotoğraflarını çekebilmek için kamera erişimi kullanılır.",
      NSPhotoLibraryUsageDescription:
        "Ana sayfa görselini seçmek ve anı galerisine fotoğraf eklemek için fotoğraf erişimi kullanılır.",
      // "audio": ninni çalar ekran kilitliyken de çalmaya devam eder
      // (LullabyPlayerProvider, shouldPlayInBackground: true).
      // "remote-notification": bakım alarmları ve Live Activity içerik
      // güncellemeleri APNs üzerinden gelir. İkisi de gerçekten kullanılıyor;
      // kullanılmayan bir arka plan modu App Review'da red sebebidir.
      UIBackgroundModes: ["audio", "remote-notification"],
      // Kilit ekranı sayacı ve Dynamic Island için zorunlu. expo-widgets
      // eklentisi de bu anahtarı yazar; burada açıkça tutulması niyeti
      // belgeler ve eklenti sırası değişirse anahtarın kaybolmasını önler.
      NSSupportsLiveActivities: true,
      // Saniyede bir push ile güncelleme YAPMIYORUZ: sayaç sistem yönetimli
      // Text(timerInterval:) ile çiziliyor. Bu yüzden "frequent updates"
      // kapalı; açık bırakmak hem pil hem App Review açısından gereksiz.
      NSSupportsLiveActivitiesFrequentUpdates: false,
      NSUserTrackingUsageDescription: metaTrackingPermission,
      SKAdNetworkItems: skAdNetworkIdentifiers
    },
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    package:
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE ||
      "com.burakguven.hamiletakip",
    playStoreUrl: `https://play.google.com/store/apps/details?id=${
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "com.burakguven.hamiletakip"
    }`,
    adaptiveIcon: {
      backgroundColor: "#F9F4F0",
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
    trackingTransparencyPlugin,
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
    "./plugins/with-ios-firebase-analytics",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static"
        }
      }
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F9F4F0",
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
        // Bkz. NSSupportsLiveActivitiesFrequentUpdates yorumu.
        frequentUpdates: false,
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
    "@react-native-community/datetimepicker",
    ...metaPlugins
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
