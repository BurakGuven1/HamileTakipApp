export type Article = {
  accent: string;
  body: string[];
  category: "hafta" | "ay" | "bebek" | "ipuclari";
  excerpt: string;
  imageSource?: number;
  imagePath?: string | null;
  imageUrl?: string;
  period: string;
  slug: string;
  sortOrder: number;
  sources?: ArticleSource[];
  timelineEndWeek?: number | null;
  timelineStartWeek?: number | null;
  title: string;
};

export type ArticleSource = {
  title: string;
  url: string;
};

const healthMinistryPostpartumGuide: ArticleSource = {
  title: "T.C. Sağlık Bakanlığı · Doğum Sonu Bakım Yönetim Rehberi",
  url: "https://hsgm.saglik.gov.tr/depo/birimler/kadin-ve-ureme-sagligi-db/Rehberler/dogum_sonu_bakim_2020.pdf"
};

const whoPostnatalGuide: ArticleSource = {
  title: "Dünya Sağlık Örgütü · Doğum sonrası bakım önerileri",
  url: "https://www.who.int/publications/i/item/9789240045989"
};

const postpartumArticles: Article[] = [
  {
    accent: "#6E8F7C",
    body: [
      "## İlk saatlerde neler olur?",
      "Doğumdan sonraki ilk gün hem bebeğinle tanıştığın hem de bedeninin yakından izlendiği bir geçiş dönemidir. Sağlık ekibi kanamanı, rahminin toparlanmasını, tansiyonunu, nabzını, ateşini ve idrar yapabilmeni değerlendirir. Kendini iyi hissetsen bile bu kontroller, erken fark edilmesi gereken durumları yakalamak için önemlidir.",
      "Vajinal doğumdan sonra perine bölgesinde hassasiyet, sezaryen doğumdan sonra kesi çevresinde ağrı; her iki doğum biçiminde de adet sancısına benzeyen rahim kasılmaları olabilir. Ağrını saklamak zorunda değilsin. Emziriyorsan bunu da belirterek, sana uygun ağrı kontrolünü sağlık ekibinle konuşabilirsin.",
      "## İlk beslenme ve temas",
      "Sen ve bebeğin tıbben uygunsanız ten tene temas ve emzirme ilk saatlerde başlayabilir. İlk süt olan kolostrum az miktarda görünse de yoğun içeriklidir. İlk denemelerin kusursuz olması beklenmez; rahat bir pozisyon ve doğru kavrama için ebe veya emzirme danışmanından uygulamalı destek istemek bakımın doğal bir parçasıdır.",
      "## Eve çıkmadan önce",
      "Taburculuk planında kontrol zamanlarını, kullandığın ilaçları, yara veya perine bakımını ve hangi belirtilerde nereye başvuracağını yazılı olarak al. Türkiye’de doğum sonrası izlem yalnızca tek bir kontrol değildir; ilk günün ardından 2–5. gün, ikinci hafta ve yaklaşık altıncı hafta değerlendirmeleri iyileşmenin farklı parçalarını takip eder.",
      "! Ani veya çok yoğun kanama, göğüs ağrısı, nefes darlığı, bayılma hissi, nöbet, geçmeyen şiddetli baş ağrısı ya da görme değişikliği acil değerlendirme gerektirir. Böyle bir durumda bekleme; 112’yi ara veya en yakın acil servise başvur.",
      "Bu yazı genel bilgilendirme içindir. Doğum biçimin, gebelikte yaşadığın hastalıklar ve doğumda uygulanan işlemler kendi takip planını değiştirebilir; taburculuk önerilerini esas al."
    ],
    category: "bebek",
    excerpt: "İlk kontroller, bedenindeki erken değişimler, ten tene temas ve eve çıkmadan önce bilmen gerekenler.",
    imageSource: require("../../../assets/articles/postpartum/ilk-24-saat.webp"),
    period: "İlk 24 saat",
    slug: "dogumdan-sonra-ilk-24-saat",
    sortOrder: 200,
    sources: [healthMinistryPostpartumGuide, whoPostnatalGuide],
    title: "Doğumdan Sonra İlk 24 Saat"
  },
  {
    accent: "#A94F60",
    body: [
      "## İyileşme bir çizgi halinde ilerlemez",
      "Lohusalıkta rahim küçülürken kramplar, yorgunluk ve birkaç hafta sürebilen vajinal akıntı görülebilir. Loşi adı verilen bu akıntı ilk günlerde kırmızı ve daha yoğunken zamanla kahverengi veya pembeye, ardından daha açık bir renge döner ve azalır. Emzirme sırasında rahim kasıldığı için akıntıda kısa süreli artış veya kramp hissi olabilir.",
      "Pedini düzenli değiştir, ellerini önce ve sonra yıka. Tampon veya menstrual kap gibi vajina içine yerleştirilen ürünleri, sağlık profesyonelin güvenli olduğunu söyleyene kadar kullanma. Kötü kokulu akıntı, ateş, giderek artan karın hassasiyeti veya tekrar belirgin biçimde artan kanama için sağlık kuruluşuna başvur.",
      "## Perine ve tuvalet konforu",
      "Yırtık ya da epizyotomi dikişin varsa bölgeyi temiz suyla nazikçe temizlemek ve iyice kurulamak rahatlatıcı olabilir. Şiddetlenen ağrı, açılma, kötü koku veya akıntı normal iyileşme bulgusu değildir. Su, lifli besinler ve ıkınmayı azaltan bir tuvalet rutini kabızlığı önlemeye yardımcı olur; süren kabızlığı sağlık profesyonelinle konuş.",
      "## Pelvik tabanı yeniden hissetmek",
      "İdrar kaçırma ilk dönemde sık olabilir; ancak kader değildir. Ağrı oluşturmayan, kısa ve nazik pelvik taban kasmalarıyla başlamak çoğu kişi için uygundur. Kaçırma, vajinada ağırlık hissi, dışkı tutamama veya ilişki sırasında ağrı sürüyorsa kadın sağlığı fizyoterapisi ya da doktor değerlendirmesi iste.",
      "! Bir saatte birden fazla pedi tamamen dolduran kanama, büyük pıhtılarla birlikte baş dönmesi veya güçsüzlük, tek bacakta ağrı-şişlik, göğüs ağrısı ya da nefes darlığı acildir. Beklemeden 112’yi ara veya acil servise başvur.",
      "Her gün bir öncekinin aynısı olmak zorunda değildir. Dinlenme sonrası azalan yakınmalar genellikle daha sakin izlenebilir; yeni başlayan, giderek artan veya günlük bakımını engelleyen belirtiler için kontrol zamanını bekleme."
    ],
    category: "bebek",
    excerpt: "Loşi, rahim krampları, perine bakımı ve pelvik taban için sakin ve güvenli bir ilk altı hafta rehberi.",
    imageSource: require("../../../assets/articles/postpartum/ilk-6-hafta-iyilesme.webp"),
    period: "İlk 6 hafta",
    slug: "lohusalikta-ilk-6-hafta-iyilesme",
    sortOrder: 210,
    sources: [healthMinistryPostpartumGuide, whoPostnatalGuide],
    title: "İlk 6 Haftada Bedensel İyileşme"
  },
  {
    accent: "#8A5B16",
    body: [
      "## Büyük bir ameliyattan sonra bakım",
      "Sezaryenle doğum, bebeğinle ilgilenmeye başladığın sırada iyileştiğin büyük bir karın ameliyatıdır. İlk günlerde ağrı, çekilme hissi, yorgunluk ve hareket ederken desteğe ihtiyaç duymak beklenebilir. Ağrı kontrolünü düzenli konuşmak; nefes almanı, hareket etmeni, uyumanı ve bebeğini daha rahat tutmanı kolaylaştırır.",
      "Sağlık ekibin izin verdiğinde kısa ve yavaş hareketler dolaşımı destekler. Yataktan kalkarken önce yan dönmek, kollarından destek almak ve ani doğrulmamak karın duvarındaki yükü azaltabilir. Bebeğinden ağır bir şeyi kaldırmak, zorlayıcı ev işi ve yoğun egzersiz için kendi doktorunun verdiği süreyi bekle.",
      "## Kesi bakımını sade tut",
      "Kesi alanını sana gösterildiği şekilde temiz ve kuru tut. Her gün aynı ışıkta bakmak; kızarıklık, şişlik veya akıntıdaki değişimi daha kolay fark etmene yardım eder. Dar ve sürtünen kıyafetler yerine bölgeyi sıkıştırmayan seçenekler daha konforlu olabilir.",
      "## Evde gerçek destek planı",
      "İlk haftalarda yardım yalnızca bebeği tutmak değildir. Yemek, su, çamaşır, randevu ulaşımı ve gece bakımının paylaşılması senin dinlenme alanını korur. Ağrın nedeniyle bebeği güvenle kaldıramadığın anlarda yardım istemek başarısızlık değil, ameliyat sonrası bakımın parçasıdır.",
      "! Kesi yerinde açılma, irinli veya kötü kokulu akıntı, artan kızarıklık-şişlik, yüksek ateş, giderek şiddetlenen ağrı, yoğun kanama, tek bacakta şişlik ya da nefes darlığında gecikmeden tıbbi yardım al.",
      "Araç kullanma, banyo, egzersiz, cinsel yaşam ve işe dönüş zamanı kişiye göre değişir. Kendini daha iyi hissetmen dokuların tamamen iyileştiği anlamına gelmez; taburculuk planını ve kontrol önerilerini esas al."
    ],
    category: "bebek",
    excerpt: "Kesi bakımı, güvenli hareket, ağrı kontrolü ve evde destek planıyla sezaryen sonrası ilk haftalar.",
    imageSource: require("../../../assets/articles/postpartum/sezaryen-sonrasi.webp"),
    period: "Sezaryen sonrası",
    slug: "sezaryen-sonrasi-iyilesme-rehberi",
    sortOrder: 220,
    sources: [
      healthMinistryPostpartumGuide,
      {
        title: "NHS · Sezaryen sonrası iyileşme",
        url: "https://www.nhs.uk/tests-and-treatments/caesarean-section/recovery/"
      }
    ],
    title: "Sezaryen Sonrası İyileşme Rehberi"
  },
  {
    accent: "#3F6F59",
    body: [
      "## Birlikte öğrenilen bir beceri",
      "Emzirmenin ilk günleri anne ve bebeğin birbirini tanıdığı bir öğrenme sürecidir. Sık emme isteği, bazı beslenmelerin uzun bazılarınsa kısa olması tek başına sütün yetmediğini göstermez. Bebeğin genel durumu, yutkunması, bezleri ve kilo izlemi birlikte değerlendirilir.",
      "Rahat bir pozisyonda omuzlarını gevşet, bebeğin gövdesini kendine dönük ve yakın tut. Yalnızca meme ucunu değil çevresindeki koyu alanın bir bölümünü de kavrayan derin yerleşim daha konforlu olabilir. Emzirme boyunca süren keskin ağrı, çatlak veya kanama varsa pozisyonu tekrar değerlendir ve erken destek iste.",
      "## Dolgunluk ve meme konforu",
      "Sütün artmaya başladığı günlerde memeler dolgun ve sıcak hissedilebilir. Bebeğin sık ve etkili emmesi genellikle rahatlatır. Memede belirgin kızarık-sıcak alan, giderek artan ağrı, ateş veya grip benzeri his mastit gibi bir durumun değerlendirilmesini gerektirir.",
      "## Su, yemek ve ilaçlar",
      "Susadıkça su içmek, erişilebilir dengeli öğünler hazırlamak ve emzirme alanına küçük bir atıştırmalık koymak sürdürülebilir bir rutin sağlar. Katı yasak listeleri yerine kendi sağlık durumuna uygun beslenme planını doktorunla konuş. Reçeteli, reçetesiz veya bitkisel bir ürün kullanmadan önce emzirdiğini belirt.",
      "! Bebeğin emmeyi reddetmesi, belirgin uykulu ve zor uyandırılır olması, beklenenden az idrar yapması veya sarılığının artması durumunda aynı gün sağlık profesyoneline ulaş. Senin yüksek ateşin, şiddetli meme ağrın veya hızla yayılan kızarıklığın varsa kontrolü erteleme.",
      "Emzirme hedefin ne olursa olsun, bilgi ve saygılı destek alma hakkın var. Süt sağma, karma beslenme veya mama kullanımı gerekiyorsa planı bebeğinin sağlık ekibiyle birlikte kur; tek bir beslenme deneyimi anneliğinin ölçüsü değildir."
    ],
    category: "bebek",
    excerpt: "Doğru yerleşim, meme konforu, yeterlilik işaretleri ve ne zaman destek istemen gerektiği.",
    imageSource: require("../../../assets/articles/postpartum/emzirmenin-ilk-gunleri.webp"),
    period: "İlk günler",
    slug: "emzirmenin-ilk-gunleri",
    sortOrder: 230,
    sources: [
      whoPostnatalGuide,
      {
        title: "CDC · Emzirmenin ilk döneminde neler beklenir?",
        url: "https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/what-to-expect-while-breastfeeding.html"
      }
    ],
    title: "Emzirmenin İlk Günleri"
  },
  {
    accent: "#5F5368",
    body: [
      "## Her duygu bağ kurmanın bir parçası olabilir",
      "Doğumdan sonra hormon değişimleri, uykusuzluk, ağrı ve yeni sorumluluklar duyguları yoğunlaştırabilir. İlk günlerde dalgalı ruh hali, kolay ağlama ve kaygı sık görülür. Bu deneyim seni kötü bir anne yapmaz ve bebeğinle bağının hemen, tek bir anda kurulması gerekmez.",
      "Kısa süreli lohusa hüznü çoğunlukla ilk günlerde başlar ve destekle hafifler. Üzüntü, boşluk, yoğun kaygı, umutsuzluk, suçluluk veya hiçbir şeyden keyif alamama iki haftayı aşıyorsa; giderek güçleniyorsa ya da günlük bakımını etkiliyorsa bunu doktorun, eben veya aile hekiminle açıkça paylaş.",
      "## Yardımı somutlaştır",
      "‘Bir şeye ihtiyacın olursa söyle’ yerine belirli işler daha koruyucudur: bir öğün hazırlamak, bir saatlik kesintisiz dinlenme alanı açmak, randevuya eşlik etmek veya mesaj trafiğini üstlenmek. Güvendiğin bir kişiye bugün nasıl hissettiğini tek cümleyle söylemek bile görünmez yükü paylaşmaya başlar.",
      "## Destek almak emzirmeyle çelişmez",
      "Ruh sağlığı desteği gerektiğinde emzirmeyi otomatik olarak bırakmak gerekmez. Terapi, sosyal destek ve gerekiyorsa ilaç seçenekleri emzirme durumun dikkate alınarak sağlık profesyonelinle birlikte planlanabilir. Tedaviyi kendi kendine başlatma, kesme veya değiştirme.",
      "! Kendine ya da bebeğine zarar verme düşüncen varsa, gerçeklikle bağının koptuğunu hissediyorsan, sesler duyuyor veya olmayan şeyler görüyorsan yalnız kalma. Hemen 112’yi ara ya da en yakın acil servise git; yanında güvendiğin bir yetişkin olsun.",
      "Kontrollerde yalnızca bebeğin değil sen de konuşulmalısın. Uyku, kaygı, korku, doğum deneyimi ve evdeki güvenlik duygun doğum sonrası bakımın gerçek parçalarıdır."
    ],
    category: "bebek",
    excerpt: "Lohusa hüznü ile daha uzun süren zorlanmayı ayırt etmek, destek istemek ve acil işaretleri tanımak.",
    imageSource: require("../../../assets/articles/postpartum/duygusal-iyilik.webp"),
    period: "Duygusal iyilik",
    slug: "dogum-sonrasi-duygusal-iyilik",
    sortOrder: 240,
    sources: [
      whoPostnatalGuide,
      {
        title: "CDC · Doğum sonrası depresyon ve emzirme",
        url: "https://www.cdc.gov/breastfeeding-special-circumstances/hcp/illnesses-conditions/postpartum-depression.html"
      }
    ],
    title: "Doğum Sonrası Duygusal İyilik"
  },
  {
    accent: "#7D8F72",
    body: [
      "## Hedef eski haline dönmek değil, toparlanmak",
      "Doğum sonrası enerji; doğum biçimi, kan kaybı, uyku, emzirme, mevcut hastalıklar ve evdeki destekle birlikte değişir. İlk haftalarda kendini performans hedefleriyle karşılaştırmak yerine temel ihtiyaçları görünür kıl: düzenli yemek, susadıkça su, ağrı kontrolü, kısa dinlenme aralıkları ve yardım.",
      "Her öğünü kusursuz hazırlamak gerekmez. Protein, sebze-meyve, tam tahıl ve ulaşılabilir yağ kaynaklarını gün içine yaymak; emzirme alanına su ve kolay bir atıştırmalık koymak işleri basitleştirir. Emziriyorsan enerji gereksinimin artabilir; özel diyet, vitamin veya bitkisel ürün kararını sağlık durumunu bilen bir profesyonelle ver.",
      "## Dinlenmeyi vardiyaya çevir",
      "‘Bebek uyurken uyu’ her evde uygulanabilir değildir. Bunun yerine aile içinde korunmuş dinlenme blokları planla: bir kişi bebeğin beslenme dışındaki bakımını üstlenirken diğer kişi kesintisiz dinlensin. Anne+ içindeki Aile Vardiyası ve bakım kayıtları, sözlü devrin unutulan ayrıntılarını azaltmak için kullanılabilir.",
      "## Hareketi küçük başlat",
      "Sağlık ekibin farklı bir kısıtlama vermediyse rahat hissettiğinde kısa, yavaş yürüyüşler ve nazik pelvik taban farkındalığıyla başlayabilirsin. Süreyi ve yoğunluğu kademeli artır. Sezaryen doğum, ciddi yırtık, yoğun kanama veya başka bir komplikasyon yaşadıysan başlangıç zamanını doktorunla netleştir.",
      "! Hareket sırasında ağrı, baş dönmesi, nefes darlığı, göğüs ağrısı, kanamada belirgin artış veya kesi/perine bölgesinde baskı hissi olursa dur ve sağlık profesyoneline başvur. Tek bacakta ağrı ve şişlik ya da ani nefes darlığı acil değerlendirme gerektirir.",
      "Toparlanma takvimi yarış değildir. Günlük işlevini engelleyen yorgunluk, çarpıntı, solukluk, baş dönmesi veya nefes darlığı kansızlık ya da başka bir durumla ilişkili olabilir; kontrol zamanını beklemeden değerlendirme iste."
    ],
    category: "bebek",
    excerpt: "Beslenme, sıvı, dinlenme vardiyası ve nazik hareketle baskısız bir toparlanma planı.",
    imageSource: require("../../../assets/articles/postpartum/enerjini-toplama.webp"),
    period: "Günlük toparlanma",
    slug: "dogum-sonrasi-enerjini-toplama",
    sortOrder: 250,
    sources: [
      healthMinistryPostpartumGuide,
      {
        title: "ACOG · Doğumdan sonra egzersiz",
        url: "https://www.acog.org/womens-health/faqs/exercise-after-pregnancy"
      }
    ],
    title: "Enerjini Toplama: Beslenme, Dinlenme ve Hareket"
  }
];

