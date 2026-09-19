import type { BellyConcept, MilestoneConcept, StudioConcept } from "./types";

/**
 * Konseptlerin tamamı kod ile çizilir (bkz. stickers.tsx); dışarıdan telifli
 * bir karakter ya da görsel kullanılmaz. Lisanslı çizgi film karakterleri
 * (Winnie the Pooh vb.) bilerek yok: uygulama içinde dağıtılmaları telif
 * ihlali olur, anneler de kartlarını sosyal medyada paylaşıyor.
 */

export const MILESTONE_CONCEPTS: MilestoneConcept[] = [
  {
    decor: "campsite",
    description: "Kamp tabelaları, çam ağaçları ve minik bir çadır.",
    headline: ["KÜÇÜK", "MUTLU", "KAŞİF"],
    id: "happy_camper",
    isPremium: false,
    kind: "milestone",
    palette: {
      accent: "#C2571F",
      accentSoft: "#E8B27A",
      ink: "#3F4A2E",
      nature: "#5E7141",
      paper: "#F5ECD7"
    },
    title: "Küçük Kaşif"
  },
  {
    decor: "clouds",
    description: "Pastel bulutlar, yıldızlar ve uçan bir balon.",
    headline: ["BULUTLARIN", "ÜSTÜNDE"],
    id: "cloud_journey",
    isPremium: false,
    kind: "milestone",
    palette: {
      accent: "#4F7FD1",
      accentSoft: "#BFD6F5",
      ink: "#33436B",
      nature: "#7FA8E0",
      paper: "#F4F8FF"
    },
    title: "Bulut Yolculuğu"
  },
  {
    decor: "forest",
    description: "Orman dostları, mantarlar ve yapraklı çerçeve.",
    headline: ["ORMANIN", "EN TATLISI"],
    id: "forest_friends",
    isPremium: true,
    kind: "milestone",
    palette: {
      accent: "#A65332",
      accentSoft: "#E3C29B",
      ink: "#3B4632",
      nature: "#6B8248",
      paper: "#F6EEDF"
    },
    title: "Orman Dostları"
  },
  {
    decor: "garden",
    description: "Çiçek bahçesi, kelebekler ve yumuşak pastel tonlar.",
    headline: ["BAHÇEMİZİN", "ÇİÇEĞİ"],
    id: "flower_garden",
    isPremium: true,
    kind: "milestone",
    palette: {
      accent: "#C2557E",
      accentSoft: "#F3C6D8",
      ink: "#5A3A4A",
      nature: "#7FA86B",
      paper: "#FDF2F6"
    },
    title: "Çiçek Bahçesi"
  }
];

export const BELLY_CONCEPTS: BellyConcept[] = [
  {
    description: "Kristal taşlar, minik kalpler ve gümüş parıltılar.",
    id: "crystal_sparkle",
    isPremium: false,
    kind: "belly",
    palette: {
      accent: "#E58AA8",
      accentSoft: "#F6D3DF",
      ink: "#7A4A5C",
      nature: "#C9B7D8",
      paper: "#FFF6F9"
    },
    sequence: ["#F2A2BC", "#D9DDE8", "#F6D36B", "#9FD3E3", "#EF7F9B", "#C9B7D8"],
    shapes: ["gem", "heart", "star", "sparkle", "dot"],
    title: "Kristal Işıltı"
  },
  {
    description: "Altın yıldız tozu ve ince parıltı serpintisi.",
    id: "star_dust",
    isPremium: false,
    kind: "belly",
    palette: {
      accent: "#D6A32C",
      accentSoft: "#F4E2B0",
      ink: "#6B5320",
      nature: "#E8CE86",
      paper: "#FFFBF0"
    },
    sequence: ["#F2C94C", "#E8D9A8", "#FFFFFF", "#D9A441", "#F7E7B8"],
    shapes: ["star", "sparkle", "dot"],
    title: "Yıldız Tozu"
  },
  {
    description: "Pastel kalpler ve yumuşak pembe tonlar.",
    id: "pastel_hearts",
    isPremium: true,
    kind: "belly",
    palette: {
      accent: "#E27D9A",
      accentSoft: "#F8DCE5",
      ink: "#7C4358",
      nature: "#F2B8CB",
      paper: "#FFF5F8"
    },
    sequence: ["#F5A8BF", "#F7C9D6", "#EF8FA9", "#FBE0E8", "#E8718F"],
    shapes: ["heart", "dot", "sparkle"],
    title: "Pastel Kalpler"
  },
  {
    description: "Papatyalar, minik yapraklar ve bahar renkleri.",
    id: "belly_bloom",
    isPremium: true,
    kind: "belly",
    palette: {
      accent: "#C97BA8",
      accentSoft: "#EBD3E4",
      ink: "#5E4460",
      nature: "#86A96B",
      paper: "#FBF5FA"
    },
    sequence: ["#F6E7A1", "#EFA9C4", "#A9CE8F", "#FFFFFF", "#D8A7D6"],
    shapes: ["flower", "heart", "dot", "sparkle"],
    title: "Çiçek Açan Karın"
  }
];

/**
 * Katalog hiçbir zaman boş olamaz; varsayılan konsept tip düzeyinde de garanti
 * olsun ki ekranlar her yerde "tanımsız olabilir" kontrolü taşımasın.
 */
const DEFAULT_MILESTONE_CONCEPT = MILESTONE_CONCEPTS[0] as MilestoneConcept;
const DEFAULT_BELLY_CONCEPT = BELLY_CONCEPTS[0] as BellyConcept;

export function getMilestoneConcept(id: string | null | undefined): MilestoneConcept {
  return MILESTONE_CONCEPTS.find((concept) => concept.id === id) ?? DEFAULT_MILESTONE_CONCEPT;
}

export function getBellyConcept(id: string | null | undefined): BellyConcept {
  return BELLY_CONCEPTS.find((concept) => concept.id === id) ?? DEFAULT_BELLY_CONCEPT;
}

/**
 * Ücretsiz kullanıcı her iki stüdyoda da çalışan konseptlerle kartını
 * bitirebilsin; kilit, denemeden önce değil beğendikten sonra gelsin diye
 * premium konseptler listenin sonunda duruyor.
 */
export function isConceptLocked(concept: StudioConcept, isPremium: boolean) {
  return concept.isPremium && !isPremium;
}
