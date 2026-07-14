# Ninni Kütüphanesi

Uygulama ninnileri `public.lullabies` tablosundan listeler ve ses dosyasını
public-read `lullabies` Supabase Storage bucket'ından oynatır.

## En Kolay Yükleme

1. Supabase Dashboard > Storage > `lullabies` bucket'a gir.
2. Ninni dosyalarını yükle. Desteklenen tipler migration'a göre `mp3`, `aac`
   veya `m4a/mp4 audio`; dosya limiti varsayılan olarak 50 MB.
3. Supabase Dashboard > Table Editor > `lullabies` tablosuna her dosya için
   bir kayıt ekle.

Örnek kayıt:

```sql
insert into public.lullabies (
  title,
  duration_minutes,
  storage_path,
  category,
  is_active
) values (
  'Uyku Ninnisi 1',
  15,
  'uyku-ninnisi-1.mp3',
  'Ninni',
  true
);
```

`storage_path`, bucket içindeki dosya yoludur. Örneğin dosyayı
`lullabies/uyku-ninnisi-1.mp3` bucket URL'iyle görüyorsan tabloya sadece
`uyku-ninnisi-1.mp3` yaz. Klasör kullanırsan `klasik/uyku-ninnisi-1.mp3`
gibi klasörle birlikte yaz.

`duration_minutes` şu an yalnızca `15`, `30` veya `60` olabilir; ekrandaki
süre filtreleri de bu değerlere göre çalışır.
