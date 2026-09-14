import type {
  DocumentInsightValue,
  DocumentInterpretationContext
} from "./types.ts";

/**
 * The one rule this module enforces: **we never say more than we know.**
 *
 * `documentRules` produces a plain-language reading for every value it can
 * match. This guard runs afterwards and decides how much of that reading
 * survives, at one of three levels:
 *
 * - `explained` — nothing undermines the reading.
 * - `contextual` — the test shifts in pregnancy and the report printed only a
 *   general adult range. Previously this case was shown as a full, confident
 *   interpretation, which quietly applied non-pregnant thresholds to a pregnant
 *   reader. Now the lab's own comparison is kept (it is still the lab's own
 *   arithmetic, and hiding it helps nobody) while every sentence that assigns
 *   *meaning* is dropped and a visible note says whose range was used.
 * - `not_interpretable` — an unreliable OCR read, a test with no cited source,
 *   a test we have no sourced entry for, no comparable range at all, or a
 *   threshold that is simply invalid in pregnancy. What remains is the factual
 *   part plus an honest sentence explaining why nothing else is shown.
 */

/** Used by `documentRules` for tests with no entry in the knowledge list. */
export const GENERIC_SOURCE_URL =
  "https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/";

/**
 * Tests whose expected range moves with pregnancy or gestational week. For
 * these, a comparison is only trustworthy when the lab printed the range it
 * used; a range carried in this app cannot know the user's week.
 */
const PREGNANCY_SENSITIVE_ALIASES = [
  "hemoglobin", "hgb", "hb", "hematokrit", "hct",
  "ferritin", "demir",
  "tsh", "ft4", "serbest t4", "free t4", "tiroksin", "ft3", "t3", "t4",
  "hba1c", "a1c",
  "glukoz", "glucose", "kan sekeri",
  "kreatinin", "creatinine", "ure", "urik asit",
  "wbc", "lokosit", "leukocyte",
  "trombosit", "platelet", "plt",
  "hcg", "bhcg", "beta hcg",
  "progesteron", "progesterone", "estradiol", "prolaktin",
  "ldl", "hdl", "non-hdl", "kolesterol", "cholesterol", "trigliserid", "triglyceride", "tg",
  "crp", "c reaktif protein",
  "d-dimer", "fibrinojen"
];

/**
 * Terms whose narrative thresholds are explicitly non-pregnancy thresholds and
 * where even *contextualising* them would mislead.
 *
 * HbA1c is the clearest case: it is not used to diagnose gestational diabetes
 * at all, and red cell turnover in pregnancy shifts the result independently of
 * blood sugar. Showing a pregnant reader "your HbA1c is inside the lab's range"
 * next to a note would still leave her with a number she would reasonably read
 * as reassurance about a question this test does not answer. The same applies
 * to the oral glucose tolerance / gestational diabetes screening results, whose
 * cut-offs are protocol-specific.
 */
const NOT_VALID_IN_PREGNANCY = [
  "hba1c", "a1c", "glikozile hemoglobin", "glycated hemoglobin",
  "ogtt", "oral glukoz", "glukoz tolerans", "seker yukleme", "şeker yükleme",
  "gestasyonel diyabet", "gebelik sekeri", "gebelik şekeri"
];

/**
 * Pregnancy-sensitive tests where showing the lab's own general-range
 * comparison, clearly labelled, is more useful than showing nothing. These are
 * the everyday panels — full blood count, thyroid, iron stores, kidney, liver,
 * inflammation, lipids — where the direction of the lab's own comparison is
 * still meaningful information to take to a doctor, even though the boundary
 * itself is not a pregnancy boundary.
 *
 * Anything pregnancy-sensitive but *not* on this list stays uninterpreted.
 */
const CONTEXTUALISABLE = [
  "hemoglobin", "hgb", "hb", "hematokrit", "hct",
  "ferritin", "demir",
  "tsh", "ft4", "serbest t4", "free t4", "tiroksin", "ft3", "t3", "t4",
  "kreatinin", "creatinine", "ure", "urik asit",
  "wbc", "lokosit", "leukocyte",
  "trombosit", "platelet", "plt",
  "ldl", "hdl", "non-hdl", "kolesterol", "cholesterol", "trigliserid", "triglyceride", "tg",
  "crp", "c reaktif protein",
  "d-dimer", "fibrinojen"
];

/** Tests for which even a contextual note must carry its own wording. */
const HCG_ALIASES = ["hcg", "bhcg", "beta hcg"];

const REASON = {
  lowConfidence:
    "Bu satır belgeden yeterli güvenle okunamadı. Yanlış okunmuş bir rakamı yorumlamak yerine bu değeri açıklamadan bıraktık.",
  noSource:
    "Bu test için dayandığımız doğrulanmış bir kaynak bulunmuyor, bu yüzden bir açıklama yazmadık.",
  unknownTest:
    "Bu test, uygulamadaki kaynaklı açıklama sözlüğünde bulunmuyor. Ne anlama geldiğini doktoruna sorman en doğrusu.",
  noComparableRange:
    "Belgede bu sonuç için karşılaştırılabilen bir referans aralığı bulunamadı, bu yüzden düşük/normal/yüksek ayrımı yapmadık.",
  pregnancySensitive:
    "Bu testin beklenen aralığı gebelik dönemine ve haftasına göre değişir. Belgede gebeliğe özel bir aralık yazmadığı için sonucu yorumlamadık.",
  notValidInPregnancy:
    "Bu testin yaygın sınır değerleri gebelik dışı yetişkinler için tanımlıdır ve gebelikte kullanılmaz. Bu yüzden sonucu yorumlamadık."
} as const;

