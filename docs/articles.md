# Makale İçeriği Ekleme

Makaleler artık uygulama kodunda değil Supabase'de tutulur.

## Önerilen Yol: Lokal HTML Panel

Panel dosyası:

`tools/articles-admin.html`

Bu dosyayı tarayıcıda aç. Panel şunları yapar:

- Makale ekler/günceller/siler.
- Kapak görselini `article-images` bucket'ına yükler.
- Makalenin timeline içinde kaçıncı hafta veya hangi hafta aralığında görüneceğini kaydeder.
- `is_published` açık olduğunda app'te görünür.

Panel service role key kullanmaz. Supabase anon key ve yetkili kullanıcı hesabıyla çalışır.

## Admin Yetkisi Verme

Önce migration'ları uygula:

```bash
supabase db push
```

Sonra Supabase SQL Editor'de kendi hesabını makale admini yap:

```sql
insert into public.article_admins (user_id)
select id
from auth.users
where email = 'SENIN_APP_HESABI_EMAILIN';
```

Bu adımı yapmadan HTML panel makale veya görsel yazamaz.

## Görsel Yükleme

HTML panel görseli otomatik şu formatta yükler:

- `slug/cover.webp`
- `slug/cover.jpg`
- `slug/cover.png`

Manuel yüklemek istersen:

1. Supabase Dashboard > Storage bölümünü aç.
2. `article-images` bucket'ına gir.
3. Makale slug'ı ile klasör oluştur:
   - `hamileligin-10-haftasi/cover.webp`
   - `hamilelikte-3-ay/cover.webp`
4. Görsel için öneri:
   - WebP tercih et.
   - Ana sayfa kartları için yatay veya kare kapak iyi çalışır.
   - Dosya 10 MB altında olmalı.

## Makale Metni Ekleme

Supabase Dashboard > Table Editor > `articles` tablosuna satır ekle.

Alanlar:

- `slug`: URL anahtarı. Türkçe karakter kullanma. Örn. `hamileligin-10-haftasi`
- `title`: Makale başlığı. Örn. `Hamileliğin 10. Haftası`
- `period`: Kart etiketi. Örn. `10. hafta`, `3. ay`, `İpuçları`. Boş bırakırsan panel kategoriye göre otomatik doldurur.
- `category`: `hafta`, `ay`, `bebek`, `ipuclari`
- `excerpt`: Kartlarda görünen kısa açıklama.
- `body`: Makale metni. Paragrafları boş satırla ayır.
- `image_path`: Storage içindeki görsel yolu. Örn. `hamileligin-10-haftasi/cover.webp`
- `accent`: Görsel yoksa kullanılan renk. Örn. `#D97895`
- `sort_order`: Sıralama. Küçük sayı önce görünür. Ana sayfa vitrini ilk 4 yayındaki makaleyi bu sıraya göre gösterir.
- `timeline_start_week`: Hamilelik çizelgesinde görüneceği ilk hafta. Örn. `10`
- `timeline_end_week`: Hamilelik çizelgesinde görüneceği son hafta. Örn. `12`
- `is_published`: App'te görünmesi için `true` yap.
- `published_at`: Yayın tarihi. Boş bırakabilirsin.

## Ana Sayfa Vitrini

Ana sayfadaki makale vitrini `is_published = true` olan makaleleri `sort_order` değerine göre çeker ve ilk 4 tanesini gösterir.

## Hamilelik Çizelgesi

Hamilelik çizelgesinde makale göstermek için:

- Tek hafta: `timeline_start_week = 15`, `timeline_end_week = 15`
- Aralık: `timeline_start_week = 12`, `timeline_end_week = 16`
- Tüm gebelik: `timeline_start_week = 1`, `timeline_end_week = 42`

Bu alanlar boşsa makale sadece Makaleler ekranında ve ana sayfa vitrini sıralamasında görünür, timeline'da görünmez.

## Güvenlik Notu

HTML paneli local kullan. Public bir siteye koyacaksan sadece anon key kullanıldığı için service role sızmaz; yine de makale yazma yetkisi yalnızca `article_admins` tablosunda yetkilendirilen hesaplarda olmalıdır.
