import { parseProteinuria } from "./proteinuria";
import type {
  DocumentInsightValue,
  DocumentInterpretationContext,
  DocumentRedFlag,
  DocumentRedFlagSeverity
} from "./types.ts";

/**
 * Red flags are the one place where the app speaks before the user asks, so the
 * bar for firing one is deliberately high:
 *
 * - the test must match a rule by name,
 * - the unit printed on the report must match the unit the threshold is written
 *   in (a hemoglobin in g/L must never be read as g/dL),
 * - the number must be parseable and cross a published guideline cut-off.
 *
 * Thresholds are **graded**. A single alarm level forces an impossible choice
 * between shouting at every borderline value and staying silent until a number
 * is already dangerous. Each rule therefore carries an ordered tier list:
 *
 * - `soon`   — "dikkat", show it at the next visit,
 * - `today`  — ask the doctor today,
 * - `urgent` — guidelines treat this range as needing same-day assessment.
 *
 * Every threshold below states its source and its reasoning in a comment, so a
 * clinician auditing this file can check each number against the guideline it
 * claims to come from. Nothing here is a diagnosis; each rule states an
 * observation and an action only.
 */

type Tier = {
  /** Fires when the numeric result is strictly below this. */
  below?: number;
  /** Fires when the numeric result is at or above this. */
  atOrAbove?: number;
  severity: DocumentRedFlagSeverity;
  observation: string;
};

type RedFlagRule = {
  id: string;
  aliases: string[];
  units: string[];
  /** Tiers ordered most severe first; the first match wins. */
  tiers: Tier[] | ((context: DocumentInterpretationContext) => Tier[]);
  /** True when the observation text assumes the reader is pregnant. */
  pregnancyOnly?: boolean;
  sourceLabel: string;
  sourceUrl: string;
};

const ACTION: Record<DocumentRedFlagSeverity, string> = {
  urgent:
    "Bu değeri bugün içinde bir sağlık kuruluşunda değerlendirtmen isteniyor. Bu ekran aciliyet değerlendirmesi yapmaz; kendini kötü hissediyorsan beklemeden başvur.",
  today: "Bu değeri bugün doktorunla paylaş. Bu ekran aciliyet değerlendirmesi yapmaz.",
  soon: "Bu değeri ilk görüşmende doktoruna göster. Bu ekran aciliyet değerlendirmesi yapmaz."
};

const SEVERITY_ORDER: Record<DocumentRedFlagSeverity, number> = {
  urgent: 3,
  today: 2,
  soon: 1
};

const SOURCE = {
  whoAnaemia: {
    label: "WHO — Haemoglobin cutoffs to define anaemia (2024)",
    url: "https://www.who.int/publications/i/item/9789240088542"
  },
  acogHypertensive: {
    label: "ACOG — Gestational Hypertension and Preeclampsia (Practice Bulletin 222)",
    url: "https://www.aafp.org/afp/2019/1115/p649"
  },
  statPearlsHypertension: {
    label: "StatPearls — Hypertension in Pregnancy",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK430839/"
  },
  adaGlucose: {
    label: "ADA — Diagnosis and Classification of Diabetes, Standards of Care",
    url: "https://diabetesjournals.org/care/article/48/Supplement_1/S27/157566/2-Diagnosis-and-Classification-of-Diabetes"
  },
  medlineCrp: {
    label: "MedlinePlus — C-Reactive Protein Test",
    url: "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/"
  },
  medlineUrineProtein: {
    label: "MedlinePlus — Protein in Urine",
    url: "https://medlineplus.gov/lab-tests/protein-in-urine/"
  }
} as const;

