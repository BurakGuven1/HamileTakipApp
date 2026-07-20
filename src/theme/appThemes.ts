import { accentColors, colors, semanticColor } from "@/theme/colors";

export type ThemePreference =
  | "auto"
  | "sage"
  | "rose"
  | "blue"
  | "pink"
  | "lavender";

type AppTheme = {
  accent: string;
  accentSoft: string;
  label: string;
  primary: string;
  primarySoft: string;
};

export const appThemes: Record<Exclude<ThemePreference, "auto">, AppTheme> = {
  sage: {
    accent: colors.accent,
    accentSoft: colors.accentSoft,
    label: "Ada yeşili",
    primary: colors.primary,
    primarySoft: colors.primarySoft
  },
  rose: {
    accent: semanticColor("#8A5B16", "#E9C47E"),
    accentSoft: semanticColor("rgba(138, 91, 22, 0.14)", "rgba(233, 196, 126, 0.14)"),
    label: "Sıcak gül",
    primary: semanticColor("#A94F60", "#F0A7B4"),
    primarySoft: semanticColor("rgba(169, 79, 96, 0.14)", "rgba(240, 167, 180, 0.14)")
  },
  blue: {
    accent: semanticColor("#456F98", "#9FC6EA"),
    accentSoft: semanticColor("rgba(69, 111, 152, 0.14)", "rgba(159, 198, 234, 0.14)"),
    label: "Bebek mavisi",
    primary: semanticColor(accentColors.erkek.primary, "#9FC6EA"),
    primarySoft: semanticColor(accentColors.erkek.tint, "rgba(159, 198, 234, 0.14)")
  },
  pink: {
    accent: semanticColor("#9F3F5D", "#F0A7B4"),
    accentSoft: semanticColor("rgba(159, 63, 93, 0.14)", "rgba(240, 167, 180, 0.14)"),
    label: "Pamuk pembe",
    primary: semanticColor(accentColors.kiz.primary, "#F0A7B4"),
    primarySoft: semanticColor(accentColors.kiz.tint, "rgba(240, 167, 180, 0.14)")
  },
  lavender: {
    accent: semanticColor("#6F56A3", "#C7B4F4"),
    accentSoft: semanticColor("rgba(111, 86, 163, 0.14)", "rgba(199, 180, 244, 0.14)"),
    label: "Lavanta",
    primary: semanticColor("#6F56A3", "#C7B4F4"),
    primarySoft: semanticColor("rgba(111, 86, 163, 0.14)", "rgba(199, 180, 244, 0.14)")
  }
};

export const themeOptions = [
  {
    id: "auto" as ThemePreference,
    accent: colors.accent,
    accentSoft: colors.accentSoft,
    label: "Bebeğe göre",
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

  return appThemes[theme as Exclude<ThemePreference, "auto">] ?? appThemes.sage;
}

export function getSuggestedThemeForGender(
  gender?: string | null
): Exclude<ThemePreference, "auto"> {
  if (gender === "erkek") return "blue";
  if (gender === "kiz" || gender === "kız") return "pink";
  return "sage";
}
