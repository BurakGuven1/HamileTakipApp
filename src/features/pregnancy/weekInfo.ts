export type PregnancyWeekInfo = {
  week: number;
  emoji: string;
  size: string;
  lengthCm: string;
  weightG: string;
  milestone: string;
  note: string;
};

type PregnancyWeekGrowth = Pick<
  PregnancyWeekInfo,
  "emoji" | "lengthCm" | "size" | "week" | "weightG"
>;

type PregnancyWeekMilestone = Omit<PregnancyWeekInfo, "emoji">;

export const PREGNANCY_WEEK_GROWTH: readonly PregnancyWeekGrowth[] = [
  {
    week: 1,
    emoji: "🌙",
    size: "hazırlık döneminde",
    lengthCm: "Henüz ölçülmez",
    weightG: "Henüz ölçülmez"
  },
  {
    week: 2,
    emoji: "🌙",
    size: "hazırlık döneminde",
    lengthCm: "Henüz ölçülmez",
    weightG: "Henüz ölçülmez"
  },
  {
    week: 3,
    emoji: "🌱",
    size: "haşhaş tohumu kadar",
    lengthCm: "<0.1 cm",
    weightG: "<1 g"
  },
  {
    week: 4,
    emoji: "✨",
    size: "susam tanesi kadar",
    lengthCm: "0.1-0.2 cm",
    weightG: "<1 g"
  },
  {
    week: 5,
    emoji: "🍎",
    size: "elma çekirdeği kadar",
    lengthCm: "0.2-0.3 cm",
    weightG: "<1 g"
  },
  {
    week: 6,
    emoji: "🫘",
    size: "mercimek kadar",
    lengthCm: "0.4-0.6 cm",
    weightG: "<1 g"
  },
  {
    week: 7,
    emoji: "🫐",
    size: "yaban mersini kadar",
    lengthCm: "0.8-1.1 cm",
    weightG: "<1 g"
  },
  {
    week: 8,
    emoji: "🫘",
    size: "fasulye tanesi kadar",
    lengthCm: "1.5-2 cm",
    weightG: "1 g civarı"
  },
  {
    week: 9,
    emoji: "🍇",
    size: "üzüm kadar",
    lengthCm: "2.2-2.5 cm",
    weightG: "2 g civarı"
  },
  {
    week: 10,
    emoji: "🍓",
    size: "çilek kadar",
    lengthCm: "3-4 cm",
    weightG: "4-5 g"
  },
  {
    week: 11,
    emoji: "🟣",
    size: "incir kadar",
    lengthCm: "4-5 cm",
    weightG: "7-8 g"
  },
  {
    week: 12,
    emoji: "🍋",
    size: "misket limonu kadar",
    lengthCm: "5-6 cm",
    weightG: "14-18 g"
  },
  {
    week: 13,
    emoji: "🍋",
    size: "limon kadar",
    lengthCm: "7-8 cm",
    weightG: "20-25 g"
  },
  {
    week: 14,
    emoji: "🍑",
    size: "şeftali kadar",
    lengthCm: "8-9 cm",
    weightG: "40-45 g"
  },
  {
    week: 15,
    emoji: "🍎",
    size: "elma kadar",
    lengthCm: "10-11 cm",
    weightG: "65-75 g"
  },
  {
    week: 16,
    emoji: "🥑",
    size: "avokado kadar",
    lengthCm: "11-12 cm",
    weightG: "90-110 g"
  },
  {
    week: 17,
    emoji: "🍐",
    size: "armut kadar",
    lengthCm: "12-13 cm",
    weightG: "120-150 g"
  },
  {
    week: 18,
    emoji: "🍠",
    size: "tatlı patates kadar",
    lengthCm: "14-15 cm",
    weightG: "180-220 g"
  },
  {
    week: 19,
    emoji: "🥭",
    size: "mango kadar",
    lengthCm: "15-16 cm",
    weightG: "230-280 g"
  },
  {
    week: 20,
    emoji: "🍌",
    size: "muz kadar",
    lengthCm: "24-26 cm",
    weightG: "280-330 g"
  },
  {
    week: 21,
    emoji: "🥕",
    size: "havuç kadar",
    lengthCm: "26-27 cm",
    weightG: "350-400 g"
  },
  {
    week: 22,
    emoji: "🥒",
    size: "küçük kabak kadar",
    lengthCm: "27-28 cm",
    weightG: "430-500 g"
  },
  {
    week: 23,
    emoji: "🍊",
    size: "greyfurt kadar",
    lengthCm: "28-29 cm",
    weightG: "500-600 g"
  },
  {
    week: 24,
    emoji: "🌽",
    size: "mısır koçanı kadar",
    lengthCm: "29-31 cm",
    weightG: "550-650 g"
  },
  {
    week: 25,
    emoji: "🥦",
    size: "karnabahar kadar",
    lengthCm: "32-34 cm",
    weightG: "650-750 g"
  },
  {
    week: 26,
    emoji: "🥬",
    size: "marul başı kadar",
    lengthCm: "34-36 cm",
    weightG: "760-900 g"
  },
  {
    week: 27,
    emoji: "🥦",
    size: "büyük karnabahar kadar",
    lengthCm: "36-37 cm",
    weightG: "850-1000 g"
  },
  {
    week: 28,
    emoji: "🍆",
    size: "patlıcan kadar",
    lengthCm: "36-38 cm",
    weightG: "900-1100 g"
  },
  {
    week: 29,
    emoji: "🎃",
    size: "bal kabağı dilimi kadar",
    lengthCm: "38-39 cm",
    weightG: "1100-1300 g"
  },
  {
    week: 30,
    emoji: "🥬",
    size: "lahana kadar",
    lengthCm: "39-40 cm",
    weightG: "1300-1500 g"
  },
  {
    week: 31,
    emoji: "🥥",
    size: "hindistan cevizi kadar",
    lengthCm: "40-41 cm",
    weightG: "1500-1700 g"
  },
  {
    week: 32,
    emoji: "🥒",
    size: "kabak kadar",
    lengthCm: "41-43 cm",
    weightG: "1700-1900 g"
  },
  {
    week: 33,
    emoji: "🍍",
    size: "ananas kadar",
    lengthCm: "43-44 cm",
    weightG: "1900-2100 g"
  },
  {
    week: 34,
    emoji: "🍈",
    size: "kavun kadar",
    lengthCm: "44-45 cm",
    weightG: "2100-2400 g"
  },
  {
    week: 35,
    emoji: "🎃",
    size: "bal kabağı kadar",
    lengthCm: "45-46 cm",
    weightG: "2400-2600 g"
  },
  {
    week: 36,
    emoji: "🥬",
    size: "marul kadar",
    lengthCm: "46-48 cm",
    weightG: "2600-2900 g"
  },
  {
    week: 37,
    emoji: "🥬",
    size: "pazı demeti kadar",
    lengthCm: "48-49 cm",
    weightG: "2800-3100 g"
  },
  {
    week: 38,
    emoji: "🥬",
    size: "pırasa demeti kadar",
    lengthCm: "49-50 cm",
    weightG: "2900-3300 g"
  },
  {
    week: 39,
    emoji: "🍉",
    size: "küçük karpuz kadar",
    lengthCm: "49-51 cm",
    weightG: "3000-3500 g"
  },
  {
    week: 40,
    emoji: "🍉",
    size: "küçük karpuz kadar",
    lengthCm: "49-52 cm",
    weightG: "3000-3600 g"
  }
];

