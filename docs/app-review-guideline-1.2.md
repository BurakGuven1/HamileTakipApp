# App Review Guideline 1.2 Teslim Notu

## Fiziksel cihaz ekran kaydı

Kayda başlamadan önce uygulamayı cihazdan silip yeniden kur. Böylece giriş
ekranındaki cihazda bir kez saklanan onay boş görünür. Rapor ve engel
demonstrasyonu için gerçek kullanıcı içeriği yerine iki ayrı kadın test hesabıyla
oluşturulmuş test gönderilerini kullan.

1. Uygulamayı aç; giriş/kayıt ekranındaki boş EULA ve topluluk kuralları onayını
   göster.
2. `Apple Standard EULA` ve `Kullanım Şartları` bağlantılarını sırayla açıp
   uygulamaya dön.
3. Onay kutusunu işaretle ve App Review test hesabıyla giriş yap.
4. `Forum` sekmesini aç. Tek seferlik `Anne+ topluluk sözleşmesi` ekranında üç
   kuralı ve bağlantıları göster; kutuyu işaretleyip `Kabul et ve foruma gir`
   düğmesine dokun.
5. Test gönderilerinden birini aç; `Raporla` düğmesine dokun. `Raporlandı`
   bildiriminin, içeriğin inceleme süresince kaldırıldığının ve 24 saatlik sürenin
   göründüğünü kaydet.
6. Başka bir test gönderisini veya yorumunu aç; `Engelle` düğmesine dokun.
   Kullanıcının ve içeriklerinin akıştan kalktığını göster.
7. Forumun altındaki `Engellediğin kullanıcılar` alanını ve `Engeli kaldır`
   işlemini göster.

Kaydı kesmeden, mümkünse cihaz çerçevesi veya iOS ekran kaydı göstergesi görünür
halde tamamla. Videoyu App Store Connect > App Review Information > Notes alanına
kalıcı bir HTTPS bağlantısı olarak ekle.

## App Review Notes

```text
Guideline 1.2 — User-Generated Content

We implemented all required UGC safeguards:

1. Before registration or login, every user is presented with links to the Apple
   Standard EULA and Anne+ Terms of Use and must actively select the agreement
   checkbox. The agreement states zero tolerance for objectionable content and
   abusive users. The accepted version is stored once and recorded to the signed-in
   account.
2. Existing users see a one-time Community Agreement before entering the forum.
3. Forum posts and comments are protected by a server-side objectionable-content
   filter.
4. Every post and comment has a clearly visible “Raporla” (Report) action.
   Reported content is removed from the public feed while it is reviewed. Every
   report has a 24-hour moderation deadline.
5. Every post and comment has a clearly visible “Engelle” (Block) action. Blocking
   is enforced server-side and removes that user’s posts and comments from the
   blocker’s feed.
6. Confirmed objectionable content is removed, and the user who provided it is
   ejected from the community.

Physical-device demonstration video:
<PASTE_PERMANENT_HTTPS_VIDEO_LINK_HERE>

Review account:
Email: <APP_REVIEW_TEST_EMAIL>
Password: <APP_REVIEW_TEST_PASSWORD>
```

## Gönderim öncesi son kontrol

- `public/kullanim-sartlari/index.html` üretim Vercel sitesinde yayınlanmış olmalı.
- `https://hamile-takip-app-vqgw.vercel.app/kullanim-sartlari/` sayfasında
  `Son güncelleme: 24 Temmuz 2026`, `sıfır tolerans` ve `24 saat` metinleri
  görünmeli.
- App Review test hesabında Premium/forum erişimi açık olmalı.
- Videodaki test raporu 24 saat dolmadan moderasyon runbook’u ile sonuçlandırılmalı.
