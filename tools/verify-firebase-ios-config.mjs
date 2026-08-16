import { readFile } from "node:fs/promises";
import path from "node:path";

const plistPath = path.resolve("assets/GoogleService-Info.plist");
const expectedBundleIdentifier =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() ||
  "com.burakguven.hamiletakip";

const plist = await readFile(plistPath, "utf8").catch((error) => {
  fail(`GoogleService-Info.plist is missing at ${plistPath}: ${error.message}`);
});

const configuredBundleIdentifier = readStringValue(plist, "BUNDLE_ID");
if (!configuredBundleIdentifier) {
  fail("BUNDLE_ID is missing from GoogleService-Info.plist.");
}

if (configuredBundleIdentifier !== expectedBundleIdentifier) {
  fail(
    `Bundle ID mismatch. Expected ${expectedBundleIdentifier}, received ${configuredBundleIdentifier}.`
  );
}

if (!readStringValue(plist, "GOOGLE_APP_ID")) {
  fail("GOOGLE_APP_ID is missing from GoogleService-Info.plist.");
}

const obsoleteBundleIdentifier = ["com", ["basari", "yolu"].join("")].join(
  "."
);
const obsoleteProductNamePattern = new RegExp(
  ["ba", "(?:\\u015f|s)", "ar", "(?:\\u0131|i)", "yolum"].join(""),
  "i"
);
if (
  plist.toLowerCase().includes(obsoleteBundleIdentifier) ||
  obsoleteProductNamePattern.test(plist)
) {
  fail("An obsolete project identifier was found in GoogleService-Info.plist.");
}

console.log(
  `[firebase-ios-config] Valid Firebase configuration for ${configuredBundleIdentifier}.`
);

function readStringValue(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]*)</string>`)
  );

  return match?.[1]
    ?.replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function fail(message) {
  console.error(`[firebase-ios-config] ${message}`);
  process.exit(1);
}
