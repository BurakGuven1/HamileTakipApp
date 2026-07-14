import { accentColors, colors } from "@/theme/colors";

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
    accent: "#E3B873",
    accentSoft: "rgba(227, 184, 115, 0.2)",
    label: "Sıcak gül",
    primary: "#C98A93",
    primarySoft: "rgba(201, 138, 147, 0.18)"
  },
  blue: {
    accent: "#93B3CF",
    accentSoft: "rgba(127, 163, 196, 0.18)",
    label: "Bebek mavisi",
    primary: accentColors.erkek.primary,
    primarySoft: accentColors.erkek.tint
  },
  pink: {
    accent: "#D97895",
    accentSoft: "rgba(232, 159, 176, 0.2)",
    label: "Pamuk pembe",
    primary: accentColors.kiz.primary,
    primarySoft: accentColors.kiz.tint
  },
  lavender: {
    accent: "#B99FE0",
    accentSoft: "rgba(185, 159, 224, 0.2)",
    label: "Lavanta",
    primary: "#8A75BD",
    primarySoft: "rgba(138, 117, 189, 0.18)"
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