const RULES: RedFlagRule[] = [
  {
    id: "hemoglobin",
    aliases: ["hemoglobin", "hgb", "hb"],
    units: ["g/dl"],
    // WHO 2024 defines anaemia in pregnancy at Hb <11.0 g/dL in the 1st and 3rd
    // trimester and <10.5 g/dL in the 2nd, because plasma volume expansion
    // dilutes haemoglobin most in mid-pregnancy. Severity bands (mild /
    // moderate / severe) are unchanged from the long-standing WHO
    // classification: moderate 7.0-9.9 g/dL, severe <7.0 g/dL.
    //
    // The previous single rule fired only below 7.0 g/dL, which is severe
    // anaemia — far too late to be useful as a prompt. The graded version warns
    // once the reading crosses the guideline's own anaemia line, without
    // treating every low-normal haemoglobin as an alarm.
    tiers: (context) => {
      const anaemiaCutoff = context.pregnancyStatus === "pregnant"
        ? context.trimester === 2 ? 10.5 : 11
        // WHO non-pregnant adult women: anaemia below 12.0 g/dL.
        : 12;
      return [
        {
          below: 7,
          severity: "today",
          observation:
            "Hemoglobinin, rehberlerin ağır kansızlık için kullandığı sınırın (7 g/dL) altında görünüyor."
        },
        {
          below: 10,
          severity: "today",
          observation:
            "Hemoglobinin, rehberlerin orta düzey kansızlık için kullandığı aralıkta (7–9,9 g/dL) görünüyor."
        },
        {
          below: anaemiaCutoff,
          severity: "soon",
          observation:
            `Hemoglobinin, gebelikte kansızlık için kullanılan sınırın (${formatNumber(anaemiaCutoff)} g/dL) biraz altında görünüyor. Gebelikte hafif düşüklük sık görülür ve tek başına bir sonuç anlamına gelmez.`
        }
      ];
    },
    sourceLabel: SOURCE.whoAnaemia.label,
    sourceUrl: SOURCE.whoAnaemia.url
  },
  {
    id: "platelet",
    aliases: ["trombosit", "platelet", "plt"],
    units: ["10^3/ul", "10^3/µl", "x10^3/ul", "x10^3/µl", "10^9/l"],
    pregnancyOnly: true,
    // ACOG Practice Bulletin 222 lists a platelet count below 100.000/µL among
    // the severe features of preeclampsia; StatPearls states the same cut-off.
    // Between 100.000 and 150.000/µL the overwhelmingly common explanation in
    // pregnancy is gestational thrombocytopenia, which is benign — so that band
    // is "dikkat" only, and the wording says so.
    tiers: [
      {
        below: 100,
        severity: "today",
        observation:
          "Trombosit sayın, gebelik takibinde ayrıca değerlendirilen sınırın (100 bin/µL) altında görünüyor."
      },
      {
        below: 150,
        severity: "soon",
        observation:
          "Trombosit sayın alışılmış alt sınırın (150 bin/µL) biraz altında görünüyor. Gebelikte bu durum sık görülür ve çoğu zaman kendiliğinden geçer."
      }
    ],
    sourceLabel: SOURCE.acogHypertensive.label,
    sourceUrl: SOURCE.acogHypertensive.url
  },
  {
    id: "alt",
    aliases: ["alt", "alanin aminotransferaz", "sgpt"],
    units: ["u/l", "iu/l"],
    // ACOG's severe-feature criterion is "AST/ALT greater than twice the upper
    // limit of normal". Laboratory upper limits cluster around 35-40 U/L for
    // adults, so twice normal is taken here as 70 U/L. Between the ordinary
    // upper limit (40 U/L) and that point the reading is worth mentioning but
    // not worth alarming about.
    tiers: [
      { atOrAbove: 70, severity: "today", observation: "Karaciğer enzimin (ALT), laboratuvarların üst sınırının yaklaşık iki katı ve üzerinde görünüyor." },
      { atOrAbove: 40, severity: "soon", observation: "Karaciğer enzimin (ALT) alışılmış üst sınırın üstünde görünüyor." }
    ],
    sourceLabel: SOURCE.acogHypertensive.label,
    sourceUrl: SOURCE.acogHypertensive.url
  },
  {
    id: "ast",
    aliases: ["ast", "aspartat aminotransferaz", "sgot"],
    units: ["u/l", "iu/l"],
    // Same ACOG "twice the upper limit of normal" criterion as ALT.
    tiers: [
      { atOrAbove: 70, severity: "today", observation: "Karaciğer/kas enzimin (AST), laboratuvarların üst sınırının yaklaşık iki katı ve üzerinde görünüyor." },
      { atOrAbove: 40, severity: "soon", observation: "Karaciğer/kas enzimin (AST) alışılmış üst sınırın üstünde görünüyor." }
    ],
    sourceLabel: SOURCE.acogHypertensive.label,
    sourceUrl: SOURCE.acogHypertensive.url
  },
  {
    id: "creatinine",
    aliases: ["kreatinin", "creatinine"],
    units: ["mg/dl"],
    pregnancyOnly: true,
    // ACOG / StatPearls: serum creatinine above 1.1 mg/dL (or a doubling of the
    // patient's own baseline) counts as renal insufficiency among the severe
    // features. Creatinine normally *falls* in pregnancy thanks to increased
    // renal plasma flow, so 0.9-1.1 mg/dL is already above the pregnancy norm
    // and earns a "dikkat" rather than silence.
    tiers: [
      { atOrAbove: 1.1, severity: "today", observation: "Kreatinin değerin, gebelik takibinde ayrıca değerlendirilen sınırın (1,1 mg/dL) üstünde görünüyor." },
      { atOrAbove: 0.9, severity: "soon", observation: "Kreatinin değerin, gebelikte beklenenin üstünde görünüyor. Gebelikte kreatinin genellikle düşer." }
    ],
    sourceLabel: SOURCE.statPearlsHypertension.label,
    sourceUrl: SOURCE.statPearlsHypertension.url
  },
  {
    id: "glucose_low",
    aliases: ["glukoz", "glucose", "kan şekeri", "kan sekeri"],
    units: ["mg/dl"],
    // ADA hypoglycaemia levels: level 1 is <70 mg/dL, level 2 (clinically
    // significant) is <54 mg/dL. The old single rule fired below 50, which sits
    // below even level 2.
    tiers: [
      { below: 54, severity: "today", observation: "Kan şekerin, rehberlerin klinik olarak anlamlı düşüklük için kullandığı sınırın (54 mg/dL) altında görünüyor." },
      { below: 70, severity: "soon", observation: "Kan şekerin, rehberlerin düşük kan şekeri için kullandığı sınırın (70 mg/dL) altında görünüyor. Ölçümün açlıkta mı alındığı sonucu etkiler." }
    ],
    sourceLabel: SOURCE.adaGlucose.label,
    sourceUrl: SOURCE.adaGlucose.url
  },
  {
    id: "glucose_high",
    aliases: ["glukoz", "glucose", "kan şekeri", "kan sekeri"],
    units: ["mg/dl"],
    // ADA: a random plasma glucose at or above 200 mg/dL is one of the
    // diagnostic thresholds. Deliberately NO lower "soon" tier: a value of, say,
    // 130 mg/dL is entirely ordinary after a meal and alarming on it would fire
    // on most post-prandial samples. Gestational diabetes screening is not
    // evaluated here at all — see interpretationGuard.
    tiers: [
      { atOrAbove: 200, severity: "today", observation: "Kan şekerin, rehberlerin ayrıca değerlendirdiği sınırın (200 mg/dL) üstünde görünüyor. Ölçümün açlıkta mı alındığı sonucu etkiler." }
    ],
    sourceLabel: SOURCE.adaGlucose.label,
    sourceUrl: SOURCE.adaGlucose.url
  },
  {
    id: "crp",
    aliases: ["crp", "c reaktif protein"],
    units: ["mg/l"],
    // Deliberately kept as a single high tier. CRP rises physiologically in
    // normal pregnancy and with any minor infection, so a "soon" tier at the
    // ordinary upper limit (around 5-10 mg/L) would fire constantly without
    // telling the reader anything she does not already know.
    tiers: [
      { atOrAbove: 100, severity: "today", observation: "İltihap göstergen (CRP) alışılmış aralığın belirgin biçimde üstünde görünüyor. Nedenini tek başına göstermez." }
    ],
    sourceLabel: SOURCE.medlineCrp.label,
    sourceUrl: SOURCE.medlineCrp.url
  }
];

