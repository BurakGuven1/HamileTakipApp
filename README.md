# Anne+

Anne+, gebelikten doğum sonrasına uzanan süreci tek bir aile kaydı içinde yöneten iOS ve Android uygulamasıdır. Gebelik haftası, bebek bakımı, büyüme, aşılar, anılar ve aile içi koordinasyon birbirinden kopuk araçlar olarak değil, aynı yolculuğun devam eden olayları olarak ele alınır.

Bu depo yalnızca bir ekran iskeleti değildir. Uygulama akışları, Supabase migration ve RLS politikaları, Edge Function'lar, RevenueCat abonelik altyapısı, bildirimler, widget'lar ve statik yasal sayfalar kaynak kodun parçasıdır.

> Anne+ tanı veya tedavi sunmaz. Tıbbi içerikler bilgilendirme amaçlıdır; sağlık kararlarında yetkili bir sağlık profesyoneline başvurulmalıdır.

## Yaşam evresi modeli

Kullanıcının aktif evresi profilindeki gebelik durumundan belirlenir. Evre değiştiğinde geçmiş kayıtlar silinmez; yalnızca ana deneyimin öncelikleri ve gösterilen araçlar değişir.

| Alan | Gebelik | Annelik / bebek bakımı |
| --- | --- | --- |
| Ortak alanlar | Galeri, Aşı Merkezi, Makaleler, topluluk ve hesap ayarları | Galeri, Aşı Merkezi, Makaleler, topluluk ve hesap ayarları |
| Evreye özgü odak | Gebelik haftası, zaman çizgisi, su ve beslenme takibi, doğuma hazırlık | Bebek profili, bakım günlüğü, büyüme, uyku, beslenme, bez ve süt stoğu |
| Ana ekran | Gebeliğin güncel haftası ve sıradaki gebelik eylemleri | Bebeğin güncel durumu ve sıradaki bakım eylemleri |

Aşı, galeri ve makale verileri için ayrı uygulamalar veya ayrı içerik havuzları oluşturulmaz. Aynı özellik alanları iki evrede de kullanılır; içerik ve eylemler mevcut aile bağlamına göre uyarlanır.

## Başlıca özellikler

- E-posta/şifre ve Apple ile oturum açma, anne/baba onboarding akışları
- Gebelik haftası, zaman çizgisi, günlük rehberlik ve doğuma hazırlık araçları
- Bebek profili, bakım günlüğü, gece vardiyası, büyüme ve aşı takibi
- Ortak galeri, ortak Aşı Merkezi ve tek makale havuzu
- Aile koduyla güvenli eşleştirme ve bakım koordinasyonu
- Kadınlara özel topluluk, içerik moderasyonu ve bildirim akışları
- Yerel OCR ve kural tabanlı belge açıklama; tıbbi tanı iddiası olmadan sonuçları anlaşılır hâle getirme
- RevenueCat üzerinden Premium satın alma, geri yükleme ve hak eşitleme
- iOS/Android bildirimleri, bakım hatırlatmaları ve hızlı bakım widget'ları
- Erişilebilir dokunma alanları, sistem yazı boyutu, ekran okuyucu ve azaltılmış hareket desteği

## Teknoloji

| Katman | Kullanılan yapı |
| --- | --- |
| Mobil uygulama | Expo 57, React Native 0.86, React 19, Expo Router |
| Dil ve kalite | TypeScript strict mode, Expo Doctor |
| Sunucu ve veri | Supabase Auth, Postgres, RLS, Storage, Realtime, Edge Functions |
| İstemci veri yönetimi | TanStack React Query, merkezi API katmanı |
| Abonelik | RevenueCat Purchases ve RevenueCat UI |
| Dağıtım | EAS Build, GitHub Actions, TestFlight |
| Yasal site | `public/` altında statik HTML, Vercel dağıtımı |

## Depo yapısı

```text
app/                         Expo Router ekranları ve navigasyon
src/api/                     Supabase sorgu ve mutation katmanı
src/components/              Ortak UI bileşenleri
src/features/                Özellik bazlı iş mantığı ve arayüzler
src/lib/                     SDK adaptörleri ve uygulama altyapısı
src/supabase/migrations/     Veritabanı şeması, fonksiyonlar ve RLS politikaları
src/supabase/functions/      Supabase Edge Function'ları
src/types/database.ts        Uygulamanın kullandığı Supabase tipleri
src/widgets/                 iOS ve Android widget uygulamaları
public/                      Yasal sayfalar ve statik web dosyaları
docs/                        Teknik ve operasyonel notlar
tools/                       Doğrulama ve yayın yardımcıları
```

## Gereksinimler

- Node.js 22 ve npm
- iOS için Xcode, Android için Android Studio veya fiziksel bir Expo development build
- Bağlı bir Supabase projesi
- Premium akışlarını çalıştırmak için yapılandırılmış RevenueCat projesi
- Mağaza build'leri için EAS CLI ve Expo hesabı

## Yerel kurulum

```bash
npm ci
```

Gizli veya projeye özel yapılandırma dosyaları depoya eklenmez. Proje kökünde yerel bir `.env` oluşturun ve aşağıdaki değişkenlerden kullandığınız ortam için gerekli olanları tanımlayın.

