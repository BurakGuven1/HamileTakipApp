import type { ImageSourcePropType } from "react-native";

export type SolidFoodRecipeCategory =
  | "İlk tadımlar"
  | "Demirden zengin"
  | "Pütürlü geçiş"
  | "Parmak gıda"
  | "Bir yaş sofrası";

export type SolidFoodRecipe = {
  slug: string;
  title: string;
  summary: string;
  minMonth: number;
  prepMinutes: number;
  category: SolidFoodRecipeCategory;
  texture: string;
  image: ImageSourcePropType;
  ingredients: string[];
  steps: string[];
  allergens: string[];
  safetyNote: string;
  storage: string;
  /** Tarifin dayandığı halk sağlığı kaynağı; yalnızca yeni tariflerde bulunur. */
  source?: { label: string; url: string };
};

const pearOatYogurt = require("../../../assets/recipes/pear-oat-yogurt.jpg");
const pumpkinLentil = require("../../../assets/recipes/pumpkin-lentil.jpg");
const avocadoEgg = require("../../../assets/recipes/avocado-egg.jpg");
const chickenVegetable = require("../../../assets/recipes/chicken-vegetable.jpg");
const carrotPotato = require("../../../assets/recipes/havuclu-patates-puresi.jpg");
const bakedApple = require("../../../assets/recipes/firinda-elma-puresi.jpg");
const tahiniBanana = require("../../../assets/recipes/tahinli-muz-ezmesi.jpg");
const spinachPotato = require("../../../assets/recipes/ispanakli-patates-ezmesi.jpg");
const greenBeanRice = require("../../../assets/recipes/yesil-fasulyeli-pirinc-puresi.jpg");
const chickenBulgur = require("../../../assets/recipes/tavuklu-bulgur-ezmesi.jpg");
const yaylaSoup = require("../../../assets/recipes/bebek-yayla-corbasi.jpg");
const bakedSalmon = require("../../../assets/recipes/firinda-somon-sebze.jpg");
const omeletteMuffin = require("../../../assets/recipes/sebzeli-omlet-muffin.jpg");
const babyHummus = require("../../../assets/recipes/bebek-humusu.jpg");
const salmonRisotto = require("../../../assets/recipes/somonlu-bezelyeli-risotto.jpg");
const bakedMeatballs = require("../../../assets/recipes/firinda-sebzeli-kofte.jpg");
const lentilPasta = require("../../../assets/recipes/mercimekli-sebze-soslu-makarna.jpg");
const familyStew = require("../../../assets/recipes/aile-sofrasi-tavuklu-guvec.jpg");
const spinachCrepe = require("../../../assets/recipes/ispanakli-peynirli-krep.jpg");
const fruitOatBowl = require("../../../assets/recipes/meyveli-yulaf-kahvalti-kasesi.jpg");
const tarhanaSoup = require("../../../assets/recipes/ev-yapimi-tarhana-corbasi.jpg");