/**
 * Urine protein is categorical on most reports ("negatif", "eser", "+1"), so it
 * cannot go through the numeric tier machinery. It is also the one finding
 * whose meaning depends on a number that is not on the report at all — the
 * blood pressure — which is why the wording routes to the doctor rather than
 * naming a condition. See `combineHypertensionAndProteinuria`.
 */
const PROTEINURIA_ALIASES = ["idrarda protein", "idrar protein", "protein (idrar)", "proteinuri", "proteinüri", "urine protein", "albumin (idrar)"];

export function detectDocumentRedFlags(
  values: DocumentInsightValue[],
  context: DocumentInterpretationContext
): DocumentRedFlag[] {
  const flags: DocumentRedFlag[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    // An unreliable read must never raise an alarm: a misread decimal point is
    // exactly how a normal hemoglobin becomes a "very low" one.
    if (value.confidence === "low") continue;

    const proteinuriaFlag = buildProteinuriaFlag(value, context);
    if (proteinuriaFlag && !seen.has(proteinuriaFlag.id)) {
      seen.add(proteinuriaFlag.id);
      flags.push(proteinuriaFlag);
    }

    for (const rule of RULES) {
      if (seen.has(rule.id)) continue;
      if (rule.pregnancyOnly && context.pregnancyStatus !== "pregnant") continue;
      if (!matchesTestName(value.testName, rule.aliases)) continue;
      if (!matchesUnit(value.unit, rule.units)) continue;

      const numeric = parseRedFlagNumber(value.result);
      if (numeric === null) continue;

      const tiers = typeof rule.tiers === "function" ? rule.tiers(context) : rule.tiers;
      const tier = tiers.find((candidate) => matchesTier(candidate, numeric));
      if (!tier) continue;

      seen.add(rule.id);
      flags.push({
        id: rule.id,
        testName: value.testName,
        observation: tier.observation,
        action: ACTION[tier.severity],
        severity: tier.severity,
        source: "lab_document",
        sourceLabel: rule.sourceLabel,
        sourceUrl: rule.sourceUrl
      });
    }
  }

  return sortBySeverity(flags);
}

