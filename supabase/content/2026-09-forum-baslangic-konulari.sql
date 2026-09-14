-- Anne+ / forum baslangic konulari - Eylul 2026
--
-- Amac: Bos gorunen forumu, cevap vermeye davet eden konularla acmak.
-- Konular "Anne+ Ekibi" takma adiyla, kimligi gizlenmeden acilir. Amac
-- kullanicilari baska bir anne oldugumuza inandirmak degil, konusmayi
-- baslatmak; gercek anneler bos listeye degil, sorusu olan bir basliga
-- cevap yazar.
--
-- ------------------------------------------------------------------
-- CALISTIRMADAN ONCE IKI SEY LAZIM
-- ------------------------------------------------------------------
-- 1) EKIP HESABI
--    Supabase Dashboard > Authentication > Users > "Add user" ile bir
--    hesap olustur (orn. ekip@anneplus.app). Asagidaki EKIP_EPOSTASI
--    degerini o adresle degistir. Kendi kisisel hesabini da
--    kullanabilirsin; forumda gorunen isim her halukarda
--    "Anne+ Ekibi" olur (forum_nickname alani).
--
-- 2) KATEGORI ADLARI
--    Once su sorguyu calistirip kendi kategori adlarini gor:
--
--        select id, name, sort_order from public.forum_categories order by sort_order;
--
--    Sonra asagidaki listede gecen kategori adlarini kendi adlarinla
--    birebir ayni olacak sekilde duzelt. Adi tutmayan satir EKLENMEZ
--    (sessizce atlanir); en alttaki kontrol sorgusu kacinin eklendigini
--    gosterir.
-- ------------------------------------------------------------------
--
-- Tekrar calistirilabilir: ayni baslik zaten varsa yeniden eklenmez.

with team as (
  select id
  from auth.users
  where email = 'EKIP_EPOSTASI'   -- <<< BURAYI DEGISTIR
  limit 1
),
seed (category_name, title, content) as (
  values
    -- ---------- DOGUM SONRASI ----------
    (
      $md$Bebek Bakımı$md$,
      $md$Bebeğiniz geceleri kaç saatte bir uyanıyor?$md$,
      $md$Yeni makalemizde yenidoğan uykusunun neden dağınık göründüğünü ve gece gündüz ayrımının nasıl oturduğunu anlattık.

Merak ettiğimiz şu: sizin bebeğiniz kaç aylık ve geceleri hangi aralıklarla uyanıyor? Uykuya geçişte işinize yarayan bir rutin bulabildiniz mi?

Yorumlarda paylaşırsanız hem birbirinize fikir vermiş olursunuz hem de hangi konularda daha çok içerik hazırlamamız gerektiğini görürüz.

— Anne+ Ekibi$md$
    ),
    (
      $md$Bebek Bakımı$md$,
      $md$Akşam huzursuzluğunda size ne iyi geldi?$md$,
      $md$Pek çok bebekte akşam saatlerinde artan bir huzursuzluk oluyor ve bu dönem anne baba için epey yıpratıcı olabiliyor.

Sizde ne işe yaradı? Kundak mı, ten tene temas mı, hafif sallanma mı, yoksa hiçbiri tutmayıp sadece zamanla mı geçti?

Bu başlığı aynı dönemden geçen anneler için bir fikir listesi hâline getirelim.

— Anne+ Ekibi$md$
    ),
    (
      $md$Emzirme$md$,
      $md$Emzirmenin ilk haftasında en çok ne zorladı?$md$,
      $md$Emzirme doğal bir süreç ama ilk haftalar çoğu anne için hiç de kolay geçmiyor. Meme ucu ağrısı, tutunma sorunu, sütün yeterli gelip gelmediği kaygısı en sık duyduklarımız.

Sizi en çok ne zorladı ve neyin işe yaradığını fark ettiniz? Emzirme danışmanına başvurdunuz mu, faydasını gördünüz mü?

Yeni doğum yapmış anneler bu başlığı okuyacak; deneyiminizi yazmanız onlara iyi gelecek.

— Anne+ Ekibi$md$
    ),
    (
      $md$Lohusalık$md$,
      $md$Lohusalıkta kendinize vakit ayırabildiniz mi?$md$,
      $md$Doğumdan sonraki haftalarda her şey bebeğin etrafında dönerken annenin kendi iyileşmesi kolayca arka plana düşüyor.

Siz bu dönemde kendinize vakit ayırabildiniz mi? Destek isteyebildiniz mi, yoksa "ben hallederim" deyip yüklendiniz mi?

Bu başlıkta kimse kimseyi yargılamıyor; ne yaşadıysanız öyle yazın.

— Anne+ Ekibi$md$
    ),

    -- ---------- HAMILELIK ----------
    (
      $md$Hamilelik$md$,
      $md$Demir takviyesi kullananlar: mideniz kaldırdı mı?$md$,
      $md$Gebelikte demir ihtiyacı artıyor ve pek çok annenin takviye kullanması gerekiyor. Ancak takviyeler bazı annelerde mide rahatsızlığı veya kabızlık yapabiliyor.

Siz kullandınız mı? Sizde bir yan etki oldu mu, olduysa doktorunuzla nasıl bir çözüm buldunuz?

Not: doz ve ilaç değişikliği kararı tamamen doktorunuza ait; burada sadece deneyim paylaşıyoruz.

— Anne+ Ekibi$md$
    ),
    (
      $md$Hamilelik$md$,
      $md$Hamileyken seyahat ettiniz mi?$md$,
      $md$Sorunsuz ilerleyen bir gebelikte seyahat çoğu zaman mümkün ve en rahat dönem genellikle ikinci trimester oluyor.

Siz hamileyken yola çıktınız mı? Uçakta ya da uzun araba yolculuğunda işinize yarayan bir hazırlık oldu mu? Havayolu sizden doktor raporu istedi mi?

Yola çıkmayı düşünen anneler için pratik bir başlık olsun.

— Anne+ Ekibi$md$
    ),
    (
      $md$Hamilelik$md$,
      $md$Bu hafta en çok neyi merak ediyorsunuz?$md$,
      $md$Her hafta bir konu seçip içerik hazırlıyoruz ve hangi konuların gerçekten işinize yaradığını sizden duymak istiyoruz.

Şu sıralar aklınızı en çok kurcalayan soru ne? Hangi konuda doğru dürüst bilgi bulamadığınızı düşünüyorsunuz?

Buraya yazdıklarınız bir sonraki makalelerin konusu olacak.

— Anne+ Ekibi$md$
    )
)
insert into public.forum_posts
  (category_id, author_id, forum_nickname, title, content, post_kind, is_pinned)
select
  c.id,
  t.id,
  'Anne+ Ekibi',
  s.title,
  s.content,
  'topic',
  false
from seed s
join public.forum_categories c on c.name = s.category_name
cross join team t
where not exists (
  select 1 from public.forum_posts p where p.title = s.title
);

-- Kontrol: eklenen konular. Beklenen satir sayisi 7.
-- Daha az geldiyse kategori adlari tutmamistir; yukaridaki kategori
-- sorgusunu calistirip adlari duzelt ve bu dosyayi tekrar calistir.
select p.created_at, c.name as kategori, p.forum_nickname, p.title
from public.forum_posts p
join public.forum_categories c on c.id = p.category_id
where p.forum_nickname = 'Anne+ Ekibi'
order by p.created_at desc;