| Değişken | Amaç |
| --- | --- |
| `APP_VARIANT` | `development` veya `production` uygulama varyantı |
| `EXPO_OWNER` | Expo hesap sahibi |
| `EAS_PROJECT_ID` | EAS proje kimliği |
| `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` | iOS uygulama ve widget bundle kimliklerinin temeli |
| `EXPO_PUBLIC_ANDROID_PACKAGE` | Android package adı |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'si |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | RLS ile sınırlandırılan istemci anahtarı |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat Apple public SDK anahtarı |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Google public SDK anahtarı |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Premium entitlement kimliği; varsayılan `premium` |
| `EXPO_PUBLIC_LEGAL_BASE_URL` | Yasal sayfaların yayınlandığı kök URL |

Ardından geliştirme sunucusunu başlatın:

```bash
npm run start
```

Native bağımlılık veya plugin değişikliklerinde development build kullanın:

```bash
npm run ios
npm run android
```

`EXPO_PUBLIC_*` değişkenleri uygulama paketine gömülür ve son kullanıcı tarafından okunabilir. Bu alanlara `SUPABASE_SERVICE_ROLE_KEY`, webhook doğrulama değerleri, mağaza sertifikaları veya başka bir sunucu sırrı kesinlikle yazılmamalıdır.

## Supabase

Veritabanı migration'ları ve RLS politikaları [`src/supabase/migrations`](src/supabase/migrations) altında sürüm kontrollüdür. Edge Function kaynakları [`src/supabase/functions`](src/supabase/functions) altında tutulur.

Bağlı projeye bekleyen migration'ları uygulamak için:

```bash
supabase db push --linked --workdir src
```

Bir Edge Function'ı dağıtmak için:

```bash
supabase functions deploy <fonksiyon-adı> --workdir src
```

Sunucu anahtarları `supabase secrets set` ile tutulmalıdır. Edge Function'ların kullandığı `SUPABASE_SERVICE_ROLE_KEY`, RevenueCat webhook doğrulama değeri, moderasyon sırrı ve Expo erişim anahtarı mobil `.env` dosyasına konulmaz.

Şema değişikliklerinden sonra [`src/types/database.ts`](src/types/database.ts) yeniden üretilmeli ve uygulama koduyla birlikte commit edilmelidir:

```bash
supabase gen types typescript --linked --schema public --workdir src > src/types/database.ts
```

## Kalite kontrolleri

```bash
npm run typecheck
npm run doctor
npm run verify:revenuecat
```

GitHub Actions, `main` ve `development` branch'lerine yapılan push'larda ve pull request'lerde TypeScript kontrolünü çalıştırır. TestFlight iş akışı manuel tetiklenir; RevenueCat yapılandırmasını ve tipleri doğruladıktan sonra imzalı iOS arşivini üretip yükler.

## Build ve yayın

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Production profili build numarasını EAS üzerinden otomatik artırır. App Store/Play Store kimlik bilgileri, provisioning profilleri ve imzalama dosyaları GitHub'a eklenmemeli; EAS veya GitHub Environment secrets içinde tutulmalıdır.

## Yasal sayfalar

Yasal sayfalar [`public`](public) klasöründe statik HTML olarak tutulur. Vercel proje ayarları:

| Ayar | Değer |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `./` |
| Build Command | boş |
| Output Directory | `public` |
| Install Command | boş |

Yayınlanan adresler:

- [Gizlilik Politikası](https://hamile-takip-app-vqgw.vercel.app/gizlilik-politikasi/)
- [KVKK Aydınlatma Metni](https://hamile-takip-app-vqgw.vercel.app/kvkk-aydinlatma-metni/)
- [Açık Rıza Metni](https://hamile-takip-app-vqgw.vercel.app/acik-riza-metni/)
- [Kullanım Şartları](https://hamile-takip-app-vqgw.vercel.app/kullanim-sartlari/)
- [Sorumluluk Reddi](https://hamile-takip-app-vqgw.vercel.app/sorumluluk-reddi/)
- [Hesap Silme](https://hamile-takip-app-vqgw.vercel.app/delete-account/)

Uygulama ayarları ve paywall bu sayfalara bağlanır. App Store için Apple Standard EULA kullanılır. Google Play'de Gizlilik Politikası ve Veri Silme URL'leri ilgili mağaza alanlarına ayrıca girilmelidir.

Yayından önce veri sorumlusunun resmi bilgileri, iletişim adresi, yetkili mahkeme, özel nitelikli kişisel veri işleme ve yurt dışı aktarım hükümleri güncel işleyişle karşılaştırılmalı ve bir hukuk uzmanı tarafından doğrulanmalıdır.

## Güvenlik ve Git politikası

- `.env`, `.env.*`, native credential dosyaları ve mağaza imzalama dosyaları Git tarafından yok sayılır.
- `.env.example` yerel yapılandırma içerebildiği için bu projede bilinçli olarak sürüm kontrolü dışında tutulur.
- Supabase anon anahtarı gizli bir sunucu anahtarı değildir; güvenlik RLS politikalarıyla sağlanır. Service-role anahtarı ise yalnızca güvenilir sunucu ortamında bulunur.
- Forum ve aile verilerinin erişimi veritabanı RLS politikaları ve sunucu tarafı kontrollerle sınırlandırılır.
- Bir değer daha önce Git geçmişine girdiyse yalnızca `.gitignore` eklemek geçmiş commit'leri temizlemez. Gerçek bir sır yayımlandıysa önce ilgili sağlayıcıdan döndürülmeli, geçmiş temizliği ise ayrı ve kontrollü bir işlem olarak yapılmalıdır.
