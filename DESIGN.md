---
name: Anne+
description: Hamilelikten bebekliğe uzanan aile takibini, ışıklı bir zemin üzerinde yüzen cam yüzeylerle taşıyan modern iOS deneyimi.
colors:
  background: "#FBF7FF"
  iris: "#6C4CF1"
  rose: "#FF7BA8"
  mint: "#3ECFB2"
  peach: "#FFB27A"
  sky: "#5BA8F5"
  ink: "#1C1330"
  ink-muted: "#6B6280"
  dark-background: "#0F0B17"
  dark-surface: "#1A1426"
  dark-ink: "#F4F0FF"
typography:
  display:
    fontFamily: "Manrope"
    fontWeight: 800
    fontSize: "34px"
    letterSpacing: "-0.8px"
  body:
    fontFamily: "Manrope"
    fontWeight: 400
    fontSize: "16px"
    lineHeight: 1.44
  data:
    fontFamily: "Space Mono"
    fontSize: "15px"
rounded:
  sm: "12px"
  md: "16px"
  tile: "22px"
  card: "26px"
  sheet: "34px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
---

## Overview

**Creative North Star: "Warm Aurora."**

Anne+ derinliğini düz kartlardan değil, iki katmandan üretir: yavaşça hareket eden renkli bir ışık zemini ve onun üzerinde yüzen yarı saydam cam yüzeyler. Bir kart nerede durduğuna göre renk alır, çünkü altındaki aurora ondan geçer. Sıcaklık pastel dekordan değil, bu ışıktan gelir.

Bu doküman, daha önce burada duran **"Yaşayan İplik"** anayasasının yerini alır. O yön —dekoratif tek çizgi, asimetrik köşeler, ölçülü hareket, kısıtlı palet— bilerek bırakıldı.

**Key Characteristics:**

- Aurora zemin + cam yüzey: her ekranda aynı iki katman
- Yay (spring) tabanlı, kademeli ve belirgin hareket
- İris, gül, mint, şeftali: dört ışık, tek aile
- Simetrik, yumuşak squircle köşeler
- Veri gerçekten veriye bağlıdır; dekoratif grafik yoktur

## Colors

Açık temada `#FBF7FF` zemin, koyu temada `#0F0B17`. Zeminin üstünde üç aurora ışığı yavaşça sürüklenir. Yüzeyler renk taşımaz; `glass` (`rgba(255,255,255,0.62)` / koyuda `0.07`) ve bir ışık kenarlığı taşırlar — rengi zeminden alırlar.

**The Aurora Carries the Color Rule.** Kartların kendi dolgu rengi yoktur. Bir yüzeyin renklenmesi gerekiyorsa `tone="tinted"` ile o rengin *tonu* camın altına serilir; opak dolgu verilmez, yoksa cam kaybolur.

**The Night Is Not an Inversion Rule.** Koyu tema ters çevirme değildir: zemin derinleşir, aurora doygunlaşır, cam ışığa döner (beyaz %7). Gölge yerine ton farkı çalışır.

Her renk `semanticColor(light, dark)` ile tanımlanır; tek bir renk iki temayı birden taşır.

## Typography

Manrope tek arayüz yüzüdür: 800 ExtraBold büyük başlıklarda, 700/600 ara başlıklarda, 400 gövdede. Space Mono yalnızca gerçek ölçüm içindir — hafta, tarih, süre, kilo, persentil.

**The Data Earns Mono Rule.** Teknik görünmek için monospace kullanılmaz; yalnızca ölçülebilir veri bu yüzü kazanır.

Başlıklar sıkı (negatif letterSpacing) ve büyüktür. Bir ekranda tek bir `display` başlık bulunur; gerisi `heading2`/`heading3`.

## Layout

16 px yatay pay, 4/8 tabanlı aralık. Telefonda tek kolon. Her ekran `Screen` (sekmeli) veya `ToolScreen` (araç) ile kurulur; ikisi de aurora zemini ve yüzen sekme çubuğunu temizleyen alt dolguyu kendileri halleder.

**The Floating Chrome Rule.** Sekme çubuğu ve araç başlığı sayfanın *üstünde yüzer*, sayfayı kesmez: içerik altlarından bulanık olarak görünmeye devam eder. Bu yüzden ikisi de saydamdır ve zeminlerini `BlurView` taşır.

