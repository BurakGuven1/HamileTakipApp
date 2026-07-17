import { Directory, File, Paths } from "expo-file-system";

import { buildOnDeviceDocumentResult } from "@/features/document-insight/documentRules";
import type { OcrPageInput } from "@/features/document-insight/types";

type AnalyzeInput = {
  uri: string;
  mimeType: string;
};

export async function analyzeDocumentOnDevice({ uri, mimeType }: AnalyzeInput) {
  try {
    const ocr = await import("@dariyd/react-native-text-recognition");
    const available = await ocr.isAvailable();
    if (!available) throw new Error("Bu cihazda yerel belge okuma kullanılamıyor.");

    const result = await ocr.recognizeText(uri, {
      languages: ["tr", "en"],
      recognitionLevel: "line",
      maxPages: 12,
      pdfDpi: mimeType === "application/pdf" ? 300 : undefined,
      useFastRecognition: false
    });
    if (!result.success) throw new Error(result.errorMessage || "Belge cihazda okunamadı.");
    const pages = toSafePageLines(result.pages ?? [], result.fullText ?? "");
    return buildOnDeviceDocumentResult(pages);
  } catch (error) {
    if (error instanceof Error && /doesn.t seem to be linked|not using Expo Go|rebuilt the app/i.test(error.message)) {
      throw new Error("Cihaz içi belge okuyucu bu uygulama sürümünde bulunmuyor. Özelliği içeren yeni sürüm kurulmalı.");
    }
    throw error;
  } finally {
    cleanupNativeOcrTemporaryFiles();
  }
}

function toSafePageLines(
  pages: Array<{
    pageNumber: number;
    fullText: string;
    elements: Array<{
      text: string;
      confidence: number;
      boundingBox: { x: number; y: number };
    }>;
  }>,
  fallbackText: string
): OcrPageInput[] {
  if (pages.length) {
    return pages.map((page) => ({
      pageNumber: Number.isInteger(page.pageNumber) ? page.pageNumber : 0,
      lines: page.elements.length
        ? page.elements.map((element) => ({
            text: String(element.text ?? "").slice(0, 500),
            confidence: Number.isFinite(element.confidence) ? element.confidence : 0.5,
            x: Number.isFinite(element.boundingBox?.x) ? element.boundingBox.x : 0,
            y: Number.isFinite(element.boundingBox?.y) ? element.boundingBox.y : 0
          }))
        : page.fullText.split(/\r?\n/).map((text, index) => ({ text: text.slice(0, 500), confidence: 0.7, x: 0, y: index }))
    }));
  }
  return [{
    pageNumber: 0,
    lines: fallbackText.split(/\r?\n/).slice(0, 500).map((text, index) => ({ text: text.slice(0, 500), confidence: 0.5, x: 0, y: index }))
  }];
}

function cleanupNativeOcrTemporaryFiles() {
  try {
    const cache = new Directory(Paths.cache);
    for (const item of cache.list()) {
      if (item instanceof File && /^temp_pdf.*\.pdf$/i.test(item.name)) item.delete();
    }
  } catch {
    // The native reader normally deletes its own PDF copy; this is a defensive cleanup.
  }
}
