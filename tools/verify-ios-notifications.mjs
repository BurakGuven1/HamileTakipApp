import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Bildirim, Live Activity ve widget yapılandırması dört ayrı yerde yaşıyor:
// app.config.ts'teki infoPlist, expo-notifications eklentisi, expo-widgets
// eklentisi ve assets/ altındaki ses dosyası. Biri sessizce kayarsa sonucu
// ancak TestFlight'ta, alarmı duymayan bir annenin telefonunda görülür.
// Bu yüzden hepsi her build'de burada doğrulanır.

const EXPECTED_SOUND = "baby_reminder.wav";

const config = readExpoConfig();
const infoPlist = config?.ios?.infoPlist ?? {};
const bundleIdentifier = config?.ios?.bundleIdentifier;
const plugins = config?.plugins ?? [];

if (!bundleIdentifier) {
  fail("ios.bundleIdentifier tanımlı değil; App Group ve widget bundle id bundan türetiliyor.");
}

// --- Live Activity -------------------------------------------------------
if (infoPlist.NSSupportsLiveActivities !== true) {
  fail(
    "NSSupportsLiveActivities eksik. Bu anahtar olmadan ActivityKit hiçbir Live Activity başlatmaz; emzirme sayacı kilit ekranında görünmez."
  );
}

if (typeof infoPlist.NSSupportsLiveActivitiesFrequentUpdates !== "boolean") {
  fail(
    "NSSupportsLiveActivitiesFrequentUpdates açıkça true/false olmalı. Sayaç sistem yönetimli olduğu için beklenen değer false'tur."
  );
}

if (infoPlist.NSSupportsLiveActivitiesFrequentUpdates === true) {
  warn(
    "Frequent updates açık. Sayaç Text(timerInterval:) ile çiziliyorsa bu gereksiz; pil tüketimi ve App Review soruları getirir."
  );
}

// --- Arka plan modları ---------------------------------------------------
const backgroundModes = Array.isArray(infoPlist.UIBackgroundModes)
  ? infoPlist.UIBackgroundModes
  : [];

if (!backgroundModes.includes("remote-notification")) {
  fail(
    "UIBackgroundModes içinde remote-notification yok; push ile gelen bakım alarmları ve Live Activity güncellemeleri işlenemez."
  );
}

const UNJUSTIFIED_BACKGROUND_MODES = [
  "location",
  "voip",
  "fetch",
  "processing",
  "bluetooth-central"
];
for (const mode of backgroundModes) {
  if (UNJUSTIFIED_BACKGROUND_MODES.includes(mode)) {
    fail(
      `UIBackgroundModes içinde "${mode}" var. Gerçekten kullanılmayan bir arka plan modu App Review'da doğrudan red sebebidir.`
    );
  }
}

// --- İzin açıklama metinleri ---------------------------------------------
const TURKISH_DESCRIPTIONS = [
  "NSCameraUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSUserTrackingUsageDescription"
];
for (const key of TURKISH_DESCRIPTIONS) {
  const value = infoPlist[key];
  if (typeof value !== "string" || value.trim().length < 20) {
    fail(`${key} eksik ya da anlamsız kısa. App Review her izin metnini okur.`);
  }
  if (!/[çğıöşüÇĞİÖŞÜ]/.test(value)) {
    warn(`${key} Türkçe görünmüyor; uygulamanın tüm arayüzü Türkçe.`);
  }
}

// --- expo-notifications --------------------------------------------------
const notificationsPlugin = findPlugin("expo-notifications");
if (!notificationsPlugin) {
  fail("expo-notifications eklentisi yapılandırılmamış.");
}

