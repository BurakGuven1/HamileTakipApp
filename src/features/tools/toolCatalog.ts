import type { Href } from "expo-router";
import {
  Activity,
  Baby,
  BellRing,
  BookOpenCheck,
  CalendarHeart,
  FileHeart,
  FileSearch,
  HeartPulse,
  Images,
  Moon,
  Music2,
  Ruler,
  Salad,
  ShieldQuestion,
  Smile,
  Sparkles,
  Stethoscope,
  Timer,
  Users,
  Wrench,
  type LucideIcon
} from "lucide-react-native";

import type { ExperienceStage } from "@/features/life-stage/lifeStage";
import { vibrantColors } from "@/theme";

export type ToolItem = {
  /** Vurgu rengi: sol kenar ve ikon rengi. */
  accent: string;
  href: Href;
  icon: LucideIcon;
  key: string;
  /** Tek cümlelik, ne işe yaradığını söyleyen açıklama. */
  subtitle: string;
  /** İkon kutusunun yumuşak zemini. */
  tint: string;
  title: string;
};

export type ToolCategory = {
  key: string;
  items: ToolItem[];
  /** Kategorinin ne topladığını söyleyen tek satır. */
  hint: string;
  title: string;
};

const pregnancyTracking: ToolItem[] = [
  {
    accent: vibrantColors.primary,
    href: "/pregnancy-health-file",
    icon: FileHeart,
    key: "pregnancy-health-file",
    subtitle: "Kayıt, tahlil ve randevular tek yerde",
    tint: vibrantColors.primaryLight,
    title: "Sağlık dosyam"
  },
  {
    accent: vibrantColors.primary,
    href: "/pregnancy-timeline",
    icon: CalendarHeart,
    key: "pregnancy-timeline",
    subtitle: "Hafta hafta yol haritan",
    tint: vibrantColors.primaryLight,
    title: "Hamilelik çizelgesi"
  },
  {
    accent: vibrantColors.blue,
    href: "/pregnancy-nutrition",
    icon: Salad,
    key: "pregnancy-nutrition",
    subtitle: "Haftana uygun beslenme ve su takibi",
    tint: vibrantColors.blueSoft,
    title: "Beslenme ve su"
  },
  {
    accent: vibrantColors.primary,
    href: "/pregnancy-exercise",
    icon: Activity,
    key: "pregnancy-exercise",
    subtitle: "Haftana uygun güvenli hareket",
    tint: vibrantColors.primaryLight,
    title: "Hareket"
  }
];

const birthPreparation: ToolItem[] = [
  {
    accent: vibrantColors.peach,
    href: "/contraction-timer",
    icon: Timer,
    key: "contraction-timer",
    subtitle: "Süre, aralık ve 5-1-1 kuralı",
    tint: vibrantColors.peachSoft,
    title: "Kasılma sayacı"
  },
  {
    accent: vibrantColors.peach,
    href: "/birth-preparation",
    icon: BookOpenCheck,
    key: "birth-preparation",
    subtitle: "Çanta, plan ve hazırlık listesi",
    tint: vibrantColors.peachSoft,
    title: "Doğuma hazırlık"
  },
  {
    accent: vibrantColors.secondary,
    href: "/baby-names",
    icon: Sparkles,
    key: "baby-names",
    subtitle: "Anlamıyla birlikte isim keşfi",
    tint: vibrantColors.secondarySoft,
    title: "Bebek isimleri"
  }
];

