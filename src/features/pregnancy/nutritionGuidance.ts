export type PregnancyMonth = {
  endWeek: number;
  month: number;
  startWeek: number;
};

export type PregnancySupplementGuidance = {
  amount: string;
  body: string;
  endWeek: number;
  id: string;
  sourceIds: string[];
  startWeek: number;
  timing: string;
  title: string;
  warning: string;
};

export type PregnancyGuidanceSource = {
  id: string;
  publisher: string;
  title: string;
  url: string;
};

export const pregnancyMonths: PregnancyMonth[] = [
  { month: 1, startWeek: 1, endWeek: 4 },
  { month: 2, startWeek: 5, endWeek: 8 },
  { month: 3, startWeek: 9, endWeek: 13 },
  { month: 4, startWeek: 14, endWeek: 17 },
  { month: 5, startWeek: 18, endWeek: 22 },
  { month: 6, startWeek: 23, endWeek: 27 },
  { month: 7, startWeek: 28, endWeek: 31 },
  { month: 8, startWeek: 32, endWeek: 35 },
  { month: 9, startWeek: 36, endWeek: 42 }
];

export const pregnancyGuidanceSources: PregnancyGuidanceSource[] = [
  {
    id: "ministry-antenatal-2024",
    publisher: "T.C. Sağlık Bakanlığı",
    title: "Aile Hekimliği Eğitim Rehberi 2024",
    url: "https://hsgm.saglik.gov.tr/depo/birimler/aile-hekimligi-egitim-ve-izleme-db/Dokumanlar/Rehberler/EGITIM_REHBERI_2024-1.pdf"
  },
  {
    id: "tuber-2022",
    publisher: "T.C. Sağlık Bakanlığı",
    title: "Türkiye Beslenme Rehberi (TÜBER) 2022",
    url: "https://hsgm.saglik.gov.tr/depo/birimler/saglikli-beslenme-ve-hareketli-hayat-db/Dokumanlar/Rehberler/Turkiye_Beslenme_Rehber_TUBER_2022_min.pdf"
  },
  {
    id: "who-iron-folate",
    publisher: "Dünya Sağlık Örgütü",
    title: "Gebelikte günlük demir ve folik asit desteği",
    url: "https://www.who.int/tools/elena/interventions/daily-iron-pregnancy"
  },
  {
    id: "who-calcium",
    publisher: "Dünya Sağlık Örgütü",
    title: "Preeklampsi riskini azaltmak için gebelikte kalsiyum",
    url: "https://www.who.int/tools/elena/interventions/calcium-pregnancy"
  },
  {
    id: "who-vitamin-a",
    publisher: "Dünya Sağlık Örgütü",
    title: "Gebelikte A vitamini desteği",
    url: "https://www.who.int/tools/elena/interventions/vitamina-pregnancy"
  },
  {
    id: "who-hydration",
    publisher: "DSÖ Avrupa",
    title: "Sıcak havada gebelik ve sıvı alımı",
    url: "https://www.who.int/europe/news-room/questions-and-answers/item/how-does-hot-weather-affect-pregnancy"
  }
];

export const pregnancySupplementGuidance: PregnancySupplementGuidance[] = [
  {
    id: "folic-acid",
    title: "Folik asit",
    startWeek: 1,
    endWeek: 12,
    timing: "Gebelikten en az 1 ay önce başlayıp 12. hafta sonuna kadar",
    amount: "Türkiye rehberi: günde 400–800 mikrogram",
    body:
      "Bebeğin beyin ve omurilik gelişiminin çok erken döneminde önemlidir. Gebelik planlanıyorsa gebe kalmadan önce başlanması özellikle değerlidir.",
    warning:
      "Nöral tüp defekti öyküsü, antiepileptik kullanımı, diyabet veya obezite gibi yüksek risklerde 4 mg gibi dozlar yalnızca doktor tarafından planlanır.",
    sourceIds: ["ministry-antenatal-2024", "who-iron-folate"]
  },
  {
    id: "vitamin-d",
    title: "D vitamini",
    startWeek: 12,
    endWeek: 42,
    timing: "Türkiye destek programında 12. haftadan itibaren",
    amount: "Türkiye programı: günde 1200 IU",
    body:
      "Türkiye ulusal programı gebeliğin 12. haftasından başlayıp doğum sonrası döneme uzanan D vitamini desteği tanımlar.",
    warning:
      "Kullandığınız prenatal üründe D vitamini varsa toplam dozu aile hekiminize gösterin; ürünleri üst üste eklemeyin.",
    sourceIds: ["ministry-antenatal-2024", "tuber-2022"]
  },
  {
    id: "iron",
    title: "Demir",
    startWeek: 16,
    endWeek: 42,
    timing: "Türkiye programında 16. haftadan doğum sonrası 3. aya kadar",
    amount: "Türkiye programı: günde 40–60 mg elemental demir",
    body:
      "Gebelikte kan hacmi ve demir gereksinimi artar. WHO genel rehberi gebelikte günlük 30–60 mg elemental demir ile 400 mikrogram folik asidi birlikte önerir.",
    warning:
      "Bu koruyucu program dozudur; anemi tedavi dozu değildir. Hemogram/ferritin sonucu, yan etkiler ve diğer ilaçlar için doktorunuzun planı önceliklidir.",
    sourceIds: ["tuber-2022", "who-iron-folate"]
  }
];

export function getPregnancyMonth(week: number) {
  return (
    pregnancyMonths.find(
      (item) => week >= item.startWeek && week <= item.endWeek
    )?.month ?? 9
  );
}

export function getPregnancyMonthRange(month: number) {
  return pregnancyMonths.find((item) => item.month === month) ?? pregnancyMonths[0]!;
}

export function getGuidanceForMonth(month: number) {
  const range = getPregnancyMonthRange(month);
  return pregnancySupplementGuidance.filter(
    (item) => item.startWeek <= range.endWeek && item.endWeek >= range.startWeek
  );
}

export function getSourcesByIds(sourceIds: string[]) {
  return pregnancyGuidanceSources.filter((source) => sourceIds.includes(source.id));
}