const sounds = notificationsPlugin?.[1]?.sounds ?? [];
const soundPaths = Array.isArray(sounds) ? sounds : [sounds];
if (!soundPaths.some((path) => String(path).endsWith(EXPECTED_SOUND))) {
  fail(
    `expo-notifications sounds listesinde ${EXPECTED_SOUND} yok; bakım alarmı sistem sesiyle çalar ve gece fark edilmez.`
  );
}
for (const path of soundPaths) {
  const relative = String(path).replace(/^\.\//, "");
  if (!existsSync(relative)) {
    fail(`Bildirim sesi dosyası bulunamadı: ${relative}`);
  }
}

// --- expo-widgets --------------------------------------------------------
const widgetsPlugin = findPlugin("expo-widgets");
if (!widgetsPlugin) {
  fail("expo-widgets eklentisi yapılandırılmamış; widget ve Live Activity target'ı üretilmez.");
}

const widgetProps = widgetsPlugin?.[1] ?? {};
const expectedWidgetBundleId = `${bundleIdentifier}.widgets`;
if (widgetProps.bundleIdentifier !== expectedWidgetBundleId) {
  fail(
    `Widget bundle id "${widgetProps.bundleIdentifier}" beklenen "${expectedWidgetBundleId}" değil. Uyuşmazlık App Store Connect'te ayrı bir App ID kaydı gerektirir ve yükleme reddedilir.`
  );
}

const expectedGroupIdentifier = `group.${bundleIdentifier}`;
if (widgetProps.groupIdentifier !== expectedGroupIdentifier) {
  fail(
    `App Group "${widgetProps.groupIdentifier}" beklenen "${expectedGroupIdentifier}" değil. Ana uygulama ile widget aynı grubu paylaşmazsa widget hep boş görünür.`
  );
}

const widgets = Array.isArray(widgetProps.widgets) ? widgetProps.widgets : [];
const careWidget = widgets.find((widget) => widget?.name === "CareQuickWidget");
if (!careWidget) {
  fail("CareQuickWidget widget yapılandırmasında tanımlı değil.");
}

const families = careWidget?.ios?.supportedFamilies ?? careWidget?.supportedFamilies ?? [];
for (const family of ["systemSmall", "systemMedium", "accessoryRectangular", "accessoryInline"]) {
  if (!families.includes(family)) {
    fail(`CareQuickWidget ${family} boyutunu desteklemiyor.`);
  }
}

// Live Activity'ler widget listesine YAZILMAZ: expo-widgets üretilen
// WidgetBundle'a her zaman tek bir genel WidgetLiveActivity ekler ve
// çalışma anında adına göre eşleştirir. Yanlışlıkla eklenirse Swift
// derlemesi "kullanılmayan tip" değil, eksik tip hatasıyla kırılır.
const liveActivityNames = ["CareTimerLiveActivity", "NightShiftLiveActivity"];
for (const name of liveActivityNames) {
  if (widgets.some((widget) => widget?.name === name)) {
    fail(
      `${name} expo-widgets widgets listesine eklenmiş. Live Activity'ler widget olarak kaydedilmez; kayıt createLiveActivity() ile JS tarafında yapılır.`
    );
  }
}


// --- App Store Review Guideline 4.5.4 · pazarlama push'u ----------------
// "Push Notifications should not be used for promotions or direct marketing
//  purposes unless customers have explicitly opted in to receive them via
//  consent language displayed in your app's UI, and you provide a method in
//  your app for a user to opt out from receiving such messages."
//
// Bu bölüm kuralın KODDA yaşadığını doğrular. Tek bir ekran metni yeterli
// değil: onay yokken gönderimin teknik olarak mümkün olmaması gerekir.

const marketingConsentPath = "src/features/notifications/marketingConsent.ts";
const marketingConsent = readSource(
  marketingConsentPath,
  "Pazarlama onayının tek doğruluk kaynağı olan modül silinmiş."
);

for (const marker of ["notify_premium_offers", "premium_offer_consent_at"]) {
  if (!marketingConsent.includes(marker)) {
    fail(
      `${marketingConsentPath} içinde ${marker} kontrolü yok; açık onay iki ayaklı olmalı (anahtar + onay damgası).`
    );
  }
}

const campaignFunctionPath =
  "src/supabase/functions/send-seasonal-premium-campaigns/index.ts";
const campaignFunction = readSource(
  campaignFunctionPath,
  "Kampanya edge fonksiyonu bulunamadı; doğrulama kuralları güncellenmeli."
);

if (!campaignFunction.includes("marketingConsent.ts")) {
  fail(
    `${campaignFunctionPath} ortak onay modülünü içe aktarmıyor. Kural istemci ve sunucuda ayrışırsa onaysız kullanıcıya kampanya gider.`
  );
}

for (const guard of [
  "assertMarketingPushAllowed",
  "isMarketingPushAllowed",
  '.eq("notify_premium_offers", true)',
  '.not("premium_offer_consent_at", "is", null)'
]) {
  if (!campaignFunction.includes(guard)) {
    fail(
      `${campaignFunctionPath} içinde \`${guard}\` yok. Onay olmadan kampanya gönderimini engelleyen katmanlardan biri kaldırılmış.`
    );
  }
}

// Yorum satırlarında geçen kelimeye değil, gerçekten atanan DEĞERE bakılır.
const campaignLevels = [
  ...campaignFunction.matchAll(/interruptionLevel\s*[:=]\s*"([^"]+)"/g)
].map((match) => match[1]);
for (const level of campaignLevels) {
  if (level !== "passive") {
    fail(
      `Kampanya bildirimi interruptionLevel "${level}" kullanıyor. Pazarlama bildirimi Odak modunu delemez; yalnızca "passive" kabul edilir (App Review 4.5.4).`
    );
  }
}
if (/"criticalAlert"|critical:\s*true/.test(campaignFunction)) {
  fail("Kampanya bildirimi critical alert kullanıyor; bu ayrıca Apple onayı gerektirir ve pazarlamada asla kullanılamaz.");
}

