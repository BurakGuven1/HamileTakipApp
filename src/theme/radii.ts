/**
 * Köşe token'ları.
 *
 * Asimetrik "yön veren" köşeler bırakıldı: cam yüzeyler yumuşak ve simetrik
 * squircle'lar olarak okunur. Nesne biçimindeki token'lar korunuyor çünkü
 * ekranlar bunları `...radii.card` diye yayıyor; dört köşe artık eşit.
 */

const corners = (value: number) =>
  ({
    borderTopLeftRadius: value,
    borderTopRightRadius: value,
    borderBottomLeftRadius: value,
    borderBottomRightRadius: value
  }) as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,

  /** Skaler karşılıklar — yeni bileşenler bunları kullanır. */
  tile: 22,
  sheet: 34,

  card: corners(26),
  cardLarge: corners(34),
  button: corners(22),
  input: corners(16)
} as const;
