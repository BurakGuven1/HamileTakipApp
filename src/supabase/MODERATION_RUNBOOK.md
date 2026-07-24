# Anne+ Forum Moderasyon Runbook

Apple App Review Guideline 1.2 için her kullanıcı raporu en geç 24 saat içinde
sonuçlandırılır.

## Otomatik korumalar

- Yasaklı hakaret, tehdit ve cinsel spam kalıpları veritabanı tetikleyicisiyle
  paylaşılmadan önce reddedilir.
- Raporlanan içerik inceleme tamamlanana kadar anında genel akıştan gizlenir.
- Bir kullanıcının engellediği hesaplar sunucu tarafında gönderi ve yorum
  görünümlerinden çıkarılır.
- Hesap uzaklaştırma otomatik rapor sayısına göre yapılmaz; kötü niyetli toplu
  raporlamayı önlemek için moderatör doğrulaması gerekir.

## Günlük moderasyon sırası

1. `forum_reports` tablosunda `status = 'pending'` kayıtları
   `review_due_at` artan sırayla incele.
2. İçeriği, rapor nedenini ve aynı yazara ait son 90 günlük raporları değerlendir.
3. Rapor asılsızsa service role ile şu işlemi çalıştır:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'dismiss',
     'İhlal bulunmadı'
   );
   ```

4. İhlal doğrulanırsa içeriği kaldır:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'remove_content',
     'Doğrulanmış topluluk kuralı ihlali'
   );
   ```

5. Sakıncalı içeriği sağlayan kullanıcıyı topluluktan çıkarmak için:

   ```sql
   select public.resolve_forum_report(
     '<REPORT_ID>',
     'remove_and_eject',
     'Doğrulanmış ağır veya tekrarlanan ihlal'
   );
   ```

`remove_and_eject` içeriği kaldırır, hesabın tüm forum içeriklerini gizler ve
hesabın forum erişimini keser. İşlem yalnızca `service_role` tarafından
çalıştırılabilir.

Hiçbir `pending` kayıt `review_due_at` zamanını geçmemelidir.