## Elevation & Depth

Derinlik dört kademedir (`shadows.soft/card/lifted/floating`). Gölge nötr siyah değil, zeminin iris tonunu taşır. Cam yüzeyin üst kenarında ince bir specular parlama bulunur — ışığın nereden geldiğini söyleyen tek işaret.

Aynı yüzeyde hem güçlü kenarlık hem güçlü gölge kullanılmaz; camın ışık kenarlığı zaten hairline'dır.

## Shapes

Yumuşak, simetrik squircle'lar: kare kutucuk 22, kart 26, hero 34, alt sayfa 34, kapsül pill. Asimetrik "yön veren" köşeler kaldırıldı. Halkalar, avatarlar ve düğümler tam dairedir.

## Components

### Buttons

- Birincil eylem temanın **gradyanını** taşır (`appTheme.gradient`), beyaz etiket, yay ile basma geri bildirimi ve orta şiddette haptik.
- İkincil eylem cam yüzey üstünde renkli kenarlıkla durur.
- Sürekli "nefes alan" buton yoktur; etiket işlem boyunca aynı fiili korur.

### Cards / Containers

- `Card` artık camdır; tüm ekranlar onu çağırarak aynı dili alır.
- İç içe cam kullanılmaz: camın içindeki ikincil yüzey `glassStrong` dolgulu düz bir kutudur.
- Vurgu gerektiğinde `tone="tinted"` + `tint`.

### Sheets

Alt sayfalar `GlassSheet`: bulanık arkalık, aşağı sürüklenerek kapanma (mesafe veya hız eşiği), yay ile yerine oturma. Her ekranın kendi `Modal`'ını kurması bırakıldı.

### Segmented control

`SegmentedControl`: seçili sekmenin altındaki kapsül yay ile **kayar**. Kayma, hangi sekmeden hangisine geçildiğini anlatır; anında yer değiştiren vurgu bu yönü kaybeder.

### Büyüme ipliği

Uygulamadaki tek "iplik" `GrowthThread`'dir ve tamamen veriye bağlıdır:

- Arka planda WHO persentil bantları (−2σ…+2σ), aradaki alan "normal aralık"
- Üstünde ailenin girdiği ölçümlerden geçen gerçek eğri
- Her ölçüm dokunulabilir düğüm; en yenisi nabız atan nokta
- Altında düz Türkçe cümle: değer, persentil ve kendi çizgisini koruyup korumadığı
- Veri yoksa eğri çizilmez; "ilk ölçümü ekle" daveti gelir

**The Chart Must Mean Something Rule.** Veriye bağlanamayan hiçbir çizgi, eğri veya grafik çizilmez. Boşluk doldurmak için grafik kullanılmaz.

## Durumlar ve Hareket

- **Boş:** ortalanmış davet ikonu, tek cümle ve ilk anlamlı eylem.
- **Hata:** sorunu adlandırır, düzeltmeyi söyler, yeniden dene verir.
- **Yükleniyor:** ekranın gerçek silüeti `SkeletonShimmer` ile; dekoratif çizgi yok.
- **Hareket:** girişler kademeli (`stagger`), durum değişimleri yay, aurora 9 saniyelik çok yavaş bir sürüklenme.
- **Reduce Motion:** aurora durur, çizim ve nabız anında tamamlanır, kapsül anında yerine geçer. Hiçbir bilgi kaybolmaz.

## Do's and Don'ts

### Do:

- **Do** yeni yüzeyleri `Card` / `GlassSurface` / `PressableGlass` üzerinden kur.
- **Do** rengi `appTheme` üzerinden al; sabit hex yazma.
- **Do** her animasyonu `useReducedMotion` ile koşulla.
- **Do** Lucide ince çizgi ikonlarını tutarlı boyut ve stroke ile kullan.
- **Do** ikon ve etiketi aynı kutunun içinde ve aynı eksende hizala.

### Don'ts:

- **Don't** karta opak `backgroundColor` verip camı öldürme.
- **Don't** veriye bağlı olmayan grafik veya "iplik" çizme.
- **Don't** cam içine cam koyma.
- **Don't** hazır stok illüstrasyon ya da dolgu/3D ikon paketi kullan.
- **Don't** konfeti, sürekli nefes alan buton veya durmayan dekoratif animasyon ekle.
