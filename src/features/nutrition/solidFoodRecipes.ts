import type { ImageSourcePropType } from "react-native";

export type SolidFoodRecipeCategory =
  | "İlk tadımlar"
  | "Demirden zengin"
  | "Pütürlü geçiş"
  | "Parmak gıda";

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
};

const pearOatYogurt = require("../../../assets/recipes/pear-oat-yogurt.jpg");
const pumpkinLentil = require("../../../assets/recipes/pumpkin-lentil.jpg");
const avocadoEgg = require("../../../assets/recipes/avocado-egg.jpg");
const chickenVegetable = require("../../../assets/recipes/chicken-vegetable.jpg");

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
  }
];

export const solidFoodRecipeCategories: Array<"Tümü" | SolidFoodRecipeCategory> = [
  "Tümü",
  "İlk tadımlar",
  "Demirden zengin",
  "Pütürlü geçiş",
  "Parmak gıda"
];

export function getSolidFoodRecipe(slug?: string) {
  return solidFoodRecipes.find((recipe) => recipe.slug === slug);
}
