-- Anne+ / yeni makaleler - Eylul 2026
--
-- Supabase Dashboard > SQL Editor'e yapistirip tek seferde calistirabilirsin.
-- Uygulama guncellemesi gerekmez; makaleler yayinlandigi an mevcut
-- kullanicilarda gorunur.
--
-- HAYAT DONEMI AYRIMI (src/api/articles.ts > filterArticlesForExperience):
--   category = 'bebek'     -> SADECE dogum sonrasi (lohusa) annelere gorunur.
--   category = 'hafta'     -> SADECE hamilelere gorunur; hangi haftalarda
--                             gorunecegini timeline_start_week / _end_week belirler.
--   category = 'ipuclari'  -> Hamilelere ve "genel" moddaki kullanicilara gorunur.
--   category = 'ay'        -> Hamilelere gorunur (ay bazli ozet icerik).
--
-- GORSELLER: image_path degerleri 'article-images' storage bucket'indaki dosya
-- yolunu gosterir; mevcut duzen <slug>/cover.jpg seklinde. Asagidaki kayitlar
-- bu yola gore dolduruldu; dosyalari ayni isimle yuklemen yeterli.
--
-- Tekrar calistirilabilir: ayni slug varsa gunceller, yoksa ekler.

insert into public.articles
  (slug, title, period, category, excerpt, body, image_path, accent,
   sort_order, timeline_start_week, timeline_end_week, is_published, published_at)
