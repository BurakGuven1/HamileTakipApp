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
  // The ad-id-free measurement pod cannot read the IDFA, which means Google
  // Ads only ever sees modelled/SKAdNetwork conversions and cannot optimise an
  // App campaign for installs. Keep the full GoogleAppMeasurement pod; the
  // IDFA is still only read after the user accepts the ATT prompt, and Firebase
  // consent is denied by default until then (see trackingPermission.ts).
  nextConfig = analyticsIosPlugin.withIosWithoutAdIdSupport(nextConfig, {
    ios: {
      withoutAdIdSupport: false
    }
  });
  return nextConfig;
}

module.exports = createRunOncePlugin(
  withIosFirebaseAnalytics,
  "with-ios-firebase-analytics",
  `${appPackage.version}-${analyticsPackage.version}`
);