export const fallbackArticles: Article[] = [
  {
    accent: "#D97895",
    body: [
      "Bu hafta bebeğin yüz hatları daha belirginleşir. Göz kapakları, kulak yapısı ve minik parmak ayrımları gelişmeye devam eder.",
      "Anne tarafında yorgunluk, koku hassasiyeti ve mide bulantısı hâlâ görülebilir. Küçük ama sık öğünler ve yeterli sıvı alımı bu dönemde destekleyici olabilir.",
      "Her gebelik kişiseldir. Ağrı, kanama, şiddetli kusma veya seni endişelendiren bir belirti varsa doktoruna danışmalısın."
    ],
    category: "hafta",
    excerpt: "10. haftada yüz hatları, göz kapakları ve kulak yapısı gelişimini hızlandırır.",
    period: "10. hafta",
    slug: "hamileligin-10-haftasi",
    sortOrder: 10,
    timelineEndWeek: 10,
    timelineStartWeek: 10,
    title: "Hamileliğin 10. Haftası"
  },
  {
    accent: "#6B96C7",
    body: [
      "11. haftada bebek içeride aktif şekilde hareket eder; anne bu hareketleri çoğu zaman henüz hissetmez.",
      "Dış kulaklar şekillenmeye, kemik ve kas sistemi güçlenmeye devam eder. Bu dönem hızlı büyüme ve olgunlaşma dönemidir.",
      "Düzenli doktor kontrolleri, beslenme ve dinlenme planı için en güvenilir rehberdir."
    ],
    category: "hafta",
    excerpt: "Minik hareketler artar, kulaklar şekillenir ve büyüme temposu hızlanır.",
    period: "11. hafta",
    slug: "hamileligin-11-haftasi",
    sortOrder: 11,
    timelineEndWeek: 11,
    timelineStartWeek: 11,
    title: "Hamileliğin 11. Haftası"
  },
  {
    accent: "#E3B873",
    body: [
      "3. ay, ilk trimesterin sonuna yaklaşırken hem anne hem bebek için önemli bir geçiş dönemidir.",
      "Bulantı ve yorgunluk bazı annelerde hafiflemeye başlarken, iştah ve enerji seviyesi kişiden kişiye değişebilir.",
      "Bu ayda doktorunun önerdiği tarama ve takip planını aksatmamak önemlidir."
    ],
    category: "ay",
    excerpt: "İlk trimesterin sonuna yaklaşırken anne ve bebekte beklenen değişimler.",
    period: "3. ay",
    slug: "hamilelikte-3-ay",
    sortOrder: 30,
    timelineEndWeek: 13,
    timelineStartWeek: 9,
    title: "Hamilelikte 3. Ay Rehberi"
  },
  {
    accent: "#6E8F7C",
    body: [
      "Gün içinde kısa nefes molaları, su içme hatırlatmaları ve hafif yürüyüşler gebelik döneminde rutini yumuşatabilir.",
      "Kendini zorlamadan ilerlemek ve bedeninin verdiği sinyalleri dikkate almak daha sürdürülebilir bir takip sağlar.",
      "Tıbbi kararlar için uygulamadaki bilgiler yerine doktorunun önerilerini esas almalısın."
    ],
    category: "ipuclari",
    excerpt: "Gebelik takibini daha sakin ve sürdürülebilir hale getiren küçük rutinler.",
    period: "İpuçları",
    slug: "gebelikte-gunluk-rutin-ipuclari",
    sortOrder: 100,
    timelineEndWeek: 42,
    timelineStartWeek: 1,
    title: "Günlük Rutin İçin Nazik İpuçları"
  },
  ...postpartumArticles
];

export function getArticleBySlug(slug: string) {
  return fallbackArticles.find((article) => article.slug === slug);
}

export function getFeaturedArticles(limit = 3) {
  return [...fallbackArticles]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limit);
}
