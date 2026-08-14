const appId = process.env.META_APP_ID?.trim();
const clientToken = process.env.META_CLIENT_TOKEN?.trim();
const bundleIdentifier =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() ||
  "com.burakguven.hamiletakip";

function fail(message) {
  console.error(`[meta-config] ${message}`);
  process.exit(1);
}

if (!appId) {
  fail("META_APP_ID is missing.");
}

if (!/^\d+$/.test(appId)) {
  fail("META_APP_ID must contain digits only.");
}

if (!clientToken) {
  fail(
    "META_CLIENT_TOKEN is missing. Copy the Client Token from Meta Developers > App settings > Advanced."
  );
}

if (!/^[a-f\d]{32}$/i.test(clientToken)) {
  fail("META_CLIENT_TOKEN must be a 32-character hexadecimal client token.");
}

if (process.env.META_APP_SECRET) {
  fail("META_APP_SECRET must never be supplied to a client build.");
}

if (bundleIdentifier !== "com.burakguven.hamiletakip") {
  fail(
    `Unexpected iOS bundle identifier: ${bundleIdentifier}. Expected com.burakguven.hamiletakip.`
  );
}

console.log(
  `[meta-config] Valid Meta App Events configuration for ${bundleIdentifier} (App ID ${appId}).`
);
