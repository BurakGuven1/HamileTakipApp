export type TriageStage = "pregnancy" | "postpartum_mother" | "baby";

/**
 * Deliberately three levels, not a score. A number invites a parent to average
 * away a red flag; a level tells them what to do in the next few minutes.
 */
export type TriageUrgency = "emergency" | "same_day" | "monitor";

export type TriageSymptom = {
  /** Only meaningful from this gestational week onward, when set. */
  fromWeek?: number;
  id: string;
  label: string;
  note?: string;
  stage: TriageStage;
  urgency: TriageUrgency;
};

export type TriageOutcome = {
  action: string;
  headline: string;
  matched: TriageSymptom[];
  urgency: TriageUrgency | null;
};

export const TRIAGE_SYMPTOMS: TriageSymptom[] = [
  // Pregnancy
  {
    id: "pregnancy_bleeding",
    label: "Vajinal kanama",
    note: "Miktarı az olsa da değerlendirilmesi gerekir.",
    stage: "pregnancy",
    urgency: "emergency"
  },
  {
    id: "pregnancy_fluid",
    label: "Su gelmesi veya ani sulu akıntı",
    note: "Rengi yeşil veya kahverengiyse daha da acil.",
    stage: "pregnancy",
    urgency: "emergency"
  },
  {
    id: "pregnancy_preeclampsia",
    label: "Geçmeyen şiddetli baş ağrısı, görme bulanıklığı veya gözde ışık çakmaları",
    note: "Yüksek tansiyonla ilgili olabilir.",
    stage: "pregnancy",
    urgency: "emergency"
  },
  {
    id: "pregnancy_epigastric",
    label: "Kaburgaların altında, sağ üst karında ağrı",
    stage: "pregnancy",
    urgency: "emergency"
  },
  {
    id: "pregnancy_movement",
    label: "Bebeğin hareketlerinde belirgin azalma veya durma",
    fromWeek: 28,
    note: "Hareket saymak için beklemeden ara.",
    stage: "pregnancy",
    urgency: "emergency"
  },
  {
    id: "pregnancy_swelling",
    label: "Yüzde, ellerde ani ve belirgin şişme",
    stage: "pregnancy",
    urgency: "same_day"
  },
  {
    id: "pregnancy_fever",
    label: "38°C ve üzeri ateş",
    stage: "pregnancy",
    urgency: "same_day"
  },
  {
    id: "pregnancy_burning",
    label: "İdrar yaparken yanma veya sık idrara çıkma",
    stage: "pregnancy",
    urgency: "same_day"
  },
  {
    id: "pregnancy_vomiting",
    label: "Sıvı alamayacak kadar şiddetli bulantı ve kusma",
    stage: "pregnancy",
    urgency: "same_day"
  },
  {
    id: "pregnancy_cramps",
    label: "Dinlenince geçen hafif kasık ağrısı veya çekilme",
    stage: "pregnancy",
    urgency: "monitor"
  },
  {
    id: "pregnancy_heartburn",
    label: "Mide yanması, şişkinlik, kabızlık",
    stage: "pregnancy",
    urgency: "monitor"
  },

  // Postpartum mother
  {
    id: "postpartum_bleeding",
    label: "Bir saatte bir pedi tamamen dolduran kanama veya yumruk büyüklüğünde pıhtı",
    stage: "postpartum_mother",
    urgency: "emergency"
  },
  {
    id: "postpartum_breathing",
    label: "Nefes darlığı, göğüs ağrısı veya bacakta tek taraflı ağrılı şişlik",
    stage: "postpartum_mother",
    urgency: "emergency"
  },
  {
    id: "postpartum_thoughts",
    label: "Kendine veya bebeğine zarar verme düşünceleri",
    note: "Bu düşünceler utanılacak bir şey değil ve yardım almak mümkün.",
    stage: "postpartum_mother",
    urgency: "emergency"
  },
  {
    id: "postpartum_headache",
    label: "Geçmeyen şiddetli baş ağrısı veya görme değişikliği",
    stage: "postpartum_mother",
    urgency: "emergency"
  },
  {
    id: "postpartum_fever",
    label: "38°C ve üzeri ateş veya kötü kokulu akıntı",
    stage: "postpartum_mother",
    urgency: "same_day"
  },
  {
    id: "postpartum_breast",
    label: "Memede kızarıklık, sertlik ve grip benzeri halsizlik",
    note: "Mastit olabilir; emzirmeye devam etmek genellikle önerilir.",
    stage: "postpartum_mother",
    urgency: "same_day"
  },
  {
    id: "postpartum_wound",
    label: "Dikiş yerinde artan ağrı, kızarıklık veya akıntı",
    stage: "postpartum_mother",
    urgency: "same_day"
  },
  {
    id: "postpartum_mood",
    label: "İki haftadan uzun süren yoğun üzüntü, kaygı veya boşluk hissi",
    note: "Lohusalık depresyonu yaygındır ve tedavi edilebilir.",
    stage: "postpartum_mother",
    urgency: "same_day"
  },
  {
    id: "postpartum_afterpains",
    label: "Emzirirken gelen kramp benzeri ağrılar",
    stage: "postpartum_mother",
    urgency: "monitor"
  },
  {
    id: "postpartum_hairloss",
    label: "Saç dökülmesi, terleme, duygusal dalgalanma",
    stage: "postpartum_mother",
    urgency: "monitor"
  },

  // Baby
  {
    id: "baby_fever_newborn",
    label: "3 aydan küçük bebekte 38°C ve üzeri ateş",
    note: "Yenidoğanda ateş her zaman acil değerlendirilir.",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_breathing",
    label: "Hızlı, zorlu veya inleyerek nefes alma; kaburga altının içeri çekilmesi",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_color",
    label: "Dudak, dil veya ciltte morarma",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_unresponsive",
    label: "Uyandırmakta zorlanma, aşırı halsizlik veya durdurulamayan ağlama",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_seizure",
    label: "Havale, kasılma veya bilinç kaybı",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_dehydration",
    label: "12 saattir ıslak bez yok veya ağız kuruluğu, gözyaşsız ağlama",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_fever_older",
    label: "3 aydan büyük bebekte 38°C ve üzeri ateş",
    stage: "baby",
    urgency: "same_day"
  },
  {
    id: "baby_feeding",
    label: "Beslenmeyi belirgin şekilde reddetme veya sürekli kusma",
    stage: "baby",
    urgency: "same_day"
  },
  {
    id: "baby_jaundice",
    label: "Sararmanın artması veya avuç içi ve ayak tabanına yayılması",
    stage: "baby",
    urgency: "same_day"
  },
  {
    id: "baby_rash",
    label: "Bastırınca solmayan döküntü",
    stage: "baby",
    urgency: "emergency"
  },
  {
    id: "baby_reflux",
    label: "Beslenme sonrası az miktarda geri çıkarma, gaz, hıçkırık",
    stage: "baby",
    urgency: "monitor"
  },
  {
    id: "baby_stool",
    label: "Dışkı renginde ve sıklığında değişiklik",
    stage: "baby",
    urgency: "monitor"
  }
];

