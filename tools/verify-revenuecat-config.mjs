const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const bundleIdentifier =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() ||
  "com.burakguven.hamiletakip";
const expectedOfferingIdentifier =
  process.env.REVENUECAT_OFFERING_IDENTIFIER?.trim() || "default";

if (!apiKey) {
  fail("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is missing.");
}

if (!apiKey.startsWith("appl_")) {
  fail(
    "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY must be the public Apple SDK key (appl_…)."
  );
}

const response = await fetch(
  "https://api.revenuecat.com/v1/subscribers/rc_build_configuration_check/offerings",
  {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Platform": "ios"
    },
    signal: AbortSignal.timeout(15_000)
  }
).catch((error) => {
  fail(`RevenueCat offerings request failed: ${error.message}`);
});

if (!response.ok) {
  fail(`RevenueCat offerings request returned HTTP ${response.status}.`);
}

const payload = await response.json();
if (payload.current_offering_id !== expectedOfferingIdentifier) {
  fail(
    `RevenueCat current offering must be "${expectedOfferingIdentifier}", received "${payload.current_offering_id ?? "none"}".`
  );
}

const currentOffering = payload.offerings?.find(
  (offering) => offering.identifier === expectedOfferingIdentifier
);
if (!currentOffering) {
  fail(`RevenueCat offering "${expectedOfferingIdentifier}" was not returned.`);
}

const expectedPackages = new Map([
  ["$rc_monthly", `${bundleIdentifier}.premium.monthly`],
  ["$rc_annual", `${bundleIdentifier}.premium.yearly`]
]);
const actualPackages = new Map(
  currentOffering.packages?.map((entry) => [
    entry.identifier,
    entry.platform_product_identifier
  ]) ?? []
);

for (const [packageIdentifier, productIdentifier] of expectedPackages) {
  if (actualPackages.get(packageIdentifier) !== productIdentifier) {
    fail(
      `RevenueCat package "${packageIdentifier}" must point to "${productIdentifier}".`
    );
  }
}

console.log(
  `RevenueCat verified: offering=${expectedOfferingIdentifier}, products=${[
    ...expectedPackages.values()
  ].join(",")}`
);

function fail(message) {
  console.error(`RevenueCat configuration check failed: ${message}`);
  process.exit(1);
}
