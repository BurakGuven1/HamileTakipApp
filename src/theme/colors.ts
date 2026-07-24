import {
  Appearance,
  DynamicColorIOS,
  Platform,
  PlatformColor,
} from "react-native";

// Uygulama her açılışta açık görünümle başlar; kayıtlı koyu tema tercihi
// AppThemeProvider tarafından profil yüklendiğinde açıkça etkinleştirilir.
Appearance.setColorScheme("light");

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
  creamBackground: "#FBF6EF",
  sageGreen: "#3F6F59",
  dustyRose: "#A94F60",
  nightPlum: "#372F3D",
  honeyGold: "#8A5B16",
  mistGray: "#655F57"
} as const;

const rgb = {
  creamBackground: "251, 246, 239",
  sageGreen: "63, 111, 89",
  dustyRose: "169, 79, 96",
  nightPlum: "55, 47, 61",
  honeyGold: "138, 91, 22",
  mistGray: "101, 95, 87"
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
  creamBackground: semanticColor("#FBF6EF", "#171419"),
  sageGreen: semanticColor("#3F6F59", "#9ED0B5"),
  dustyRose: semanticColor("#A94F60", "#F0A7B4"),
  nightPlum: semanticColor("#372F3D", "#F5EFF7"),
  honeyGold: semanticColor("#8A5B16", "#E9C47E"),
  mistGray: semanticColor("#655F57", "#C8C1CB"),
  background: semanticColor("#FBF6EF", "#171419", "?android:attr/colorBackground"),
  surface: semanticColor("#FFFCF8", "#211D24", "?android:attr/colorBackgroundFloating"),
  surfaceStrong: semanticColor("#FFFCF8", "#29242C", "?android:attr/colorBackgroundFloating"),
  surfaceMuted: semanticColor(
    alpha(rgb.mistGray, 0.12),
    "rgba(255, 255, 255, 0.08)",
    "?android:attr/colorControlHighlight"
  ),
  primary: semanticColor("#3F6F59", "#9ED0B5"),
  primarySoft: semanticColor(alpha(rgb.sageGreen, 0.13), "rgba(158, 208, 181, 0.14)"),
  accent: semanticColor("#A94F60", "#F0A7B4"),
  accentSoft: semanticColor(alpha(rgb.dustyRose, 0.14), "rgba(240, 167, 180, 0.14)"),
  text: semanticColor("#372F3D", "#F5EFF7", "?android:attr/textColorPrimary"),
  textMuted: semanticColor("#655F57", "#C8C1CB", "?android:attr/textColorSecondary"),
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
  lengthTint: semanticColor("#F7EBEC", "#35272C", "?android:attr/colorControlHighlight"),
  weightTint: semanticColor("#FBF3E4", "#352F24", "?android:attr/colorControlHighlight"),
  overlay: semanticColor(alpha(rgb.nightPlum, 0.08), "rgba(0, 0, 0, 0.34)"),
  transparent: "transparent"
} as const;