export const TRIAGE_STAGE_LABELS: Record<TriageStage, string> = {
  pregnancy: "Hamilelik",
  postpartum_mother: "Lohusalık (anne)",
  baby: "Bebek"
};

/**
 * Symptoms are filtered by stage and, where it matters, by gestational week.
 * Reduced fetal movement before movements are reliably felt would produce a
 * frightening prompt about something the mother cannot yet assess.
 */
export function getSymptomsForStage(
  stage: TriageStage,
  gestationalWeek?: number | null
) {
  return TRIAGE_SYMPTOMS.filter((symptom) => {
    if (symptom.stage !== stage) return false;
    if (symptom.fromWeek === undefined) return true;
    return typeof gestationalWeek === "number" && gestationalWeek >= symptom.fromWeek;
  });
}

const URGENCY_ORDER: Record<TriageUrgency, number> = {
  emergency: 3,
  same_day: 2,
  monitor: 1
};

/**
 * The most urgent selected symptom decides the answer. Nothing is averaged or
 * cancelled out: one red flag among five mild complaints is still a red flag.
 */
export function evaluateTriage(selectedIds: string[]): TriageOutcome {
  const matched = TRIAGE_SYMPTOMS.filter((symptom) =>
    selectedIds.includes(symptom.id)
  );

  if (matched.length === 0) {
    return {
      action:
        "Seçtiğin bir belirti yok. Yine de içine sinmeyen bir şey varsa hekimini aramak her zaman geçerli bir seçim.",
      headline: "Henüz bir şey seçmedin",
      matched,
      urgency: null
    };
  }

  const urgency = matched.reduce<TriageUrgency>(
    (highest, symptom) =>
      URGENCY_ORDER[symptom.urgency] > URGENCY_ORDER[highest] ? symptom.urgency : highest,
    "monitor"
  );

  if (urgency === "emergency") {
    return {
      action:
        "Beklemeden hekimini veya hastanenin acil servisini ara. Ulaşamazsan 112'yi ara.",
      headline: "Şimdi ara",
      matched,
      urgency
    };
  }

  if (urgency === "same_day") {
    return {
      action:
        "Bugün içinde hekiminle görüş. Kötüleşirse beklemeden acile başvur.",
      headline: "Bugün hekimine danış",
      matched,
      urgency
    };
  }

  return {
    action:
      "Bunlar sık görülen durumlar. Takip et; sıklığı veya şiddeti artarsa hekimine sor.",
    headline: "Takip et",
    matched,
    urgency
  };
}

/**
 * What to have ready when the call connects. A parent who is frightened forgets
 * exactly the details the clinician asks for first.
 */
export function getCallChecklist(stage: TriageStage) {
  const shared = [
    "Belirtinin ne zaman başladığı ve ne sıklıkta olduğu",
    "Ateş ölçtüysen değeri ve ölçüm saati",
    "Kullandığın ilaçlar ve bilinen alerjiler"
  ];

  if (stage === "pregnancy") {
    return ["Kaçıncı haftada olduğun ve tahmini doğum tarihin", ...shared];
  }
  if (stage === "postpartum_mother") {
    return ["Doğum tarihin ve doğum şeklin (normal / sezaryen)", ...shared];
  }
  return ["Bebeğin doğum tarihi ve güncel kilosu", ...shared];
}
