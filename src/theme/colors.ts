import { Appearance, DynamicColorIOS, Platform, PlatformColor } from "react-native";

/**
 * "Warm Aurora" paleti.
 *
 * Derin gece-lavanta bir zemin üzerinde iris, gül, mint ve şeftali ışıkları.
 * Renkler cam (glass) yüzeylerin altında yaşar: zemin renkli ve hareketli,
 * yüzeyler yarı saydam. Bu yüzden her rolün bir de saydam/"glass" karşılığı var.
 */

const alpha = (rgb: string, opacity: number) => `rgba(${rgb}, ${opacity})`;

export function semanticColor(
  light: string,
  dark: string,
  androidToken?: string
): string {
  if (Platform.OS === "ios") {
    return DynamicColorIOS({ light, dark }) as unknown as string;
  }
  if (Platform.OS === "android" && androidToken) {
    return PlatformColor(androidToken) as unknown as string;
  }
  return Appearance.getColorScheme() === "dark" ? dark : light;
}

/** Ham renk değerleri. Tema koşulu olmadan, gradyan ve SVG için. */
export const palette = {
  iris: "#6C4CF1",
  irisLight: "#9C86FF",
  irisDeep: "#4B2FD0",
  rose: "#FF7BA8",
  roseLight: "#FF9BBE",
  mint: "#3ECFB2",
  mintLight: "#56E3C6",
  peach: "#FFB27A",
  peachLight: "#FFC59A",
  sky: "#5BA8F5",
  skyLight: "#8AC4FA",
  lemon: "#FFD166",

  lightBackground: "#FBF7FF",
  lightInk: "#1C1330",
  lightInkMuted: "#6B6280",

  darkBackground: "#0F0B17",
  darkSurface: "#1A1426",
  darkInk: "#F4F0FF",
  darkInkMuted: "#A9A2BF",

  white: "#FFFFFF",
  black: "#000000"
} as const;

const rgb = {
  iris: "108, 76, 241",
  irisLight: "156, 134, 255",
  rose: "255, 123, 168",
  roseLight: "255, 155, 190",
  mint: "62, 207, 178",
  mintLight: "86, 227, 198",
  peach: "255, 178, 122",
  peachLight: "255, 197, 154",
  sky: "91, 168, 245",
  lemon: "255, 209, 102",
  lightInk: "28, 19, 48",
  white: "255, 255, 255"
} as const;

/** Bir vurgu renginin yumuşak tonu: açık temada süt, koyu temada ışık. */
const softTint = (channel: keyof typeof rgb, lightOpacity = 0.14, darkOpacity = 0.18) =>
  semanticColor(alpha(rgb[channel], lightOpacity), alpha(rgb[channel], darkOpacity));

export const colors = {
  // --- Zemin ve cam katmanlar -------------------------------------------
  /** Aurora gradyanının altındaki düz zemin. */
  background: semanticColor(palette.lightBackground, palette.darkBackground),
  /** Camın desteklenmediği yerde kullanılan opak yüzey. */
  surface: semanticColor(palette.white, palette.darkSurface, "?android:attr/colorBackgroundFloating"),
  surfaceStrong: semanticColor("#FFFFFF", "#241C33", "?android:attr/colorBackgroundFloating"),
  surfaceMuted: semanticColor(alpha(rgb.lightInk, 0.05), alpha(rgb.white, 0.06)),
  /** Cam yüzeyin dolgusu — BlurView üstüne biner. */
  glass: semanticColor(alpha(rgb.white, 0.62), alpha(rgb.white, 0.07)),
  /** Daha okunaklı olması gereken cam (metin yoğun kartlar). */
  glassStrong: semanticColor(alpha(rgb.white, 0.82), alpha(rgb.white, 0.11)),
  /** Camın 1px ışık kenarlığı. */
  glassBorder: semanticColor(alpha(rgb.white, 0.75), alpha(rgb.white, 0.12)),
  /** Cam kartın üst kenarındaki parlama. */
  glassHighlight: semanticColor(alpha(rgb.white, 0.9), alpha(rgb.white, 0.18)),

  // --- Metin -------------------------------------------------------------
  text: semanticColor(palette.lightInk, palette.darkInk),
  textMuted: semanticColor(palette.lightInkMuted, palette.darkInkMuted),
  onPrimary: semanticColor("#FFFFFF", "#120E1D", "?android:attr/textColorPrimaryInverse"),

  // --- Vurgular ----------------------------------------------------------
  primary: semanticColor(palette.iris, palette.irisLight),
  primarySoft: softTint("iris", 0.12, 0.2),
  secondary: semanticColor(palette.rose, palette.roseLight),
  secondarySoft: softTint("rose", 0.14, 0.2),
  tertiary: semanticColor(palette.mint, palette.mintLight),
  tertiarySoft: softTint("mint", 0.14, 0.2),
  warm: semanticColor(palette.peach, palette.peachLight),
  warmSoft: softTint("peach", 0.16, 0.2),
  sky: semanticColor(palette.sky, palette.skyLight),
  skySoft: softTint("sky", 0.14, 0.2),
  highlight: semanticColor("#C98A12", palette.lemon),
  highlightSoft: softTint("lemon", 0.2, 0.2),

  // --- Kenarlık, gölge, örtü ---------------------------------------------
  border: semanticColor(alpha(rgb.lightInk, 0.1), alpha(rgb.white, 0.14), "?android:attr/listDivider"),
  borderStrong: semanticColor(alpha(rgb.lightInk, 0.16), alpha(rgb.white, 0.22)),
  shadow: semanticColor(alpha(rgb.iris, 0.22), alpha("0, 0, 0", 0.6)),
  overlay: semanticColor(alpha(rgb.lightInk, 0.28), "rgba(0, 0, 0, 0.55)"),

  // --- Durum -------------------------------------------------------------
  danger: semanticColor("#E2445C", "#FF8FA0"),
  dangerSoft: semanticColor("rgba(226, 68, 92, 0.12)", "rgba(255, 143, 160, 0.18)"),
  success: semanticColor("#17A67F", "#5FE0BB"),
  successSoft: softTint("mint", 0.14, 0.18),
  warning: semanticColor("#D08700", palette.lemon),
  warningSoft: softTint("lemon", 0.18, 0.18),

  // --- Geri bildirim (mevcut çağrı yerleri) ------------------------------
  feedbackForeground: semanticColor(palette.lightInk, palette.darkInk),
  feedbackActionBackground: semanticColor(palette.white, palette.darkSurface),
  feedbackErrorBackground: semanticColor("rgba(226, 68, 92, 0.12)", "rgba(255, 143, 160, 0.18)"),
  feedbackSuccessBackground: softTint("mint", 0.14, 0.18),
  feedbackInfoBackground: softTint("iris", 0.12, 0.2),

  // --- Ölçüm tonları ------------------------------------------------------
  lengthTint: softTint("sky", 0.14, 0.2),
  weightTint: softTint("peach", 0.16, 0.2),

  // --- Sekme çubuğu -------------------------------------------------------
  /** Sekme çubuğunda seçili olmayan ikon ve etiket rengi. */
  tabInactive: semanticColor(palette.lightInkMuted, palette.darkInkMuted),
  /** Seçili sekmenin ikon arkasındaki cam kapsül. */
  tabActiveSurface: semanticColor(alpha(rgb.iris, 0.14), alpha(rgb.white, 0.14)),

  transparent: "transparent",

  // --- Eski isimler ------------------------------------------------------
  // Faz 4'te ekranlar dönüştükçe silinecek; bugün yeni değerlere bağlılar.
  accent: semanticColor(palette.rose, palette.roseLight),
  accentSoft: softTint("rose", 0.14, 0.2),
  creamBackground: semanticColor(palette.lightBackground, palette.darkBackground),
  sageGreen: semanticColor(palette.mint, palette.mintLight),
  dustyRose: semanticColor(palette.rose, palette.roseLight),
  nightPlum: semanticColor(palette.lightInk, palette.darkInk),
  honeyGold: semanticColor("#C98A12", palette.lemon),
  mistGray: semanticColor(palette.lightInkMuted, palette.darkInkMuted)
} as const;

