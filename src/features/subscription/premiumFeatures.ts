export type PremiumAccessMode = "credits" | "premium";

export type PremiumFeatureDefinition = {
  accessMode: PremiumAccessMode;
  lifeStage: "pregnancy" | "postpartum" | "shared";
  source: string;
  title: string;
};

export const PREMIUM_FEATURES = {
  advancedPumping: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_advanced_pumping",
    title: "Gelişmiş iki taraflı sağım"
  },
  babyMemoryGallery: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "baby_memory_gallery",
    title: "Sınırsız anı galerisi"
  },
  careHistory: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_history",
    title: "Sınırsız bakım geçmişi"
  },
  careFamilyReminders: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_family_reminders",
    title: "Aile senkronlu bakım alarmları"
  },
  careInsights: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_insights",
    title: "Bakım eğilimleri"
  },
  careMedicine: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_medicine",
    title: "İlaç ve vitamin kaydı"
  },
  careMultiBaby: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_multi_baby",
    title: "Çoklu bebek bakım günlüğü"
  },
  careSolidFood: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_solid_food",
    title: "Ek gıda kaydı"
  },
  doctorVisitReport: {
    accessMode: "credits",
    lifeStage: "shared",
    source: "doctor_visit_report",
    title: "Doktor görüşmesi PDF özeti"
  },
  familyTaskAlarm: {
    accessMode: "credits",
    lifeStage: "shared",
    source: "family_task_alarm",
    title: "Zamanlı aile görev alarmı"
  },
  pregnancySupportHandover: {
    accessMode: "credits",
    lifeStage: "pregnancy",
    source: "pregnancy_support_handover",
    title: "Gebelik desteği devri"
  },
  sleepPrediction: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "sleep_prediction",
    title: "Akıllı uyku tahmini"
  },
  milkInventory: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_milk_inventory",
    title: "Anne sütü stok yönetimi"
  }
} as const satisfies Record<string, PremiumFeatureDefinition>;