if (!campaignFunction.includes('interruptionLevel: "passive"')) {
  warn(
    "Kampanya bildiriminde interruptionLevel açıkça passive değil; sessiz teslim tercih edilmeli."
  );
}

const migrationPath =
  "src/supabase/migrations/20260914000001_premium_offer_push_consent.sql";
const migration = readSource(
  migrationPath,
  "Pazarlama onayı damgasını ekleyen migration yok; sunucu tarafı zorlama eksik kalır."
);
if (!migration.includes("profiles_premium_offer_consent_required")) {
  fail(
    `${migrationPath} içinde onay zorunluluğu check constraint'i yok; bayrak veritabanında onaysız true olabilir.`
  );
}

// Pazarlama tipleri Time Sensitive beyaz listesine SIZMAMALI.
const interruptionPath = "src/features/notifications/interruption.ts";
const interruption = readSource(
  interruptionPath,
  "Time Sensitive beyaz listesi modülü bulunamadı."
);
for (const marketingType of [
  "premium_campaign",
  "premium_offer",
  "product_announcement"
]) {
  if (interruption.includes(marketingType)) {
    fail(
      `Time Sensitive beyaz listesinde pazarlama tipi "${marketingType}" var. Bu tipler yalnızca "active" seviyede teslim edilebilir.`
    );
  }
}

// --- Onboarding: soğuk izin istemi olmamalı ------------------------------
const onboardingPath = "app/(auth)/onboarding.tsx";
const onboarding = readSource(onboardingPath, "Onboarding ekranı bulunamadı.");

if (!onboarding.includes("requestNotificationPermissionForFeature")) {
  fail(
    `${onboardingPath} sistem iznini ön-izin akışından istemiyor. iOS istemi bir kez sorulur; bağlamsız sorulan istem hem kaybedilir hem App Review'da not edilir.`
  );
}
if (/registerAndSavePushToken\(\s*\)/.test(onboarding)) {
  fail(
    `${onboardingPath} registerAndSavePushToken() çağrısını izin isteyecek şekilde (argümansız) yapıyor. İzin ön-izin ekranından sonra ayrıca istenmeli, token alınırken ikinci kez sorulmamalı.`
  );
}

// --- Ayarlar: kapatma yolu ve sistem ayarları kısayolu -------------------
const settingsPath = "app/(tabs)/settings/index.tsx";
const settings = readSource(settingsPath, "Ayarlar ekranı bulunamadı.");

if (!settings.includes("openNotificationSettings")) {
  fail(
    `${settingsPath} sistem bildirim ayarları kısayolu sunmuyor; izin reddedilmişse kullanıcının geri dönüş yolu kalmaz.`
  );
}
if (!settings.includes("MARKETING_CONSENT_COPY")) {
  fail(
    `${settingsPath} pazarlama onay metnini ortak modülden almıyor. 4.5.4 "consent language displayed in your app's UI" şartı tek yerden yönetilmeli.`
  );
}
if (!settings.includes("notify_premium_offers")) {
  fail(
    `${settingsPath} kampanya bildirimlerini kapatma anahtarını sunmuyor (4.5.4 opt-out şartı).`
  );
}
if (!settings.includes("setLiveActivityEnabled")) {
  warn(
    "Ayarlar'da kilit ekranı sayacını kapatma anahtarı görünmüyor; Live Activity sistem ayarlarından her zaman kapatılamaz."
  );
}

console.log(
  `[ios-notifications] Live Activity anahtarları, App Group ${expectedGroupIdentifier}, widget bundle ${expectedWidgetBundleId}, ${EXPECTED_SOUND} ve App Review 4.5.4 pazarlama onayı zincirinin tamamı doğrulandı.`
);

function readSource(path, missingMessage) {
  if (!existsSync(path)) fail(`${path} bulunamadı. ${missingMessage}`);
  return readFileSync(path, "utf8");
}

function findPlugin(name) {
  return plugins.find(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name
  );
}

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
    fail(`Expo yapılandırması okunamadı: ${error.message}`);
  }
}

function warn(message) {
  console.warn(`[ios-notifications] UYARI: ${message}`);
}

function fail(message) {
  console.error(`[ios-notifications] ${message}`);
  process.exit(1);
}
