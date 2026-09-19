export type PremiumAccessMode = "credits" | "premium";

/**
 * Seventeen separately named locks read as seventeen small obstacles rather
 * than one product worth paying for. Every feature belongs to exactly one
 * bundle, and the bundle promise is what the gate and the paywall lead with.
 */
export type PremiumBundleKey =
  | "family_sharing"
  | "health_archive"
  | "memory_studio"
  | "smart_care";

export type PremiumBundleDefinition = {
  key: PremiumBundleKey;
  promise: string;
  title: string;
};

export const PREMIUM_BUNDLES = {
  health_archive: {
    key: "health_archive",
    promise: "Bebeğinin tüm sağlık geçmişi, doktora hazır.",
    title: "Sağlık Arşivi"
  },
  smart_care: {
    key: "smart_care",
    promise: "Gününü bebeğine göre kuran akıllı bakım takibi.",
    title: "Akıllı Bakım"
  },
  family_sharing: {
    key: "family_sharing",
    promise: "Bakımı eşinle paylaş; kimin sırası olduğu hep belli olsun.",
    title: "Aile Paylaşımı"
  },
  memory_studio: {
    key: "memory_studio",
    promise: "Fotoğrafını paylaşmaya hazır bir anıya çevir.",
    title: "Anı Stüdyosu"
  }
} as const satisfies Record<PremiumBundleKey, PremiumBundleDefinition>;

export type PremiumFeatureDefinition = {
  accessMode: PremiumAccessMode;
  bundle: PremiumBundleKey;
  lifeStage: "pregnancy" | "postpartum" | "shared";
  source: string;
  title: string;
};

export const PREMIUM_FEATURES = {
  documentInsight: {
    accessMode: "credits",
    bundle: "health_archive",
    lifeStage: "shared",
    source: "document_insight",
    title: "Belgeyi Anla"
  },
  advancedPumping: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_advanced_pumping",
    title: "Gelişmiş iki taraflı sağım"
  },
  babyMemoryGallery: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "baby_memory_gallery",
    title: "Sınırsız anı galerisi"
  },
  careHistory: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_history",
    title: "Sınırsız bakım geçmişi"
  },
  careFamilyReminders: {
    accessMode: "premium",
    bundle: "family_sharing",
    lifeStage: "postpartum",
    source: "care_family_reminders",
    title: "Aile senkronlu bakım alarmları"
  },
  careInsights: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_insights",
    title: "Bakım eğilimleri"
  },
  careMedicine: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_medicine",
    title: "İlaç ve vitamin kaydı"
  },
  careMultiBaby: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_multi_baby",
    title: "Çoklu bebek bakım günlüğü"
  },
  careSolidFood: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_solid_food",
    title: "Ek gıda kaydı"
  },
  doctorVisitReport: {
    accessMode: "credits",
    bundle: "health_archive",
    lifeStage: "shared",
    source: "doctor_visit_report",
    title: "Doktor görüşmesi PDF özeti"
  },
  familyTaskAlarm: {
    accessMode: "credits",
    bundle: "family_sharing",
    lifeStage: "shared",
    source: "family_task_alarm",
    title: "Zamanlı aile görev alarmı"
  },
  pregnancySupportHandover: {
    accessMode: "credits",
    bundle: "family_sharing",
    lifeStage: "pregnancy",
    source: "pregnancy_support_handover",
    title: "Gebelik desteği devri"
  },
  pregnancyHealthFileSave: {
    accessMode: "premium",
    bundle: "health_archive",
    lifeStage: "pregnancy",
    source: "pregnancy_health_file_save",
    title: "Tahlil değerlerini Sağlık Dosyam'a kaydet"
  },
  pregnancyHealthFileReminder: {
    accessMode: "premium",
    bundle: "health_archive",
    lifeStage: "pregnancy",
    source: "pregnancy_health_file_reminder",
    title: "Sağlık Dosyam hatırlatmaları"
  },
  pregnancyHealthFilePdf: {
    accessMode: "premium",
    bundle: "health_archive",
    lifeStage: "pregnancy",
    source: "pregnancy_health_file_pdf",
    title: "Sağlık Dosyam PDF arşivi"
  },
  sleepPrediction: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "sleep_prediction",
    title: "Akıllı uyku tahmini"
  },
  photoStudioMilestone: {
    accessMode: "premium",
    bundle: "memory_studio",
    lifeStage: "postpartum",
    source: "photo_studio_milestone",
    title: "Tüm anı kartı konseptleri"
  },
  photoStudioBelly: {
    accessMode: "premium",
    bundle: "memory_studio",
    lifeStage: "pregnancy",
    source: "photo_studio_belly",
    title: "Tüm karın ışıltısı konseptleri"
  },
  milkInventory: {
    accessMode: "premium",
    bundle: "smart_care",
    lifeStage: "postpartum",
    source: "care_milk_inventory",
    title: "Anne sütü stok yönetimi"
  }
} as const satisfies Record<string, PremiumFeatureDefinition>;

const FEATURES_BY_SOURCE = new Map<string, PremiumFeatureDefinition>(
  Object.values(PREMIUM_FEATURES).map((feature) => [
    feature.source as string,
    feature as PremiumFeatureDefinition
  ])
);

export function getPremiumFeatureBySource(source: string) {
  return FEATURES_BY_SOURCE.get(source) ?? null;
}

/**
 * Gates are opened from screens that only know their `source` string, so the
 * bundle has to be resolvable from that alone. An unknown source falls back to
 * the archive promise, which is the one that applies to the whole product.
 */
export function getPremiumBundleForSource(source: string) {
  const feature = getPremiumFeatureBySource(source);
  return PREMIUM_BUNDLES[feature?.bundle ?? "health_archive"];
}
