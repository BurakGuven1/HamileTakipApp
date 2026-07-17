import {
  buildOnDeviceDocumentResult,
  compareWithDocumentRange,
  detectSensitiveFieldTypes,
  extractMeasurementsFromPage,
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

Deno.test("PDF tam metnindeki sütun parçalarını laboratuvar sonuçlarına dönüştürür", () => {
  const fullText = `
Ad Soyad:
TEST HASTA
T.C. Kimlik No:
11111111111
Test Adı
Sonuç
Referans Aralığı
Birim
Durum
Beta-hCG (Kantitatif)
18.450
Gebe değil: < 5
Gebelik 4-5 hafta: 5 - 426
mIU/mL
YÜKSEK
Progesteron
22,4
Gebelik 1. Trimester: 11,2 - 90,0
ng/mL
Normal
TSH
1,85
0,27 - 4,20
mIU/L
Normal
Hemoglobin (Hb)
12,1
11,5 - 15,5
g/dL
Normal
Serbest T4
1,10
0,93 - 1,70
ng/dL
Normal`;
  const result = buildOnDeviceDocumentResult([{
    pageNumber: 0,
    fullText,
    lines: fullText.split("\n").map((text, index) => ({ text, confidence: 0.98, x: 0, y: index / 100 }))
  }]);
  assertEquals(result.values.map((value) => value.testName), ["Beta-hCG (Kantitatif)", "Progesteron", "TSH", "Hemoglobin (Hb)", "Serbest T4"]);
  assertEquals(result.values[0]?.result, "18.450");
  assertEquals(result.values[0]?.unit, "mIU/mL");
  assertEquals(result.values[0]?.referenceStatus, "document_marked");
  assertEquals(result.values[0]?.plainLanguage.possibleMeaning.includes("25'in üzerindeki"), true);
  assertEquals(result.values[1]?.referenceStatus, "within");
  assertEquals(result.readability, "readable");
});

Deno.test("aynı görsel satırdaki ayrı OCR sütunlarını birleştirir", () => {
  const values = extractMeasurementsFromPage({
    pageNumber: 0,
    lines: [
      { text: "Ferritin", confidence: 0.97, x: 0.10, y: 0.40, height: 0.02 },
      { text: "8,2", confidence: 0.97, x: 0.38, y: 0.401, height: 0.02 },
      { text: "15 - 150", confidence: 0.97, x: 0.55, y: 0.399, height: 0.02 },
      { text: "ng/mL", confidence: 0.97, x: 0.75, y: 0.40, height: 0.02 },
      { text: "DÜŞÜK", confidence: 0.97, x: 0.88, y: 0.40, height: 0.02 }
    ]
  });
  assertEquals(values.length, 1);
  assertEquals(values[0]?.testName, "Ferritin");
  assertEquals(values[0]?.referenceStatus, "below");
  assertEquals(values[0]?.plainLanguage.symptomContext.includes("Yorgunluk"), true);
});

Deno.test("lipid panelindeki kısa test adlarını ve yönlerini açıklar", () => {
  const ldl = parseMeasurementLine("LDL 142 mg/dL < 100", 1, 0.99);
  const hdl = parseMeasurementLine("HDL 38 mg/dL > 40", 1, 0.99);
  const triglyceride = parseMeasurementLine("Trigliserid 220 mg/dL 0 - 150", 1, 0.99);
  assertEquals(ldl?.referenceStatus, "above");
  assertEquals(ldl?.plainLanguage.whatItIs.includes("damar"), true);
  assertEquals(hdl?.referenceStatus, "below");
  assertEquals(hdl?.plainLanguage.possibleMeaning.includes("kalp-damar"), true);
  assertEquals(triglyceride?.referenceStatus, "above");
  assertEquals(triglyceride?.plainLanguage.sourceUrl, "https://medlineplus.gov/lab-tests/triglycerides-test/");
});

Deno.test("HbA1c sonucunu tanı koymadan genel tarama aralığıyla açıklar", () => {
  const value = parseMeasurementLine("HbA1c 6,1 %", 1, 0.99);
  assertEquals(value?.testName, "HbA1c");
  assertEquals(value?.plainLanguage.possibleMeaning.includes("prediyabet aralığı"), true);
  assertEquals(value?.plainLanguage.possibleMeaning.includes("tek başına tanı değildir"), true);
  assertEquals(value?.plainLanguage.possibleMeaning.includes("gebelik şekeri"), true);
});
