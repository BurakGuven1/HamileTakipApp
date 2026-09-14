import { Easing } from "react-native-reanimated";

/**
 * Hareket token'ları. Anne+ hareketi dekoratif değil; durum değişimini ve
 * ilerlemeyi anlatır. Süreler kısa tutulur, mesafeler küçüktür.
 */
export const durations = {
  fast: 150,
  base: 250,
  slow: 400
} as const;

export const easings = {
  /** Ekrana giren içerik: hızlı başlar, yumuşak durur. */
  entrance: Easing.bezier(0.22, 1, 0.36, 1),
  /** Ekrandan çıkan içerik. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** İki durum arası geçiş (renk, opaklık). */
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  /** Sürekli tekrar eden yumuşak nabız. */
  pulse: Easing.inOut(Easing.quad)
} as const;

export const springs = {
  /** Basma geri bildirimi: kısa ve sekmesiz. */
  press: { damping: 26, mass: 0.6, stiffness: 420 },
  /** Kart ve liste girişleri. */
  gentle: { damping: 20, mass: 0.9, stiffness: 180 },
  /** Seçili sekme gibi belirgin durum değişimleri. */
  snappy: { damping: 18, mass: 0.7, stiffness: 260 }
} as const;

/** Listelerde ardışık giriş gecikmesi (ms). */
export const stagger = {
  step: 40,
  maxItems: 10
} as const;

/** Giriş animasyonlarının varsayılan kayma mesafesi (px). */
export const distances = {
  sm: 8,
  md: 14,
  lg: 22
} as const;

export const motion = {
  distances,
  durations,
  easings,
  springs,
  stagger
} as const;