values
  -- ===================================================================
  -- DOGUM SONRASI ANNELER (category = 'bebek')
  -- ===================================================================
  (
    'yenidoganda-uyku-duzeni-ilk-aylar',
    'Yenidoğanda Uyku Düzeni: İlk Aylar',
    'İlk 3 ay',
    'bebek',
    'Yenidoğan uykusunun neden dağınık göründüğünü ve gece gündüz ayrımının nasıl oturduğunu anlatır.',
    $md$Yenidoğan bebekler günün büyük bölümünü uyuyarak geçirir, ama bu uyku yetişkinlerinkine benzemez. Kısa bölümler hâlinde, çoğu zaman iki üç saatte bir beslenmeyle bölünerek uyurlar. İlk haftalarda gece ile gündüz arasında bir fark görmemen son derece olağandır.

Bebeğin iç saati doğumla birlikte hazır gelmez; yavaş yavaş oturur. Gündüzleri odayı aydınlık tutmak, konuşmak ve günlük seslerin devam etmesi, geceleri ise ışığı kısmak ve etkileşimi azaltmak bu ayrımın yerleşmesine zamanla yardımcı olabilir. Bu bir eğitim değil, bebeğe ipucu vermektir.

Uyku bölümlerinin uzunluğu bebekten bebeğe çok değişir. Bir bebeğin altı hafta civarında daha uzun bloklar hâlinde uyuması da, dördüncü ayda hâlâ sık uyanması da normal aralık içindedir. Karşılaştırma yapmak çoğu zaman anneyi yorar, bebeği değiştirmez.

Güvenli uyku, düzenden daha önemlidir. Bebeğin sırtüstü yatırılması, yatağında yastık ve yumuşak oyuncak bulunmaması, odanın aşırı sıcak olmaması temel önerilerdir.

Kendi uykunu da denklemin parçası say. Gündüz bebek uyurken kısa aralıklarla dinlenmek, geceyi bölüşebileceğin biri varsa bunu konuşmak bu dönemde lüks değil ihtiyaçtır.

Bebeğinin uykusunda ani bir değişiklik, beslenmede belirgin azalma, uyandırmakta zorlandığın bir uyuşukluk ya da seni endişelendiren herhangi bir durum varsa doktoruna danışmalısın.$md$,
    'yenidoganda-uyku-duzeni-ilk-aylar/cover.jpg',
    '#6B96C7',
    260,
    null,
    null,
    true,
    now()
  ),
  (
    'emzirmede-sik-karsilasilan-sorunlar',
    'Emzirmede Sık Karşılaşılan Sorunlar',
    'Emzirme dönemi',
    'bebek',
    'Meme ucu çatlağı, dolgunluk ve tıkalı süt kanalı gibi sık sorunlarda ne yapılabileceği.',
    $md$Emzirme doğal bir süreç olsa da her zaman kendiliğinden kolay ilerlemez. İlk haftalarda yaşanan zorlukların çoğu geçicidir ve genellikle bebeğin memeye tutunma biçimiyle ilgilidir.

Meme ucunda ağrı ve çatlak en sık bildirilen sorundur. Çoğu durumda bebeğin yalnızca meme ucunu değil, areolanın bir bölümünü de ağzına alması gerekir. Emzirme sırasında keskin bir ağrı hissediyorsan, bebeği nazikçe ayırıp yeniden tutundurmayı denemek genellikle ilk adımdır.

Sütün geldiği ilk günlerde memelerde dolgunluk ve sertlik olabilir. Sık emzirmek bu dolgunluğun rahatlamasına yardımcı olur. Emzirme öncesi ılık, sonrasında serin uygulama bazı annelere iyi gelir.

Memede ağrılı, sert ve kızarık bir bölge fark edersen bu tıkalı bir süt kanalına işaret ediyor olabilir. Bu durumda emzirmeyi kesmek değil sürdürmek genellikle önerilir. Ateş, üşüme veya grip benzeri bir yorgunluk eklenirse vakit kaybetmeden hekime başvurulmalıdır.

Süt miktarının yeterliliğini gösteren en pratik işaretler bebeğin ıslattığı bez sayısı, kilo alımı ve genel canlılığıdır. Memenin yumuşak hissedilmesi tek başına sütün azaldığı anlamına gelmez.

Emzirme danışmanlığı bu dönemde çok işe yarar. Ağrın geçmiyorsa, bebeğin kilo alımı konusunda endişen varsa ya da ateşin çıktıysa doktoruna danışmalısın.$md$,
    'emzirmede-sik-karsilasilan-sorunlar/cover.jpg',
    '#A94F60',
    270,
    null,
    null,
    true,
    now()
  ),
  (
    'bebekte-gaz-sancisi-ve-aglama',
    'Bebekte Gaz Sancısı ve Ağlama',
    'İlk 4 ay',
    'bebek',
    'Akşam saatlerinde artan huzursuzluğun nedenleri ve bebeği sakinleştirmenin yolları.',
    $md$Yenidoğanların ağlaması iletişim biçimidir; açlık, yorgunluk, bez, sıcaklık ya da sadece kucak ihtiyacı olabilir. İlk aylarda özellikle akşam saatlerinde artan huzursuzluk oldukça sık görülür.

Gaz sancısı bu huzursuzluğun bilinen nedenlerinden biridir. Beslenme sırasında yutulan hava bebeğin karnında rahatsızlığa yol açabilir. Beslenme aralarında ve sonrasında gazını çıkarmak için dik pozisyonda tutmak çoğu zaman rahatlatır.

Sakinleştirmede işe yarayan yöntemler bebekten bebeğe değişir. Kundak, hafif sallanma, tekdüze bir ses, ten tene temas ya da karnına sıcak avuç temasıyla hafif masaj denenebilir. Hangisinin işe yaradığını zamanla sen keşfedersin.

Ağlamanın günün belli saatlerinde yoğunlaşıp haftalar içinde azalması beklenen bir seyirdir. Genellikle altı hafta civarında tepe yapar, üçüncü ay dolayında belirgin şekilde hafifler.

Bu dönem anne ve baba için yıpratıcı olabilir. Sakinleşemediğin bir anda bebeği güvenli bir yere bırakıp birkaç dakika nefeslenmek, sarsmaktan çok daha doğru bir tercihtir. Bebeği asla sarsma.

Ağlamaya ateş, kusma, beslenmeyi reddetme, ciltte döküntü veya olağandan farklı bir tizlik eşlik ediyorsa ya da bebeğin hâli seni endişelendiriyorsa doktoruna danışmalısın.$md$,
    'bebekte-gaz-sancisi-ve-aglama/cover.jpg',
    '#8A5B16',
    280,
    null,
    null,
    true,
    now()
  ),
  (
    'dogum-sonrasi-kontroller-ve-asi-takvimi',
    'Doğum Sonrası Kontroller ve Aşı Takvimi',
    'İlk 2 ay',
    'bebek',
    'Lohusalıkta anne ve bebek için planlanan kontroller ve aşı takviminin başlangıcı.',
    $md$Doğumdan sonraki ilk haftalar yalnızca bebeğin değil, annenin de takip edildiği bir dönemdir. Hem bebeğin gelişimi hem de annenin iyileşmesi planlı kontrollerle izlenir.

Bebek için ilk kontroller taburculuktan kısa süre sonra başlar. Bu görüşmelerde kilo alımı, sarılık durumu, beslenme düzeni ve genel gelişim değerlendirilir. İlk günlerdeki kilo kaybının ardından bebeğin yeniden doğum kilosuna ulaşması beklenen bir süreçtir.

Yenidoğan tarama testleri, topuktan alınan birkaç damla kanla yapılan ve erken dönemde fark edilmesi önemli olan bazı durumları arayan testlerdir. Zamanında yaptırılması önemlidir.

Aşı takvimi doğumla birlikte başlar ve belirli aralıklarla devam eder. Takvimin bebeğin durumuna göre düzenlenmesi gerekebileceği için uygulamadaki hatırlatmaları hekiminin verdiği planla birlikte kullanman en doğrusudur.

Annenin kontrolü de ihmal edilmemeli. Lohusalık dönemindeki kanama, dikiş iyileşmesi, tansiyon ve ruhsal durum değerlendirilir. Kendini sürekli çökkün, kaygılı veya bebeğine yabancı hissediyorsan bunu paylaşman gereken bir konudur; yaygındır ve desteklenebilir.

Kontrol tarihleri ve aşı takvimi kişiye göre değişebilir. Planını doktorunla birlikte netleştirmeli, aradaki bir şüphede ona danışmalısın.$md$,
    'dogum-sonrasi-kontroller-ve-asi-takvimi/cover.jpg',
    '#3F6F59',
    290,
    null,
    null,
    true,
    now()
  ),

  -- ===================================================================
  -- HAMILE ANNELER (category = 'hafta', haftaya gore gorunur)
  -- ===================================================================
  (
    'hamilelikte-demir-eksikligi-ve-kansizlik',
    'Hamilelikte Demir Eksikliği ve Kansızlık',
    'Demir ve kansızlık',
    'hafta',
    'Gebelikte demir ihtiyacının neden arttığı, belirtiler ve beslenmeyle desteklenmesi.',
    $md$Hamilelikte kan hacmi artar ve bebeğin gelişimi için demir ihtiyacı belirgin şekilde yükselir. Bu nedenle gebelikte kansızlık sık karşılaşılan durumlardan biridir.

Yorgunluk, halsizlik, çabuk nefes nefese kalma, soluk bir cilt ya da baş dönmesi demir eksikliğinin işaretleri arasında sayılır. Ancak bu belirtilerin çoğu gebeliğin kendisinde de görülebildiği için tanı kan tahliliyle konur.

Beslenme tarafında kırmızı et, yumurta sarısı, kurubaklagiller ve koyu yeşil yapraklı sebzeler demir açısından destekleyicidir. C vitamini içeren besinlerle birlikte tüketmek demirin emilimine yardımcı olur; çay ve kahveyi yemeğin hemen yanında içmemek ise sık verilen bir öneridir.

Demir takviyesi gerekip gerekmediğine, gerekiyorsa dozuna hekim karar verir. Takviyeler bazı annelerde mide rahatsızlığı veya kabızlık yapabilir; bu durumda kendi başına bırakmak yerine doktorunla konuşman daha doğru olur.

Kansızlığın takibi rutin gebelik kontrollerinin parçasıdır ve zamanında fark edildiğinde kolayca yönetilir.

Tahlil sonuçlarının yorumu ve takviye kararı kişiye özeldir; bu konuda doktorunun önerilerini esas almalısın.$md$,
    'hamilelikte-demir-eksikligi-ve-kansizlik/cover.jpg',
    '#7D8F72',
    14,
    8,
    34,
    true,
    now()
  ),
  (
    'hamilelikte-seyahat-ve-yolculuk',
    'Hamilelikte Seyahat ve Yolculuk',
    'Seyahat',
    'hafta',
    'Gebelikte araç ve uçak yolculuğunda dikkat edilmesi gerekenler ve zamanlama.',
    $md$Sorunsuz ilerleyen bir gebelikte seyahat çoğu zaman mümkündür. En rahat dönem genellikle ikinci trimesterdir; bulantı azalmış, yorgunluk hafiflemiş, doğum ise henüz yaklaşmamıştır.

Uzun yolculuklarda en önemli konu hareketsiz kalmamaktır. İki saatte bir kalkıp birkaç dakika yürümek, oturduğun yerde ayak bileklerini çevirmek ve bol su içmek dolaşımı destekler. Araçta emniyet kemerinin alt bandı karnın altından, kalça kemiklerinin üzerinden geçmelidir.

Havayolu şirketlerinin gebelik haftasına göre farklı kuralları vardır ve belirli bir haftadan sonra doktor raporu isteyebilirler. Bilet almadan önce ilgili şirketin kurallarını kontrol etmek sonradan yaşanacak sorunları önler.

Yanına gebelik takip kartını, kullandığın ilaçların listesini ve gideceğin yerdeki sağlık kuruluşlarının bilgisini alman iyi olur. Uzun süreli ya da yurt dışı seyahatlerde seyahat sağlık sigortasının gebeliği kapsayıp kapsamadığını sorman önerilir.

Riskli olarak değerlendirilen gebeliklerde, çoğul gebeliklerde ya da daha önce erken doğum öyküsü olan durumlarda seyahat planı farklı değerlendirilir.

Yolculuk kararını ve zamanlamasını, gebeliğinin seyrini bilen doktorunla birlikte vermelisin.$md$,
    'hamilelikte-seyahat-ve-yolculuk/cover.jpg',
    '#E3B873',
    20,
    12,
    32,
    true,
    now()
  )

on conflict (slug) do update set
  title               = excluded.title,
  period              = excluded.period,
  category            = excluded.category,
  excerpt             = excluded.excerpt,
  body                = excluded.body,
  image_path          = excluded.image_path,
  accent              = excluded.accent,
  sort_order          = excluded.sort_order,
  timeline_start_week = excluded.timeline_start_week,
  timeline_end_week   = excluded.timeline_end_week,
  is_published        = excluded.is_published,
  updated_at          = now();

-- Kontrol: eklenen kayitlari ve hangi doneme dustuklerini gosterir.
select sort_order, category, slug, timeline_start_week, timeline_end_week, image_path
from public.articles
where slug in (
  'yenidoganda-uyku-duzeni-ilk-aylar',
  'emzirmede-sik-karsilasilan-sorunlar',
  'bebekte-gaz-sancisi-ve-aglama',
  'dogum-sonrasi-kontroller-ve-asi-takvimi',
  'hamilelikte-demir-eksikligi-ve-kansizlik',
  'hamilelikte-seyahat-ve-yolculuk'
)
order by sort_order;
