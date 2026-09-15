import { colors, gradients, palette, semanticColor } from "@/theme/colors";

export type ThemePreference =
  | "auto"
  | "sage"
  | "rose"
  | "blue"
  | "pink"
  | "lavender"
  | "dark";

type AccentThemePreference = Exclude<ThemePreference, "auto" | "dark">;

type AppTheme = {
  accent: string;
  accentSoft: string;
  /** Birincil eylem gradyanı — buton ve hero yüzeyleri bunu kullanır. */
  gradient: readonly [string, string, ...string[]];
  label: string;
  navigationPrimary: string;
  primary: string;
  primarySoft: string;
};

const soft = (rgb: string, lightOpacity = 0.13, darkOpacity = 0.2) =>
  semanticColor(`rgba(${rgb}, ${lightOpacity})`, `rgba(${rgb}, ${darkOpacity})`);

/**
 * Altı vurgu teması. Hepsi "Warm Aurora" ailesinden çıkar: aynı ışık,
 * farklı hue. Anahtar isimleri (sage/rose/blue/pink/lavender/dark) veritabanında
 * kayıtlı olduğu için korunuyor; taşıdıkları renkler yenilendi.
 */
export const appThemes: Record<Exclude<ThemePreference, "auto">, AppTheme> = {
  sage: {
    accent: colors.secondary,
    accentSoft: colors.secondarySoft,
    gradient: gradients.fresh,
    label: "Taze mint",
    navigationPrimary: palette.mint,
    primary: semanticColor(palette.mint, palette.mintLight),
    primarySoft: soft("62, 207, 178")
  },
  rose: {
    accent: semanticColor(palette.peach, palette.peachLight),
    accentSoft: soft("255, 178, 122", 0.16),
    gradient: gradients.warm,
    label: "Sıcak gül",
    navigationPrimary: palette.rose,
    primary: semanticColor(palette.rose, palette.roseLight),
    primarySoft: soft("255, 123, 168")
  },
  blue: {
    accent: semanticColor(palette.mint, palette.mintLight),
    accentSoft: soft("62, 207, 178"),
    gradient: gradients.calm,
    label: "Bebek mavisi",
    navigationPrimary: palette.sky,
    primary: semanticColor(palette.sky, palette.skyLight),
    primarySoft: soft("91, 168, 245")
  },
  pink: {
    accent: semanticColor(palette.iris, palette.irisLight),
    accentSoft: soft("108, 76, 241"),
    gradient: [palette.rose, "#FF9ECF"] as const,
    label: "Pamuk pembe",
    navigationPrimary: palette.rose,
    primary: semanticColor(palette.rose, palette.roseLight),
    primarySoft: soft("255, 123, 168")
  },
  lavender: {
    accent: semanticColor(palette.rose, palette.roseLight),
    accentSoft: soft("255, 123, 168"),
    gradient: gradients.primary,
    label: "Lavanta",
    navigationPrimary: palette.iris,
    primary: semanticColor(palette.iris, palette.irisLight),
    primarySoft: soft("108, 76, 241")
  },
  dark: {
    accent: palette.roseLight,
    accentSoft: "rgba(255, 155, 190, 0.2)",
    gradient: gradients.primary,
    label: "Koyu mod",
    navigationPrimary: palette.irisLight,
    primary: palette.irisLight,
    primarySoft: "rgba(156, 134, 255, 0.2)"
  }
};

export const themeOptions = [
  {
    id: "auto" as ThemePreference,
    accent: colors.secondary,
    accentSoft: colors.secondarySoft,
    gradient: gradients.primary,
    label: "Bebeğe göre",
    navigationPrimary: palette.iris,
    primary: colors.primary,
    primarySoft: colors.primarySoft
  },
  ...Object.entries(appThemes).map(([id, theme]) => ({
    id: id as ThemePreference,
    ...theme
  }))
];

export function getAppTheme(theme?: string | null, gender?: string | null) {
  if (!theme || theme === "auto") {
    const suggestedTheme = getSuggestedThemeForGender(gender);
    const resolvedTheme = appThemes[suggestedTheme];
    return {
      ...resolvedTheme,
      label: `Bebeğe göre: ${resolvedTheme.label}`
    };
  }

  return appThemes[theme as Exclude<ThemePreference, "auto">] ?? appThemes.lavender;
}

export function getSuggestedThemeForGender(
  gender?: string | null
): AccentThemePreference {
  if (gender === "erkek") return "blue";
  if (gender === "kiz" || gender === "kız") return "pink";
  return "lavender";
}