/**
 * Proteinuria and a raised blood pressure are each individually inconclusive,
 * but guidelines evaluate them together. When both are present the two separate
 * cards are replaced by **one** card at a higher severity, so the reader is not
 * left to combine two half-warnings herself. The text still never names a
 * condition — it says what was measured and who should look at it.
 */
export function combineHypertensionAndProteinuria(flags: DocumentRedFlag[]): DocumentRedFlag[] {
  const proteinuria = flags.find((flag) => flag.id.startsWith("proteinuria"));
  const hypertension = flags.find((flag) => flag.id.startsWith("blood_pressure"));
  if (!proteinuria || !hypertension) return sortBySeverity(flags);

  const rest = flags.filter((flag) => flag !== proteinuria && flag !== hypertension);
  return sortBySeverity([
    {
      id: "blood_pressure_with_proteinuria",
      testName: "Tansiyon ve idrarda protein",
      observation:
        "Hem tansiyon ölçümün yüksek görünüyor hem de idrarında protein saptanmış. Rehberler bu iki bulguyu tek başına değil birlikte değerlendirir.",
      action:
        "Bu iki sonucu birlikte, bugün içinde bir sağlık kuruluşunda değerlendirtmen isteniyor. Bu ekran tanı koymaz ve aciliyet değerlendirmesi yapmaz.",
      severity: "urgent",
      source: hypertension.source,
      sourceLabel: SOURCE.acogHypertensive.label,
      sourceUrl: SOURCE.acogHypertensive.url
    },
    ...rest
  ]);
}

export function sortBySeverity(flags: DocumentRedFlag[]) {
  return [...flags].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

/**
 * Also used outside the document reader: the health file pairs the most recent
 * saved urine protein with the reader's own blood pressure entries, which is
 * the only place the two halves of that pair actually meet.
 */
export function buildProteinuriaFlag(
  value: Pick<DocumentInsightValue, "testName" | "result" | "unit">,
  context: DocumentInterpretationContext
): DocumentRedFlag | null {
  // Non-pregnant readers get nothing here: the whole point of the rule is the
  // pregnancy-specific pairing with blood pressure.
  if (context.pregnancyStatus !== "pregnant") return null;
  if (!matchesTestName(value.testName, PROTEINURIA_ALIASES)) return null;

  const reading = parseProteinuria(value.result, value.unit);
  // An unrecognised format is never guessed at.
  if (!reading || !reading.detected) return null;

  // ACOG's dipstick criterion for proteinuria is 2+; 1+ or a trace amount is
  // below that line but still worth pairing with a blood pressure reading,
  // which is why it fires at the lower "today" tier rather than silently.
  const severity: DocumentRedFlagSeverity = reading.rank >= 2 ? "today" : "soon";
  return {
    id: `proteinuria_${reading.level}`,
    testName: value.testName,
    observation:
      `İdrarında protein saptanmış (${reading.displayValue}). Tek başına bir sonuç göstermez; gebelikte asıl olarak tansiyon ölçümünle birlikte değerlendirilir.`,
    action:
      severity === "today"
        ? "Bu sonucu tansiyon ölçümünle birlikte bugün doktorunla paylaş. Bu ekran tanı koymaz."
        : "Bu sonucu tansiyon ölçümünle birlikte ilk görüşmende doktoruna göster. Bu ekran tanı koymaz.",
    severity,
    source: "lab_document",
    sourceLabel: SOURCE.medlineUrineProtein.label,
    sourceUrl: SOURCE.medlineUrineProtein.url
  };
}

function matchesTier(tier: Tier, numeric: number) {
  if (typeof tier.below === "number" && numeric < tier.below) return true;
  return typeof tier.atOrAbove === "number" && numeric >= tier.atOrAbove;
}

function matchesTestName(testName: string, aliases: string[]) {
  const normalized = normalize(testName);
  return aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedAlias.length > 3) return normalized.includes(normalizedAlias);
    return normalized.split(/[^a-z0-9]+/).includes(normalizedAlias);
  });
}

function matchesUnit(unit: string, units: string[]) {
  const normalized = normalize(unit).replace(/\s+/g, "");
  if (!normalized) return false;
  return units.some((candidate) => normalize(candidate).replace(/\s+/g, "") === normalized);
}

function parseRedFlagNumber(result: string) {
  const trimmed = result.trim();
  // "<5" or ">200" carry no exact value; a flag built on a bound is a guess.
  if (/^[<>≤≥~]/.test(trimmed)) return null;
  const match = trimmed.match(/^-?\d+(?:[.,]\d+)?$/);
  if (!match) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    // OCR reads "İDRARDA PROTEİN" as often as "İdrarda Protein", and Turkish
    // case folding turns the capital I into a dotless ı. Folding both to "i"
    // keeps alias matching from depending on how the lab shouted the label.
    .replace(/[ıİ]/g, "i")
    .replace(/[µμ]/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
