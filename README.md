# Hamile & Bebek Takip

Expo + React Native + Supabase tabanlı hamilelik ve bebek takip uygulaması iskeleti.

## Kapsam

- Expo Router ile dosya tabanlı navigasyon
- TypeScript strict mode
- Supabase Auth/DB/Storage için merkezi API katmanı
- RevenueCat abonelik ve AdMob reklam soyutlamaları
- React Query ve Zustand altyapısı
- Aşı, büyüme, galeri, ninni, forum ve paywall ekran iskeletleri
- EAS Build, environment ve GitHub'a hazır `.gitignore`

Supabase SQL migration tarafı bilinçli olarak eklenmedi. Şema ve RLS politikalarını sen çalıştırdıktan sonra `src/types/database.ts` dosyasını generated types ile değiştir.

## Kurulum

```bash
npm install
cp .env.example .env
npm run start
```

Expo uyumlu native paketleri güncellemek için:

```bash
npx expo install --fix
```

## Önemli Env Değerleri

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`
- `EXPO_PUBLIC_ADMOB_IOS_APP_ID`

## GitHub'a Hazırlama

```bash
git init
git add .
git commit -m "Initial Expo app scaffold"
gh repo create HamileTakipApp --private --source=. --remote=origin --push
```

`.env`, native credential dosyaları ve store imzalama dosyaları ignore edilir.

## Yasal Sayfalar ve Vercel Deploy

Yasal sayfalar `public/` klasöründe statik HTML olarak tutulur. Vercel import
ekranında şu ayarlarla yayınlanır:

- Application Preset: `Other`
- Root Directory: `./`
- Build Command: boş
- Output Directory: `public`
- Install Command: boş
- Environment Variables: boş

GitHub'a `main` branch'ine push edildiğinde Vercel bağlı projede otomatik yeni
deployment başlatır. EAS build almak tek başına Vercel deploy tetiklemez; Vercel'i
tetikleyen işlem GitHub'a push etmektir.

Deploy sonrası kullanılacak URL'ler:

- Gizlilik Politikası: `https://hamile-takip-app-vqgw.vercel.app/gizlilik-politikasi/`
- KVKK Aydınlatma Metni: `https://hamile-takip-app-vqgw.vercel.app/kvkk-aydinlatma-metni/`
- Açık Rıza Metni: `https://hamile-takip-app-vqgw.vercel.app/acik-riza-metni/`
- Kullanım Şartları: `https://hamile-takip-app-vqgw.vercel.app/kullanim-sartlari/`
- Sorumluluk Reddi: `https://hamile-takip-app-vqgw.vercel.app/sorumluluk-reddi/`
- Hesap Silme: `https://hamile-takip-app-vqgw.vercel.app/delete-account/`

Mağaza ve servis kontrol listesi:

- [ ] RevenueCat Paywall Editor > Şartlar linki -> `/kullanim-sartlari/`
- [ ] RevenueCat Paywall Editor > Gizlilik linki -> `/gizlilik-politikasi/`
- [ ] App Store Connect > App Information > Privacy Policy URL -> `/gizlilik-politikasi/`
- [ ] Google Play Console > App content > Privacy Policy -> `/gizlilik-politikasi/`
- [ ] Google Play Console > Data deletion URL -> `/delete-account/`
- [ ] Uygulama içi Ayarlar ekranına Gizlilik, KVKK, Açık Rıza ve Kullanım Şartları linkleri ekle
- [ ] Onboarding/kayıt ekranındaki açık rıza checkbox metinlerini `/acik-riza-metni/` ile aynı içerikte tut

Yayından önce kontrol:

- [ ] Veri sorumlusu resmi unvan/ad-soyad, adres ve başvuru e-postasını kontrol et
- [ ] Yetkili mahkeme/şehir bilgisini kendi hukuki durumuna göre kontrol et
- [ ] Özel nitelikli veri ve yurt dışı aktarım maddelerini hukukçuya kontrol ettir
