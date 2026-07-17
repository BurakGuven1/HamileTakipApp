# GitHub Actions ile TestFlight

Bu depo, Expo bulut derlemesine ihtiyaç duymadan GitHub'un macOS çalıştırıcısında
native iOS projesini üretip imzalar ve TestFlight'a yükler. Çalıştırmak için
`.github/workflows/testflight.yml` dosyasındaki **Build and upload iOS to
TestFlight** akışını Actions sekmesinden **Run workflow** ile başlat.

Workflow GitHub repository secret'larını kullanır. GitHub deposunda
**Settings > Secrets and variables > Actions > Secrets** yolunu aç ve
**New repository secret** ile aşağıdaki değerleri ekle. Bu seçim, private
repoda GitHub Free kullanan hesaplarda environment secret'larının workflow'a
aktarılmaması sorununu önler.

## Uygulama yapılandırması

| Secret adı | Değer |
| --- | --- |
| `EXPO_OWNER` | Expo hesabı adı: `burakguven351999` |
| `EAS_PROJECT_ID` | Expo projesinin UUID'si: `710c02c1-ddbb-4433-818f-00dadd19a758` |
| `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` | `com.burakguven.hamiletakip` |
| `EXPO_PUBLIC_SUPABASE_URL` | Mevcut `.env` dosyandaki aynı değer |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mevcut `.env` dosyandaki aynı değer |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Mevcut `.env` dosyandaki aynı değer |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Mevcut `.env` dosyandaki aynı değer (genellikle `premium`) |

`EXPO_PUBLIC_*` değerleri uygulamanın içine gömülür; bunlar sunucu sırları için
uygun değildir. Bu projedeki Supabase **anon** anahtarı ve RevenueCat SDK
anahtarları istemci anahtarlarıdır. GitHub'da secret kullanılması, yalnızca
workflow günlüklerinde ve kaynak ayarlarda kazara görünmelerini önler.

## Apple imzalama secret'ları

| Secret adı | Nasıl hazırlanır |
| --- | --- |
| `APPLE_TEAM_ID` | [Apple Developer Account](https://developer.apple.com/account) > Membership sayfasındaki 10 karakterli Team ID. |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Mac'te Keychain Access'ten **Apple Distribution** sertifikasını **private key ile birlikte** `.p12` olarak dışa aktar; aşağıdaki Base64 komutunun çıktısını yapıştır. |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | `.p12` dışa aktarırken belirlediğin parola. |
| `IOS_APP_PROVISIONING_PROFILE_BASE64` | Apple Developer > Certificates, Identifiers & Profiles > Profiles alanından `com.burakguven.hamiletakip` için oluşturup indirdiğin **App Store Connect** profile'ın Base64 çıktısı. |
| `IOS_WIDGET_PROVISIONING_PROFILE_BASE64` | Aynı alanda `com.burakguven.hamiletakip.widgets` App ID'si için oluşturup indirdiğin **App Store Connect** profile'ın Base64 çıktısı. |

Profil oluştururken iki App ID'nin de Apple Developer portalında mevcut olması
gerekir. Widget uzantısı push notifications kullandığı için, widget App ID'sinde
gerekli capability'lerin etkin olduğundan ve profilin bu değişikliklerden sonra
yeniden oluşturulduğundan emin ol.

Apple Developer portalında bir **Apple Distribution** sertifikası oluştururken
CSR istenir. Mac zorunlu değildir: Windows'ta OpenSSL ile CSR ve ardından `.p12`
oluşturabilirsin. Bu dosyalar yalnızca kendi bilgisayarında kalmalı; repoya
eklenmemeli.

```powershell
# Git for Windows kuruluysa önce Git Bash açıp bu komutları çalıştır.
openssl req -new -newkey rsa:2048 -nodes -keyout ios_distribution.key -out ios_distribution.certSigningRequest -subj "/emailAddress=EMAILINIZ/CN=ADINIZ SOYADINIZ/C=TR"
```

Apple'ın sertifika ekranına `ios_distribution.certSigningRequest` dosyasını
yükle ve indirdiğin `ios_distribution.cer` dosyasını aynı klasöre koy. Ardından:

```powershell
openssl x509 -inform DER -in ios_distribution.cer -out ios_distribution.pem
openssl pkcs12 -export -out distribution-certificate.p12 -inkey ios_distribution.key -in ios_distribution.pem
```

İkinci komutun sorduğu parola `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` secret'ı
olur. Oluşan `distribution-certificate.p12` dosyasını Base64'e çevirip ilgili
GitHub secret'ına yapıştır.

## App Store Connect API secret'ları

| Secret adı | Nereden alınır |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect > Users and Access > Integrations > App Store Connect API > Team Keys alanındaki **Key ID**. |
| `APP_STORE_CONNECT_ISSUER_ID` | Aynı sayfanın üst bölümündeki **Issuer ID**. |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Aynı ekranda oluşturulan API key'in bir kez indirilebilen `.p8` dosyasının Base64 çıktısı. |

API key oluştururken **App Manager** rolü TestFlight yüklemesi için uygundur;
gereksiz yere Admin rolü verme. `.p8` dosyası yalnızca bir kez indirilebilir;
kaybolursa eski anahtarı revoke edip yenisini oluşturman gerekir.

## Base64 komutları (macOS)

Terminal'de aşağıdaki komutlar yalnızca çıktıyı üretir; çıktıyı ilgili GitHub
secret alanına yapıştır. Dosyaları repoya ekleme.

```bash
base64 -i distribution-certificate.p12 | pbcopy
base64 -i HamileTakipApp_AppStore.mobileprovision | pbcopy
base64 -i HamileTakipWidget_AppStore.mobileprovision | pbcopy
base64 -i AuthKey_ABC123DEFG.p8 | pbcopy
```

Windows PowerShell kullanıyorsan:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\distribution-certificate.p12')) | Set-Clipboard
```

İkinci, üçüncü ve dördüncü dosya için de aynı komutu dosya yolunu değiştirerek
çalıştır. Workflow'a gönderilen IPA ayrıca 14 gün süreyle GitHub Actions
artifact'ı olarak tutulur.

## İlk çalıştırmadan önce

1. App Store Connect'te `com.burakguven.hamiletakip` bundle ID'siyle bir iOS app kaydı oluşturulmuş olmalı.
2. App kaydının bundle ID'si, buradaki `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` ile birebir aynı olmalı.
3. Her TestFlight yüklemesinde iOS build number önceki yüklemelerden büyük olmalı. Workflow her native proje üretiminde Unix zaman damgasını build number olarak verir; bu nedenle elle artırman gerekmez.

Bu akış EAS Build'i çağırmaz. GitHub'ın macOS çalıştırıcısı ücretli dakika
kullanır; GitHub hesabındaki Actions kotasını kontrol et.
