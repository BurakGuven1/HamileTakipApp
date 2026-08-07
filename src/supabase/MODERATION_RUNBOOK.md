# Anne+ Forum Moderasyon Runbook

Apple App Review Guideline 1.2 için her kullanıcı raporu en geç 24 saat içinde
sonuçlandırılır.

## Otomatik korumalar

- Yasaklı hakaret, tehdit ve cinsel spam kalıpları veritabanı tetikleyicisiyle
  paylaşılmadan önce reddedilir.
- Tek bir rapor içeriği gizlemez veya silmez; rapor moderasyon kuyruğunda tutulur.
- Aynı içeriğe 24 saat içinde en az üç farklı hesap rapor gönderirse içerik yalnızca
  inceleme tamamlanana kadar geçici karantinaya alınır.
- Her hesap saatte en fazla 5, günde en fazla 15 rapor gönderebilir ve aynı içeriği
  yalnızca bir kez raporlayabilir.
- Bir kullanıcının engellediği hesaplar sunucu tarafında gönderi ve yorum
  görünümlerinden çıkarılır.
- Hesap uzaklaştırma otomatik rapor sayısına göre yapılmaz; kötü niyetli toplu
  raporlamayı önlemek için moderatör doğrulaması gerekir.

## Günlük moderasyon sırası

1. Uygulamadaki **Forum > Moderasyon merkezi** ekranında bekleyen kayıtları
   `review_due_at` sırasıyla incele. Kuyruk `forum_moderation_queue` görünümünden gelir.
2. İçeriği, rapor nedenini ve aynı yazara ait son 90 günlük raporları değerlendir.
3. Rapor asılsızsa **İhlal yok** kararını ver. Aynı hedef için bekleyen tüm raporlar
   birlikte kapanır ve eşik nedeniyle karantinaya alınan içerik yeniden yayınlanır.

   SQL alternatifi:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'dismiss',
     'İhlal bulunmadı'
   );
   ```

4. İhlal doğrulanırsa uygulamadan **İçeriği kaldır** kararını ver:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'remove_content',
     'Doğrulanmış topluluk kuralı ihlali'
   );
   ```

5. Ağır veya tekrarlanan ihlalde **İçeriği kaldır ve forumdan uzaklaştır** kararını ver:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'remove_and_eject',
     'Doğrulanmış ağır veya tekrarlanan ihlal'
   );
   ```

`remove_and_eject` içeriği kaldırır, hesabın tüm forum içeriklerini gizler ve
hesabın forum erişimini keser. İşlem yalnızca `forum_moderators` tablosundaki
yetkili kullanıcı veya `service_role` tarafından çalıştırılabilir.

Mevcut `article_admins` kayıtları migration sırasında otomatik olarak forum
moderatörlüğüne alınır. Yeni bir moderatör eklemek için:

```sql
insert into public.forum_moderators (user_id) values ('<AUTH_USER_ID>');
```

Hiçbir `pending` kayıt `review_due_at` zamanını geçmemelidir.
