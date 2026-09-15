import { Easing } from "react-native-reanimated";

/**
 * Hareket token'ları.
 *
 * Yeni dil daha canlı: geçişler yay (spring) tabanlı, girişler kademeli ve
 * basma geri bildirimi belirgin. Yine de hareket anlam taşır — sürekli dönen
 * dekoratif animasyon yok, Reduce Motion açıkken her şey sakinleşir.
 */
export const durations = {
  instant: 90,
  fast: 160,
  base: 260,
  slow: 420,
  /** Aurora zemin gibi çok yavaş ortam hareketleri. */
  ambient: 9000
} as const;

export const easings = {
  /** Ekrana giren içerik: hızlı başlar, yumuşak durur. */
  entrance: Easing.bezier(0.22, 1, 0.36, 1),
  /** Ekrandan çıkan içerik. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** İki durum arası geçiş (renk, opaklık). */
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  /** Hafif geri sekmeli vurgu. */
  emphasized: Easing.bezier(0.2, 0.9, 0.2, 1.08),
  /** Sürekli tekrar eden yumuşak nabız. */
  pulse: Easing.inOut(Easing.quad)
} as const;

export const springs = {
  /** Basma geri bildirimi: kısa ve sekmesiz. */
  press: { damping: 26, mass: 0.6, stiffness: 420 },
  /** Kart ve liste girişleri. */
  gentle: { damping: 20, mass: 0.9, stiffness: 180 },
  /** Seçili sekme gibi belirgin durum değişimleri. */
  snappy: { damping: 18, mass: 0.7, stiffness: 260 },
  /** Küçük, oyuncu bir sekme (ikon pop'u, rozet). */
  bouncy: { damping: 12, mass: 0.7, stiffness: 300 },
  /** Alt sayfa (sheet) açılış/kapanışı. */
  sheet: { damping: 32, mass: 1, stiffness: 320 }
} as const;

/** Listelerde ardışık giriş gecikmesi (ms). */
export const stagger = {
  fast: 30,
  step: 55,
  maxItems: 12
} as const;

/** Giriş animasyonlarının varsayılan kayma mesafesi (px). */
export const distances = {
  sm: 10,
  md: 18,
  lg: 28
} as const;

export const motion = {
  distances,
  durations,
  easings,
  springs,
  stagger
} as const;
