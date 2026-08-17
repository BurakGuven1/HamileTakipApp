const path = require("node:path");

const { createRunOncePlugin } = require("@expo/config-plugins");

const appPackagePath = require.resolve(
  "@react-native-firebase/app/package.json"
);
const analyticsPackagePath = require.resolve(
  "@react-native-firebase/analytics/package.json"
);
const appPackage = require(appPackagePath);
const analyticsPackage = require(analyticsPackagePath);
const appIosPlugin = require(
  path.join(path.dirname(appPackagePath), "plugin/build/ios")
);
const analyticsIosPlugin = require(
  path.join(path.dirname(analyticsPackagePath), "plugin/build/ios")
);

function withIosFirebaseAnalytics(config) {
  let nextConfig = appIosPlugin.withFirebaseAppDelegate(config);
  nextConfig = appIosPlugin.withIosGoogleServicesFile(nextConfig);
  nextConfig = appIosPlugin.withIosDisableSPM(nextConfig, {
    ios: {
      disableSPM: true
    }
  });
  nextConfig = analyticsIosPlugin.withIosWithoutAdIdSupport(nextConfig, {
    ios: {
      withoutAdIdSupport: true
    }
  });
  return nextConfig;
}

module.exports = createRunOncePlugin(
  withIosFirebaseAnalytics,
  "with-ios-firebase-analytics",
  `${appPackage.version}-${analyticsPackage.version}`
);
