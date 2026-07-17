export type PregnancyTimelineBand = {
  color: string;
  endWeek: number;
  id: string;
  note: string;
  source: string;
  startWeek: number;
  title: string;
};

export type PregnancyTimelineMilestone = {
  body: string;
  source: string;
  title: string;
  type: "bebek" | "anne" | "kontrol" | "beslenme";
  week: number;
};

export const TIMELINE_TOTAL_WEEKS = 42;

export const pregnancyTimelineBands: PregnancyTimelineBand[] = [
  {
    color: "#D97895",
    endWeek: 12,
    id: "folic-acid",
    note:
      "Türkiye rehberi gebelik planlayan kadınlarda gebelikten en az 1 ay önce başlayıp 12. haftaya kadar günde 400–800 mikrogram folik asit tanımlar. Kişisel doz için doktor takibi esastır.",
    source: "T.C. Sağlık Bakanlığı / WHO",
    startWeek: 1,
    title: "Folik asit"
  },
  {
    color: "#E3B873",
    endWeek: 42,
    id: "vitamin-d",
    note:
      "Türkiye destek programında 12. haftadan itibaren günde 1200 IU D vitamini bilgisi yer alır. Diğer ürünlerdeki D vitaminiyle toplam doz doktorla kontrol edilmelidir.",
    source: "T.C. Sağlık Bakanlığı",
    startWeek: 12,
    title: "D vitamini"
  },
  {
    color: "#B86F55",
    endWeek: 42,
    id: "iron-support",
    note:
      "Türkiye destek programında 16. haftadan itibaren günde 40–60 mg elemental demir bilgisi yer alır. Kan sonuçları ve kişisel plan için doktor takibi önceliklidir.",
    source: "T.C. Sağlık Bakanlığı / WHO",
    startWeek: 16,
    title: "Demir desteği"
  },
  {
    color: "#6B96C7",
    endWeek: 28,
    id: "anatomy-scan-window",
    note:
      "Detaylı ultrason ve rutin kontrollerin zamanı ülke, hekim ve gebelik riskine göre değişebilir.",
    source: "Klinik takip",
    startWeek: 18,
    title: "Detaylı değerlendirme dönemi"
  },
  {
    color: "#8A75BD",
    endWeek: 36,
    id: "movement-awareness",
    note:
      "Bebek hareket düzeni kişiseldir. Hareketlerde belirgin azalma hissedersen doktorunla görüşmelisin.",
    source: "Klinik takip",
    startWeek: 20,
    title: "Hareket farkındalığı"
  }
];

export const pregnancyTimelineMilestones: PregnancyTimelineMilestone[] = [
  {
    body:
      "Gebelik haftası son adet tarihine göre sayılır. İlk haftalarda vücut gebeliğe hazırlanır.",
    source: "Genel obstetrik hesaplama",
    title: "Başlangıç ve hazırlık",
    type: "anne",
    week: 1
  },
  {
    body:
      "Nöral tüp çok erken haftalarda gelişmeye başlar. Bu yüzden folik asit erken dönemde özellikle önemlidir.",
    source: "T.C. Sağlık Bakanlığı / WHO",
    title: "Erken sinir sistemi gelişimi",
    type: "bebek",
    week: 4
  },
  {
    body:
      "Kalp ve temel organ taslakları hızla şekillenmeye başlar. Halsizlik ve bulantı artabilir.",
    source: "Klinik gelişim özeti",
    title: "Organ taslakları hızlanır",
    type: "bebek",
    week: 6
  },
  {
    body:
      "Kol ve bacak tomurcukları belirginleşir. Bu dönem hızlı hücre bölünmesiyle geçer.",
    source: "Klinik gelişim özeti",
    title: "Minik uzuvlar belirginleşir",
    type: "bebek",
    week: 8
  },
  {
    body:
      "Göz kapakları, kulak yapısı ve parmak ayrımları gelişmeye devam eder.",
    source: "Klinik gelişim özeti",
    title: "Yüz hatları seçilmeye başlar",
    type: "bebek",
    week: 10
  },
  {
    body:
      "İlk trimesterin sonuna yaklaşılır. Folik asit için ilk 12 hafta kritik dönem olarak kabul edilir.",
    source: "T.C. Sağlık Bakanlığı",
    title: "İlk trimester kapanışı",
    type: "beslenme",
    week: 12
  },
  {
    body:
      "Bazı annelerde enerji toparlanmaya başlar. Doktor kontrolleri ve tarama planı kişiye göre netleşir.",
    source: "Klinik takip",
    title: "İkinci trimester ritmi",
    type: "anne",
    week: 13
  },
  {
    body:
      "Kaslar güçlenir, baş kontrolü artar. Bazı anneler bu haftalarda ilk hafif hareketleri fark edebilir.",
    source: "Klinik gelişim özeti",
    title: "Hareketler güçlenir",
    type: "bebek",
    week: 16
  },
  {
    body:
      "Detaylı ultrason penceresi çoğu takipte bu haftalara denk gelir. Randevu zamanını doktorun belirler.",
    source: "Klinik takip",
    title: "Detaylı değerlendirme penceresi",
    type: "kontrol",
    week: 20
  },
  {
    body:
      "İşitme sistemi daha duyarlı hale gelir. Cilt üzerinde koruyucu vernix tabakası oluşmaya başlar.",
    source: "Klinik gelişim özeti",
    title: "Duyu gelişimi hızlanır",
    type: "bebek",
    week: 24
  },
  {
    body:
      "Rutin kan değerleri ve demir ihtiyacı bu dönemde tekrar değerlendirilebilir. Takip planını doktorun belirler.",
    source: "NHS / Klinik takip",
    title: "Kan değerleri ve enerji",
    type: "kontrol",
    week: 28
  },
  {
    body:
      "Bebek kilo almaya devam eder. Hareketler daha güçlü ama alan daraldıkça hissi değişebilir.",
    source: "Klinik gelişim özeti",
    title: "Kilo artışı görünürleşir",
    type: "bebek",
    week: 32
  },
  {
    body:
      "Akciğer ve sindirim sistemi doğuma hazırlık ritmine yaklaşır. Doğum planı ve çanta hazırlığı gündeme gelebilir.",
    source: "Klinik takip",
    title: "Doğuma hazırlık dönemi",
    type: "anne",
    week: 36
  },
  {
    body:
      "Bebek dış dünyaya geçiş için hazır kabul edilen döneme yaklaşır. Her doğum zamanı kişiseldir.",
    source: "Klinik takip",
    title: "Term döneme yaklaşım",
    type: "bebek",
    week: 40
  }
];

export function getTimelineMilestonesForWeek(week: number) {
  const exact = pregnancyTimelineMilestones.filter((item) => item.week === week);
  if (exact.length > 0) return exact;

  const nearest = pregnancyTimelineMilestones.reduce((current, item) =>
    Math.abs(item.week - week) < Math.abs(current.week - week) ? item : current
  );

  return [nearest];
}

export function getActiveTimelineBands(week: number) {
  return pregnancyTimelineBands.filter(
    (band) => week >= band.startWeek && week <= band.endWeek
  );
}
