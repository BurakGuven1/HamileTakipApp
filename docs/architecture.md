# Mimari Notlar

## Stack

- React Native + Expo + EAS Build
- Expo Router
- TypeScript strict mode
- Supabase Auth, Postgres, Storage, Edge Functions, Realtime
- RevenueCat
- Google AdMob
- React Query
- Zustand

## Klasör Yapısı

```text
app/                 Expo Router ekranları
src/api/             Supabase query/mutation fonksiyonları
src/components/      Ortak UI bileşenleri
src/features/        Özellik bazlı UI ve iş mantığı
src/hooks/           Ortak hook'lar
src/lib/             SDK wrapper ve altyapı
src/store/           Lokal state
src/theme/           Tasarım tokenları
src/types/           Supabase generated type hedefi
src/utils/           Saf yardımcı fonksiyonlar
```

## Güvenlik İlkeleri

- Component'lerde doğrudan Supabase client çağrısı yapılmaz.
- Kişisel tablolar RLS ile `auth.uid()` üzerinden izole edilir.
- Forum client'ı `author_id` okumaz. Public view sadece anonim nickname ve içerik döndürmelidir.
- Storage bucket önerisi:
  - `baby-photos`: private, signed URL
  - `lullabies`: public read, admin write

## MVP Sırası

1. Auth ve onboarding
2. Bebek profili
3. Aşı takibi
4. Büyüme takibi
5. Fotoğraf galerisi
6. Ninni kütüphanesi
7. Forum
8. AdMob reklam kapısı
9. RevenueCat abonelik
10. Analytics eventleri
