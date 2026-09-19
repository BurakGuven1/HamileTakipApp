import {
  Appearance,
  DynamicColorIOS,
  Platform,
  PlatformColor,
} from "react-native";

// Uygulama her açılışta açık görünümle başlar; kayıtlı koyu tema tercihi
// AppThemeProvider tarafından profil yüklendiğinde açıkça etkinleştirilir.
if (typeof Appearance.setColorScheme === "function") {
  Appearance.setColorScheme("light");
}

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

export const palette = {
  creamBackground: "#FFF8F3",
  sageGreen: "#3F6F59",
  dustyRose: "#FF6F91",
  nightPlum: "#2D2438",
  honeyGold: "#8A5B16",
  mistGray: "#6B6478"
} as const;

const rgb = {
  creamBackground: "255, 248, 243",
  sageGreen: "63, 111, 89",
  dustyRose: "255, 111, 145",
  nightPlum: "45, 36, 56",
  honeyGold: "138, 91, 22",
  mistGray: "107, 100, 120"
} as const;

export const vibrantPalette = {
  primary: "#8B6FE8",
  primaryLight: "#EDE7FB",
  secondary: "#FF6F91",
  mint: "#4ECDC4",
  blue: "#5DADE2",
  peach: "#FFB86B",
  yellow: "#FFD166",
  background: "#FFF8F3",
  heading: "#2D2438",
  body: "#6B6478",
  white: "#FFFFFF",
  pinkSoft: "#FFE8EE",
  mintSoft: "#E3F8F5",
  blueSoft: "#E8F4FC",
  peachSoft: "#FFF0DF",
  yellowSoft: "#FFF6D9"
} as const;

export const vibrantColors = {
  primary: semanticColor(vibrantPalette.primary, "#BDAAF6"),
  primaryLight: semanticColor(vibrantPalette.primaryLight, "rgba(189, 170, 246, 0.16)"),
  secondary: semanticColor(vibrantPalette.secondary, "#FF91AA"),
  secondarySoft: semanticColor(vibrantPalette.pinkSoft, "rgba(255, 145, 170, 0.16)"),
  mint: semanticColor(vibrantPalette.mint, "#76DDD6"),
  mintSoft: semanticColor(vibrantPalette.mintSoft, "rgba(118, 221, 214, 0.14)"),
  blue: semanticColor(vibrantPalette.blue, "#8AC8ED"),
  blueSoft: semanticColor(vibrantPalette.blueSoft, "rgba(138, 200, 237, 0.15)"),
  peach: semanticColor(vibrantPalette.peach, "#FFC98F"),
  peachSoft: semanticColor(vibrantPalette.peachSoft, "rgba(255, 201, 143, 0.15)"),
  yellow: semanticColor(vibrantPalette.yellow, "#FFE092"),
  yellowSoft: semanticColor(vibrantPalette.yellowSoft, "rgba(255, 224, 146, 0.15)"),
  background: semanticColor(vibrantPalette.background, "#1B1720"),
  heading: semanticColor(vibrantPalette.heading, "#F8F3FC"),
  body: semanticColor(vibrantPalette.body, "#CDC4D8"),
  surface: semanticColor(vibrantPalette.white, "#26212C"),
  surfaceTranslucent: semanticColor("rgba(255, 255, 255, 0.90)", "rgba(38, 33, 44, 0.92)"),
  border: semanticColor("rgba(139, 111, 232, 0.18)", "rgba(237, 231, 251, 0.18)")
} as const;

export const vibrantGradients = {
  primary: [vibrantColors.primary, vibrantColors.secondary] as const,
  hero: [vibrantColors.peachSoft, vibrantColors.secondarySoft, vibrantColors.primaryLight] as const,
  backdrop: [vibrantColors.background, vibrantColors.primaryLight] as const
} as const;

export const vibrantTheme = {
  primary: vibrantColors.primary,
  primarySoft: vibrantColors.primaryLight,
  accent: vibrantColors.secondary,
  accentSoft: vibrantColors.secondarySoft
} as const;

export const accentColors = {
  kiz: {
    primary: "#A54664",
    tint: "#FBEAEE"
  },
  erkek: {
    primary: "#456F98",
    tint: "#EAF1F7"
  },
  notr: {
    primary: "#6E8F7C",
    tint: "#EAF0EC"
  }
} as const;

export const colors = {
  ...palette,
  creamBackground: vibrantColors.background,
  sageGreen: semanticColor("#3F6F59", "#9ED0B5"),
  dustyRose: vibrantColors.secondary,
  nightPlum: vibrantColors.heading,
  honeyGold: semanticColor("#8A5B16", "#E9C47E"),
  mistGray: vibrantColors.body,
  background: vibrantColors.background,
  surface: semanticColor("#FFFCF8", "#211D24", "?android:attr/colorBackgroundFloating"),
  surfaceStrong: semanticColor("#FFFCF8", "#29242C", "?android:attr/colorBackgroundFloating"),
  surfaceMuted: semanticColor(
    alpha(rgb.mistGray, 0.12),
    "rgba(255, 255, 255, 0.08)",
    "?android:attr/colorControlHighlight"
  ),
  primary: vibrantColors.primary,
  primarySoft: vibrantColors.primaryLight,
  accent: vibrantColors.secondary,
  accentSoft: vibrantColors.secondarySoft,
  text: vibrantColors.heading,
  textMuted: vibrantColors.body,
  border: semanticColor(
    "rgba(101, 95, 87, 0.38)",
    "rgba(245, 239, 247, 0.22)",
    "?android:attr/listDivider"
  ),
  highlight: semanticColor("#8A5B16", "#E9C47E"),
  highlightSoft: semanticColor(alpha(rgb.honeyGold, 0.15), "rgba(233, 196, 126, 0.14)"),
  danger: semanticColor("#A33F52", "#FF9AAA"),
  success: semanticColor("#376B4C", "#8FD1A8"),
  onPrimary: semanticColor("#FFFCF8", "#171419", "?android:attr/textColorPrimaryInverse"),
  feedbackForeground: vibrantColors.heading,
  feedbackActionBackground: vibrantColors.surface,
  feedbackErrorBackground: "#FBEAEE",
  feedbackSuccessBackground: vibrantColors.mintSoft,
  feedbackInfoBackground: vibrantColors.primaryLight,
  lengthTint: vibrantColors.blueSoft,
  weightTint: vibrantColors.peachSoft,
  overlay: semanticColor(alpha(rgb.nightPlum, 0.08), "rgba(0, 0, 0, 0.34)"),
  transparent: "transparent"
} as const;
