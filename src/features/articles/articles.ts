export type Article = {
  accent: string;
  body: string[];
  category: "hafta" | "ay" | "bebek" | "ipuclari";
  excerpt: string;
  imagePath?: string | null;
  imageUrl?: string;
  period: string;
  slug: string;
  sortOrder: number;
  timelineEndWeek?: number | null;
  timelineStartWeek?: number | null;
  title: string;
};

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
  }
];

export function getArticleBySlug(slug: string) {
  return fallbackArticles.find((article) => article.slug === slug);
}

export function getFeaturedArticles(limit = 3) {
  return [...fallbackArticles]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limit);
}
