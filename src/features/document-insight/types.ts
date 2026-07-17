export type DocumentReferenceStatus =
  | "below"
  | "within"
  | "above"
  | "document_marked"
  | "unclassified";

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
  values: DocumentInsightValue[];
  glossary: Array<{
    term: string;
    explanation: string;
    sourceLabel: string;
    sourceUrl: string;
  }>;
  doctorQuestions: string[];
  privacy: {
    originalStored: false;
    resultStored: false;
    identifiersReturned: false;
    processedOnDevice: true;
    sentToOpenAI: false;
  };
  safetyNotice: string;
};

export type OcrPageInput = {
  pageNumber: number;
  lines: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
  }>;
};