const babyCare: ToolItem[] = [
  {
    accent: vibrantColors.primary,
    href: { pathname: "/care-journal", params: { section: "record" } },
    icon: CalendarHeart,
    key: "care-journal-record",
    subtitle: "Beslenme, uyku ve bez kaydını hemen ekle",
    tint: vibrantColors.primaryLight,
    title: "Bakım kaydı"
  },
  {
    accent: vibrantColors.secondary,
    href: "/sleep-rhythm",
    icon: Moon,
    key: "sleep-rhythm",
    subtitle: "Tek dokunuşla kaydet, ritmini gör",
    tint: vibrantColors.secondarySoft,
    title: "Uyku ritmi"
  },
  {
    accent: vibrantColors.peach,
    href: { pathname: "/care-journal", params: { section: "plan" } },
    icon: BellRing,
    key: "care-journal-plan",
    subtitle: "Alarm, sağım ve süt stoğu planı",
    tint: vibrantColors.peachSoft,
    title: "Bakım planı"
  },
  {
    accent: vibrantColors.mint,
    href: "/baby",
    icon: Ruler,
    key: "baby-growth",
    subtitle: "Ölçümler ve yaklaşan aşılar",
    tint: vibrantColors.mintSoft,
    title: "Büyüme ve aşı"
  },
  {
    accent: vibrantColors.yellow,
    href: "/teething",
    icon: Smile,
    key: "teething",
    subtitle: "20 süt dişini ailece işaretle",
    tint: vibrantColors.yellowSoft,
    title: "Diş takibi"
  },
  {
    accent: vibrantColors.blue,
    href: "/solid-food-recipes",
    icon: Salad,
    key: "solid-food-recipes",
    subtitle: "Yaşa ve dokuya uygun güvenli tarifler",
    tint: vibrantColors.blueSoft,
    title: "Ek gıda tarifleri"
  },
  {
    accent: vibrantColors.primary,
    href: "/lullaby",
    icon: Music2,
    key: "lullaby",
    subtitle: "Sakinleştiren uyku sesleri",
    tint: vibrantColors.primaryLight,
    title: "Ninniler"
  }
];

function healthTools(stage: ExperienceStage): ToolItem[] {
  return [
    {
      accent: vibrantColors.secondary,
      href: "/symptom-check",
      icon: ShieldQuestion,
      key: "symptom-check",
      subtitle: "Beklemeli mi, aramalı mısın",
      tint: vibrantColors.secondarySoft,
      title: "Bu normal mi?"
    },
    {
      accent: vibrantColors.blue,
      href: {
        pathname: "/doctor-visit",
        params: { subject: stage === "pregnancy" ? "pregnancy" : "baby" }
      },
      icon: Stethoscope,
      key: "doctor-visit",
      subtitle: "Soruların ve kayıtların hazır",
      tint: vibrantColors.blueSoft,
      title: "Doktora hazırlan"
    },
    {
      accent: vibrantColors.peach,
      href: "/document-insight",
      icon: FileSearch,
      key: "document-insight",
      subtitle: "Sağlık belgelerini sade dile çevir",
      tint: vibrantColors.peachSoft,
      title: "Belgeyi anla"
    }
  ];
}

const familyTools: ToolItem[] = [
  {
    accent: vibrantColors.mint,
    href: "/family-planner",
    icon: Users,
    key: "family-planner",
    subtitle: "Kime, ne zaman: ortak görev ve alarmlar",
    tint: vibrantColors.mintSoft,
    title: "Aile görevleri"
  },
  {
    accent: vibrantColors.secondary,
    href: "/gallery",
    icon: Images,
    key: "gallery",
    subtitle: "Anıları tarih sırasıyla sakla",
    tint: vibrantColors.secondarySoft,
    title: "Anı galerisi"
  },
  {
    accent: vibrantColors.mint,
    href: "/forum",
    icon: HeartPulse,
    key: "forum",
    subtitle: "Deneyimlerini toplulukla paylaş",
    tint: vibrantColors.mintSoft,
    title: "Anne forumu"
  }
];

const setupTools: ToolItem[] = [
  {
    accent: vibrantColors.primary,
    href: "/settings",
    icon: CalendarHeart,
    key: "setup-pregnancy",
    subtitle: "Hafta ve gününü girerek takibe başla",
    tint: vibrantColors.primaryLight,
    title: "Hamilelik akışı"
  },
  {
    accent: vibrantColors.blue,
    href: "/baby",
    icon: Baby,
    key: "setup-baby",
    subtitle: "Doğum bilgileriyle bakım alanını hazırla",
    tint: vibrantColors.blueSoft,
    title: "Bebek profili"
  }
];

