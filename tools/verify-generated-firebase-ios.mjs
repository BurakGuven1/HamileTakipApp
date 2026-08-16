import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const expectedBundleIdentifier = "com.burakguven.hamiletakip";
const iosRoot = path.resolve("ios");
const appDelegatePath = path.join(iosRoot, "Anne", "AppDelegate.swift");
const generatedPlistPath = path.join(
  iosRoot,
  "Anne",
  "GoogleService-Info.plist"
);

const [appDelegate, generatedPlist, podfile, podfileProperties] =
  await Promise.all([
    readRequiredFile(appDelegatePath),
    readRequiredFile(generatedPlistPath),
    readRequiredFile(path.join(iosRoot, "Podfile")),
    readRequiredFile(path.join(iosRoot, "Podfile.properties.json"))
  ]);

const configureCount = countMatches(
  appDelegate,
  /FirebaseApp\.configure\(\)|\[FIRApp configure\]/g
);
if (configureCount !== 1) {
  fail(`Firebase must be initialized exactly once; found ${configureCount} calls.`);
}

if (!appDelegate.includes("import FirebaseCore")) {
  fail("The generated Swift AppDelegate does not import FirebaseCore.");
}

const generatedBundleIdentifier = readPlistString(generatedPlist, "BUNDLE_ID");
if (generatedBundleIdentifier !== expectedBundleIdentifier) {
  fail(
    `Generated plist Bundle ID mismatch. Expected ${expectedBundleIdentifier}, received ${generatedBundleIdentifier ?? "missing"}.`
  );
}

const generatedPlists = (await findFiles(iosRoot, "GoogleService-Info.plist")).filter(
  (filePath) => !filePath.includes(`${path.sep}Pods${path.sep}`)
);
if (generatedPlists.length !== 1) {
  fail(
    `Expected one generated GoogleService-Info.plist outside Pods; found ${generatedPlists.length}.`
  );
}

const projectFiles = await findFiles(iosRoot, "project.pbxproj");
const appProjectFiles = projectFiles.filter(
  (filePath) => !filePath.includes(`${path.sep}Pods${path.sep}`)
);
if (appProjectFiles.length !== 1) {
  fail(`Expected one generated app project; found ${appProjectFiles.length}.`);
}

const project = await readRequiredFile(appProjectFiles[0]);
const resourceMembershipCount = countMatches(
  project,
  /\/\* GoogleService-Info\.plist in Resources \*\//g
);
if (resourceMembershipCount !== 2) {
  fail(
    `Expected one Copy Bundle Resources membership for GoogleService-Info.plist; found an unexpected project reference count of ${resourceMembershipCount}.`
  );
}

if (
  countMatches(
    podfile,
    /\$RNFirebaseAnalyticsWithoutAdIdSupport\s*=\s*true/g
  ) !== 1
) {
  fail("The AnalyticsWithoutAdIdSupport Podfile flag is missing or duplicated.");
}

if (/\$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion\s*=\s*true/.test(podfile)) {
  fail("On-device conversion measurement must not be enabled for this integration.");
}

if (/\$RNFirebaseDisableSPM\s*=\s*true/.test(podfile)) {
  fail("Firebase SPM was unexpectedly disabled.");
}

let properties;
try {
  properties = JSON.parse(podfileProperties);
} catch (error) {
  fail(`Podfile.properties.json is invalid: ${error.message}`);
}

if (properties["ios.useFrameworks"] !== "dynamic") {
  fail('ios.useFrameworks must be "dynamic" for Firebase SPM.');
}

const obsoleteBundleIdentifier = ["com", ["basari", "yolu"].join("")].join(
  "."
);
const obsoleteProductNamePattern = new RegExp(
  ["ba", "(?:\\u015f|s)", "ar", "(?:\\u0131|i)", "yolum"].join(""),
  "i"
);
if (
  [appDelegate, generatedPlist, podfile, project].some(
    (content) =>
      content.toLowerCase().includes(obsoleteBundleIdentifier) ||
      obsoleteProductNamePattern.test(content)
  )
) {
  fail("An obsolete project identifier was found in generated iOS files.");
}

console.log(
  `[firebase-ios-generated] Verified one Firebase initialization and one app resource for ${generatedBundleIdentifier}.`
);

async function readRequiredFile(filePath) {
  return readFile(filePath, "utf8").catch((error) => {
    fail(`Required generated file is missing: ${filePath} (${error.message})`);
  });
}

async function findFiles(root, fileName) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    fail(`Cannot inspect generated iOS directory ${root}: ${error.message}`);
  });
  const matches = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findFiles(entryPath, fileName)));
    } else if (entry.name === fileName) {
      matches.push(entryPath);
    }
  }

  return matches;
}

function readPlistString(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source
    .match(
      new RegExp(
        `<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]*)</string>`
      )
    )?.[1]?.trim();
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function fail(message) {
  console.error(`[firebase-ios-generated] ${message}`);
  process.exit(1);
}
