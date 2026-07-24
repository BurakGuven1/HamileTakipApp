---
name: Anne+
description: Ailenin gebelikten bebekliğe uzanan yaşam kaydını tek bir Yaşayan İplik üzerinde tutan native takip deneyimi.
colors:
  cream-background: "#FBF6EF"
  sage-green: "#3F6F59"
  dusty-rose: "#A94F60"
  night-plum: "#372F3D"
  honey-gold: "#8A5B16"
  mist-gray: "#655F57"
  surface: "#FFFCF8"
  dark-background: "#171419"
  dark-surface: "#211D24"
  dark-surface-strong: "#29242C"
typography:
  display:
    fontFamily: "Fraunces"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.1875
  body:
    fontFamily: "Manrope"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.47
  data:
    fontFamily: "Space Mono"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.375
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sage-green}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.night-plum}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

## Overview

**Creative North Star: “Yaşayan İplik.”**

Anne+ sıcaklık hissini pastel dekorlardan değil, bir ailenin zaman içinde devam eden gerçek kaydından üretir. Tek bir çizgi gebelik haftasından doğuma, büyümeden aşılara ve anılara devam eder. Etrafındaki arayüz sakin, native ve göreve odaklıdır.

**Key Characteristics:**

- İşlevsel ve veriyle bağlı tek İplik
- Fraunces başlıklar, Manrope arayüz metni, Space Mono ölçümler
- Krem ve erik yüzeyler üzerinde ada yeşili, gül ve bal vurguları
- Yön hissi taşıyan asimetrik köşeler
- Tek güçlü orkestrasyon anı; geri kalanında ölçülü native geri bildirim

## Colors

Ana yüzeyler açık temada Krem Zemin ve sıcak beyaz yüzeylerle; koyu temada Gece Eriği, koyu yüzey ve güçlü koyu yüzey katmanlarıyla kurulur. Ada Yeşili ana eylem ve anlamlı İplik ilerlemesini, Toz Gül yakınlık ve bakım olaylarını, Bal Altını seçkin vurgu ve premium bağlamını taşır.

**The Existing Palette Rule.** Yeni ekranlar mevcut semantik renk rollerini kullanır; terracotta, neon veya yeni bir marka paleti eklemez.

**The Night Plum Rule.** Koyu tema bir ters çevirme değil, düşük ışıkta katmanları ışıklılıkla ayıran Gece Eriği ortamıdır.

## Typography

Fraunces yalnızca anlamlı başlık ve yaşam anlarında kullanılır. Manrope görev, açıklama, buton ve form dilini taşır. Space Mono yalnızca hafta, tarih, süre ve ölçüm gibi gerçek veriler içindir.

**The Data Earns Mono Rule.** Teknik görünmek için monospace kullanılmaz; yalnızca ölçülebilir veri bu yüzü kazanır.

## Layout

Telefonlarda 16 px yatay içerik payı ve 4/8 tabanlı aralık sistemi korunur. İçerik küçük ekranda tek kolondur; sabit genişlik yerine mevcut alanı kullanır. Yaşayan İplik, içeriğin altında dekoratif bir katman değil; ilgili olayların yanında bilgi omurgasıdır. Tablet ve geniş görünümde ana görev ve destekleyici içerik iki bölgeye ayrılabilir, ancak okuma sırası değişmez.

**The Quiet Around the Thread Rule.** İplik görünüyorsa yakın çevrede ikinci bir büyük dekoratif odak kullanılmaz.

## Elevation & Depth

Derinlik yumuşak ofset gölgeler ve tonal yüzey ayrımıyla sağlanır. Aynı yüzeyde hem güçlü sınır hem güçlü gölge kullanılmaz. Koyu temada gölge yerine yüzey tonları önceliklidir.

## Shapes

Kartlar ve butonlar yön hissi veren asimetrik köşeleri korur. Düğüm ve ilmekler tam dairesel olabilir; büyük içerik kapları pill biçimine dönmez. İplik yuvarlak uçlu ve kesintisizdir.

