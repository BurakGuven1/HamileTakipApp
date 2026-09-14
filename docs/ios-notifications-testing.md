# iOS bildirim, Live Activity ve widget test rehberi

Bu belge TestFlight build'i telefona kurulduktan sonra **tek oturumda**
baştan sona yürünecek şekilde yazıldı. Her adımda "beklenen sonuç" var;
tutmayan adımı olduğu gibi not et, tahmin etme.

Gereken: iPhone (Dynamic Island için iPhone 14 Pro veya üstü; Live Activity
kilit ekranı kartı iPhone XR ve sonrası her modelde çalışır), iOS 17+ (Dynamic
Island'daki "Bitir" düğmesi iOS 17 ile geldi), TestFlight build'i.

Simülatörde **test edilemeyecek** olanlar: gerçek push teslimi, kilit ekranı
sesi/titreşimi, Odak modu davranışı. Live Activity ve widget simülatörde
çalışır ama gerçek cihazda doğrulanmadan "tamam" sayma.

---

## 0. Kurulum kontrolü (1 dk)

1. Uygulamayı ilk kez aç. **Beklenen: hiçbir bildirim izni istemi çıkmaz.**
   Soğuk açılışta izin istemek hem kabul oranını düşürür hem App Review'da
   not edilir; izin yalnızca kullanıcı bir hatırlatma kurarken istenir.
2. Ayarlar → Anne+ → Bildirimler'e bak. **Beklenen: "İzin Verilmedi"** (ya da
   onboarding'i tamamladıysan izin verilmiş).

---

## 1. Bildirim izni akışı (3 dk)

| Adım | Yapılacak | Beklenen sonuç |
|---|---|---|
| 1.1 | Bakım Günlüğü → bir hatırlatma kur | Önce uygulama içi açıklama, sonra sistem izin istemi |
| 1.2 | Sistem isteminde **İzin Verme** de | Uygulama çökmüyor, hatırlatma kurulamadığı açıkça söyleniyor |
| 1.3 | Aynı hatırlatmayı yeniden kurmayı dene | Sistem istemi **tekrar çıkmaz**; Ayarlar'a yönlendiren bir metin görünür |
| 1.4 | Ayarlar → Anne+ → Bildirimler → aç, uygulamaya dön | Hatırlatma kurulabiliyor |

> iOS bir kez reddedilen izni bir daha sormaz. 1.3'te sistem istemi yeniden
> çıkıyorsa akış yanlış; `requestNotificationPermissionForFeature()` yerine
> doğrudan `requestPermissionsAsync()` çağrılıyordur.

---

## 2. Bildirim eylemleri (kategoriler) (5 dk)

Bildirim geldiğinde **banner'ı aşağı çek veya uzun bas**; düğmeler orada.

### 2.1 Bakım alarmı (gece vardiyası)
1. Gece Vardiyası ekranından 2 dakika sonrasına bir alarm kur.
2. Telefonu kilitle ve bekle.
- **Beklenen:** kilit ekranında `baby_reminder.wav` sesiyle bildirim; uzun
  basınca **Ertele** ve **Kapat** düğmeleri.
- **Ertele** → uygulama açılmaz, alarm 10 dk sonrasına taşınır.
- **Kapat** → uygulama açılmaz, hatırlatma iptal olur.

### 2.2 Emzirme hatırlatması
- **Beklenen düğmeler:** **Başlat** ve **10 dk ertele**.
- **Başlat** → uygulama açılır ve Bakım Günlüğü'nde emzirme girişi seçili gelir.
- **10 dk ertele** → uygulama açılmaz; 10 dk sonra aynı bildirim yeniden gelir.

### 2.3 Aşı hatırlatması
- **Beklenen düğmeler:** **Detay** ve **Yapıldı**. İkisi de Aşılar ekranını açar.

### 2.4 Odak modu (Time Sensitive) kontrolü
1. Uyku Odağı'nı aç.
2. Bir bakım alarmı kur ve beklet.
- **Beklenen:** bakım alarmı Odak'ı deler (Time Sensitive).
- **Beklenen:** su hatırlatması / içerik bildirimi Odak'ı **delmez**.
  Pazarlama bildirimi Odak'ı delerse bu bir App Review red riskidir.

---

## 3. Derin bağlantılar (5 dk)

Her bildirim tipine **banner'ın gövdesine dokunarak** (düğmeye değil) gir ve
hangi ekranın açıldığını işaretle:

| Bildirim tipi (`data.screen`) | Açılması gereken ekran |
|---|---|
| `care-journal` | Bakım Günlüğü |
| `night-shift` | Gece Vardiyası (doğru bebek seçili) |
| `baby-vaccines` | Aşılar |
| `family-planner` | Aile Planlayıcı (görev seçili) |
| `doctor-visit` | Doktor Ziyareti |
| `article` | İlgili makale |
| `home` / `forum` | Ana sayfa / Forum |

Her birini **iki durumda** dene:
- uygulama arka plandayken,
- uygulama tamamen kapalıyken (app switcher'dan yukarı kaydır).

İkinci durum `getLastNotificationResponseAsync()` yolunu test eder ve en sık
burada kırılır.

---

## 4. Live Activity — emzirme / sağım / uyku sayacı (10 dk)

1. Bakım Günlüğü → emzirme sayacını **sol meme** ile başlat.
2. Telefonu hemen kilitle.

**Kilit ekranında beklenen:**
- "ANNE+ · EMZİRME" başlığı ve sağ üstte "HH:MM’de başladı".
- Bebeğin adı büyük, altında "Sol meme".
- Sağda saniye saniye akan büyük sayaç.
- Sayaç **telefon kilitliyken de akar** — uygulamanın açık olması gerekmez.

**Dynamic Island (iPhone 14 Pro+):**

| Görünüm | Nasıl tetiklenir | Beklenen |
|---|---|---|
| compact | Başka bir uygulamaya geç | Solda damla ikonu, sağda akan sayaç |
| minimal | İkinci bir Live Activity başlat (ör. gece vardiyası) | Yalnızca ikon |
| expanded | Dynamic Island'a uzun bas | Solda ikon + "Sol meme", ortada bebek adı, sağda sayaç, altta başlangıç saati ve **Bitir** düğmesi |

3. Expanded görünümdeki **Bitir** düğmesine bas.
   - **Beklenen:** uygulama **öne gelmez**, sayaç durur, kart "Kaydedildi" +
     süre özetine döner ve ~8 dakika içinde kendiliğinden kaybolur.
   - Uygulamayı aç: kayıt Bakım Günlüğü'nde durmuş olarak görünmeli.
4. Aynı testi **sağım** ve **uyku** için tekrarla (ikon ve başlık değişmeli:
   damla / dalga / ay).
5. **Koyu tema:** Ayarlar → Ekran → Koyu. Kilit ekranı kartı okunur olmalı;
   metin arka plana karışmamalı.

### 4.1 Yetim (orphan) kart temizliği — en kritik senaryo
1. Bir sayaç başlat.
2. Uygulamayı app switcher'dan **öldür**.
3. Kilit ekranına bak: kart hâlâ orada ve saymaya devam ediyor (normal).
4. Uygulamayı yeniden aç ve arka plana al.
- **Beklenen:** sunucuda sayaç hâlâ çalışıyorsa kart kalır; sayaç başka bir
  cihazda durdurulmuşsa kart **derhal kaybolur**.
5. Uçak moduna al, uygulamayı aç.
- **Beklenen:** kart **silinmez**. Çevrimdışıyken çalışan bir sayacı silmek,
  asılı kalmış bir karttan daha kötüdür.

### 4.2 8 saat sınırı
Cihaz saatini 9 saat ileri al, uygulamayı aç.
- **Beklenen:** kart kaldırılır. (ActivityKit zaten 8 saat sonra activity'yi
  kendiliğinden sonlandırır; uygulama aynı sınırı kendi tarafında da uygular.)
Testten sonra saati otomatiğe geri al.

---

## 5. Live Activity — gece vardiyası (5 dk)

1. Gece Vardiyası'nı başlat, bitiş saatini 10 dk sonrasına ayarla.
2. Kilit ekranı: **geriye sayan** büyük sayaç, bakıcı adı, sıradaki alarm satırı.
3. Dynamic Island expanded → **Vardiyayı bitir** düğmesi.
   - **Beklenen:** vardiya kapanır, kart "Tamamlandı"ya döner, ~15 dk içinde
     kaybolur.
4. Vardiyayı bitirmeden planlanan saatin geçmesini bekle ve uygulamayı aç.
   - **Beklenen:** sunucu vardiyayı kapatır ve kart kaybolur.

---

## 6. Widget (10 dk)

### 6.1 Ana ekran
1. Ana ekranda boş alana uzun bas → **+** → "Anne+" ara.
2. **Küçük (systemSmall)** boyutu ekle.
   - Beklenen: "ŞU AN NE ÖNEMLİ? · <isim>", büyük başlık, açıklama satırı ve
     ikinci bir durum varsa **"Diğer durumu göster"** düğmesi.
   - Düğmeye bas: uygulama açılmadan kart ikinci duruma geçmeli.
3. **Orta (systemMedium)** boyutu ekle.
   - Beklenen: küçük boyutun büyütülmüşü **değil** — birinci durum büyük,
     ikinci durum altta ayrı bir satır olarak **aynı anda** görünür, düğme yok.
4. Widget'a dokun → doğru ekran açılmalı:
   - uyku sürüyorsa Gece Vardiyası,
   - yaklaşan aşı varsa Aşılar,
   - hiçbiri yoksa Bakım Günlüğü.

### 6.2 Kilit ekranı
1. Kilit ekranında saate uzun bas → Özelleştir → Kilit Ekranı.
2. Saatin altındaki alana **accessoryRectangular** Anne+ widget'ını ekle.
   - Beklenen: ikon + isim, kalın başlık, ince detay satırı. Renk yok (iOS
     kilit ekranını tek renk "vibrant" modda çizer) ama hiyerarşi okunur.
3. Saatin üstündeki satıra **accessoryInline** ekle.
   - Beklenen: "Anne+ · <başlık>" tek satır.

### 6.3 Veri tazeliği ve boş durum
1. Uygulamada yeni bir bakım kaydı ekle, ana ekrana dön.
   - Beklenen: widget birkaç saniye içinde güncellenir (App Group üzerinden).
2. Hiç kaydı olmayan bir bebekle dene.
   - Beklenen: "Bugün yeni kayıt yok" / "İlk kaydı eklemek için dokun."
     Boş bir kutu veya "—" görünmemeli.

> Widget zaman çizelgesi 25 saatlik pencereyle yazılır ve uygulama her
> açıldığında yenilenir. Uygulamaya bir gün hiç girilmezse widget son bilinen
> durumu göstermeye devam eder; bu beklenen davranıştır.

---

## 7. Yükleme öncesi otomatik kontrol

Build almadan önce yerel makinede:

```bash
npm run verify:ios-notifications
```

Kontrol ettikleri: `NSSupportsLiveActivities`, frequent-updates bayrağı,
`UIBackgroundModes` (gerekçesiz mod var mı), Türkçe izin açıklamaları,
App Group kimliği, widget bundle id'si, desteklenen widget boyutları ve
bildirim sesi dosyasının gerçekten diskte olup olmadığı.

Ayrıca App Review 4.5.4 zinciri (bkz. bölüm 9): pazarlama onay modülünün
varlığı, kampanya edge fonksiyonunun onay filtrelerini ve `assertMarketingPushAllowed()`
son savunmasını hâlâ içerip içermediği, kampanya push'unun `interruptionLevel`
değerinin `passive` olması, onay damgası migration'ının ve check constraint'inin
yerinde olması, Time Sensitive beyaz listesine pazarlama tipi sızmaması,
onboarding'in soğuk izin istemi yapmaması ve Ayarlar'ın hem kapatma anahtarını
hem sistem ayarları kısayolunu sunması.

---

## 8. Sorun giderme

| Belirti | Muhtemel sebep |
|---|---|
| Live Activity hiç görünmüyor | Ayarlar → Anne+ → **Canlı Etkinlikler** kapalı; ya da `NSSupportsLiveActivities` build'e girmemiş |
| Widget hep boş | App Group uyuşmuyor; `npm run verify:ios-notifications` çalıştır |
| Bildirim düğmeleri yok | Kategori, bildirim zamanlanmadan önce kaydedilmemiş — uygulamayı bir kez açıp kapat, sonra yeni bildirim kur |
| "Bitir" düğmesi hiçbir şey yapmıyor | iOS 17 altı cihaz; ya da uygulama tamamen kapalıyken olay kaybolmuş — uygulamayı açıp tekrar dene |
| Alarm sessiz geliyor | Odak modu veya Ayarlar'da ses kapalı; `baby_reminder.wav` build'e girmemiş olabilir |
| Bildirimler bir süre sonra hiç gelmiyor | 64 bekleyen bildirim sınırı aşılmış olabilir — uygulamayı aç, planlama yenilenir |

---

## 9. App Review kontrol listesi (bildirimler)

Bu bölüm reviewer'ın bildirimlerle ilgili sorabileceği her maddeye, hangi kodun
karşılık geldiğiyle birlikte cevap verir. Yeni sürüm göndermeden önce baştan
sona okunur.

### 4.5.4 — Push Notifications

> *"Push Notifications must not be required for the app to function, and should
> not be used to send sensitive personal or confidential information. Push
> Notifications should not be used for promotions or direct marketing purposes
> unless customers have explicitly opted in to receive them via consent language
> displayed in your app's UI, and you provide a method in your app for a user to
> opt out from receiving such messages."*

| Şart | Nasıl uyuyoruz | Kod |
|---|---|---|
| Bildirim zorunlu olmasın | Kurulumdaki izin adımı atlanabilir ("Şimdilik bildirim alma"); izin verilmese de tüm takip, kayıt ve araçlar çalışır | `app/(auth)/onboarding.tsx` |
| Hassas bilgi gönderilmesin | Bildirim gövdeleri yalnızca bebek takma adı ve hatırlatma başlığı taşır; sağlık ölçümü, belge içeriği veya tanı ASLA push'a yazılmaz | `src/supabase/functions/send-*` |
| Pazarlama için **açık** opt-in | `notify_premium_offers` varsayılanı **false** (migration 20260810000003) ve yalnızca Ayarlar'daki anahtarı kullanıcı kendi açarsa true olur. Anahtarın yanındaki metin onay dilidir | `src/features/notifications/marketingConsent.ts` → `MARKETING_CONSENT_COPY` |
| Onay uygulamanın arayüzünde gösterilsin | Ayarlar → Bildirim tercihleri → "Ürün ve kampanya duyuruları" satırı; metin varsayılanın kapalı olduğunu ve kapatma yolunu açıkça söyler | `app/(tabs)/settings/index.tsx` |
| Opt-out yolu olsun | Aynı anahtar her zaman kapatılabilir; kapatıldığında `premium_offer_consent_at` trigger ile **null**'a çekilir | migration `20260914000001_premium_offer_push_consent.sql` |
| Onay **kod tarafında zorlansın** | Kampanya gönderimi üç katmanla korunur: (1) SQL sorgusu `notify_premium_offers = true` **ve** `premium_offer_consent_at is not null`; (2) satırlar kodda `isMarketingPushAllowed()` ile yeniden süzülür; (3) her mesaj kuyruğa girmeden önce `assertMarketingPushAllowed()` ile son kez doğrulanır ve onaysızsa gönderim hata ile durur | `src/supabase/functions/send-seasonal-premium-campaigns/index.ts` |
| Veritabanı seviyesinde tutarlılık | `profiles_premium_offer_consent_required` check constraint'i, bayrak true iken onay damgasının boş kalmasını imkânsız kılar | aynı migration |
| Pazarlama Odak modunu delmesin | Kampanya push'u `interruptionLevel: "passive"`, `priority: "normal"`, `sound: null` ve ayrı `premium-offers` kanalıyla gider | aynı fonksiyon + `src/lib/notifications.ts` |
| Regresyona karşı kilit | `npm run verify:ios-notifications` bu zincirin her halkasını kaynak kodda arar; biri silinirse build öncesi kırılır | `tools/verify-ios-notifications.mjs` |

**Reviewer "kampanya bildirimini nasıl kapatırım?" derse:** Ayarlar sekmesi →
Bildirim tercihleri → "Diğer bildirim tercihlerini göster" → **Ürün ve kampanya
duyuruları** anahtarı. Varsayılan olarak kapalıdır; açılmadıkça hiçbir kampanya
bildirimi gönderilmez.

### İzin isteme zamanlaması (5.1.1(ii) ve reddedilme riski)

- Sistem izin istemi **asla soğuk açılışta** gösterilmez. Kurulumdaki izin
  adımında önce uygulamanın kendi Türkçe ön-izin ekranı çıkar (ne göndereceğimiz
  madde madde yazılıdır); sistem istemi yalnızca kullanıcı "Bildirimleri aç ve
  başla" derse gösterilir.
- Kullanıcı ön-izin ekranında "Şimdilik bildirim alma" derse sistem istemi
  **hiç harcanmaz**; iOS istemi bir kez sorduğu için sonradan bir hatırlatma
  kurulduğunda yeniden sorulabilir.
- İzin daha önce reddedilmişse (`canAskAgain === false`) düğme sahte bir istem
  göstermez; doğrudan sistem ayarlarına yönlendirir.
- İlgili kod: `src/features/notifications/permission.ts`,
  `app/(auth)/onboarding.tsx`, `app/(tabs)/settings/index.tsx`.

### Time Sensitive kullanımı

- Beyaz liste tek yerde: `src/features/notifications/interruption.ts` →
  `care_alarm`, `care_reminder`, `sleep_prediction`, `vaccine_reminder`,
  `family_task`. Hepsi kullanıcının kendi kurduğu, kaçırıldığında sonucu olan
  bildirimlerdir.
- Pazarlama, kampanya, içerik önerisi ve "seni özledik" tipleri asla Time
  Sensitive değildir; doğrulama betiği bunu ayrıca kontrol eder.
- Critical Alert **kullanılmıyor** (ayrı Apple onayı gerektirir).

### 2.5.4 — Arka plan modları

`UIBackgroundModes` yalnızca iki değer taşır ve ikisi de gerçekten kullanılır:

| Mod | Gerekçe |
|---|---|
| `audio` | Ninni çalar ekran kilitliyken çalmaya devam eder (`LullabyPlayerProvider`, `shouldPlayInBackground: true`) |
| `remote-notification` | Bakım alarmları ve Live Activity içerik güncellemeleri APNs üzerinden gelir |

`location`, `voip`, `fetch`, `processing`, `bluetooth-central` **yok**;
doğrulama betiği bunlardan biri eklenirse build'i kırar.

### Info.plist izin açıklamaları

| Anahtar | Metin gerçeği yansıtıyor mu |
|---|---|
| `NSCameraUsageDescription` | Evet — bebek fotoğrafı çekimi (anı galerisi) |
| `NSPhotoLibraryUsageDescription` | Evet — ana sayfa görseli seçimi ve anı galerisine ekleme |
| `NSUserTrackingUsageDescription` | Evet — reklam ölçümü (Meta/Google); ATT istemi yalnızca bu amaçla gösterilir |

Hepsi Türkçe ve somut; doğrulama betiği uzunluk ve Türkçe karakter kontrolü yapar.

### Sürüm öncesi sıra

1. `npm run typecheck && npm run lint && npm test && npm run verify:ios-notifications`
2. **Migration `20260914000001_premium_offer_push_consent.sql` üretime uygulanır.**
   Bu yapılmadan `send-seasonal-premium-campaigns` deploy edilirse fonksiyon
   olmayan kolonu sorgular ve 500 döner (gönderim yapmaz — güvenli taraf).
3. `supabase functions deploy send-seasonal-premium-campaigns`
4. Yeni EAS build (native tarafta değişen: `premium-offers` Android kanalı
   JS'te olduğu için iOS'ta yeni native yetenek gerekmez; yine de
   `app.config.ts` okunduğu için normal sürüm build'i yeterlidir).
