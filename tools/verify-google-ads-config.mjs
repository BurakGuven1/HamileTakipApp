import { execSync } from "node:child_process";

// Google Ads can only optimise an App campaign when iOS is allowed to deliver
// the install postback and Firebase is allowed to attribute it. Both settings
// live far apart from each other (app.config.ts and a config plugin), so they
// are asserted here on every build.

const GOOGLE_SKADNETWORK_IDENTIFIER = "cstr6suwn9.skadnetwork";
const MINIMUM_SKADNETWORK_IDENTIFIERS = 20;

const config = readExpoConfig();
const infoPlist = config?.ios?.infoPlist ?? {};

const skAdNetworkItems = Array.isArray(infoPlist.SKAdNetworkItems)
  ? infoPlist.SKAdNetworkItems
  : [];
const identifiers = skAdNetworkItems
  .map((item) => item?.SKAdNetworkIdentifier)
  .filter((identifier) => typeof identifier === "string");

if (!identifiers.includes(GOOGLE_SKADNETWORK_IDENTIFIER)) {
  fail(
    `SKAdNetworkItems must contain ${GOOGLE_SKADNETWORK_IDENTIFIER}; without it iOS drops every Google Ads install postback.`
  );
}

if (identifiers.length < MINIMUM_SKADNETWORK_IDENTIFIERS) {
  fail(
    `Only ${identifiers.length} SKAdNetwork identifiers are configured; Google Ads serves through partner networks that each need their own entry.`
  );
}

if (new Set(identifiers).size !== identifiers.length) {
  fail("SKAdNetworkItems contains duplicate identifiers.");
}

const invalidIdentifier = identifiers.find(
  (identifier) => !/^[a-z0-9]+\.skadnetwork$/.test(identifier)
);
if (invalidIdentifier) {
  fail(`Malformed SKAdNetwork identifier: ${invalidIdentifier}.`);
}

if (!infoPlist.NSUserTrackingUsageDescription) {
  fail(
    "NSUserTrackingUsageDescription is missing; without the ATT prompt Firebase cannot read the IDFA and Google Ads loses user-level attribution."
  );
}

const plugins = (config?.plugins ?? []).map((plugin) =>
  Array.isArray(plugin) ? plugin[0] : plugin
);

if (!plugins.includes("expo-tracking-transparency")) {
  fail("expo-tracking-transparency must be configured for every build.");
}

if (!plugins.includes("./plugins/with-ios-firebase-analytics")) {
  fail("The Firebase Analytics config plugin is missing.");
}

console.log(
  `[google-ads-config] ${identifiers.length} SKAdNetwork identifiers and the ATT prompt are configured.`
);

function readExpoConfig() {
  try {
    // `shell: true` keeps this working with the npx shim on Windows.
    const output = execSync("npx expo config --json", {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return JSON.parse(output);
  } catch (error) {
    fail(`Could not resolve the Expo config: ${error.message}`);
  }
}

function fail(message) {
  console.error(`[google-ads-config] ${message}`);
  process.exit(1);
}
