export type DocumentReferenceStatus =
  | "below"
  | "within"
  | "above"
  | "document_marked"
  | "unclassified";

/**
 * How much this app is willing to say about one value. Three levels, in
 * descending confidence:
 *
 * - `explained` — a sourced entry matched, and the reference the comparison
 *   used is valid for *this* reader (either the test does not shift in
 *   pregnancy, or the report printed a pregnancy-specific range).
 * - `contextual` — the test shifts in pregnancy and the report printed only a
 *   general adult range. The lab's own comparison is still shown, because
 *   hiding it entirely helps nobody, but the meaning sentences are dropped and
 *   a visible note says the range is not a pregnancy range.
 * - `not_interpretable` — unreliable OCR, no citable source, unknown test, no
 *   comparable range, or a threshold that is simply invalid in pregnancy.
 *
 * A guessed interpretation is still worse than an honest blank; `contextual`
 * never adds meaning, it only refuses to throw away the lab's own arithmetic.
 */
export type DocumentInterpretability =
  | "explained"
  | "contextual"
  | "not_interpretable";

export type DocumentPregnancyStatus = "pregnant" | "not_pregnant" | "unknown";

export type DocumentInterpretationContext = {
  pregnancyStatus: DocumentPregnancyStatus;
  /** Gestational trimester when it can be derived from the due date. */
  trimester: 1 | 2 | 3 | null;
  /**
   * Gestational week from the last menstrual period, when known. Only tests
   * whose expected values genuinely move week by week (hCG) may use it.
   */
  pregnancyWeek: number | null;
};

/**
 * Graded, so that a value far outside the range and a value that has only just
 * crossed a guideline cut-off do not shout with the same voice.
 *
 * - `soon` — "dikkat": worth showing the doctor at the next visit.
 * - `today` — worth asking the doctor about today.
 * - `urgent` — the reading itself is in a range guidelines treat as needing
 *   same-day in-person assessment. Still never an urgency *verdict*: the card
 *   says where to go, not what is wrong.
 */
export type DocumentRedFlagSeverity = "urgent" | "today" | "soon";

/** Where the number came from. A home cuff is not a lab report. */
export type DocumentRedFlagSource = "lab_document" | "manual_measurement";

export type DocumentRedFlag = {
  id: string;
  testName: string;
  /** Neutral, non-diagnostic statement about what the number looks like. */
  observation: string;
  /** What the user should do. Never a treatment, never an urgency verdict. */
  action: string;
  severity: DocumentRedFlagSeverity;
  /** Defaults to "lab_document"; manual measurements are labelled separately. */
  source: DocumentRedFlagSource;
  sourceLabel: string;
  sourceUrl: string;
};

export type DocumentInsightValue = {
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  documentMarker: "high" | "low" | "normal" | "abnormal" | "none";
  confidence: "high" | "medium" | "low";
  pageNumber: number;
  referenceStatus: DocumentReferenceStatus;
  referenceExplanation: string;
  interpretability: DocumentInterpretability;
  /** Empty unless interpretability is "not_interpretable". */
  notInterpretableReason: string;
  /**
   * Empty unless interpretability is "contextual". A sentence the UI must show
   * next to the comparison, saying whose range the lab actually used.
   */
  contextNote: string;
  /** True when the expected range shifts with pregnancy or gestational week. */
  trimesterSensitive: boolean;
  plainLanguage: {
    whatItIs: string;
    resultSummary: string;
    possibleMeaning: string;
    symptomContext: string[];
    clinicianContext: string;
    sourceLabel: string;
    sourceUrl: string;
  };
};

export type MaskedFieldType =
  | "name"
  | "tc_identity"
  | "address"
  | "phone"
  | "email"
  | "birth_date"
  | "patient_id"
  | "other";

export type DocumentInsightResult = {
  documentType: "lab_report" | "other";
  readability: "readable" | "partially_readable" | "unreadable";
  maskedFieldTypes: MaskedFieldType[];
  context: DocumentInterpretationContext;
  values: DocumentInsightValue[];
  redFlags: DocumentRedFlag[];
  glossary: Array<{
    term: string;
    explanation: string;
    sourceLabel: string;
    sourceUrl: string;
  }>;
  doctorQuestions: string[];
  privacy: {
    /** The picked file and its OCR copy are deleted when the run finishes. */
    originalStored: false;
    /**
     * Nothing is written anywhere by the analysis itself. Values the user later
     * picks by hand in "Sağlık Dosyam'a kaydet" are the only thing that leaves
     * the screen, and only after an explicit consent checkbox.
     */
    resultStored: false;
    identifiersReturned: false;
    processedOnDevice: true;
    sentToOpenAI: false;
  };
  safetyNotice: string;
};

export type OcrPageInput = {
  pageNumber: number;
  fullText?: string;
  lines: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>;
};
