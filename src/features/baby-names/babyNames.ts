export type BabyNameGender = "girl" | "boy";
export type BabyNameSelection = BabyNameGender | "surprise";
export type BabyNameKind = "single" | "double";

export type BabyNameRecord = {
  gender: BabyNameGender;
  id: string;
  kind: BabyNameKind;
  meaning: string;
  name: string;
};

export type BabyNameDataset = {
  names: BabyNameRecord[];
  sourceTitle: string;
  version: string;
};

type RawName = {
  meaning?: unknown;
  name?: unknown;
  parts?: unknown;
};

type RawNameGroups = {
  boys?: unknown;
  girls?: unknown;
};

type RawBabyNameFile = {
  doubleNames?: RawNameGroups;
  metadata?: {
    title?: unknown;
    version?: unknown;
  };
  singleNames?: RawNameGroups;
};

let datasetPromise: Promise<BabyNameDataset> | null = null;

export function loadBabyNameDataset() {
  datasetPromise ??= import("../../../assets/turkiye_bebek_isimleri.json")
    .then((module) => normalizeBabyNameFile(module.default as RawBabyNameFile))
    .catch((error) => {
      datasetPromise = null;
      throw error;
    });
  return datasetPromise;
}

export function normalizeBabyNameFile(raw: RawBabyNameFile): BabyNameDataset {
  const names = [
    ...normalizeGroup(raw.singleNames?.girls, "girl", "single"),
    ...normalizeGroup(raw.singleNames?.boys, "boy", "single"),
    ...normalizeGroup(raw.doubleNames?.girls, "girl", "double"),
    ...normalizeGroup(raw.doubleNames?.boys, "boy", "double")
  ];

  if (names.length === 0) {
    throw new Error("Bebek isimleri dosyasında kullanılabilir kayıt bulunamadı.");
  }

  const uniqueNames = new Map<string, BabyNameRecord>();
  names.forEach((item) => uniqueNames.set(item.id, item));

  return {
    names: [...uniqueNames.values()],
    sourceTitle:
      typeof raw.metadata?.title === "string"
        ? raw.metadata.title
        : "Türkiye Bebek İsimleri",
    version:
      typeof raw.metadata?.version === "string"
        ? raw.metadata.version
        : "1"
  };
}

export function namesForSelection(
  names: BabyNameRecord[],
  selection: BabyNameSelection
) {
  return selection === "surprise"
    ? names
    : names.filter((item) => item.gender === selection);
}

export function pickUnseenName(
  names: BabyNameRecord[],
  seenIds: Set<string>
) {
  let candidates = names.filter((item) => !seenIds.has(item.id));
  let reset = false;

  if (candidates.length === 0) {
    names.forEach((item) => seenIds.delete(item.id));
    candidates = names;
    reset = true;
  }

  if (candidates.length === 0) return { item: null, reset };
  const item = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  if (item) seenIds.add(item.id);
  return { item, reset };
}

export function scrambleName(name: string) {
  const alphabet = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
  return Array.from(name.toLocaleUpperCase("tr-TR"))
    .map((character) => {
      if (character === " ") return " ";
      return alphabet[Math.floor(Math.random() * alphabet.length)] ?? "A";
    })
    .join("");
}

function normalizeGroup(
  value: unknown,
  gender: BabyNameGender,
  kind: BabyNameKind
) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate): BabyNameRecord[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as RawName;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const meaning = typeof item.meaning === "string" ? item.meaning.trim() : "";
    if (!name || !meaning) return [];

    return [
      {
        gender,
        id: `${gender}:${normalizeNameKey(name)}`,
        kind,
        meaning,
        name
      }
    ];
  });
}

function normalizeNameKey(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/\s+/g, " ");
}
