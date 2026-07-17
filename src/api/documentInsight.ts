export { analyzeDocumentOnDevice as analyzeMedicalDocument } from "@/features/document-insight/localDocumentAnalysis";
export type {
  DocumentInsightResult,
  DocumentInsightValue,
  DocumentReferenceStatus,
  MaskedFieldType
} from "@/features/document-insight/types";

export const DOCUMENT_INSIGHT_MAX_BYTES = 8 * 1024 * 1024;
