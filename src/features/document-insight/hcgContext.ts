/**
 * hCG is the test this app is most likely to get wrong, because a single value
 * looks like it means something and does not.
 *
 * Two facts drive everything here:
 *
 * 1. The typical range for a given gestational week spans more than an order of
 *    magnitude, and neighbouring weeks overlap almost completely. A value can
 *    sit inside the "normal" band for week 6 and week 10 at once.
 * 2. What clinicians actually read is the *change* over roughly 48 hours — a
 *    rise of at least about 53% in a viable early intrauterine pregnancy — not
 *    the level. A single measurement cannot establish whether a pregnancy is
 *    viable or where it is located.
 *
 * So in a pregnancy context this module deliberately produces **no verdict**.
 * It shows the week's typical band as information and states, in the same
 * breath, that one measurement cannot be read on its own.
 *
 * Outside pregnancy the 5 / 25 mIU/mL serum cut-offs remain in
 * `documentRules`, where they are clinically reasonable: they describe assay
 * positivity, not the course of a pregnancy.
 *
 * Sources:
 * - β-hCG dynamics in early gestational events, a practical and updated
 *   reappraisal (2024) — https://onlinelibrary.wiley.com/doi/10.1155/2024/8351132
 * - Perinatology.com — beta hCG doubling time reference ranges
 *   https://perinatology.com/calculators/betahCG.htm
 *
 * The bands below are the widely reproduced serum β-hCG ranges by weeks since
 * the last menstrual period. They vary by assay and laboratory, which is why
 * they are presented as "typical", never as a reference range to be compared
 * against.
 */

export type HcgWeekBand = {
  /** Inclusive week bounds, counted from the last menstrual period. */
  fromWeek: number;
  toWeek: number;
  minMilliIuPerMl: number;
  maxMilliIuPerMl: number;
};

export const HCG_SOURCE_LABEL = "β-hCG dinamikleri — güncel derleme (2024)";
export const HCG_SOURCE_URL = "https://onlinelibrary.wiley.com/doi/10.1155/2024/8351132";

const BANDS: HcgWeekBand[] = [
  { fromWeek: 3, toWeek: 3, minMilliIuPerMl: 5, maxMilliIuPerMl: 72 },
  { fromWeek: 4, toWeek: 4, minMilliIuPerMl: 10, maxMilliIuPerMl: 708 },
  { fromWeek: 5, toWeek: 5, minMilliIuPerMl: 217, maxMilliIuPerMl: 8245 },
  { fromWeek: 6, toWeek: 6, minMilliIuPerMl: 152, maxMilliIuPerMl: 32177 },
  { fromWeek: 7, toWeek: 8, minMilliIuPerMl: 4059, maxMilliIuPerMl: 153767 },
  { fromWeek: 9, toWeek: 12, minMilliIuPerMl: 25700, maxMilliIuPerMl: 288000 },
  { fromWeek: 13, toWeek: 16, minMilliIuPerMl: 13300, maxMilliIuPerMl: 254000 },
  { fromWeek: 17, toWeek: 24, minMilliIuPerMl: 4060, maxMilliIuPerMl: 165400 },
  { fromWeek: 25, toWeek: 40, minMilliIuPerMl: 3640, maxMilliIuPerMl: 117000 }
];

/** The sentence that must accompany every hCG value shown to a pregnant user. */
export const HCG_SINGLE_VALUE_CAVEAT =
  "Tek bir hCG ölçümü gebeliğin nasıl ilerlediğini, nerede olduğunu veya kesin haftayı tek başına göstermez. Hekimler bu testi çoğunlukla yaklaşık 48 saat arayla tekrarlayıp değerin nasıl değiştiğine bakar.";

export function findHcgWeekBand(week: number | null): HcgWeekBand | null {
  if (week === null || !Number.isFinite(week)) return null;
  const rounded = Math.floor(week);
  return BANDS.find((band) => rounded >= band.fromWeek && rounded <= band.toWeek) ?? null;
}

/**
 * Information, not a comparison. The returned text never says whether the
 * reader's own value is good, low or high — only what values are typically seen
 * that week, and that one number cannot be read alone.
 */
export function buildHcgPregnancyContext(week: number | null): string {
  const band = findHcgWeekBand(week);
  if (!band) {
    return `Gebelikte hCG değerleri haftadan haftaya çok geniş bir aralıkta değişir ve komşu haftaların aralıkları büyük ölçüde iç içe geçer. ${HCG_SINGLE_VALUE_CAVEAT}`;
  }
  const weekLabel = band.fromWeek === band.toWeek
    ? `${band.fromWeek}. hafta`
    : `${band.fromWeek}–${band.toWeek}. haftalar`;
  return `Son adet tarihine göre ${weekLabel} için yayınlarda bildirilen tipik hCG aralığı yaklaşık ${formatNumber(band.minMilliIuPerMl)}–${formatNumber(band.maxMilliIuPerMl)} mIU/mL'dir. Bu aralık laboratuvara ve yönteme göre değişir ve bir referans aralığı değil, yalnızca bilgidir. ${HCG_SINGLE_VALUE_CAVEAT}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}