/**
 * Yaşam evresine göre kategorilere ayrılmış araç listesi.
 * Ana ekran yalnızca birkaç hızlı eylemi gösterir; tüm liste Araçlar
 * ekranında bu katalogdan üretilir.
 */
export function getToolCategories(stage: ExperienceStage): ToolCategory[] {
  if (stage === "pregnancy") {
    return [
      {
        key: "pregnancy-tracking",
        hint: "Haftanı ve sağlığını takip ettiğin araçlar",
        items: pregnancyTracking,
        title: "Gebelik takibi"
      },
      {
        key: "birth",
        hint: "Doğuma yaklaşırken hazırlanmanı sağlayanlar",
        items: birthPreparation,
        title: "Doğuma hazırlık"
      },
      {
        key: "health",
        hint: "Bir şeyi merak ettiğinde açacakların",
        items: healthTools(stage),
        title: "Sağlık ve doktor"
      },
      {
        key: "family",
        hint: "Aileni ve anılarını bir arada tutanlar",
        items: familyTools,
        title: "Aile ve paylaşım"
      }
    ];
  }

  if (stage === "postpartum") {
    return [
      {
        key: "baby-care",
        hint: "Günlük bakımın ve bebeğinin ritmi",
        items: babyCare,
        title: "Bebek bakımı"
      },
      {
        key: "health",
        hint: "Bir şeyi merak ettiğinde açacakların",
        items: healthTools(stage),
        title: "Sağlık ve doktor"
      },
      {
        key: "family",
        hint: "Aileni ve anılarını bir arada tutanlar",
        items: familyTools,
        title: "Aile ve paylaşım"
      }
    ];
  }

  return [
    {
      key: "setup",
      hint: "Önce takibini kur, araçlar sana göre açılsın",
      items: setupTools,
      title: "Takibini başlat"
    },
    {
      key: "family",
      hint: "Aileni ve anılarını bir arada tutanlar",
      items: familyTools,
      title: "Aile ve paylaşım"
    }
  ];
}

const pregnancyToolsShortcut: ToolItem = {
  accent: vibrantColors.mint,
  href: "/pregnancy-tools",
  icon: Wrench,
  key: "pregnancy-tools-counters",
  subtitle: "Tekme, su ve kilo ölçümleri",
  tint: vibrantColors.mintSoft,
  title: "Takip araçları"
};

/** Verilen anahtarları, katalogdaki sırayı koruyarak seçer. */
function pickTools(source: ToolItem[], keys: string[]): ToolItem[] {
  return keys
    .map((key) => source.find((item) => item.key === key))
    .filter((item): item is ToolItem => Boolean(item));
}

/**
 * Ana ekrandaki hızlı eylem satırı: evre başına en fazla dört giriş.
 * Bebek ek gıda yaşına yaklaştığında (5 ay ve sonrası) büyüme kısayolunun
 * yerini ek gıda tarifleri alır.
 */
export function getQuickActions(
  stage: ExperienceStage,
  babyAgeMonths?: number | null
): ToolItem[] {
  if (stage === "pregnancy") {
    return [
      ...pickTools(pregnancyTracking, ["pregnancy-health-file"]),
      pregnancyToolsShortcut,
      ...pickTools(healthTools(stage), ["symptom-check"]),
      ...pickTools(birthPreparation, ["contraction-timer"])
    ];
  }

  if (stage === "postpartum") {
    const readyForSolids = typeof babyAgeMonths === "number" && babyAgeMonths >= 5;
    return [
      ...pickTools(babyCare, ["care-journal-record", "sleep-rhythm"]),
      ...pickTools(healthTools(stage), ["symptom-check"]),
      ...pickTools(babyCare, [readyForSolids ? "solid-food-recipes" : "baby-growth"])
    ];
  }

  return [
    ...pickTools(setupTools, ["setup-pregnancy", "setup-baby"]),
    ...pickTools(familyTools, ["family-planner"])
  ];
}

/** Araçlar ekranındaki toplam araç sayısı; başlıkta gösterilir. */
export function countTools(stage: ExperienceStage) {
  return getToolCategories(stage).reduce(
    (total, category) => total + category.items.length,
    0
  );
}
