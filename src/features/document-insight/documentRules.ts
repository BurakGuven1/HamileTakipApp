import type {
  DocumentInsightResult,
  DocumentInsightValue,
  DocumentReferenceStatus,
  MaskedFieldType,
  OcrPageInput
} from "./types.ts";

type Marker = DocumentInsightValue["documentMarker"];

const SENSITIVE_PATTERNS: Array<{ type: MaskedFieldType; pattern: RegExp }> = [
  { type: "tc_identity", pattern: /(?:t\.?\s*c\.?\s*kimlik|kimlik\s*no|\b[1-9]\d{10}\b)/i },
  { type: "email", pattern: /(?:e-?posta|email|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
  { type: "phone", pattern: /(?:telefon|phone|(?:\+?90\s*)?(?:\(?0?5\d{2}\)?[\s.-]*)\d{3}[\s.-]*\d{2}[\s.-]*\d{2})/i },
  { type: "address", pattern: /(?:adres|address|mahallesi|mah\.|sokak|sok\.|caddesi|cad\.|apartman|daire\s*[:#]?)/i },
  { type: "birth_date", pattern: /(?:doğum\s*tarihi|dogum\s*tarihi|date\s*of\s*birth|d\.o\.b)/i },
  { type: "patient_id", pattern: /(?:hasta\s*(?:no|numarası)|patient\s*id|protokol|dosya\s*no|barkod|barcode|pasaport)/i },
  { type: "name", pattern: /(?:ad[ıi]?\s*soyad[ıi]?|hasta\s*ad[ıi]|patient\s*name|isim\s*soyisim)/i }
];

const UNSAFE_OR_HEADER_LABEL = /(?:hasta|patient|ad\s*soyad|isim|kimlik|adres|telefon|phone|e-?posta|email|doğum\s*tarihi|protokol|dosya\s*no|hasta\s*no|barkod|barcode|hekim|doktor|laboratuvar|hastane|klinik|kurum|tarih|date|saat|time|sonuç\s*birim|referans\s*(?:değer|aralık)|test\s*adı|tetkik\s*adı|sayfa|page)/i;
const CATEGORICAL_RESULT = /^(pozitif|negatif|reaktif|nonreaktif|saptandı|saptanmadı|var|yok|eser|normal|anormal)$/i;
const NUMERIC_TOKEN = /(?:^|\s)([<>≤≥~]?\s*-?\d+(?:[.,]\d+)?)(?=\s|$|[*#/])/g;
const KNOWN_UNIT = /(?:10\^\d+\/?[A-Za-zµμ]+|x10\^?\d+\/?[A-Za-zµμ]+|g\/dL|mg\/dL|mg\/L|µg\/dL|ug\/dL|ng\/mL|pg\/mL|mIU\/L|IU\/L|U\/L|µIU\/mL|uIU\/mL|mmol\/L|µmol\/L|umol\/L|mEq\/L|fL|pg|mm\/h|mm\/s|cells\/µL|\/µL|\/uL|%|cm|mm|kg|g)\b/i;
const SAFE_TEST_WORDS = /(?:hemoglobin|hematokrit|eritrosit|alyuvar|lökosit|lokosit|trombosit|nötrofil|notrofil|lenfosit|monosit|eozinofil|bazofil|glukoz|şeker|seker|insülin|insulin|kreatinin|üre|ure|ürik\s*asit|urik\s*asit|sodyum|potasyum|kalsiyum|magnezyum|fosfor|demir|ferritin|folat|vitamin|protein|albumin|bilirubin|kolesterol|trigliserid|tiroid|tsh|t3|t4|hcg|progesteron|estradiol|prolaktin|kortizol|alt|ast|amilaz|lipaz|crp|sedim|koagülasyon|koagulasyon|fibrinojen|d-dimer|idrar|dansite|keton|nitrit|antikor|antijen|hepatit|rubella|toksoplazma|toxoplasma|cmv|hiv|hbsag|anti-hbs|kan\s*grubu|rh)/i;
const SAFE_TEST_ACRONYMS = new Set(["HGB", "HB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "RDW", "MPV", "NEU", "LYM", "MONO", "EOS", "BASO", "TSH", "FT3", "FT4", "T3", "T4", "CRP", "ALT", "AST", "GGT", "ALP", "LDH", "CK", "BUN", "HBA1C", "INR", "PT", "APTT", "HCG", "BHCG"]);

const GLOSSARY = [
  glossary(["hemoglobin", "hgb", "hb"], "Hemoglobin", "Alyuvarlarda bulunan ve oksijen taşınmasında görev alan proteindir.", "MedlinePlus — Hemoglobin Test", "https://medlineplus.gov/lab-tests/hemoglobin-test/"),
  glossary(["wbc", "lökosit", "lokosit", "leukocyte"], "Lökosit (WBC)", "Kandaki beyaz kan hücrelerinin sayısını ifade eden ölçümdür.", "MedlinePlus — White Blood Count", "https://medlineplus.gov/lab-tests/white-blood-count-wbc/"),
  glossary(["platelet", "plt", "trombosit"], "Trombosit (PLT)", "Kan pıhtılaşması sürecinde görev alan hücre parçacıklarının sayısını ifade eder.", "MedlinePlus — Platelet Tests", "https://medlineplus.gov/lab-tests/platelet-tests/"),
  glossary(["glucose", "glukoz", "kan şekeri", "kan sekeri"], "Glukoz", "Belgenin alındığı örnekteki glukoz düzeyini gösteren ölçümdür.", "MedlinePlus — Blood Glucose Test", "https://medlineplus.gov/lab-tests/blood-glucose-test/"),
  glossary(["tsh", "tiroid uyarıcı hormon"], "TSH", "Tiroid bezinin çalışmasının düzenlenmesinde rol alan bir hormondur.", "MedlinePlus — TSH Test", "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/"),
  glossary(["ferritin"], "Ferritin", "Demirin vücutta depolanmasıyla ilişkili bir proteindir.", "MedlinePlus — Ferritin Blood Test", "https://medlineplus.gov/lab-tests/ferritin-blood-test/"),
  glossary(["crp", "c reaktif protein"], "CRP", "Kanda ölçülen C-reaktif protein düzeyidir.", "MedlinePlus — C-Reactive Protein Test", "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/"),
  glossary(["alt", "alanin aminotransferaz", "sgpt"], "ALT", "Kanda ölçülebilen alanin aminotransferaz adlı enzimin düzeyidir.", "MedlinePlus — ALT Blood Test", "https://medlineplus.gov/lab-tests/alt-blood-test/"),
  glossary(["ast", "aspartat aminotransferaz", "sgot"], "AST", "Kanda ölçülebilen aspartat aminotransferaz adlı enzimin düzeyidir.", "MedlinePlus — AST Test", "https://medlineplus.gov/lab-tests/ast-test/"),
  glossary(["creatinine", "kreatinin"], "Kreatinin", "Kasların normal çalışması sırasında oluşan ve kanda ölçülebilen bir atık üründür.", "MedlinePlus — Creatinine Test", "https://medlineplus.gov/lab-tests/creatinine-test/"),
  glossary(["beta hcg", "β-hcg", "bhcg"], "Beta-hCG", "Gebelik sırasında plasenta tarafından üretilen hCG hormonunun ölçümüdür.", "MedlinePlus — Pregnancy Test", "https://medlineplus.gov/lab-tests/pregnancy-test/")
] as const;

export function buildOnDeviceDocumentResult(pages: OcrPageInput[]): DocumentInsightResult {
  const maskedFieldTypes = detectSensitiveFieldTypes(pages.flatMap((page) => page.lines.map((line) => line.text)));
  const parsed = pages
    .flatMap((page) =>
      page.lines
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((line) => parseMeasurementLine(line.text, page.pageNumber + 1, line.confidence))
    )
    .filter((value): value is DocumentInsightValue => Boolean(value));
  const values = deduplicateValues(parsed).slice(0, 100);
  const glossaryItems = GLOSSARY
    .filter((term) => values.some((value) => term.aliases.some((alias) => normalizeTerm(value.testName).includes(normalizeTerm(alias)))))
    .map(({ aliases: _aliases, ...term }) => term);
  const flagged = values.filter((value) =>
    value.referenceStatus === "below" ||
    value.referenceStatus === "above" ||
    (value.referenceStatus === "document_marked" && value.documentMarker !== "normal")
  );
  const doctorQuestions = flagged.slice(0, 5).map(
    (value) => `${value.testName} sonucu belgedeki referans bilgisiyle birlikte değerlendirilirken hangi kişisel ve klinik bilgiler dikkate alınmalı?`
  );
  if (!doctorQuestions.length && values.length) {
    doctorQuestions.push("Bu sonuçlar gebelik veya doğum sonrası dönemime göre değerlendirilirken hangi bilgiler dikkate alınmalı?");
  }

  return {
    documentType: values.length ? "lab_report" : "other",
    readability: values.length >= 2 ? "readable" : pages.some((page) => page.lines.length) ? "partially_readable" : "unreadable",
    maskedFieldTypes,
    values,
    glossary: glossaryItems,
    doctorQuestions,
    privacy: {
      originalStored: false,
      resultStored: false,
      identifiersReturned: false,
      processedOnDevice: true,
      sentToOpenAI: false
    },
    safetyNotice: "Bu ekran yalnızca cihazda okunan belge metnini düzenler ve belgenin kendi referans aralıklarıyla mekanik karşılaştırma yapar; teşhis, tıbbi yorum, aciliyet veya tedavi önerisi üretmez."
  };
}

export function parseMeasurementLine(rawLine: string, pageNumber: number, ocrConfidence = 1): DocumentInsightValue | null {
  const line = rawLine.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!line || line.length < 4 || SENSITIVE_PATTERNS.some(({ pattern }) => pattern.test(line))) return null;

  const categorical = line.match(/^(.{2,100}?)\s+(Pozitif|Negatif|Reaktif|Nonreaktif|Saptandı|Saptanmadı|Var|Yok|Eser|Normal|Anormal)(?:\s|$)/i);
  if (categorical) {
    const categoricalName = categorical[1];
    const categoricalResult = categorical[2];
    if (!categoricalName || !categoricalResult) return null;
    const testName = cleanTestName(categoricalName);
    if (!isSafeTestName(testName)) return null;
    const marker: Marker = /anormal/i.test(categoricalResult) ? "abnormal" : /normal/i.test(categoricalResult) ? "normal" : "none";
    const comparison = compareWithDocumentRange(categoricalResult, "", marker);
    return makeValue(testName, categoricalResult, "", "", marker, ocrConfidence, pageNumber, comparison);
  }

  NUMERIC_TOKEN.lastIndex = 0;
  const first = NUMERIC_TOKEN.exec(line);
  if (!first || first.index < 2 || !first[1]) return null;
  const rawResult = first[1].replace(/\s+/g, "");
  const testName = cleanTestName(line.slice(0, first.index));
  if (!isSafeTestName(testName)) return null;

  const afterResult = line.slice(first.index + first[0].length).trim();
  const rangeMatch = afterResult.match(/(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|ile)\s*(-?\d+(?:[.,]\d+)?)/i);
  const limitMatch = afterResult.match(/(?:^|\s)((?:<=|>=|≤|≥|<|>)\s*-?\d+(?:[.,]\d+)?)(?=\s|$)/);
  const referenceRange = rangeMatch ? `${rangeMatch[1]} - ${rangeMatch[2]}` : limitMatch?.[1]?.replace(/\s+/g, "") ?? "";
  const unit = line.match(KNOWN_UNIT)?.[0] ?? "";
  const marker = detectMarker(afterResult);
  const comparison = compareWithDocumentRange(rawResult, referenceRange, marker);
  return makeValue(testName, rawResult, unit, referenceRange, marker, ocrConfidence, pageNumber, comparison);
}

export function compareWithDocumentRange(resultText: string, rangeText: string, marker: Marker): { status: DocumentReferenceStatus; explanation: string } {
  const value = parseLocaleNumber(resultText);
  const range = rangeText.trim();
  if (value !== null && range) {
    const between = range.match(/(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|ile)\s*(-?\d+(?:[.,]\d+)?)/i);
    if (between) {
      const min = parseLocaleNumber(between[1]);
      const max = parseLocaleNumber(between[2]);
      if (min !== null && max !== null) {
        if (value < min) return { status: "below", explanation: `Belgedeki ${range} referans aralığının altında görünüyor.` };
        if (value > max) return { status: "above", explanation: `Belgedeki ${range} referans aralığının üstünde görünüyor.` };
        return { status: "within", explanation: `Belgedeki ${range} referans aralığının içinde görünüyor.` };
      }
    }
    const limit = range.match(/^\s*(<=|≥|>=|≤|<|>)\s*(-?\d+(?:[.,]\d+)?)/);
    if (limit) {
      const boundary = parseLocaleNumber(limit[2]);
      if (boundary !== null) {
        const within = limit[1] === "<" ? value < boundary
          : limit[1] === "<=" || limit[1] === "≤" ? value <= boundary
          : limit[1] === ">" ? value > boundary
          : value >= boundary;
        return within
          ? { status: "within", explanation: `Belgedeki ${range} referans koşulunu karşılıyor.` }
          : { status: value < boundary ? "below" : "above", explanation: `Belgedeki ${range} referans koşulunun dışında görünüyor.` };
      }
    }
  }
  if (marker !== "none") return { status: "document_marked", explanation: "Bu satır belgenin kendisinde ayrıca işaretlenmiş." };
  return { status: "unclassified", explanation: range ? "Sonuç ve referans bilgisi güvenli biçimde sayısal karşılaştırılamadı." : "Bu satır için belgede referans aralığı görünmüyor." };
}

export function detectSensitiveFieldTypes(lines: string[]) {
  const detected = new Set<MaskedFieldType>();
  for (const line of lines) {
    for (const item of SENSITIVE_PATTERNS) if (item.pattern.test(line)) detected.add(item.type);
  }
  return [...detected];
}

function makeValue(
  testName: string,
  result: string,
  unit: string,
  referenceRange: string,
  marker: Marker,
  ocrConfidence: number,
  pageNumber: number,
  comparison: { status: DocumentReferenceStatus; explanation: string }
): DocumentInsightValue {
  return {
    testName,
    result,
    unit,
    referenceRange,
    documentMarker: marker,
    confidence: ocrConfidence < 0.65 ? "low" : referenceRange || CATEGORICAL_RESULT.test(result) ? "high" : "medium",
    pageNumber,
    referenceStatus: comparison.status,
    referenceExplanation: comparison.explanation
  };
}

function cleanTestName(value: string) {
  return value.replace(/^\s*\d+[.)]\s*/, "").replace(/[:;|]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function isSafeTestName(value: string) {
  if (value.length < 2 || value.length > 100 || UNSAFE_OR_HEADER_LABEL.test(value)) return false;
  if ((value.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length < 2) return false;
  if (/\b(?:sn|mr|mrs|bay|bayan)\.?\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/u.test(value)) return false;
  const acronym = value.toLocaleUpperCase("tr-TR").replace(/[^A-Z0-9]/g, "");
  return SAFE_TEST_WORDS.test(value) || SAFE_TEST_ACRONYMS.has(acronym);
}

function detectMarker(value: string): Marker {
  if (/(?:^|\s)(?:H|HIGH|YÜKSEK)(?:\s|$)|↑/i.test(value)) return "high";
  if (/(?:^|\s)(?:L|LOW|DÜŞÜK)(?:\s|$)|↓/i.test(value)) return "low";
  if (/(?:^|\s)(?:ABN|ANORMAL)(?:\s|$)/i.test(value)) return "abnormal";
  if (/(?:^|\s)(?:N|NORMAL)(?:\s|$)/i.test(value)) return "normal";
  return "none";
}

function parseLocaleNumber(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.trim().match(/[<>≤≥~]?\s*(-?\d+(?:[.,]\d+)?)/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function deduplicateValues(values: DocumentInsightValue[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${normalizeTerm(value.testName)}|${value.result}|${value.unit}|${value.referenceRange}|${value.pageNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTerm(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function glossary(aliases: string[], term: string, explanation: string, sourceLabel: string, sourceUrl: string) {
  return { aliases, term, explanation, sourceLabel, sourceUrl };
}
