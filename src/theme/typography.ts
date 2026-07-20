import type { TextStyle } from "react-native";

import { colors } from "@/theme/colors";

export const fonts = {
  displaySemiBold: "Fraunces_600SemiBold",
  displayBold: "Fraunces_700Bold",
  bodyRegular: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  dataRegular: "SpaceMono_400Regular",
  dataBold: "SpaceMono_700Bold"
} as const;

export const typography = {
  heading1: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 38
  },
  heading2: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 21,
    lineHeight: 28
  },
  heading3: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 24
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24
  },
  bodyStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 24
  },
  label: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 21
  },
  button: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 19,
    textTransform: "uppercase"
  },
  tabLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14
  },
  data: {
    color: colors.text,
    fontFamily: fonts.dataRegular,
    fontSize: 16,
    lineHeight: 22
  },
  dataStrong: {
    color: colors.primary,
    fontFamily: fonts.dataBold,
    fontSize: 24,
    lineHeight: 30
  },
  price: {
    color: colors.primary,
    fontFamily: fonts.dataBold,
    fontSize: 24,
    lineHeight: 30
  }
} satisfies Record<string, TextStyle>;
