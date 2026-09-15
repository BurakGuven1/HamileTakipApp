import type { TextStyle } from "react-native";

import { colors } from "@/theme/colors";

export const fonts = {
  displaySemiBold: "Manrope_600SemiBold",
  displayBold: "Manrope_700Bold",
  displayExtraBold: "Manrope_800ExtraBold",
  bodyRegular: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  dataRegular: "SpaceMono_400Regular",
  dataBold: "SpaceMono_700Bold"
} as const;

/**
 * Tipografi ölçeği.
 *
 * Başlıklar daha büyük ve daha sıkı (negatif letterSpacing) — iOS'un büyük
 * başlık diline yakın. Gövde metni 16'ya indi ki cam yüzeylerde satırlar
 * daha dengeli otursun. SpaceMono yalnızca ölçüm ve sayaçlarda.
 */
export const typography = {
  /** Ekranın tek büyük başlığı. */
  display: {
    color: colors.text,
    fontFamily: fonts.displayExtraBold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40
  },
  heading1: {
    color: colors.text,
    fontFamily: fonts.displayExtraBold,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 34
  },
  heading2: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28
  },
  heading3: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    letterSpacing: -0.2,
    lineHeight: 24
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 23
  },
  bodyStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 23
  },
  /** Kart içi ikincil açıklama. */
  caption: {
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20
  },
  captionStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20
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
    letterSpacing: -0.1,
    lineHeight: 21
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase"
  },
  tabLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: -0.1
  },
  data: {
    color: colors.text,
    fontFamily: fonts.dataRegular,
    fontSize: 15,
    lineHeight: 21
  },
  dataStrong: {
    color: colors.primary,
    fontFamily: fonts.dataBold,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 32
  },
  /** Sayaç ve büyük ölçüm gösterimi. */
  metric: {
    color: colors.text,
    fontFamily: fonts.displayExtraBold,
    fontSize: 40,
    letterSpacing: -1.2,
    lineHeight: 46
  },
  price: {
    color: colors.primary,
    fontFamily: fonts.dataBold,
    fontSize: 24,
    lineHeight: 30
  }
} satisfies Record<string, TextStyle>;