export const solidFoodRecipes: SolidFoodRecipe[] = [
  {
    slug: "armutlu-yulafli-yogurt",
    title: "Armutlu yulaflı yoğurt",
    summary: "Yumuşak armut, iyi pişmiş yulaf ve şekersiz yoğurtla sakin bir ilk kâse.",
    minMonth: 6,
    prepMinutes: 12,
    category: "İlk tadımlar",
    texture: "Pürüzsüz veya ince ezme",
    image: pearOatYogurt,
    ingredients: [
      "2 yemek kaşığı ince yulaf ezmesi",
      "Yarım küçük, soyulmuş armut",
      "2 yemek kaşığı pastörize, şekersiz tam yağlı yoğurt",
      "Kıvam için içme suyu"
    ],
    steps: [
      "Armutu küçük doğra; az suyla tamamen yumuşayana kadar pişir.",
      "Yulafı ayrı bir kapta suyla iyice yumuşayana kadar pişir.",
      "Armut ve yulafı bebeğinin deneyimine uygun pürüzsüzlükte ez.",
      "Karışım ılınınca yoğurdu ekle ve küçük bir porsiyon sun."
    ],
    allergens: ["Süt", "Yulaf"],
    safetyNote: "Süt ürününü ilk kez deniyorsa küçük miktarla ve gündüz saatinde sun; daha önce reaksiyon öyküsü varsa çocuk doktorunun planını izle.",
    storage: "Taze sun. Bebeğin kaşığının değmediği artanı kapalı kapta buzdolabında en fazla 24 saat sakla."
  },
  {
    slug: "balkabakli-kirmizi-mercimek",
    title: "Balkabaklı kırmızı mercimek ezmesi",
    summary: "Balkabağının yumuşaklığıyla mercimeği birleştiren, kaşıktan kolay kayan bir öğün.",
    minMonth: 6,
    prepMinutes: 24,
    category: "Demirden zengin",
    texture: "Pürüzsüz ezme",
    image: pumpkinLentil,
    ingredients: [
      "2 yemek kaşığı kırmızı mercimek",
      "3 küçük küp balkabağı",
      "1 çay kaşığı zeytinyağı",
      "Kıvam için içme suyu"
    ],
    steps: [
      "Mercimeği bol suyla iyice yıka.",
      "Mercimek ve balkabağını tamamen yumuşayana kadar birlikte pişir.",
      "Pişirme suyundan az ekleyerek bebeğinin yutabileceği kıvamda ez.",
      "Ilıdıktan sonra zeytinyağını ekle; tuz veya salça ekleme."
    ],
    allergens: [],
    safetyNote: "İlk günlerde tek bileşenli tadımlar tamamlandıysa karışık tarife geç. Bebeğini dik oturt ve yerken daima yanında kal.",
    storage: "Porsiyonlanmış artanı hızla soğutup buzdolabında en fazla 24 saat sakla; yalnızca bir kez ısıt."
  },
  {
    slug: "avokadolu-yumurta-ezmesi",
    title: "Avokadolu yumurta ezmesi",
    summary: "Tam pişmiş yumurta ve avokadoyla hazırlanan, yumuşak ve doyurucu bir ezme.",
    minMonth: 6,
    prepMinutes: 14,
    category: "Demirden zengin",
    texture: "İnce ezme",
    image: avocadoEgg,
    ingredients: [
      "Yarım katı pişmiş yumurta",
      "Çeyrek olgun avokado",
      "Kıvam için az miktarda anne sütü, mama veya içme suyu"
    ],
    steps: [
      "Yumurtayı sarısı ve beyazı tamamen katılaşana kadar pişir.",
      "Avokadoyu çatalla pürüzsüzce ez.",
      "Yumurtayı çok ince ezip avokadoya karıştır.",
      "Gerekirse birkaç damla sıvıyla kıvamı aç ve hemen sun."
    ],
    allergens: ["Yumurta"],
    safetyNote: "Yumurta alerjen bir besindir. İlk sunumda küçük miktar ver; şiddetli egzama veya bilinen alerji varsa önce çocuk doktoruna danış.",
    storage: "Avokado hızla renk değiştirir; bu tarifi bekletmeden taze sun ve artanı yeniden verme."
  },
  {
    slug: "kabakli-patates-ezmesi",
    title: "Kabaklı patates ezmesi",
    summary: "Pürüzsüzden hafif pütürlü dokuya geçiş için çatalla kolayca ayarlanan sade tarif.",
    minMonth: 7,
    prepMinutes: 20,
    category: "Pütürlü geçiş",
    texture: "Yumuşak, küçük pütürlü",
    image: pumpkinLentil,
    ingredients: [
      "Yarım küçük kabak",
      "Yarım küçük patates",
      "1 çay kaşığı zeytinyağı",
      "Kıvam için içme suyu"
    ],
    steps: [
      "Kabak ve patatesi soyup küçük küpler halinde doğra.",
      "Buharda veya az suda çatalla dağılacak kadar yumuşat.",
      "Blender yerine çatalla ezerek çok küçük, yumuşak pütürler bırak.",
      "Ilıkken zeytinyağını ekle ve dokuya verdiği tepkiyi gözle."
    ],
    allergens: [],
    safetyNote: "Ay etiketi yalnızca rehberdir. Bebeğin baş-boyun kontrolü ve yutma becerisi bu dokuya hazır değilse daha pürüzsüz kıvam kullan.",
    storage: "Buzdolabında en fazla 24 saat sakla; bebeğin ağzına değen porsiyonu saklama."
  },
  {
    slug: "tavuklu-sebze-tenceresi",
    title: "Tavuklu sebze tenceresi",
    summary: "İyice pişmiş tavuk ve sebzelerle hazırlanan, aile yemeğine yaklaşan yumuşak bir kâse.",
    minMonth: 8,
    prepMinutes: 32,
    category: "Demirden zengin",
    texture: "Nemli, ince didiklenmiş",
    image: chickenVegetable,
    ingredients: [
      "30 g derisiz, kemiksiz tavuk eti",
      "2 dilim kabak",
      "2 dilim havuç",
      "Yarım küçük patates",
      "1 çay kaşığı zeytinyağı"
    ],
    steps: [
      "Tavuk ve sebzeleri ayrı bir kesme yüzeyinde küçükçe hazırla.",
      "Hepsini tavuk tamamen pişene ve sebzeler dağılacak kadar yumuşayana dek pişir.",
      "Kemiği olmadığını kontrol et; tavuğu lif kalmayacak kadar ince didikle.",
      "Sebzelerle nemli bir kıvamda ez, ılınınca zeytinyağını ekle."
    ],
    allergens: [],
    safetyNote: "Tavukta pembe kısım kalmamalı. Büyük veya kuru et parçaları bırakma; bebeğin dik oturduğundan ve gözetim altında olduğundan emin ol.",
    storage: "Temiz bir kapta hızla soğutup buzdolabında en fazla 24 saat sakla; servis öncesi her yerini eşit ısıtıp ılıt."
  },
  {
    slug: "muzlu-yulafli-mini-pankek",
    title: "Muzlu yulaflı yumuşak pankek",
    summary: "Şekersiz, tamamen pişmiş ve iki parmak genişliğinde şeritlerle sunulan yumuşak lokmalar.",
    minMonth: 9,
    prepMinutes: 18,
    category: "Parmak gıda",
    texture: "Yumuşak şerit",
    image: pearOatYogurt,
    ingredients: [
      "Yarım olgun muz",
      "1 küçük yumurta",
      "3 yemek kaşığı ince öğütülmüş yulaf",
      "Tavayı yağlamak için birkaç damla zeytinyağı"
    ],
    steps: [
      "Muzu ez; yumurta ve yulafla pürüzsüz bir harç yap.",
      "Küçük pankekleri kısık ateşte iki yüzü de tamamen pişene kadar tut.",
      "Soğuduktan sonra yetişkin parmağı kadar geniş, yumuşak şeritler kes.",
      "Bir şeridi iki parmağın arasında kolayca ezebildiğini kontrol ederek sun."
    ],
    allergens: ["Yumurta", "Yulaf"],
    safetyNote: "Bebeğin kendi kendine alıp ağzına götürme ve dik oturma becerisi oluşmadıysa parmak gıdaya geçme. Küçük yuvarlak parçalar sunma.",
    storage: "Aynı gün içinde tüket; bebeğin eline verilen veya ağzına değen parçaları tekrar saklama."
  },
  {
    slug: "brokolili-yogurtlu-makarna",
    title: "Brokolili yoğurtlu mini makarna",
    summary: "Çok iyi pişmiş makarna ve ezilmiş brokoliyle pütürlü doku pratiği.",
    minMonth: 9,
    prepMinutes: 22,
    category: "Pütürlü geçiş",
    texture: "Çok yumuşak, küçük taneli",
    image: chickenVegetable,
    ingredients: [
      "2 yemek kaşığı küçük şekilli makarna",
      "2 küçük brokoli çiçeği",
      "2 yemek kaşığı pastörize, şekersiz yoğurt",
      "1 çay kaşığı zeytinyağı"
    ],
    steps: [
      "Makarna ve brokoliyi normalden daha yumuşak olacak şekilde iyice pişir.",
      "Brokoliyi çatalla ez; makarnayı bebeğinin becerisine göre çok küçük parçala.",
      "Ilıyınca yoğurt ve zeytinyağıyla nemli bir kıvam oluştur.",
      "Büyük brokoli sapı veya sert makarna parçası kalmadığını kontrol et."
    ],
    allergens: ["Buğday", "Süt"],
    safetyNote: "Buğday ve sütü ilk kez aynı öğünde deneme. Alerjenleri daha önce ayrı ayrı güvenle tattıysa bu karışımı sun.",
    storage: "Yoğurdu servis anında ekle. Sade pişmiş tabanı buzdolabında en fazla 24 saat sakla."
  },
  {
    slug: "firinda-armutlu-lor-lokmasi",
    title: "Fırında armutlu lor lokması",
    summary: "Elde kolay ezilen, ilave şekersiz ve yumuşak aile lokmaları.",
    minMonth: 10,
    prepMinutes: 28,
    category: "Parmak gıda",
    texture: "Yumuşak, kolay dağılan",
    image: avocadoEgg,
    ingredients: [
      "Yarım olgun armut",
      "2 yemek kaşığı tuzsuz pastörize lor",
      "1 yumurta sarısı",
      "2 yemek kaşığı ince yulaf"
    ],
    steps: [
      "Armudu rendele ve fazla suyunu hafifçe sık.",
      "Lor, yumurta sarısı ve yulafla yumuşak bir karışım yap.",
      "İnce, uzun lokmalar şekillendir ve içi tamamen pişene kadar fırınla.",
      "Ilıt; iki parmak arasında kolayca dağıldığını kontrol ederek sun."
    ],
    allergens: ["Süt", "Yumurta", "Yulaf"],
    safetyNote: "Yeni alerjenleri tek tek tanıt. Lokmayı sert veya küçük yuvarlak yapma; bebeğin oturarak ve yakın gözetim altında yemesini sağla.",
    storage: "Aynı gün taze sun. Temiz kalan lokmaları kapalı kapta buzdolabında en fazla 24 saat tut."
  },
  {
    slug: "havuclu-patates-puresi",
    title: "Havuçlu patates püresi",
    summary: "İki sebzeyle hazırlanan, tatlımsı ve kaşıktan kolay kayan klasik bir ilk püre.",
    minMonth: 6,
    prepMinutes: 20,
    category: "İlk tadımlar",
    texture: "Pürüzsüz püre",
    image: carrotPotato,
    ingredients: [
      "1 küçük havuç",
      "Yarım küçük patates",
      "1 çay kaşığı zeytinyağı",
      "Kıvam için pişirme suyu, anne sütü veya mama"
    ],
    steps: [
      "Havuç ve patatesi soyup küçük küpler halinde doğra.",
      "Buharda ya da az suda, çatalla kolayca dağılana kadar 12-15 dakika pişir.",
      "Blenderdan geçir; pişirme suyundan azar azar ekleyerek akışkan bir püre elde et.",
      "Ilıdıktan sonra zeytinyağını karıştır; tuz, tereyağı veya baharat ekleme."
    ],
    allergens: [],
    safetyNote:
      "Bebeğin ek gıdaya yeni başlıyorsa yeni besinleri 2-3 gün arayla tek tek tanıt. Püreyi her zaman el bileğinde ısı kontrolü yaparak ılık sun ve yerken yanından ayrılma.",
    storage:
      "Porsiyonlayıp hızla soğut; buzdolabında en fazla 24 saat, derin dondurucuda 1 ay sakla. Yalnızca bir kez ısıt.",
    source: {
      label: "NHS – Bebeğine ne verebilirsin: 6 ay civarı",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/around-6-months/"
    }
  },
  {
    slug: "firinda-elma-puresi",
    title: "Fırında elma püresi",
    summary: "Fırında pişince doğal tatlılığı artan, ilave şekersiz tek bileşenli bir tadım.",
    minMonth: 6,
    prepMinutes: 30,
    category: "İlk tadımlar",
    texture: "Pürüzsüz püre",
    image: bakedApple,
    ingredients: [
      "1 tatlı elma",
      "2 yemek kaşığı içme suyu",
      "İstersen kıvam için 1 yemek kaşığı ince yulaf"
    ],
    steps: [
      "Elmayı soy, çekirdek evini tamamen çıkar ve küp küp doğra.",
      "Fırın kabına al, suyu ekle ve üstünü kapatarak 180°C'de 25 dakika yumuşayana kadar pişir.",
      "Çatalla veya blenderla pürüzsüz hale getir; gerekiyorsa kıvam için pişmiş yulaf ekle.",
      "Ilıdıktan sonra küçük bir kaşıkla sun; tarçın, şeker veya bal ekleme."
    ],
    allergens: ["Yulaf (eklersen)"],
    safetyNote:
      "1 yaşından önce bal verilmez; botulizm riski taşır. Şeker de eklenmez. Elma çiğ ve sert haldeyken boğulma riski oluşturur, bu yaşta mutlaka pişirerek sun.",
    storage:
      "Buzdolabında 24 saat; buz kalıbında porsiyonlayıp 1 aya kadar dondurabilirsin. Çözdükten sonra tekrar dondurma.",
    source: {
      label: "T.C. Sağlık Bakanlığı HSGM – Bebek Beslenmesi",
      url: "https://hsgm.saglik.gov.tr/tr/beslenme/bebek-beslenmesi.html"
    }
  },
  {
    slug: "tahinli-muz-ezmesi",
    title: "Tahinli muz ezmesi",
    summary: "Susamı güvenli biçimde tanıtan, demir ve enerjisi yüksek iki malzemeli ezme.",
    minMonth: 6,
    prepMinutes: 6,
    category: "Demirden zengin",
    texture: "Yumuşak ezme",
    image: tahiniBanana,
    ingredients: [
      "Yarım olgun muz",
      "1 çay kaşığı şekersiz, tuzsuz tahin",
      "İstersen 1 yemek kaşığı anne sütü veya mama"
    ],
    steps: [
      "Muzu çatalla lif kalmayacak şekilde pürüzsüzce ez.",
      "Tahini iyice karıştır; yoğun kaldıysa birkaç damla süt ile aç.",
      "Karışımın kaşıkta kalacak ama kolay yutulacak kıvamda olduğunu kontrol et.",
      "Küçük bir porsiyonla başla ve bebeğinin tepkisini gözle."
    ],
    allergens: ["Susam"],
    safetyNote:
      "Susam başlıca alerjenlerden biridir. İlk kez veriyorsan gündüz, sakin bir günde ve azıcık miktarla başla; sonraki 2 saat boyunca döküntü, kusma veya nefes değişikliği açısından gözle. Şiddetli egzama veya bilinen besin alerjisi varsa önce çocuk doktoruna danış. Tahini kaşık dolusu, koyu kıvamda verme.",
    storage: "Muz hızla kararır; tarifi taze hazırla ve artanı saklama.",
    source: {
      label: "NHS – Bebeklerde besin alerjileri ve alerjen tanıtımı",
      url: "https://www.nhs.uk/conditions/baby/weaning-and-feeding/food-allergies-in-babies-and-young-children/"
    }
  },
  {
    slug: "ispanakli-patates-ezmesi",
    title: "Ispanaklı patates ezmesi",
    summary: "Bitkisel demiri C vitaminiyle birlikte sunan, yumuşak ve sade bir öğün.",
    minMonth: 6,
    prepMinutes: 22,
    category: "Demirden zengin",
    texture: "Pürüzsüz ezme",
    image: spinachPotato,
    ingredients: [
      "1 avuç taze ıspanak yaprağı (sapları ayıklanmış)",
      "1 küçük patates",
      "2 yemek kaşığı pişmiş kırmızı mercimek",
      "1 çay kaşığı zeytinyağı",
      "Birkaç damla taze limon suyu"
    ],
    steps: [
      "Ispanağı yaprak yaprak iyice yıka; kum kalmadığından emin ol.",
      "Patatesi küçük doğrayıp yumuşayana kadar haşla, son 3 dakikada ıspanağı ekle.",
      "Pişmiş mercimekle birlikte pürüzsüz olana kadar ez veya blenderdan geçir.",
      "Ilıkken zeytinyağını ve birkaç damla limonu ekle; limon, demirin emilimini artırır."
    ],
    allergens: [],
    safetyNote:
      "Ispanağı pişirdikten sonra bekletme, hemen soğutup sun. 6. aydan sonra bebeğin demir deposu azalır; bu tip demirden zengin öğünleri günlük planına ekle. Tuz ve tereyağı ekleme.",
    storage: "Taze tüket. Kalanı 24 saatten uzun bekletme; ıspanaklı yemekleri tekrar tekrar ısıtma.",
    source: {
      label: "NHS – Bebeğine ne verebilirsin: 6 ay civarı",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/around-6-months/"
    }
  },
  {
    slug: "yesil-fasulyeli-pirinc-puresi",
    title: "Yeşil fasulyeli pirinç püresi",
    summary: "Acı-ekşi olmayan yeşil sebze tadını yumuşak pirinçle dengeleyen doyurucu püre.",
    minMonth: 6,
    prepMinutes: 25,
    category: "İlk tadımlar",
    texture: "Pürüzsüz püre",
    image: greenBeanRice,
    ingredients: [
      "6-7 adet taze yeşil fasulye",
      "1 yemek kaşığı pirinç",
      "1 çay kaşığı zeytinyağı",
      "Kıvam için pişirme suyu"
    ],
    steps: [
      "Fasulyelerin uçlarını ve kılçıklarını temizle, küçük parçalara böl.",
      "Pirinci bol suda, normalden uzun süre pişirerek iyice dağıt.",
      "Fasulyeleri parmakla ezilecek yumuşaklığa gelene kadar ayrı haşla.",
      "İkisini birlikte blenderdan geçir; kabuk parçası kalmadığından emin ol ve ılıkken zeytinyağını ekle."
    ],
    allergens: [],
    safetyNote:
      "Yeşil sebzelerin buruk tadını bebeğin ilk seferde reddedebilir; aynı sebzeyi farklı günlerde tekrar sunmak kabulü artırır. Kabuk ve lif parçalarını mutlaka ele; bunlar boğulmaya yol açabilir.",
    storage: "Buzdolabında 24 saat sakla; pirinçli yemekleri oda sıcaklığında bekletme, hızlıca soğut.",
    source: {
      label: "NHS – 7-9 ay besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/7-to-9-months/"
    }
  },
  {
    slug: "tavuklu-bulgur-ezmesi",
    title: "Tavuklu ince bulgur ezmesi",
    summary: "Pütürlü dokuya geçişte demir ve çinko sağlayan, tencerede tek kapta pişen öğün.",
    minMonth: 7,
    prepMinutes: 28,
    category: "Pütürlü geçiş",
    texture: "Yumuşak, ince pütürlü",
    image: chickenBulgur,
    ingredients: [
      "2 yemek kaşığı ince bulgur",
      "30 g derisiz, kemiksiz tavuk göğsü",
      "2 dilim havuç",
      "1 yemek kaşığı rendelenmiş domates (kabuğu soyulmuş)",
      "1 çay kaşığı zeytinyağı"
    ],
    steps: [
      "Tavuğu ayrı bir kesme tahtasında küçük parçalara ayır ve tamamen pişene kadar haşla.",
      "Havuç ve domatesi bulgurla birlikte bol suda, bulgur iyice şişip yumuşayana kadar pişir.",
      "Tavuğu lif kalmayacak şekilde çok ince didikle veya çatalla ez.",
      "Hepsini karıştır; blender yerine çatal kullanarak küçük pütürler bırak, ılıkken zeytinyağını ekle."
    ],
    allergens: ["Buğday (gluten)"],
    safetyNote:
      "Tavuğun hiçbir yerinde pembelik kalmamalı; çiğ tavuğun değdiği yüzey ve bıçağı ayrı yıka. Bulgur gluten içerir; glutenle ilk tanışma ise küçük miktarla başla. Kuru veya iri et parçası bırakma.",
    storage:
      "Pişirdikten sonra 1-2 saat içinde soğutup buzdolabına al, 24 saat içinde tüket. Isıtırken her yerini eşit ısıt ve mutlaka ılıt.",
    source: {
      label: "NHS – 7-9 ay besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/7-to-9-months/"
    }
  },
  {
    slug: "bebek-yayla-corbasi",
    title: "Bebek yayla çorbası (tuzsuz)",
    summary: "Yoğurt ve pirinçle hazırlanan, Sağlık Bakanlığı'nın ek gıda önerilerinde geçen ev çorbası.",
    minMonth: 8,
    prepMinutes: 25,
    category: "Pütürlü geçiş",
    texture: "Akışkan, hafif taneli",
    image: yaylaSoup,
    ingredients: [
      "2 yemek kaşığı pirinç",
      "2 yemek kaşığı pastörize, şekersiz tam yağlı yoğurt",
      "1 yumurta sarısı (isteğe bağlı)",
      "1 çay kaşığı zeytinyağı",
      "1,5 su bardağı içme suyu"
    ],
    steps: [
      "Pirinci suyla, taneler tamamen dağılana kadar kısık ateşte pişir.",
      "Yoğurdu ayrı bir kapta yumurta sarısıyla çırp; kesilmemesi için üzerine sıcak çorbadan azar azar ekleyerek ılıştır.",
      "Karışımı tencereye dök ve sürekli karıştırarak kaynama noktasına getirmeden 3-4 dakika pişir.",
      "Ocaktan al, zeytinyağını ekle; tuz, nane yağı veya kuru nane koyma."
    ],
    allergens: ["Süt", "Yumurta"],
    safetyNote:
      "Süt ve yumurtayı ilk kez aynı öğünde deneme; her birini ayrı günlerde tanıt. Bir yaşından önce inek sütü içecek olarak verilmez, ancak yoğurt gibi pişmiş/mayalanmış süt ürünleri ek gıda olarak sunulabilir. Tuz ekleme: bebeğin böbrekleri fazla tuzu işleyemez.",
    storage:
      "Yoğurtlu çorbalar tekrar ısıtıldığında kesilebilir; aynı öğünde tüketmen en iyisi. Kalanı buzdolabında 24 saatten uzun tutma.",
    source: {
      label: "T.C. Sağlık Bakanlığı HSGM – Bebek Beslenmesi",
      url: "https://hsgm.saglik.gov.tr/tr/beslenme/bebek-beslenmesi.html"
    }
  },
  {
    slug: "firinda-somon-sebze",
    title: "Fırında somonlu sebze ezmesi",
    summary: "Haftada bir yağlı balık hedefini kolaylaştıran, omega-3'ten zengin yumuşak bir kâse.",
    minMonth: 8,
    prepMinutes: 30,
    category: "Demirden zengin",
    texture: "Nemli, ince pütürlü",
    image: bakedSalmon,
    ingredients: [
      "40 g derisiz somon fileto",
      "Yarım küçük tatlı patates",
      "2 dilim kabak",
      "1 çay kaşığı zeytinyağı",
      "Birkaç damla limon suyu"
    ],
    steps: [
      "Sebzeleri küp küp doğra, yağlı kâğıt serili tepsiye somonla birlikte diz.",
      "Üzerini folyoyla kapat ve 180°C'de 18-20 dakika, balık tamamen matlaşana kadar pişir.",
      "Somonu tabakta parmaklarınla didikleyerek kılçık olmadığını iki kez kontrol et.",
      "Sebzelerle çatalda ez, ılıkken zeytinyağı ve birkaç damla limon ekle."
    ],
    allergens: ["Balık"],
    safetyNote:
      "Kılçık kontrolü bu tarifin en kritik adımı. Balık başlıca alerjenlerdendir; ilk sunumda az miktar ver ve gözle. Bebeklere kılıç balığı, köpek balığı ve marlin verilmez (yüksek cıva); çiğ veya az pişmiş balık, kabuklu deniz ürünü de uygun değildir.",
    storage:
      "Pişmiş balığı buzdolabında en fazla 24 saat sakla ve yalnızca bir kez, iyice ısıtarak tüket.",
    source: {
      label: "NHS – Bebekler ve çocuklar için balık tüketimi önerileri",
      url: "https://www.nhs.uk/live-well/eat-well/food-types/fish-and-shellfish-nutrition/"
    }
  },
  {
    slug: "sebzeli-omlet-muffin",
    title: "Sebzeli mini omlet muffin",
    summary: "NHS'in omlet muffin tarifinden uyarlanan, elde tutulabilen tuzsuz parmak gıda.",
    minMonth: 9,
    prepMinutes: 25,
    category: "Parmak gıda",
    texture: "Yumuşak, elde dağılan",
    image: omeletteMuffin,
    ingredients: [
      "2 yumurta",
      "2 yemek kaşığı haşlanmış bezelye",
      "1 yemek kaşığı ince rendelenmiş az tuzlu peynir",
      "1 yemek kaşığı ince doğranmış kırmızı biber",
      "Kalıbı yağlamak için birkaç damla zeytinyağı"
    ],
    steps: [
      "Fırını 180°C'ye ısıt ve muffin kalıbının gözlerini ince bir tabaka yağla.",
      "Bezelye, peynir ve biberi bir kapta karıştır.",
      "Yumurtaları çırpıp karışıma ekle, 1 yemek kaşığı su ile iyice karıştır; tuz koyma.",
      "Gözlere paylaştır ve içi tamamen pişip üstü altın rengi olana kadar 15 dakika pişir.",
      "Tamamen ılıdıktan sonra kalıptan çıkar; bebeğine yetişkin parmağı genişliğinde dilimler halinde sun."
    ],
    allergens: ["Yumurta", "Süt"],
    safetyNote:
      "Yumurtanın sarısı ve beyazı tamamen katılaşmış olmalı. Peyniri az tuzlu bir çeşitten seç ve miktarını abartma. Küçük yuvarlak parçalar boğulma riski taşır; muffinleri yuvarlak değil şerit şeklinde kesip bebeğin dik otururken ve gözetim altında yemesini sağla.",
    storage: "Buzdolabında kapalı kapta 2 gün; dondurucuda 1 ay. Bebeğin eline verilmiş parçaları saklama.",
    source: {
      label: "NHS Best Start in Life – Omelette muffins",
      url: "https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/omelette-muffins/"
    }
  },
  {
    slug: "bebek-humusu",
    title: "Bebek humusu (tuzsuz)",
    summary: "Sebze çubuklarına veya ekmeğe sürülen, bitkisel demir ve protein kaynağı yumuşak ezme.",
    minMonth: 9,
    prepMinutes: 15,
    category: "Parmak gıda",
    texture: "Pürüzsüz, sürülebilir",
    image: babyHummus,
    ingredients: [
      "4 yemek kaşığı iyi haşlanmış nohut (kabukları ayıklanmış)",
      "1 çay kaşığı tuzsuz tahin",
      "1 çay kaşığı zeytinyağı",
      "Birkaç damla limon suyu",
      "Kıvam için 2-3 yemek kaşığı haşlama suyu"
    ],
    steps: [
      "Nohutları parmakla ezilecek kadar yumuşayana dek haşla; kabuklarını kolayca çıkması için avucunda ovala.",
      "Tahin, zeytinyağı ve limonla birlikte blenderdan geçir.",
      "Haşlama suyunu azar azar ekleyerek pürüzsüz, akışkan bir kıvam yakala; tuz, sarımsak ve kimyon ekleme.",
      "Yumuşayana kadar buharda pişmiş havuç veya kabak çubuklarıyla ya da ekmek şeritleriyle sun."
    ],
    allergens: ["Susam"],
    safetyNote:
      "Tahin susam içerir; susamı daha önce güvenle tattıysa bu tarifi ver. Nohut kabukları ve bütün taneler boğulma riski taşır, ezmenin içinde tane kalmasın. Çiğ ve sert havuç çubuğu verme; mutlaka yumuşayana kadar pişir.",
    storage: "Kapalı kapta buzdolabında 2 gün. Servis kabına ayırdığın porsiyonu ana kaba geri koyma.",
    source: {
      label: "NHS – Bebek ve küçük çocuk öğün fikirleri",
      url: "https://www.nhs.uk/baby/weaning-and-feeding/baby-and-toddler-meal-ideas/"
    }
  },
  {
    slug: "somonlu-bezelyeli-risotto",
    title: "Somonlu bezelyeli risotto",
    summary: "NHS'in risotto tarifinden uyarlanan, doğranmış dokuya hazır bebekler için tek tencere öğün.",
    minMonth: 10,
    prepMinutes: 30,
    category: "Demirden zengin",
    texture: "Yumuşak taneli",
    image: salmonRisotto,
    ingredients: [
      "3 yemek kaşığı pirinç",
      "50 g derisiz, kılçıksız somon",
      "2 yemek kaşığı bezelye",
      "Yarım küçük soğan",
      "Yarım diş sarımsak (isteğe bağlı)",
      "Birkaç şerit kırmızı biber",
      "1 çay kaşığı zeytinyağı"
    ],
    steps: [
      "Zeytinyağında ince doğranmış soğan ve sarımsağı 1 dakika yumuşat.",
      "Pirinç ve bezelyeyi ekle, üzerini geçecek kadar su koy; kapağı kapatıp su çekilene ve pirinç iyice yumuşayana dek yaklaşık 10-12 dakika pişir.",
      "Biber şeritlerini ayrıca 5 dakika haşlayıp yumuşat ve küçük küpler halinde doğra.",
      "Somonu buharda veya suda tamamen pişir, kılçık kontrolü yaparak didikle ve risottoya karıştır.",
      "Bebeğinin becerisine göre çatalla ez veya küçük lokmalar halinde bırak; tuz ve bulyon kullanma."
    ],
    allergens: ["Balık"],
    safetyNote:
      "Hazır bulyon, tablet et suyu ve soya sosu bebek yemeklerine girmez; tuz oranları çok yüksektir. Somonu didiklerken kılçıkları iki kez kontrol et. Bezelye tanelerini olduğu gibi bırakmak istiyorsan hafifçe ez, yuvarlak bütün taneler boğulma riski taşır.",
    storage:
      "Pirinçli yemekleri pişirdikten sonra hızla soğut, buzdolabında 24 saat sakla ve yalnızca bir kez, iyice ısıtıp ılıtarak ver.",
    source: {
      label: "NHS Best Start in Life – Tasty salmon risotto",
      url: "https://www.nhs.uk/best-start-in-life/baby/recipes-and-meal-ideas/tasty-salmon-risotto/"
    }
  },
  {
    slug: "firinda-sebzeli-kofte",
    title: "Fırında sebzeli mini köfte",
    summary: "Kıymayı sebzeyle nemlendiren, elde tutulabilen ve demir açısından güçlü bir parmak gıda.",
    minMonth: 10,
    prepMinutes: 35,
    category: "Parmak gıda",
    texture: "Yumuşak, kolay dağılan",
    image: bakedMeatballs,
    ingredients: [
      "100 g az yağlı dana kıyma",
      "Yarım küçük kabak (rendelenip suyu sıkılmış)",
      "1 küçük havuç (ince rendelenmiş)",
      "2 yemek kaşığı ince yulaf veya galeta unu",
      "1 çay kaşığı zeytinyağı",
      "1 tutam kuru kekik (isteğe bağlı)"
    ],
    steps: [
      "Tüm malzemeleri bir kapta yoğur; tuz, soğan suyu veya baharat karışımı ekleme.",
      "Yuvarlak değil, parmak şeklinde uzun küçük köfteler şekillendir.",
      "Yağlı kâğıt serili tepsiye diz, 190°C'de 18-20 dakika içi tamamen pişene kadar fırınla.",
      "Ortadan bir tanesini kesip pembelik kalmadığını kontrol et, ılıt ve sun."
    ],
    allergens: ["Yulaf veya buğday (galeta unu kullanırsan)"],
    safetyNote:
      "Kırmızı et tam pişmiş olmalı. Köfteleri yuvarlak yapma; yuvarlak ve kayabilen parçalar soluk borusunu tıkayabilir. Bebeğin dik otururken, kendi hızında ve daima gözetim altında yemesini sağla.",
    storage: "Buzdolabında 24 saat, dondurucuda 1 ay. Çözdüğünü tekrar dondurma.",
    source: {
      label: "NHS – 10-12 ay besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/10-to-12-months/"
    }
  },
  {
    slug: "mercimekli-sebze-soslu-makarna",
    title: "Mercimekli sebze soslu makarna",
    summary: "Bir yaş sonrası aile sofrasına uyarlanabilen, etsiz ama demirden zengin sos.",
    minMonth: 12,
    prepMinutes: 30,
    category: "Bir yaş sofrası",
    texture: "Yumuşak, doğranmış",
    image: lentilPasta,
    ingredients: [
      "3 yemek kaşığı kırmızı mercimek",
      "1 küçük havuç ve yarım kabak (ince doğranmış)",
      "2 olgun domates (kabuğu soyulmuş, rendelenmiş)",
      "Yarım soğan, yarım diş sarımsak",
      "1 yemek kaşığı zeytinyağı",
      "Bir avuç küçük şekilli makarna",
      "Üzeri için 1 yemek kaşığı rendelenmiş az tuzlu peynir"
    ],
    steps: [
      "Zeytinyağında soğan ve sarımsağı yumuşat, sebzeleri ekleyip 3-4 dakika çevir.",
      "Yıkanmış mercimeği ve domatesi ekle, üzerini geçecek kadar su koyup mercimek dağılana dek 20 dakika pişir.",
      "Makarnayı paket süresinden biraz uzun haşlayarak iyice yumuşat.",
      "Sosu blenderdan geçirmeden çatalla ez, makarnayla karıştır ve üzerine peyniri rendele.",
      "Aileye ayıracaksan tuz ve baharatı ancak çocuğun porsiyonunu ayırdıktan sonra ekle."
    ],
    allergens: ["Buğday (gluten)", "Süt"],
    safetyNote:
      "1 yaşından sonra da tuz sınırı sürer: 1-3 yaş için günde 2 gramdan az tuz önerilir, bu yüzden bulyon, salça ve hazır sos kullanma. Peyniri az tuzlu bir çeşitten seç.",
    storage: "Sosu ayrı kapta buzdolabında 2 gün, dondurucuda 1 ay sakla; makarnayı servis anında haşla.",
    source: {
      label: "NHS – 12 ay ve sonrası besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/12-months-plus/"
    }
  },
  {
    slug: "aile-sofrasi-tavuklu-guvec",
    title: "Aile sofrası tavuklu sebze güveci",
    summary: "Tek tencerede pişip hem çocuğun hem yetişkinlerin tabağına giden bir yaş üstü ana yemek.",
    minMonth: 12,
    prepMinutes: 45,
    category: "Bir yaş sofrası",
    texture: "Yumuşak, küçük doğranmış",
    image: familyStew,
    ingredients: [
      "200 g derisiz, kemiksiz tavuk but veya göğüs",
      "1 havuç, 1 patates, yarım kabak",
      "2 yemek kaşığı bezelye",
      "1 soğan, 1 diş sarımsak",
      "1 rendelenmiş domates",
      "1 yemek kaşığı zeytinyağı",
      "1,5 su bardağı içme suyu"
    ],
    steps: [
      "Tavuğu küp küp doğra, zeytinyağında soğan ve sarımsakla rengi dönene kadar çevir.",
      "Sebzeleri ve domatesi ekle, suyu koy ve kapağı kapatarak 30 dakika kısık ateşte pişir.",
      "Sebzeler çatalla dağılacak kıvama geldiğinde ocaktan al.",
      "Çocuğun porsiyonunu ayır: tavuğu ince didikle, sebzeleri küçük lokmalara böl.",
      "Tuz ve baharatı yalnızca yetişkinlerin tabağına ekle."
    ],
    allergens: [],
    safetyNote:
      "Çocuğun porsiyonunu tuzlamadan önce ayırmak bu tarifin kuralı. Tavukta pembe kısım kalmamalı; iri lokmaları çocuğun lokma büyüklüğüne göre küçült ve her zaman gözetim altında yesin.",
    storage:
      "Hızla soğutup buzdolabında 2 gün, dondurucuda 2 ay sakla. Isıtırken içine kadar sıcak olmalı, sonra servis için ılıt.",
    source: {
      label: "NHS – 12 ay ve sonrası besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/12-months-plus/"
    }
  },
  {
    slug: "ispanakli-peynirli-krep",
    title: "Ispanaklı peynirli krep dilimleri",
    summary: "Yeşilliği sevdirmenin pratik yolu; elde tutulabilen, tuzsuz ve hızlı bir öğün.",
    minMonth: 12,
    prepMinutes: 20,
    category: "Bir yaş sofrası",
    texture: "Yumuşak şerit",
    image: spinachCrepe,
    ingredients: [
      "1 yumurta",
      "3 yemek kaşığı süt",
      "3 yemek kaşığı tam buğday unu",
      "1 avuç ıspanak (haşlanıp suyu sıkılmış, ince doğranmış)",
      "1 yemek kaşığı rendelenmiş az tuzlu peynir",
      "Tavayı yağlamak için birkaç damla zeytinyağı"
    ],
    steps: [
      "Yumurta, süt ve unu topaksız bir harç olana kadar çırp.",
      "Ispanak ve peyniri karıştır; harç akışkan olmalı, gerekirse 1 kaşık süt daha ekle.",
      "Kısık ateşte yağlanmış tavada iki yüzünü de tamamen pişir.",
      "Ilıdıktan sonra parmak genişliğinde şeritler halinde kes ve sun."
    ],
    allergens: ["Yumurta", "Süt", "Buğday (gluten)"],
    safetyNote:
      "Bu tarif üç ana alerjeni bir arada içerir; üçünü de daha önce ayrı ayrı güvenle tattıysa ver. Çocuk 1 yaşını geçtiyse tam yağlı inek sütü ana içecek olabilir; yağsız veya yarım yağlı süt 5 yaşına kadar ana içecek olarak önerilmez.",
    storage: "Aynı gün tüket; kalanı kapalı kapta buzdolabında en fazla 24 saat sakla.",
    source: {
      label: "NHS – 12 ay ve sonrası besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/12-months-plus/"
    }
  },
  {
    slug: "meyveli-yulaf-kahvalti-kasesi",
    title: "Meyveli yulaf kahvaltı kâsesi",
    summary: "İlave şekersiz, lif ve kalsiyum içeren; sabahları iki dakikada kurulan bir kâse.",
    minMonth: 12,
    prepMinutes: 10,
    category: "Bir yaş sofrası",
    texture: "Yumuşak, küçük parçalı",
    image: fruitOatBowl,
    ingredients: [
      "3 yemek kaşığı ince yulaf ezmesi",
      "Yarım su bardağı tam yağlı süt veya anne sütü",
      "2 yemek kaşığı şekersiz yoğurt",
      "Birkaç dilim ezilmiş muz",
      "3-4 adet yarıya değil dörde bölünmüş yumuşak çilek veya yaban mersini"
    ],
    steps: [
      "Yulafı sütle kısık ateşte 4-5 dakika, tamamen yumuşayana kadar pişir.",
      "Ilıdıktan sonra yoğurdu karıştır.",
      "Meyveleri ez veya çok küçük parçalara böl ve üzerine ekle.",
      "Şeker, bal veya hazır meyve püresi ekleme; tatlılığı meyveden gelsin."
    ],
    allergens: ["Yulaf", "Süt"],
    safetyNote:
      "Yaban mersini ve üzüm gibi yuvarlak meyveler bütün haldeyken boğulma riski taşır; uzunlamasına dörde böl. Bal yalnızca 1 yaşından sonra verilebilir, yine de şeker alışkanlığı için erken tatlandırma önerilmez. Çilek bazı çocuklarda ağız çevresinde tahrişe yol açabilir; küçük miktarla başla.",
    storage: "Taze hazırla. Kalan yulaf lapasını buzdolabında 24 saat sakla, meyveyi servis anında ekle.",
    source: {
      label: "NHS – 12 ay ve sonrası besleme rehberi",
      url: "https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/12-months-plus/"
    }
  },
  {
    slug: "ev-yapimi-tarhana-corbasi",
    title: "Ev yapımı tuzsuz tarhana çorbası",
    summary: "Sağlık Bakanlığı'nın ek gıda listesinde geçen geleneksel çorbanın tuzsuz uyarlaması.",
    minMonth: 12,
    prepMinutes: 20,
    category: "Bir yaş sofrası",
    texture: "Akışkan, pürüzsüz",
    image: tarhanaSoup,
    ingredients: [
      "2 yemek kaşığı tuzsuz ev tarhanası",
      "1,5 su bardağı içme suyu",
      "1 yemek kaşığı rendelenmiş domates",
      "1 çay kaşığı zeytinyağı"
    ],
    steps: [
      "Tarhanayı 10 dakika ılık suda beklet.",
      "Zeytinyağında domatesi 1 dakika çevir, tarhanayı suyuyla birlikte ekle.",
      "Sürekli karıştırarak kısık ateşte 10-12 dakika, kıvam alana kadar pişir.",
      "Ocaktan al ve servis sıcaklığına gelene kadar ılıt; salça, tuz ve acı biber ekleme."
    ],
    allergens: ["Buğday (gluten)", "Süt"],
    safetyNote:
      "Market tarhanalarının çoğu yüksek oranda tuz içerir; bu tarifte tuzsuz ev tarhanası kullan ve paket etiketinde tuz değerini kontrol et. Tarhana buğday unu ve yoğurt içerdiği için gluten ve süt alerjenlerini birlikte taşır.",
    storage: "Buzdolabında 2 gün sakla; ısıtırken kaynatmadan, karıştırarak ısıt.",
    source: {
      label: "T.C. Sağlık Bakanlığı HSGM – Bebek Beslenmesi",
      url: "https://hsgm.saglik.gov.tr/tr/beslenme/bebek-beslenmesi.html"
    }
  }
];

