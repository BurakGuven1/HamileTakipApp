import type { TextStyle } from "react-native";

export const colors = {
  background: "#FAF7F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F4EFE7",
  primary: "#5F8F7B",
  primarySoft: "#DDECE5",
  accent: "#D98B8B",
  accentSoft: "#F5DEDE",
  text: "#26352F",
  textMuted: "#6E7C75",
  border: "#E4DDD3",
  danger: "#B95B5B",
  success: "#5D946F"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999
} as const;

export const typography = {
  heading1: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 36
  },
  heading2: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  button: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: "uppercase"
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  price: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30
  }
} satisfies Record<string, TextStyle>;