**The Directional Corner Rule.** Asimetri her bileşene rastgele uygulanmaz; ana yüzeyler ve birincil eylemler aynı köşe yönünü paylaşır.

## Components

### Buttons

- Birincil eylem mevcut tema rengini ve asimetrik buton şeklini kullanır.
- Basma geri bildirimi kısa ölçek/ton değişimidir; sürekli nefes animasyonu kullanılmaz.
- Etiket işlem boyunca aynı fiili korur.

### Cards / Containers

- Kartlar yalnızca gerçek bir bilgi grubunu veya görevi bir arada tutar.
- İç içe kart kullanılmaz.
- Yüzey sınır veya gölgeden yalnızca birini baskın kullanır.

### Inputs / Fields

- Alanlar görünür etiket taşır.
- Hata metni sorunu ve düzeltmeyi aynı yerde söyler.
- Büyük yazı boyutunda yükseklik büyür; metin kırpılmaz.

### Yaşayan İplik

- Akış geçen zamanı veya ölçülebilir ilerlemeyi gösterir.
- Düğüm tamamlanan gerçek bir olayı gösterir.
- İlmek yaklaşan veya eylem bekleyen noktayı gösterir.
- İplik yalnızca anlam taşıdığında görünür ve ekran okuyucuya özet/değer verir.

## Generic Ekran Testi

- **Ana sayfa:** Sağlık uygulamalarındaki standart hero + ikon ızgarası reddedildi. Gebelik haftası gerçek bir düğüme, hafta notu kalıcı bir bilgi yüzeyine, kısayollar ise açık başlıklı tek kolon görev listelerine dönüştürüldü.
- **Bebek profili:** Genel profil kartı reddedildi. Doğum düğümü, bugün ilmeği, gerçek aşı tamamlanması ve büyüme kayıtları aynı yaşam ipliğinin farklı okumaları oldu.
- **Forum:** Genel sosyal medya kart akışı reddedildi. Gönderi ve yorumlar ortak dikey iplik üzerindeki konuşma düğümleri olarak bağlandı; anonimlik ve anneye özel erişim görünür ürün kararları olarak kaldı.
- **Paywall:** RevenueCat panelinde tasarlanan paywall tek görsel ve ticari kaynaktır; uygulama tarafında yeniden tasarlanmaz. Anne+ kimliği paywall’a giden bağlamda korunur, paket/fiyat/sunum RevenueCat UI’dan gelir.

## Durumlar ve Hareket

- **Boş:** Açık ilmek ve ilk anlamlı eylemle davet eder.
- **Hata:** Sorunu adlandırır, kullanıcıya düzeltme yolunu söyler ve yeniden deneme eylemi verir.
- **Yükleniyor:** Ekranın gerçek silüetini asimetrik yüzeylerle gösterir; genel gri çubuk kullanmaz.
- **Orkestra anı:** Onboarding tamamlandığında İplik bir kez çizilir ve ilk gerçek düğüm bağlanır. Reduce Motion açıkken aynı anlam kısa, düşük mesafeli bir geçişle korunur.
- **Sadeleştirme kararı:** Dekoratif giriş çizgileri, sürekli nefes alan butonlar ve genel ekran giriş animasyonları kaldırıldı; geriye yalnızca işlevsel durum ve basma geri bildirimi kaldı.

## Do's and Don'ts

### Do:

- **Do** İpliği gerçek ilerleme, olay veya ilişki verisine bağla.
- **Do** boş durumları kullanıcıyı ilk anlamlı kayda davet edecek şekilde yaz.
- **Do** koyu temada mevcut Gece Eriği yüzey rollerini ayrı ayrı tasarla.
- **Do** Lucide ince çizgi ikonlarını tutarlı boyut ve stroke ile kullan.

### Don'ts:

- **Don't** İpliği yalnızca boş alan dolduran arka plan dokusuna dönüştür.
- **Don't** krem zeminle terracotta vurgu, neon koyu tema veya gazete düzeni ekle.
- **Don't** hazır stok illüstrasyon ya da dolgu/3D ikon paketi kullan.
- **Don't** dekoratif numaralandırma, konfeti veya her yerde sürekli animasyon kullan.