export const solidFoodRecipeCategories: Array<"Tümü" | SolidFoodRecipeCategory> = [
  "Tümü",
  "İlk tadımlar",
  "Demirden zengin",
  "Pütürlü geçiş",
  "Parmak gıda",
  "Bir yaş sofrası"
];

export type SolidFoodAgeBand = {
  id: string;
  label: string;
  minMonth: number;
  maxMonth: number;
  description: string;
};

/** Ay aralıkları NHS "Bebeğine ne verebilirsin" basamaklarıyla aynı mantıkta gruplanır. */
export const solidFoodAgeBands: SolidFoodAgeBand[] = [
  {
    id: "6",
    label: "6 ay civarı",
    minMonth: 6,
    maxMonth: 6,
    description: "Tek bileşenli, pürüzsüz ilk tadımlar ve alerjenlerle tanışma."
  },
  {
    id: "7-9",
    label: "7-9 ay",
    minMonth: 7,
    maxMonth: 9,
    description: "Ezmeden pütürlüye geçiş, ilk parmak gıdalar ve demir açısından zengin öğünler."
  },
  {
    id: "10-12",
    label: "10-12 ay",
    minMonth: 10,
    maxMonth: 11,
    description: "Doğranmış lokmalar, günde üç öğün ve kendi kendine yeme pratiği."
  },
  {
    id: "12+",
    label: "1 yaş ve sonrası",
    minMonth: 12,
    maxMonth: 99,
    description: "Tuzu ve şekeri eklenmemiş, küçültülmüş porsiyonlarla aile sofrası."
  }
];

export function getSolidFoodAgeBand(minMonth: number) {
  return (
    solidFoodAgeBands.find((band) => minMonth >= band.minMonth && minMonth <= band.maxMonth) ??
    solidFoodAgeBands[solidFoodAgeBands.length - 1]!
  );
}

export function getSolidFoodRecipe(slug?: string) {
  return solidFoodRecipes.find((recipe) => recipe.slug === slug);
}
