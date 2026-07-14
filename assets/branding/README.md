# Anne+ App Logo Dosyaları

Build almadan önce bu klasöre aşağıdaki PNG dosyalarını koy.

## Zorunlu

### `app-icon.png`
- Boyut: `1024x1024 px`
- Format: PNG
- Arka plan: opak olmalı, transparan olmasın
- Köşe: yuvarlatma ekleme; iOS ve Android kendisi maskeler
- Öneri: krem zemin `#FBF6EF`, logo merkezde, güvenli boşluk en az 120 px

### `adaptive-icon.png`
- Boyut: `1024x1024 px`
- Format: PNG
- Arka plan: transparan olabilir
- Kullanım: Android adaptive icon foreground görseli
- Öneri: sadece ana logo/işaret olsun, önemli kısım ortadaki yaklaşık `640x640 px` alanda kalsın

### `splash-icon.png`
- Boyut: `1024x1024 px`
- Format: PNG
- Arka plan: transparan olmalı
- Kullanım: splash ekranında krem `#FBF6EF` zemin üstünde gösterilir
- Öneri: logo ortada, çok büyük olmadan temiz görünmeli

## Not

Bu dosyalar yerleşmeden EAS build veya Expo export hata verebilir.