/** Shown next to the comparison whenever interpretability is "contextual". */
const CONTEXT_NOTE = {
  generalAdultRange:
    "Bu aralık gebe olmayan yetişkinler için. Gebelikte normal değerler farklı olabilir — doktoruna sor.",
  hcg:
    "Gebelikte hCG değerleri haftaya göre çok geniş bir aralıkta değişir; tek ölçüm tek başına yorumlanamaz. Aşağıdaki karşılaştırma yalnızca laboratuvarın kendi aralığıyla yapılmıştır."
} as const;

export function isPregnancySensitiveTest(testName: string) {
  return matchesAny(testName, PREGNANCY_SENSITIVE_ALIASES);
}

export function isContextualisableTest(testName: string) {
  return matchesAny(testName, CONTEXTUALISABLE) || matchesAny(testName, HCG_ALIASES);
}

/**
 * A comparison the lab itself printed is authoritative for that lab and that
 * patient group; a marker or a missing range is not.
 */
function usedDocumentRange(value: Pick<DocumentInsightValue, "referenceStatus">) {
  return value.referenceStatus === "below"
    || value.referenceStatus === "within"
    || value.referenceStatus === "above";
}

function referenceMentionsPregnancy(referenceRange: string) {
  return /gebe|gebelik|trimester|hafta|prenatal/i.test(referenceRange);
}

export function applyInterpretationGuard(
  value: DocumentInsightValue,
  context: DocumentInterpretationContext
): DocumentInsightValue {
  const trimesterSensitive = isPregnancySensitiveTest(value.testName);
  const decision = resolveInterpretability(value, context);

  if (decision.level === "explained") {
    return {
      ...value,
      interpretability: "explained",
      notInterpretableReason: "",
      contextNote: "",
      trimesterSensitive
    };
  }

  if (decision.level === "contextual") {
    return {
      ...value,
      interpretability: "contextual",
      notInterpretableReason: "",
      contextNote: decision.note,
      trimesterSensitive,
      plainLanguage: {
        ...value.plainLanguage,
        // The comparison and the definition stay; anything that assigns meaning
        // to the direction of that comparison does not, because the boundary it
        // would be reasoning from is not this reader's boundary.
        possibleMeaning: "",
        symptomContext: []
      }
    };
  }

  const keepsDefinition = decision.reason !== REASON.unknownTest && decision.reason !== REASON.noSource;
  return {
    ...value,
    interpretability: "not_interpretable",
    notInterpretableReason: decision.reason,
    contextNote: "",
    trimesterSensitive,
    plainLanguage: {
      ...value.plainLanguage,
      whatItIs: keepsDefinition ? value.plainLanguage.whatItIs : "",
      possibleMeaning: "",
      symptomContext: [],
      clinicianContext: keepsDefinition ? value.plainLanguage.clinicianContext : "",
      sourceLabel: keepsDefinition ? value.plainLanguage.sourceLabel : "",
      sourceUrl: keepsDefinition ? value.plainLanguage.sourceUrl : ""
    }
  };
}

type Decision =
  | { level: "explained" }
  | { level: "contextual"; note: string }
  | { level: "not_interpretable"; reason: string };

function resolveInterpretability(
  value: DocumentInsightValue,
  context: DocumentInterpretationContext
): Decision {
  if (value.confidence === "low") return suppress(REASON.lowConfidence);
  if (!hasCitableSource(value)) return suppress(REASON.noSource);
  if (value.plainLanguage.sourceUrl === GENERIC_SOURCE_URL) return suppress(REASON.unknownTest);

  const pregnancyPossible = context.pregnancyStatus !== "not_pregnant";
  if (pregnancyPossible && matchesAny(value.testName, NOT_VALID_IN_PREGNANCY)) {
    return suppress(REASON.notValidInPregnancy);
  }

  const hasComparison = usedDocumentRange(value);

  if (pregnancyPossible && isPregnancySensitiveTest(value.testName)) {
    // A range the report itself marked as a pregnancy range is authoritative.
    if (referenceMentionsPregnancy(value.referenceRange)) return { level: "explained" };

    // hCG never earns a verdict in pregnancy, even against a printed range:
    // what matters clinically is the change over ~48 hours, not the level.
    if (matchesAny(value.testName, HCG_ALIASES)) {
      return hasComparison
        ? { level: "contextual", note: CONTEXT_NOTE.hcg }
        : suppress(REASON.pregnancySensitive);
    }

    // The report printed a general adult range and we compared against it. Show
    // that comparison, labelled for what it is.
    if (hasComparison && matchesAny(value.testName, CONTEXTUALISABLE)) {
      return { level: "contextual", note: CONTEXT_NOTE.generalAdultRange };
    }

    // Either no comparison at all, or a pregnancy-shifted test we have decided
    // not to contextualise. Nothing honest is left to say.
    return suppress(REASON.pregnancySensitive);
  }

  if (value.referenceStatus === "unclassified" && value.documentMarker === "none") {
    return suppress(REASON.noComparableRange);
  }
  return { level: "explained" };
}

function suppress(reason: string): Decision {
  return { level: "not_interpretable", reason };
}

/** No source, no interpretation — there is no third option. */
export function hasCitableSource(value: Pick<DocumentInsightValue, "plainLanguage">) {
  return Boolean(value.plainLanguage.sourceLabel.trim())
    && /^https:\/\//i.test(value.plainLanguage.sourceUrl ?? "");
}

function matchesAny(testName: string, aliases: string[]) {
  const normalized = normalize(testName);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedAlias.length > 3) return normalized.includes(normalizedAlias);
    return words.includes(normalizedAlias);
  });
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐‑‒–—]/g, "-")
    .trim();
}