const weekMilestones: PregnancyWeekMilestone[] = [
  {
    week: 1,
    size: "hazırlık döneminde",
    lengthCm: "Henüz ölçülmez",
    weightG: "Henüz ölçülmez",
    milestone: "Gebelik haftası hesabı son adet tarihinin ilk gününden başlar.",
    note: "Bu haftalarda henüz ölçülebilir embriyo görüntüsü beklenmez."
  },
  {
    week: 4,
    size: "susam tanesi kadar",
    lengthCm: "0.1-0.2 cm",
    weightG: "<1 g",
    milestone: "Yerleşme sonrası erken hücre gelişimi hızlanır.",
    note: "Görsel anlatım bu dönemde temsili tutulur; klinik takip doktorla yapılır."
  },
  {
    week: 8,
    size: "fasulye tanesi kadar",
    lengthCm: "1.5-2 cm",
    weightG: "1 g civarı",
    milestone: "Küçük kol ve bacak tomurcukları belirginleşir.",
    note: "Kalp ritmi hızlanır; bu dönem hızlı şekillenme dönemidir."
  },
  {
    week: 10,
    size: "çilek kadar",
    lengthCm: "3-4 cm",
    weightG: "4-5 g",
    milestone: "Göz kapakları, kulak yapısı ve parmak ayrımları gelişmeye devam eder.",
    note: "Baş hâlâ gövdeye göre büyüktür; yüz hatları daha seçilebilir hale gelir."
  },
  {
    week: 11,
    size: "incir kadar",
    lengthCm: "4-5 cm",
    weightG: "7-8 g",
    milestone: "Dış kulaklar şekillenir, minik hareketler artar.",
    note: "Anne henüz hissetmese de bebek içeride aktif şekilde kıpırdar."
  },
  {
    week: 12,
    size: "misket limonu kadar",
    lengthCm: "5-6 cm",
    weightG: "14-18 g",
    milestone: "Tırnak temelleri ve yüz detayları belirginleşir.",
    note: "İlk trimesterin sonuna yaklaşırken organ gelişimi hızla olgunlaşır."
  },
  {
    week: 16,
    size: "avokado kadar",
    lengthCm: "11-12 cm",
    weightG: "90-110 g",
    milestone: "Kaslar güçlenir, baş kontrolü artar.",
    note: "Bazı anneler ilk hafif hareketleri bu haftalarda fark etmeye başlayabilir."
  },
  {
    week: 20,
    size: "muz kadar",
    lengthCm: "24-26 cm",
    weightG: "280-330 g",
    milestone: "Duyu gelişimi hızlanır; işitme sistemi daha duyarlı hale gelir.",
    note: "Cilt üzerinde koruyucu vernix tabakası oluşmaya başlar."
  },
  {
    week: 24,
    size: "mısır koçanı kadar",
    lengthCm: "29-31 cm",
    weightG: "550-650 g",
    milestone: "Akciğer gelişimi ve solunum hareketleri pratikleri devam eder.",
    note: "Bebek seslere ve ritimlere daha belirgin tepki verebilir."
  },
  {
    week: 28,
    size: "patlıcan kadar",
    lengthCm: "36-38 cm",
    weightG: "900-1100 g",
    milestone: "Göz açıp kapama hareketleri ve uyku-uyanıklık döngüleri belirginleşir.",
    note: "Üçüncü trimesterle birlikte kilo artışı daha görünür hale gelir."
  },
  {
    week: 32,
    size: "kabak kadar",
    lengthCm: "41-43 cm",
    weightG: "1700-1900 g",
    milestone: "Yağ depoları artar, cilt daha dolgun görünür.",
    note: "Hareketler daha güçlü ama alan daraldıkça daha farklı hissedilebilir."
  },
  {
    week: 36,
    size: "marul kadar",
    lengthCm: "46-48 cm",
    weightG: "2600-2900 g",
    milestone: "Akciğer ve sindirim sistemi doğuma hazırlık ritmine yaklaşır.",
    note: "Bebek çoğu zaman doğum pozisyonuna doğru yerleşmeye başlar."
  },
  {
    week: 40,
    size: "küçük karpuz kadar",
    lengthCm: "49-52 cm",
    weightG: "3000-3600 g",
    milestone: "Bebek dış dünyaya geçiş için hazır kabul edilir.",
    note: "Her doğum zamanı kişiseldir; doktorunun takip planı esas alınmalıdır."
  }
];

export function getPregnancyWeekInfo(
  week?: number | null
): PregnancyWeekInfo | null {
  if (!week) return null;

  const clampedWeek = Math.max(1, Math.min(40, Math.round(week)));
  const growth =
    PREGNANCY_WEEK_GROWTH.find((item) => item.week === clampedWeek) ??
    PREGNANCY_WEEK_GROWTH[PREGNANCY_WEEK_GROWTH.length - 1]!;
  const milestone = weekMilestones.reduce((nearest, item) =>
    Math.abs(item.week - clampedWeek) < Math.abs(nearest.week - clampedWeek)
      ? item
      : nearest
  );

  return {
    ...milestone,
    ...growth,
    week: clampedWeek
  };
}
