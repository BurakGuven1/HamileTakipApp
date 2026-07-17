import {
  buildOnDeviceDocumentResult,
  compareWithDocumentRange,
  detectSensitiveFieldTypes,
  parseMeasurementLine
} from "../../../features/document-insight/documentRules.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Beklenen ${JSON.stringify(expected)}, alınan ${JSON.stringify(actual)}`);
  }
}

Deno.test("laboratuvar satırını ve belgedeki aralığı cihazda ayrıştırır", () => {
  const value = parseMeasurementLine("Hemoglobin 12,4 g/dL 11,0 - 15,0", 1, 0.96);
  assertEquals(value?.testName, "Hemoglobin");
  assertEquals(value?.result, "12,4");
  assertEquals(value?.unit, "g/dL");
  assertEquals(value?.referenceRange, "11,0 - 15,0");
  assertEquals(value?.referenceStatus, "within");
});

Deno.test("belgede olmayan genel referans aralığını üretmez", () => {
  const value = parseMeasurementLine("TSH 1,25 mIU/L", 1, 1);
  assertEquals(value?.referenceRange, "");
  assertEquals(value?.referenceStatus, "unclassified");
});

Deno.test("kimlik ve idari satırları ölçüm olarak döndürmez", () => {
  assertEquals(parseMeasurementLine("T.C. Kimlik No 12345678901", 1, 1), null);
  assertEquals(parseMeasurementLine("Hasta Adı Ayşe Yılmaz 12345", 1, 1), null);
  assertEquals(parseMeasurementLine("Ayşe Yılmaz 12345", 1, 1), null);
});

Deno.test("kişisel alan kategorilerini değerlerini saklamadan algılar", () => {
  assertEquals(
    detectSensitiveFieldTypes(["Hasta Adı: Ayşe Yılmaz", "T.C. Kimlik No: 12345678901", "Adres: Örnek Mahallesi"]),
    ["name", "tc_identity", "address"]
  );
});

Deno.test("iki uçlu ve tek uçlu belge aralıklarını deterministik karşılaştırır", () => {
  assertEquals(compareWithDocumentRange("3,4", "3,5 - 5,5", "none").status, "below");
  assertEquals(compareWithDocumentRange("4", "<5", "none").status, "within");
  assertEquals(compareWithDocumentRange("7", "≤5", "none").status, "above");
});

Deno.test("sonuç yalnızca cihazda işlendiğini bildirir", () => {
  const result = buildOnDeviceDocumentResult([{ pageNumber: 0, lines: [{ text: "Glukoz 90 mg/dL 70 - 100", confidence: 1, x: 0, y: 0 }] }]);
  assertEquals(result.privacy.processedOnDevice, true);
  assertEquals(result.privacy.sentToOpenAI, false);
  assertEquals(result.privacy.originalStored, false);
  assertEquals(result.values.length, 1);
});
