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