/**
 * Gradyanlar. Aurora zemin bunların üzerine kurulur; kart ve butonlarda da
 * aynı ışık ailesi kullanılır ki uygulama tek bir dünyada geçsin.
 */
export const gradients = {
  /** Birincil eylem butonu. */
  primary: [palette.iris, "#8E63F0", palette.rose] as const,
  /** Sıcak, anne-bebek tonlu hero. */
  warm: [palette.rose, palette.peach] as const,
  /** Sakin, uyku/gece bağlamı. */
  calm: [palette.iris, palette.sky] as const,
  /** Büyüme ve sağlık. */
  fresh: [palette.mint, palette.sky] as const,
  /** Aurora zeminin üç ışığı (AuroraBackground bunları blob olarak kullanır). */
  auroraLight: [palette.irisLight, palette.rose, palette.peach] as const,
  auroraDark: ["#3A2A7A", "#6B2F63", "#22304F"] as const
} as const;

/** Bebeğin cinsiyetine göre önerilen vurgu. */
export const accentColors = {
  kiz: { primary: palette.rose, tint: alpha(rgb.rose, 0.14) },
  erkek: { primary: palette.sky, tint: alpha(rgb.sky, 0.14) },
  notr: { primary: palette.mint, tint: alpha(rgb.mint, 0.14) }
} as const;

/**
 * Geriye dönük uyumluluk.
 *
 * Eski "vibrant*" isimleri hâlâ birkaç ekranda çağrılıyor. Yeni değerlere
 * bağlanmış alias'lar olarak duruyorlar; ekranlar Faz 4'te dönüştükçe silinecek.
 */
export const vibrantPalette = {
  primary: palette.iris,
  primaryLight: alpha(rgb.iris, 0.12),
  secondary: palette.rose,
  mint: palette.mint,
  blue: palette.sky,
  peach: palette.peach,
  yellow: palette.lemon,
  background: palette.lightBackground,
  heading: palette.lightInk,
  body: palette.lightInkMuted,
  white: palette.white,
  pinkSoft: alpha(rgb.rose, 0.14),
  mintSoft: alpha(rgb.mint, 0.14),
  blueSoft: alpha(rgb.sky, 0.14),
  peachSoft: alpha(rgb.peach, 0.16),
  yellowSoft: alpha(rgb.lemon, 0.18)
} as const;

export const vibrantColors = {
  primary: colors.primary,
  primaryLight: colors.primarySoft,
  secondary: colors.secondary,
  secondarySoft: colors.secondarySoft,
  mint: colors.tertiary,
  mintSoft: colors.tertiarySoft,
  blue: colors.sky,
  blueSoft: colors.skySoft,
  peach: colors.warm,
  peachSoft: colors.warmSoft,
  yellow: colors.highlight,
  yellowSoft: colors.highlightSoft,
  background: colors.background,
  heading: colors.text,
  body: colors.textMuted,
  surface: colors.surface,
  surfaceTranslucent: colors.glassStrong,
  border: colors.border
} as const;

export const vibrantGradients = {
  primary: gradients.primary,
  hero: gradients.warm,
  backdrop: gradients.calm
} as const;

export const vibrantTheme = {
  primary: colors.primary,
  primarySoft: colors.primarySoft,
  accent: colors.secondary,
  accentSoft: colors.secondarySoft
} as const;
