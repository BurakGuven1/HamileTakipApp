export type PremiumAccessMode = "credits" | "premium";

export type PremiumFeatureDefinition = {
  accessMode: PremiumAccessMode;
  lifeStage: "pregnancy" | "postpartum" | "shared";
  source: string;
  title: string;
};

export const PREMIUM_FEATURES = {
  babyMemoryGallery: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "baby_memory_gallery",
    title: "Sınırsız anı galerisi"
  },
  careFamily: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_family",
    title: "Aile desteği"
  },
  careInsights: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_insights",
    title: "Bakım eğilimleri"
  },
  carePlan: {
    accessMode: "premium",
    lifeStage: "postpartum",
    source: "care_plan",
    title: "Bakım planı"
  },
  dailyPlanInsights: {
    accessMode: "premium",
    lifeStage: "shared",
    source: "daily_plan_insights",
    title: "Anne+ Günüm kişisel planı"
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
  }
} as const satisfies Record<string, PremiumFeatureDefinition>;

