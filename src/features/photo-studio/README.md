# Foto Stüdyo

Annenin fotoğrafını **hiç değiştirmeden** paylaşılabilir bir anı kartına çeviren iki akış:

- **Aylık anı kartı** (`app/photo-studio/milestone.tsx`) — bebeğin fotoğrafına kaç aylık
  olduğunu, kilo/boy rozetlerini ve konsept süslemelerini ekler.
- **Karın ışıltısı** (`app/photo-studio/belly.tsx`) — hamile karnına taş/kalp/çiçek
  yapıştırmalarını serper.

## Temel ilke: fotoğrafa dokunulmaz

Fotoğraf hiçbir aşamada piksel düzeyinde işlenmez. Kart, altta fotoğraf + üstünde ayrı
bir süsleme katmanı olan bir React Native görünümüdür; dışa aktarım bu görünümün
`react-native-view-shot` ile çekilmesidir. Yüz, saç, kıyafet, arka plan ve renkler
olduğu gibi kalır. Yüz tanıma, arka plan silme veya üretken görsel modeli yok.

## Dosyalar

| Dosya | İş |
| --- | --- |
| `types.ts` | Katmanın sözleşmesi (slot, palet, elips, taş). |
| `concepts.ts` | Konsept kataloğu ve premium kilidi. |
| `milestone.ts` | Yazı sadeleştirme (30 karakter), ölçü/tarih biçimleri, yaş etiketi, slot yerleşimi. |
| `scatter.ts` | Karın taşlarının tohumlu (deterministik) dağılımı ve elips sınırları. |
| `stickers.tsx` | Tüm süslemelerin SVG çizimleri. |
| `MilestoneCard.tsx` / `BellyCard.tsx` | Dışa aktarılan kart görünümleri. |
| `ConceptPicker.tsx` | Konsept seçici. |
| `exportCard.ts` | Kart yakalama, ölçekleme ve paylaşma. |

## Telif

Süslemelerin tamamı kod ile çizilir; dışarıdan görsel indirilmez. Lisanslı çizgi film
karakterleri (Winnie the Pooh ve benzerleri) **bilerek yok** — uygulamada dağıtılmaları
telif ihlali olurdu ve anneler bu kartları sosyal medyada paylaşıyor.

## Premium

`memory_studio` paketi. Her iki stüdyoda da ilk iki konsept ücretsiz; kilitli konsept
yine de seçilip önizlenebilir, paywall dışa aktarma anında açılır. Değer anını
görmeden gelen kilit kimseyi aboneye çevirmiyor.

## Dağılım neden tohumlu?

`scatterBellyStickers` fotoğraf URI'si + karıştırma sayacından türeyen bir tohum
kullanır. Böylece konsept değişince ya da ekran yeniden çizilince taşlar yerinden
oynamaz ve dışa aktarılan kart ekranda görülenin aynısı olur. Anne düzeni beğenmezse
"yeniden dağıt" ile tohumu değiştirir.
