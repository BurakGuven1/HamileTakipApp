# Meta App Events — iOS

## Proje ve entegrasyon modeli

Anne+ native `ios/` ve `android/` klasörlerini repoda tutmayan Expo managed/CNG
projesidir. Entegrasyon Expo Prebuild sırasında config plugin ile üretilir:

- Expo SDK: `57.0.9`
- React Native: `0.86.2`
- `react-native-fbsdk-next`: `13.4.3`
- `expo-tracking-transparency`: `57.0.1`
- iOS Bundle ID: `com.burakguven.hamiletakip`

`react-native-fbsdk-next` config plugin'i mevcut `hamiletakip` deep-link scheme'ini
silmez. `fb<META_APP_ID>` scheme'ini, Meta query scheme'lerini ve güncel Meta
SKAdNetwork kimliklerini (`v9wttpbfk9.skadnetwork` ve
`n38lu8286q.skadnetwork`) mevcut Info.plist değerleriyle birleştirir.

## Build-time yapılandırma

Yerel build için gitignored `.env` dosyasında şunlar bulunmalıdır:

```dotenv
META_APP_ID=28065787783017675
META_CLIENT_TOKEN=<META_CLIENT_TOKEN>
EXPO_PUBLIC_META_TEST_EVENT_ENABLED=false
```

`META_CLIENT_TOKEN`, Meta Developers > App settings > Advanced bölümündeki
Client Token'dır. `META_APP_SECRET` hiçbir zaman bu projeye, istemci ortamına,
GitHub secret'larına veya EAS build ortamına eklenmemelidir.

Client Token `EXPO_PUBLIC_` öneki kullanmaz ve JavaScript `extra` alanına
aktarılmaz. Config plugin bunu build sırasında Info.plist'e yazar. Bu nedenle
kaynak kodda tutulmaz fakat dağıtılan IPA içinde gerçek anlamda gizli değildir.

EAS Build kullanılıyorsa production ve development build profillerinin kullandığı
EAS environment'a ekle:

```bash
eas env:create --environment production --name META_APP_ID --value 28065787783017675 --visibility plaintext
eas env:create --environment production --name META_CLIENT_TOKEN --value <META_CLIENT_TOKEN> --visibility sensitive
```

Repository'deki TestFlight GitHub Action'ı EAS environment okumaz. GitHub >
Settings > Environments > `EXPO_OWNER` > Environment secrets altında ayrıca
`META_APP_ID` ve `META_CLIENT_TOKEN` tanımlanmalıdır. Workflow native proje
üretmeden önce `npm run verify:meta` ile değerleri doğrular.

## Çalışma zamanı davranışı

- SDK uygulama başlangıcında initialize edilir; otomatik app install/activate
  event'leri açıktır.
- App Events gönderimi ATT cevabına bağlı değildir.
- Info.plist başlangıç politikası advertiser ID collection kapalıdır.
- ATT yalnızca iOS'ta istenir. İzin `granted` ise advertiser tracking ve IDFA
  collection açılır; diğer tüm durumlarda ikisi de kapalı kalır.
- Supabase `signUp` ilk kez başarı verdiğinde standard
  `CompleteRegistration` parametresiz gönderilir.
- RevenueCat purchase callback'i premium entitlement'ı aktif ve satın alınan
  ürünle eşleşen durumda doğrular:
  - ücretsiz dönem: `StartTrial` ve `Subscribe`,
  - ücretli abonelik/ücretli intro dönem: `Subscribe` ve `Purchase`,
  - `Purchase`: RevenueCat Store product'ındaki tahsil edilen fiyat ve ISO 4217
    para birimiyle gönderilir.
- Restore, entitlement refresh ve Supabase reconciliation Meta conversion event'i
  üretmez. Her kayıt/transaction/event türü AsyncStorage ile kalıcı olarak
  deduplike edilir.
- Meta event parametrelerine ad, e-posta, telefon, Supabase user ID, RevenueCat
  user ID, gebelik/sağlık/bebek verisi veya başka kişisel veri eklenmez.

Meta Developers tarafında otomatik App Store purchase logging kapalı tutulmalıdır;
`Purchase` bu uygulama tarafından manuel gönderilir.

