# Google Ads iOS yükleme ölçümü

Google Ads App campaign'i yalnızca kendisine ulaşan sinyale göre optimize eder.
Bu doküman, yükleme (`first_open`) ve satın alma (`purchase`) conversion'larının
uçtan uca nasıl aktığını ve neyin nerede bozulabileceğini anlatır.

## Zincir

1. **Tıklama → yükleme postback'i.** iOS, `SKAdNetworkItems` listesinde olmayan
   bir ağa postback göndermez. Google'ın kimliği `cstr6suwn9.skadnetwork`;
   Google partner ağlar üzerinden de yayın yaptığı için tam liste
   `app.config.ts` içindeki `skAdNetworkIdentifiers` dizisinde tutulur.
2. **ATT izni.** `src/services/attribution/trackingPermission.ts` açılışta tek
   bir prompt gösterir ve cevabı hem Firebase consent'ine hem de Meta tarafına
   dağıtır. İzin verilmeden `ad_storage` / `ad_user_data` /
   `ad_personalization` kapalıdır, yani IDFA hiçbir yere gitmez.
3. **Firebase ölçümü.** `plugins/with-ios-firebase-analytics.js`, IDFA
   okuyabilen `GoogleAppMeasurement` pod'unu kullanır. Ad-id'siz varyant
   açılırsa Google Ads kullanıcı düzeyinde attribution yapamaz, elinde yalnızca
   modellenmiş veri kalır.
4. **Conversion event'leri.**
   - `first_open` — Firebase otomatik gönderir, ek kod gerekmez.
   - `sign_up` — `src/services/firebase/firebaseAnalytics.ios.ts`, kayıt başına
     bir kez (`trackFirebaseSignUpOnce`).
   - `begin_checkout` — paywall'da satın alma başlatıldığında. Kampanyanın ilk
     günlerinde `purchase` tek başına öğrenmeye yetmeyecek kadar seyrektir.
   - `purchase` — `src/services/firebase/firebasePurchase.ts`. Yalnızca
     RevenueCat entitlement'ı ile **doğrulanmış** işlemler, transaction başına
     bir kez, değer ve para birimiyle.

## Google Ads / Firebase konsol ayarları

Kod tarafı tek başına yeterli değildir:

1. Firebase Console → Integrations → Google Ads → reklam hesabını bağla.
2. Google Ads → Tools → Data manager → Firebase'den `first_open`, `sign_up`,
   `begin_checkout` ve `purchase` event'lerini conversion olarak import et.
3. `first_open` dışındaki conversion'ları "secondary" bırak; kampanyanın hedefi
   olacak tek bir primary conversion seç.
4. Kampanya yeni ise `first_open` hedefiyle başla. Haftada ~30 dönüşüme
   ulaştığında hedefi `purchase`'a (In-app action) taşı — daha erken geçersen
   bidder öğrenemez.
5. SKAdNetwork conversion value'larını Google Ads kendisi yönetir; uygulama
   içinde `updateConversionValue` çağırma.

## Doğrulama

- `npm run verify:google-ads` — SKAdNetwork listesi, ATT metni ve plugin'ler.
  `eas-build-post-install` içinde her build'de çalışır.
- `npm run verify:firebase:ios` — GoogleService-Info.plist.
- Firebase Console → DebugView: ATT prompt'unu kabul edip `first_open`,
  `begin_checkout` ve `purchase` akışını canlı izle.
- Google Ads'te conversion'ların "Recording conversions" durumuna geçmesi
  24–48 saat sürer.

## Dikkat

- Bu ayarların hiçbiri OTA güncellemesiyle gitmez; **yeni bir native build**
  ve App Store gönderimi gerekir.
- ATT'yi reddeden kullanıcılarda attribution SKAdNetwork'e düşer. Bu normaldir;
  önemli olan postback'in Google'a ulaşabiliyor olmasıdır.
- Kampanya ilk günlerde dalgalanır; öğrenme dönemi bitmeden bütçe veya hedef
  değiştirmek bidder'ı sıfırlar.
