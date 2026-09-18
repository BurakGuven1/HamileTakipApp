import type {
  DocumentInsightResult,
  DocumentInsightValue,
  DocumentReferenceStatus,
  MaskedFieldType,
  OcrPageInput
} from "./types.ts";

type Marker = DocumentInsightValue["documentMarker"];
type Knowledge = {
  aliases: string[];
  term: string;
  whatItIs: string;
  within: string;
  below: string;
  above: string;
  lowSymptoms: string[];
  highSymptoms: string[];
  clinicianContext: string;
  sourceLabel: string;
  sourceUrl: string;
};

const SENSITIVE_PATTERNS: Array<{ type: MaskedFieldType; pattern: RegExp }> = [
  { type: "tc_identity", pattern: /(?:t\.?\s*c\.?\s*kimlik|kimlik\s*no|\b[1-9]\d{10}\b)/i },
  { type: "email", pattern: /(?:e-?posta|email|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
  { type: "phone", pattern: /(?:telefon|phone|(?:\+?90\s*)?(?:\(?0?5\d{2}\)?[\s.-]*)\d{3}[\s.-]*\d{2}[\s.-]*\d{2})/i },
  { type: "address", pattern: /(?:adres|address|mahallesi|mah\.|sokak|sok\.|caddesi|cad\.|apartman|daire\s*[:#]?)/i },
  { type: "birth_date", pattern: /(?:doğum\s*tarihi|dogum\s*tarihi|date\s*of\s*birth|d\.?o\.?b)/i },
  { type: "patient_id", pattern: /(?:hasta\s*(?:no|numarası)|patient\s*id|protokol|dosya\s*no|barkod|barcode|pasaport)/i },
  { type: "name", pattern: /(?:ad[ıi]?\s*soyad[ıi]?|hasta\s*ad[ıi]|patient\s*name|isim\s*soyisim)/i }
];

const UNSAFE_OR_HEADER_LABEL = /(?:hasta|patient|ad\s*soyad|isim|kimlik|adres|telefon|phone|e-?posta|email|doğum\s*tarihi|protokol|dosya\s*no|hasta\s*no|barkod|barcode|hekim|doktor|laboratuvar|hastane|klinik|kurum|tarih|date|saat|time|sonuç\s*birim|referans\s*(?:değer|aralık)|test\s*adı|tetkik\s*adı|sayfa|page)/i;
const CATEGORICAL_RESULT = /^(pozitif|negatif|reaktif|nonreaktif|saptandı|saptanmadı|var|yok|eser|normal|anormal)$/i;
const NUMERIC_TOKEN = /(?:^|\s)([<>≤≥~]?\s*-?\d+(?:[.,]\d+)?)(?=\s|$|[*#/])/g;
const STANDALONE_RESULT = /^[<>≤≥~]?\s*-?\d+(?:[.,]\d+)?\s*[*#]?$/;
const KNOWN_UNIT = /(?:^|\s)(10\^\d+\/?[A-Za-zµμ]+|x10\^?\d+\/?[A-Za-zµμ]+|g\/dL|mg\/dL|mg\/L|µg\/dL|ug\/dL|ng\/mL|pg\/mL|mIU\/mL|mIU\/L|IU\/L|U\/L|µIU\/mL|uIU\/mL|mmol\/L|µmol\/L|umol\/L|mEq\/L|fL|pg|mm\/h|mm\/s|cells\/µL|\/µL|\/uL|%|cm|mm|kg|g)(?=\s|$|[*#])/i;
const SAFE_TEST_WORDS = /(?:hemoglobin|hematokrit|eritrosit|alyuvar|lökosit|lokosit|trombosit|nötrofil|notrofil|lenfosit|monosit|eozinofil|bazofil|glukoz|şeker|seker|insülin|insulin|kreatinin|üre|ure|ürik\s*asit|urik\s*asit|sodyum|potasyum|kalsiyum|magnezyum|fosfor|demir|ferritin|folat|vitamin|protein|albumin|bilirubin|kolesterol|trigliserid|triglyceride|lipid|non-?hdl|ldl|hdl|vldl|hba?1c|a1c|tiroid|tsh|t3|t4|hcg|progesteron|estradiol|prolaktin|kortizol|alt|ast|amilaz|lipaz|crp|sedim|koagülasyon|koagulasyon|fibrinojen|d-dimer|idrar|dansite|keton|nitrit|antikor|antijen|hepatit|rubella|toksoplazma|toxoplasma|cmv|hiv|hbsag|anti-hbs|kan\s*grubu|rh)/i;
const SAFE_TEST_ACRONYMS = new Set(["HGB", "HB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "RDW", "MPV", "NEU", "LYM", "MONO", "EOS", "BASO", "TSH", "FT3", "FT4", "T3", "T4", "CRP", "ALT", "AST", "GGT", "ALP", "LDH", "CK", "BUN", "HBA1C", "A1C", "LDL", "HDL", "VLDL", "TG", "TRIG", "CHOL", "INR", "PT", "APTT", "HCG", "BHCG"]);

const KNOWLEDGE: Knowledge[] = [
  knowledge(["beta hcg", "beta-hcg", "β-hcg", "bhcg", "hcg"], "Beta-hCG", "Gebelikte plasenta dokusu tarafından üretilen hCG hormonunun kandaki miktarını gösterir.", "Değer belgenin seçtiği bağlama ait aralıkta görünüyor; tek ölçüm gebeliğin gidişini veya haftasını tek başına göstermez.", "Düşük bir değer; testin zamanı, gebelik haftası ve önceki ölçümlerle birlikte anlam kazanır. Tek başına gebeliğin gidişi hakkında sonuç vermez.", "Yüksek hCG çoğunlukla gebelikle uyumludur; ancak tek değer gebeliğin yerini, sağlıklı ilerleyip ilerlemediğini veya kesin haftayı göstermez.", [], [], "hCG sonucu değerlendirilirken son adet tarihi, testin tekrarı, önceki hCG değerleri ve ultrason bulguları birlikte ele alınır.", "ACOG — Pozitif hCG sonuçları", "https://www.acog.org/clinical/clinical-guidance/clinical-consensus/articles/2026/02/management-of-positive-human-chorionic-gonadotropin-test-results-in-nonpregnant-patients-without-gynecologic-malignancy"),
  knowledge(["progesteron", "progesterone"], "Progesteron", "Adet döngüsünde rahim iç tabakasını gebeliğe hazırlayan, gebelikte de bu dokuyu destekleyen hormondur.", "Belgede seçilen dönem için verilen aralıkta görünüyor. Progesteron gün, döngü ve gebelik haftasına göre belirgin değişebilir.", "Düşük görünmesi tek başına bir neden veya gebeliğin gidişi hakkında kesin sonuç göstermez; ölçüm zamanı önemlidir.", "Yüksek görünmesi gebelik, döngünün dönemi veya kullanılan hormon ilaçları gibi farklı bağlamlarla ilişkili olabilir.", ["Adet düzensizliği", "Sıcak basması", "Uyku güçlüğü"], ["Şişkinlik", "Vajinal kuruluk"], "Sonuç; gebelik durumu, gebelik haftası, adet döngüsünün günü ve kullanılan hormonlarla birlikte değerlendirilir.", "MedlinePlus — Progesterone Test", "https://medlineplus.gov/lab-tests/progesterone-test/"),
  knowledge(["tsh", "tiroid uyarıcı hormon"], "TSH", "Beyindeki hipofiz bezinin tiroid bezine ne kadar çalışacağını bildiren hormondur.", "Belgedeki aralık içinde görünüyor. Bu, yalnızca raporun referansına göre beklenen aralıkta olduğunu anlatır.", "Düşük TSH bazı durumlarda tiroidin hızlı çalışmasıyla ilişkili olabilir; serbest T4/T3 ile birlikte okunur.", "Yüksek TSH bazı durumlarda tiroidin yavaş çalışmasıyla ilişkili olabilir; serbest T4/T3 ile birlikte okunur.", ["Kalp çarpıntısı", "Sıcağa tahammülsüzlük", "Titreme", "Açıklanamayan kilo kaybı"], ["Yorgunluk", "Üşüme", "Kabızlık", "Açıklanamayan kilo artışı"], "Gebelikte hedefler gebelik haftasına göre değişebildiği için TSH, serbest T4 ve klinik bilgiler birlikte değerlendirilir.", "MedlinePlus — TSH Test", "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/"),
  knowledge(["serbest t4", "free t4", "ft4", "tiroksin"], "Serbest T4", "Tiroid bezinin ürettiği ve vücudun enerji kullanımını düzenlemeye yardım eden hormonun kanda serbest dolaşan bölümüdür.", "Belgedeki aralık içinde görünüyor. TSH ile birlikte okunması tiroid işlevi hakkında daha anlamlıdır.", "Düşük serbest T4, özellikle TSH da yüksekse, tiroidin yavaş çalışmasıyla ilişkili olabilir.", "Yüksek serbest T4, özellikle TSH da düşükse, tiroidin hızlı çalışmasıyla ilişkili olabilir.", ["Yorgunluk", "Üşüme", "Kabızlık", "Cilt kuruluğu"], ["Kalp çarpıntısı", "Terleme", "Titreme", "Sıcağa tahammülsüzlük"], "Sonuç TSH, gebelik haftası, kullanılan ilaçlar ve laboratuvarın gebeliğe özel aralıklarıyla birlikte değerlendirilir.", "MedlinePlus — Thyroxine (T4) Test", "https://medlineplus.gov/lab-tests/thyroxine-t4-test/"),
  knowledge(["hemoglobin", "hgb", "hb"], "Hemoglobin", "Alyuvarların oksijeni akciğerlerden dokulara taşıyan proteinidir.", "Belgedeki aralık içinde görünüyor. Bu, raporun kullandığı aralığa göre hemoglobin düşüklüğü veya yüksekliği işaretlenmediği anlamına gelir.", "Düşük hemoglobin kansızlık, demir/B12 eksikliği veya kan kaybı gibi farklı nedenlerle ilişkili olabilir.", "Yüksek hemoglobin sıvı kaybı, sigara, yüksek rakım veya bazı kalp-akciğer durumlarıyla ilişkili olabilir.", ["Yorgunluk", "Güçsüzlük", "Baş dönmesi", "Nefes darlığı", "Solukluk"], ["Baş ağrısı", "Baş dönmesi"], "Hemoglobin; hematokrit, MCV, ferritin ve kişisel durumla birlikte değerlendirilir. Gebelikte laboratuvar aralığı değişebilir.", "MedlinePlus — Hemoglobin Test", "https://medlineplus.gov/lab-tests/hemoglobin-test/"),
  knowledge(["ferritin"], "Ferritin", "Vücudun demir depoları hakkında bilgi veren proteindir; yalnızca o andaki kandaki demiri göstermez.", "Belgedeki aralık içinde görünüyor; bu, laboratuvar aralığına göre demir depolarının düşük veya yüksek işaretlenmediğini anlatır.", "Düşük ferritin çoğunlukla demir depolarının azaldığını düşündürür ve demir eksikliğiyle ilişkili olabilir.", "Yüksek ferritin yalnızca demir fazlalığı demek değildir; enfeksiyon/iltihap, karaciğer sorunları ve başka durumlarla da yükselebilir.", ["Yorgunluk", "Güçsüzlük", "Baş dönmesi", "Nefes darlığı", "Solukluk", "Huzursuz bacak yakınması"], ["Yorgunluk", "Eklem ağrısı", "Karın ağrısı"], "Ferritin; hemoglobin, MCV, serum demiri ve iltihap göstergeleriyle birlikte değerlendirilir. Gebelikte ihtiyaçlar değişebilir.", "MedlinePlus — Ferritin Blood Test", "https://medlineplus.gov/lab-tests/ferritin-blood-test/"),
  knowledge(["wbc", "lökosit", "lokosit", "leukocyte"], "Lökosit (WBC)", "Bağışıklık sisteminde görev alan beyaz kan hücrelerinin sayısını gösterir.", "Belgedeki aralık içinde görünüyor.", "Düşüklük bazı enfeksiyonlar, ilaçlar veya kemik iliğini etkileyen durumlarla ilişkili olabilir.", "Yükseklik enfeksiyon, iltihap, stres ve gebelik gibi pek çok nedenle görülebilir.", ["Sık enfeksiyon", "Ateş"], ["Ateş", "Enfeksiyon veya iltihaba ait yakınmalar"], "Gebelikte lökosit sayısı doğal olarak değişebildiği için alt hücre grupları ve belirtilerle birlikte değerlendirilir.", "MedlinePlus — White Blood Count", "https://medlineplus.gov/lab-tests/white-blood-count-wbc/"),
  knowledge(["platelet", "plt", "trombosit"], "Trombosit (PLT)", "Kanın pıhtı oluşturmasına yardım eden hücre parçacıklarının sayısını gösterir.", "Belgedeki aralık içinde görünüyor.", "Düşüklük kolay morarma veya kanama eğilimiyle ilişkili olabilir; derecesi ve diğer kan değerleri önemlidir.", "Yükseklik geçici iltihap, demir eksikliği veya başka durumlarla ilişkili olabilir.", ["Kolay morarma", "Burun veya diş eti kanaması", "Noktasal cilt kanamaları"], ["Çoğu zaman belirti vermeyebilir"], "Trombosit sonucu hemogramın diğer bölümleri, gebelik haftası ve önceki sonuçlarla birlikte değerlendirilir.", "MedlinePlus — Platelet Tests", "https://medlineplus.gov/lab-tests/platelet-tests/"),
  knowledge(["glucose", "glukoz", "kan şekeri", "kan sekeri"], "Glukoz", "Vücudun temel enerji kaynaklarından olan kan şekerinin ölçümüdür.", "Belgedeki aralık içinde görünüyor; açlık/tokluk durumu yine de sonucun anlamını etkiler.", "Düşük glukoz terleme, titreme, çarpıntı veya sersemlikle ilişkili olabilir.", "Yüksek glukoz geçici olabileceği gibi şeker metabolizmasıyla ilgili bir durumu da düşündürebilir.", ["Terleme", "Titreme", "Çarpıntı", "Sersemlik"], ["Çok susama", "Sık idrara çıkma", "Yorgunluk", "Bulanık görme"], "Örneğin açlıkta mı alındığı, gebelik haftası ve gerekirse gebeliğe özel tarama testleriyle birlikte değerlendirilir.", "MedlinePlus — Blood Glucose Test", "https://medlineplus.gov/lab-tests/blood-glucose-test/"),
  knowledge(["hba1c", "hb a1c", "a1c", "glikozile hemoglobin", "glycated hemoglobin"], "HbA1c", "Son yaklaşık 2–3 aydaki ortalama kan şekeri düzeyi hakkında bilgi veren ölçümdür.", "Belgedeki aralık içinde görünüyor. Gebelikte ve alyuvarları etkileyen durumlarda HbA1c'nin anlamı değişebilir.", "Düşük HbA1c çoğunlukla tek başına bir hastalık göstermez; kansızlık veya alyuvar ömrünü değiştiren durumlar sonucu etkileyebilir.", "Yüksek HbA1c son aylardaki ortalama kan şekerinin yüksek olabileceğini düşündürür; tek sonuçla tanı konmaz.", [], ["Çok susama", "Sık idrara çıkma", "Yorgunluk", "Bulanık görme"], "HbA1c gebelik şekeri tanısı için kullanılmaz; gebelik durumu, kan sayımı ve glukoz testleriyle birlikte değerlendirilir.", "MedlinePlus — Hemoglobin A1C Test", "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/"),
  knowledge(["ldl kolesterol", "ldl cholesterol", "ldl-c", "ldl"], "LDL kolesterol", "Kolesterolü dokulara taşıyan parçacıktır. Kandaki LDL arttıkça damar duvarında birikme riski artabilir.", "Belgedeki hedef veya referans koşulunu karşılıyor. LDL için daha düşük değerler genellikle kalp-damar sağlığı açısından daha olumludur.", "Düşük LDL çoğu durumda ayrıca bir sorun göstermez; kişisel durum yine de önemlidir.", "Yüksek LDL zaman içinde damar duvarında plak birikimi ve kalp-damar riskiyle ilişkili olabilir.", [], ["Yüksek LDL çoğu zaman belirti vermez"], "LDL hedefi yaş, tansiyon, diyabet, sigara kullanımı, aile öyküsü ve mevcut kalp-damar hastalığına göre kişiye özel değişir.", "MedlinePlus — Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
  knowledge(["hdl kolesterol", "hdl cholesterol", "hdl-c", "hdl"], "HDL kolesterol", "Fazla kolesterolün karaciğere taşınmasına yardım eden parçacıktır. HDL için daha yüksek değerler genellikle daha olumlu kabul edilir.", "Belgedeki hedef veya referans koşulunu karşılıyor.", "Düşük HDL, diğer risk etkenleriyle birlikte kalp-damar riskinin artmasıyla ilişkili olabilir.", "Yüksek HDL çoğunlukla olumlu kabul edilir; ancak tek başına genel kalp-damar riskini belirlemez.", ["Düşük HDL çoğu zaman belirti vermez"], [], "HDL; LDL, trigliserid, total kolesterol ve diğer kişisel kalp-damar riskleriyle birlikte değerlendirilir.", "MedlinePlus — Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
  knowledge(["non-hdl", "non hdl"], "Non-HDL kolesterol", "Total kolesterolden HDL çıkarılarak hesaplanan ve damar duvarında birikebilen kolesterol taşıyıcılarını topluca gösteren değerdir.", "Belgedeki hedef veya referans koşulunu karşılıyor.", "Düşük non-HDL çoğu durumda ayrıca bir sorun göstermez.", "Yüksek non-HDL, diğer risk etkenleriyle birlikte kalp-damar riskinin artmasıyla ilişkili olabilir.", [], ["Yüksek non-HDL çoğu zaman belirti vermez"], "Sonuç LDL, HDL, trigliserid ve kişisel kalp-damar riskleriyle birlikte değerlendirilir.", "MedlinePlus — Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
  knowledge(["total kolesterol", "toplam kolesterol", "total cholesterol", "kolesterol total", "kolesterol"], "Total kolesterol", "Kandaki farklı kolesterol taşıyıcılarının toplam miktarını gösterir.", "Belgedeki aralık veya hedef içinde görünüyor.", "Düşük total kolesterol çoğu zaman tek başına bir sorun göstermez; diğer lipid değerleri daha açıklayıcıdır.", "Yüksek total kolesterol, özellikle LDL de yüksekse, kalp-damar riskiyle ilişkili olabilir.", [], ["Yüksek kolesterol çoğu zaman belirti vermez"], "Total kolesterol tek başına değil; LDL, HDL, trigliserid ve kişisel risk etkenleriyle birlikte değerlendirilir.", "MedlinePlus — Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
  knowledge(["trigliserid", "triglyceride", "triglycerides", "trig", "tg"], "Trigliserid", "Vücudun enerji için kullandığı ve fazlasını yağ hücrelerinde depoladığı kandaki bir yağ türüdür.", "Belgedeki aralık içinde görünüyor. Açlık durumu sonucu etkileyebilir.", "Düşük trigliserid çoğu zaman ayrıca bir sorun göstermez.", "Yüksek trigliserid kalp-damar ve metabolik risklerle ilişkili olabilir; çok yüksek düzeylerde pankreas iltihabı riski de artabilir.", [], ["Yüksek trigliserid çoğu zaman belirti vermez"], "Sonuç açlık durumu, glukoz/HbA1c, tiroid, karaciğer değerleri, LDL ve HDL ile birlikte değerlendirilir.", "MedlinePlus — Triglycerides Test", "https://medlineplus.gov/lab-tests/triglycerides-test/"),
  knowledge(["crp", "c reaktif protein"], "CRP", "Vücutta iltihap olduğunda yükselebilen, ancak iltihabın nedenini veya yerini tek başına göstermeyen bir proteindir.", "Belgedeki aralık içinde görünüyor.", "CRP için düşük sonuç genellikle ayrıca bir sorun anlamına gelmez.", "Yüksek CRP enfeksiyon veya başka bir iltihabi süreçle ilişkili olabilir; tek başına nedeni göstermez.", [], ["Ateş", "Halsizlik", "Altta yatan duruma göre değişen yakınmalar"], "CRP belirtiler, muayene ve diğer testlerle birlikte değerlendirilir.", "MedlinePlus — C-Reactive Protein Test", "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/"),
  knowledge(["kreatinin", "creatinine"], "Kreatinin", "Kasların normal çalışması sırasında oluşan ve böbrekler yoluyla atılan bir atık maddedir.", "Belgedeki aralık içinde görünüyor.", "Düşük kreatinin çoğu zaman düşük kas kütlesi veya gebelikteki fizyolojik değişikliklerle ilişkili olabilir.", "Yüksek kreatinin böbreklerin süzme işlevindeki değişikliklerle veya sıvı kaybıyla ilişkili olabilir.", [], ["Şişlik", "İdrar miktarında değişiklik", "Yorgunluk"], "Kreatinin eGFR, idrar sonuçları, kas yapısı ve gebelik durumu dikkate alınarak değerlendirilir.", "MedlinePlus — Creatinine Test", "https://medlineplus.gov/lab-tests/creatinine-test/"),
  knowledge(["alt", "alanin aminotransferaz", "sgpt"], "ALT", "Özellikle karaciğer hücrelerinde bulunan bir enzimin kandaki düzeyidir.", "Belgedeki aralık içinde görünüyor.", "Düşük ALT çoğunlukla tek başına klinik bir sorun göstermez.", "Yüksek ALT karaciğer hücrelerinde etkilenme olabileceğini gösterebilir; nedeni tek başına belirlemez.", [], ["Çoğu zaman belirti vermeyebilir", "Bulantı", "Karın sağ üst bölümünde rahatsızlık", "Sarılık"], "ALT; AST ve diğer karaciğer testleri, ilaçlar ve belirtilerle birlikte değerlendirilir.", "MedlinePlus — ALT Blood Test", "https://medlineplus.gov/lab-tests/alt-blood-test/"),
  knowledge(["ast", "aspartat aminotransferaz", "sgot"], "AST", "Karaciğerin yanı sıra kas ve başka dokularda da bulunan bir enzimin kandaki düzeyidir.", "Belgedeki aralık içinde görünüyor.", "Düşük AST çoğunlukla tek başına klinik bir sorun göstermez.", "Yüksek AST karaciğer veya kas gibi farklı dokularla ilişkili olabilir; tek başına kaynağını göstermez.", [], ["Altta yatan duruma göre değişir"], "AST; ALT, diğer karaciğer testleri, kas yakınmaları ve kullanılan ilaçlarla birlikte değerlendirilir.", "MedlinePlus — AST Test", "https://medlineplus.gov/lab-tests/ast-test/")
];

export function buildOnDeviceDocumentResult(pages: OcrPageInput[]): DocumentInsightResult {
  const allText = pages.flatMap((page) => [page.fullText ?? "", ...page.lines.map((line) => line.text)]);
  const maskedFieldTypes = detectSensitiveFieldTypes(allText);
  const parsed = pages.flatMap(extractMeasurementsFromPage);
  const values = deduplicateValues(parsed).slice(0, 100).map((value) => ({
    ...value,
    plainLanguage: buildPlainLanguage(value)
  }));
  const glossaryItems = KNOWLEDGE
    .filter((term) => values.some((value) => matchesKnowledge(value.testName, term)))
    .map(({ aliases: _aliases, within: _within, below: _below, above: _above, lowSymptoms: _lowSymptoms, highSymptoms: _highSymptoms, clinicianContext: _clinicianContext, whatItIs: explanation, ...term }) => ({
      term: term.term,
      explanation,
      sourceLabel: term.sourceLabel,
      sourceUrl: term.sourceUrl
    }));
  const flagged = values.filter(isFlagged);
  const doctorQuestions = flagged.slice(0, 5).map(
    (value) => `${value.testName} sonucum değerlendirilirken gebelik haftam, belirtilerim ve diğer hangi sonuçlar birlikte ele alınmalı?`
  );
  if (!doctorQuestions.length && values.length) {
    doctorQuestions.push("Bu sonuçlar gebelik veya doğum sonrası dönemime göre değerlendirilirken hangi bilgiler dikkate alınmalı?");
  }

  return {
    documentType: values.length ? "lab_report" : "other",
    readability: values.length ? "readable" : pages.some((page) => page.lines.length || page.fullText?.trim()) ? "partially_readable" : "unreadable",
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
    safetyNotice: "Bu ekran belgedeki sonucu ve laboratuvarın kendi referans bilgisini anlaşılır dile çevirir. Genel bilgiler tanı koymaz; gebeliğin durumu, aciliyet, tedavi, ilaç veya doz önerisi üretmez. Kesin değerlendirme kişisel öykü, muayene ve diğer sonuçlarla sağlık profesyoneli tarafından yapılır."
  };
}

export function extractMeasurementsFromPage(page: OcrPageInput): DocumentInsightValue[] {
  const ordered = page.lines
    .filter((line) => line.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const visualRows = mergeVisualRows(ordered);
  const fullTextLines = (page.fullText ?? "").split(/\r?\n/).map(cleanLine).filter(Boolean);
  const orderedFragments = ordered.flatMap((line) => line.text.split(/\r?\n/).map(cleanLine).filter(Boolean));
  const candidates = [...visualRows, ...ordered.map((line) => line.text)];
  const direct = candidates
    .map((line) => parseMeasurementLine(line, page.pageNumber + 1, averageConfidence(ordered)))
    .filter((value): value is DocumentInsightValue => Boolean(value));
  const sequential = [fullTextLines, orderedFragments]
    .flatMap((lines) => parseSequentialMeasurements(lines, page.pageNumber + 1, averageConfidence(ordered)));
  return deduplicateValues([...direct, ...sequential]);
}

export function parseMeasurementLine(rawLine: string, pageNumber: number, ocrConfidence = 1): DocumentInsightValue | null {
  const line = cleanLine(rawLine).slice(0, 500);
  if (!line || line.length < 4 || SENSITIVE_PATTERNS.some(({ pattern }) => pattern.test(line))) return null;

  const categorical = line.match(/^(.{2,100}?)\s+(Pozitif|Negatif|Reaktif|Nonreaktif|Saptandı|Saptanmadı|Var|Yok|Eser|Normal|Anormal)(?:\s|$)/i);
  if (categorical) {
    const testName = cleanTestName(categorical[1] ?? "");
    const categoricalResult = categorical[2] ?? "";
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
  const referenceRange = extractReferenceText([afterResult]);
  const unit = extractUnit(line);
  const marker = detectMarker(afterResult);
  const comparison = compareWithDocumentRange(rawResult, referenceRange, marker);
  return makeValue(testName, rawResult, unit, referenceRange, marker, ocrConfidence, pageNumber, comparison);
}

export function compareWithDocumentRange(resultText: string, rangeText: string, marker: Marker): { status: DocumentReferenceStatus; explanation: string } {
  const value = parseLocaleNumber(resultText);
  const range = rangeText.trim();
  const hasMultipleContextualRanges = range.includes(";");
  if (marker !== "none" && hasMultipleContextualRanges) {
    return {
      status: "document_marked",
      explanation: markerExplanation(marker, range)
    };
  }
  if (value !== null && range) {
    const between = range.match(/(?:^|:\s*)(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|ile)\s*(-?\d+(?:[.,]\d+)?)(?:\s|$)/i);
    if (between) {
      const min = parseLocaleNumber(between[1]);
      const max = parseLocaleNumber(between[2]);
      if (min !== null && max !== null) {
        if (value < min) return { status: "below", explanation: `Belgedeki ${range} referans aralığının altında görünüyor.` };
        if (value > max) return { status: "above", explanation: `Belgedeki ${range} referans aralığının üstünde görünüyor.` };
        return { status: "within", explanation: `Belgedeki ${range} referans aralığının içinde görünüyor.` };
      }
    }
    const limit = range.match(/(?:^|:\s*)(<=|≥|>=|≤|<|>)\s*(-?\d+(?:[.,]\d+)?)(?:\s|$)/);
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
  if (marker !== "none") return { status: "document_marked", explanation: markerExplanation(marker, range) };
  return { status: "unclassified", explanation: range ? "Sonuç ve bağlama göre değişen referans bilgisi otomatik olarak karşılaştırılmadı." : "Bu satır için belgede referans aralığı görünmüyor." };
}

export function detectSensitiveFieldTypes(lines: string[]) {
  const detected = new Set<MaskedFieldType>();
  for (const line of lines) {
    for (const item of SENSITIVE_PATTERNS) if (item.pattern.test(line)) detected.add(item.type);
  }
  return [...detected];
}

function parseSequentialMeasurements(lines: string[], pageNumber: number, confidence: number) {
  const values: DocumentInsightValue[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const testName = cleanTestName(lines[index] ?? "");
    if (!isLikelyStandaloneTestName(testName)) continue;
    let end = Math.min(lines.length, index + 9);
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      if (isLikelyStandaloneTestName(cleanTestName(lines[cursor] ?? ""))) {
        end = cursor;
        break;
      }
    }
    const parts = lines.slice(index + 1, end);
    const resultIndex = parts.findIndex((part) => STANDALONE_RESULT.test(part) || CATEGORICAL_RESULT.test(part));
    if (resultIndex < 0) continue;
    const result = parts[resultIndex]?.replace(/\s*[*#]\s*$/, "") ?? "";
    const context = parts.slice(resultIndex + 1);
    const unit = context.map(extractUnit).find(Boolean) ?? "";
    const marker = context.map(detectMarker).find((item) => item !== "none") ?? "none";
    const referenceRange = extractReferenceText(context);
    const comparison = compareWithDocumentRange(result, referenceRange, marker);
    values.push(makeValue(testName, result, unit, referenceRange, marker, confidence, pageNumber, comparison));
    index += resultIndex;
  }
  return values;
}

function mergeVisualRows(lines: OcrPageInput["lines"]) {
  const groups: Array<{ center: number; height: number; items: OcrPageInput["lines"] }> = [];
  for (const line of lines) {
    const height = line.height && line.height > 0 ? line.height : 0.012;
    const center = line.y + height / 2;
    const previous = groups.at(-1);
    const tolerance = Math.max(0.006, Math.min(0.025, height * 0.65, (previous?.height ?? height) * 0.65));
    if (previous && Math.abs(previous.center - center) <= tolerance) {
      previous.items.push(line);
      previous.center = previous.items.reduce((sum, item) => sum + item.y + (item.height ?? height) / 2, 0) / previous.items.length;
      previous.height = Math.max(previous.height, height);
    } else {
      groups.push({ center, height, items: [line] });
    }
  }
  return groups.map((group) => group.items.sort((a, b) => a.x - b.x).map((line) => cleanLine(line.text)).filter(Boolean).join(" "));
}

function extractReferenceText(parts: string[]) {
  const references = parts
    .map((part) => cleanLine(part)
      .replace(KNOWN_UNIT, "")
      .replace(/(?:^|\s)(?:YÜKSEK|HIGH|DÜŞÜK|LOW|NORMAL|ANORMAL|ABN)(?:\s|$)/gi, " ")
      .trim())
    .filter((part) => {
      if (!part) return false;
      if (/^(?:<|>|<=|>=|≤|≥)\s*-?\d+(?:[.,]\d+)?$/.test(part)) return true;
      if (/^-?\d+(?:[.,]\d+)?\s*(?:-|–|—|ile)\s*-?\d+(?:[.,]\d+)?$/i.test(part)) return true;
      return /(?:referans|gebe|gebelik|trimester|hafta|erkek|kadın|çocuk|yaş)\b.*(?:<|>|≤|≥|\d\s*(?:-|–|—|ile)\s*\d)/i.test(part);
    });
  return [...new Set(references)].join("; ").slice(0, 240);
}

function extractUnit(value: string) {
  return value.match(KNOWN_UNIT)?.[1] ?? "";
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
  const base = {
    testName,
    result,
    unit,
    referenceRange,
    documentMarker: marker,
    confidence: ocrConfidence < 0.65 ? "low" as const : referenceRange || CATEGORICAL_RESULT.test(result) ? "high" as const : "medium" as const,
    pageNumber,
    referenceStatus: comparison.status,
    referenceExplanation: comparison.explanation
  };
  return { ...base, plainLanguage: buildPlainLanguage(base as DocumentInsightValue) };
}

function buildPlainLanguage(value: DocumentInsightValue): DocumentInsightValue["plainLanguage"] {
  const item = KNOWLEDGE.find((candidate) => matchesKnowledge(value.testName, candidate));
  const resultSummary = buildResultSummary(value);
  if (!item) {
    return {
      whatItIs: "Bu test için cihazdaki güvenilir açıklama sözlüğünde henüz ayrıntılı bir tanım bulunmuyor.",
      resultSummary,
      possibleMeaning: "Sonucun anlamı örnek türüne, ölçüm yöntemine, laboratuvar aralığına ve kişisel duruma göre değişebilir.",
      symptomContext: [],
      clinicianContext: "Bu değer diğer sonuçlar, belirtiler ve kişisel sağlık bilgileriyle birlikte değerlendirilir.",
      sourceLabel: "MedlinePlus — Laboratuvar testlerini anlama",
      sourceUrl: "https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/"
    };
  }
  const direction = effectiveDirection(value);
  const possibleMeaning = isHcg(item)
    ? buildHcgMeaning(value, item, direction)
    : item.term === "HbA1c"
      ? buildHba1cMeaning(value, item, direction)
      : direction === "below"
        ? item.below
        : direction === "above"
          ? item.above
          : direction === "within"
            ? item.within
            : "Belgede bu sonuç için güvenle karşılaştırılabilen bir yön bulunmadı. Testin anlamı laboratuvar yöntemi ve kişisel durumla birlikte değerlendirilir.";
  return {
    whatItIs: item.whatItIs,
    resultSummary,
    possibleMeaning,
    symptomContext: direction === "below" ? item.lowSymptoms : direction === "above" ? item.highSymptoms : [],
    clinicianContext: item.clinicianContext,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl
  };
}

function buildResultSummary(value: Pick<DocumentInsightValue, "referenceStatus" | "referenceRange" | "documentMarker">) {
  if (value.referenceStatus === "within") return "Sonucunuz, bu belgede yazan referans aralığının içinde görünüyor. Bu ifade yalnızca rapordaki aralıkla yapılan karşılaştırmadır.";
  if (value.referenceStatus === "below") return "Sonucunuz, bu belgede yazan referans aralığının altında görünüyor.";
  if (value.referenceStatus === "above") return "Sonucunuz, bu belgede yazan referans aralığının üstünde görünüyor.";
  if (value.documentMarker === "high") return "Laboratuvar bu sonucu “yüksek” olarak işaretlemiş. Birden fazla bağlama ait aralık varsa otomatik olarak tek bir aralık seçilmedi.";
  if (value.documentMarker === "low") return "Laboratuvar bu sonucu “düşük” olarak işaretlemiş.";
  if (value.documentMarker === "normal") return "Laboratuvar bu sonucu “normal” olarak işaretlemiş.";
  return value.referenceRange ? "Belgede referans bilgisi var, ancak bağlama göre değiştiği için sonuç otomatik olarak tek bir aralıkla karşılaştırılmadı." : "Belgede bu sonuç için güvenle okunabilen bir referans aralığı bulunamadı.";
}

function buildHcgMeaning(value: DocumentInsightValue, item: Knowledge, direction: "below" | "above" | "within" | "unknown") {
  const numeric = parseLocaleNumber(value.result);
  if (numeric === null || !/(?:mIU\/mL|IU\/L)/i.test(value.unit)) return direction === "below" ? item.below : direction === "above" ? item.above : item.within;
  if (numeric < 5) return "Serum hCG için 5'in altındaki değerler çoğu laboratuvarda gebelik olmayan aralıkla uyumludur. Çok erken test zamanı ve laboratuvar yöntemi yine de sonucu etkileyebilir.";
  if (numeric <= 25) return "Bu değer 5–25 arasındaki sınır bölgededir. Tek ölçümle gebelik hakkında kesin sonuç kurulmaz; zaman içindeki değişim ve klinik bilgiler önemlidir.";
  return "25'in üzerindeki serum hCG değerleri genellikle gebelikle uyumludur. Yine de tek bir hCG değeri gebeliğin yerini, sağlıklı ilerleyip ilerlemediğini veya kesin haftayı göstermez.";
}

function buildHba1cMeaning(value: DocumentInsightValue, item: Knowledge, direction: "below" | "above" | "within" | "unknown") {
  const numeric = parseLocaleNumber(value.result);
  if (numeric === null || value.unit !== "%") return direction === "below" ? item.below : direction === "above" ? item.above : direction === "within" ? item.within : "HbA1c son 2–3 aylık ortalama kan şekeri hakkında bilgi verir; belgedeki referans bilgisi okunamadığı için bu sonuç sınıflandırılmadı.";
  if (numeric < 5.7) return "Gebelik dışındaki yetişkin taramalarında %5,7'nin altı genellikle beklenen aralık kabul edilir. Bu sınır gebelik şekeri tanısı için kullanılmaz.";
  if (numeric < 6.5) return "Gebelik dışındaki yetişkin taramalarında %5,7–6,4 arası prediyabet aralığı olarak kullanılır. Bu ifade tek başına tanı değildir ve gebelik şekeri değerlendirmesinde kullanılmaz.";
  return "Gebelik dışındaki yetişkin taramalarında %6,5 ve üzeri diyabet aralığı olarak kullanılır; tanı çoğu zaman ek veya tekrarlanan testlerle doğrulanır. Bu sınır gebelik şekeri tanısı için kullanılmaz.";
}

function effectiveDirection(value: Pick<DocumentInsightValue, "referenceStatus" | "documentMarker">) {
  if (value.referenceStatus === "below" || value.documentMarker === "low") return "below" as const;
  if (value.referenceStatus === "above" || value.documentMarker === "high") return "above" as const;
  if (value.referenceStatus === "within" || value.documentMarker === "normal") return "within" as const;
  return "unknown" as const;
}

function markerExplanation(marker: Marker, range: string) {
  const label = marker === "high" ? "yüksek" : marker === "low" ? "düşük" : marker === "normal" ? "normal" : "anormal";
  return `Laboratuvar bu sonucu “${label}” olarak işaretlemiş.${range ? " Belgede bağlama göre değişen referans bilgileri bulunuyor." : ""}`;
}

function isFlagged(value: DocumentInsightValue) {
  return value.referenceStatus === "below" || value.referenceStatus === "above" || (value.referenceStatus === "document_marked" && value.documentMarker !== "normal");
}

function isLikelyStandaloneTestName(value: string) {
  if (!isSafeTestName(value) || value.length > 70) return false;
  if (/^(?:not|açıklama|yorum)\b|\b(?:değeri|sonucu|saptanmıştır|başvurunuz)\b/i.test(value)) return false;
  const withoutTestDigits = value.replace(/\b(?:T3|T4|FT3|FT4|B12|D3|HBA1C)\b/gi, "");
  return !/\d+(?:[.,]\d+)?/.test(withoutTestDigits);
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
  const raw = match[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}\.\d{3}$/.test(raw)
      ? raw.replace(".", "")
      : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function deduplicateValues(values: DocumentInsightValue[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${normalizeTerm(value.testName)}|${value.result}|${value.pageNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function averageConfidence(lines: OcrPageInput["lines"]) {
  if (!lines.length) return 0.5;
  return lines.reduce((sum, line) => sum + (Number.isFinite(line.confidence) ? line.confidence : 0.5), 0) / lines.length;
}

function matchesKnowledge(testName: string, item: Knowledge) {
  const normalized = normalizeTerm(testName);
  return item.aliases.some((alias) => {
    const normalizedAlias = normalizeTerm(alias);
    if (normalizedAlias.length > 3) return normalized.includes(normalizedAlias);
    return normalized === normalizedAlias || normalized.split(/[^a-z0-9çğıöşü]+/i).includes(normalizedAlias);
  });
}

function isHcg(item: Knowledge) {
  return item.term === "Beta-hCG";
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTerm(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‐‑‒–—]/g, "-");
}

function knowledge(
  aliases: string[],
  term: string,
  whatItIs: string,
  within: string,
  below: string,
  above: string,
  lowSymptoms: string[],
  highSymptoms: string[],
  clinicianContext: string,
  sourceLabel: string,
  sourceUrl: string
): Knowledge {
  return { aliases, term, whatItIs, within, below, above, lowSymptoms, highSymptoms, clinicianContext, sourceLabel, sourceUrl };
}