## Events Manager development testi

Expo Go native Meta SDK içermediği için kullanılamaz. Gerçek iPhone'a development
client kurarak test et:

1. Meta App Dashboard'da iOS platformunun bundle ID değerini
   `com.burakguven.hamiletakip` olarak doğrula ve test hesabına gerekli app rolünü
   ver.
2. Yerel/development environment'ta
   `EXPO_PUBLIC_META_TEST_EVENT_ENABLED=true` yap ve yeni native development
   build üret. Bu değişken production ortamında hiç tanımlanmamalı veya `false`
   olmalıdır.
3. Events Manager > ilgili App data source > Test Events ekranını aç.
4. Uygulamayı gerçek cihazda aç. Otomatik activate/install event'ine ek olarak
   `anne_meta_integration_test` görünmelidir. Bu özel event yalnızca `__DEV__`
   build'de derlenir ve gönderildikten sonra hemen flush edilir.
5. Yeni bir Supabase hesabı oluştur; `CompleteRegistration` bir kez görünmelidir.
6. App Store sandbox hesabıyla RevenueCat paywall'undan deneme başlat;
   `StartTrial` ve `Subscribe` görünmeli, `Purchase` görünmemelidir.
7. Ücret tahsil eden bir sandbox satın alma yap; `Subscribe` ile birlikte doğru
   `value` ve `currency` içeren `Purchase` görünmelidir.
8. Aynı paywall sonucunu tekrar açmak veya restore yapmak aynı conversion event'ini
   yeniden üretmemelidir.
9. ATT'yi önce reddederek App Events'in gelmeye devam ettiğini; uygulamayı silip
   yeniden kurduktan sonra izin vererek advertiser tracking'in yalnızca granted
   durumda açıldığını doğrula.

Test Events teslimatı birkaç dakika gecikebilir. Event isimleri ve satın alma
değerleri doğru göründükten sonra development test bayrağını kapatıp production
native build'i yeniden üret.

## TestFlight ve App Store kontrol listesi

1. GitHub/EAS production ortamında `META_APP_ID` ve `META_CLIENT_TOKEN` mevcut,
   `META_APP_SECRET` ve `EXPO_PUBLIC_META_TEST_EVENT_ENABLED=true` yok olmalı.
2. Meta App Dashboard'da uygulamanın iOS bundle ID'si ve App Store ID'si doğru
   olmalı; otomatik App Store purchase logging kapalı kalmalı.
3. Events Manager/AEM event önceliklerinde gerçek iş event'lerini yapılandır:
   `Purchase`, `Subscribe`, `StartTrial`, `CompleteRegistration`. SKAdNetwork
   campaign şemasını Meta'nın güncel Events Manager yönlendirmesiyle yayınla.
4. TestFlight satın almaları sandbox'tır. Ücretsiz deneme ve ücretli ürün için
   event kombinasyonlarını ve para birimini Test Events/Overview'da doğrula.
5. App Store Connect > App Privacy yanıtlarında Meta SDK'nın kullanımına uygun
   olarak tracking, device identifier/IDFA, product interaction ve purchase
   bilgilerinin reklam ölçümü/kişiselleştirme amaçlarını beyan et. Nihai beyanı
   App Store Connect'in güncel veri türleri ve Meta SDK privacy manifest raporuyla
   karşılaştır.
6. ATT amacı Info.plist'te Türkçe açıklanır. Uygulama ATT reddedildiğinde tüm
   temel özellikleri ve App Events'i çalıştırmaya devam etmelidir; IDFA kullanımı
   reddedilmiş durumda kapalı kalmalıdır.
7. Sağlık, gebelik ve çocuk verilerini Meta custom audience, advanced matching
   veya event parametrelerine bağlama. `setUserData` ve `setUserID` bu
   entegrasyonda özellikle kullanılmaz.

SKAdNetwork/AEM gereksinimleri Meta tarafından değiştirilebildiği için her App
Store gönderiminden önce [Meta SKAdNetwork dokümanını](https://developers.facebook.com/docs/SKAdNetwork)
ve Events Manager Diagnostics ekranını yeniden kontrol et.
