const alpha = (rgb: string, opacity: number) => `rgba(${rgb}, ${opacity})`;

export const palette = {
  creamBackground: "#FBF6EF",
  sageGreen: "#6E8F7C",
  dustyRose: "#C98A93",
  nightPlum: "#372F3D",
  honeyGold: "#E3B873",
  mistGray: "#A79C8E"
} as const;

const rgb = {
  creamBackground: "251, 246, 239",
  sageGreen: "110, 143, 124",
  dustyRose: "201, 138, 147",
  nightPlum: "55, 47, 61",
  honeyGold: "227, 184, 115",
  mistGray: "167, 156, 142"
} as const;

export const accentColors = {
  kiz: {
    primary: "#E89FB0",
    tint: "#FBEAEE"
  },
  erkek: {
    primary: "#7FA3C4",
    tint: "#EAF1F7"
  },
  notr: {
    primary: "#6E8F7C",
    tint: "#EAF0EC"
  }
} as const;

export const colors = {
  ...palette,
  background: palette.creamBackground,
  surface: alpha(rgb.creamBackground, 0.86),
  surfaceStrong: palette.creamBackground,
  surfaceMuted: alpha(rgb.mistGray, 0.14),
  primary: palette.sageGreen,
  primarySoft: alpha(rgb.sageGreen, 0.14),
  accent: palette.dustyRose,
  accentSoft: alpha(rgb.dustyRose, 0.18),
  text: palette.nightPlum,
  textMuted: palette.mistGray,
  border: alpha(rgb.mistGray, 0.38),
  highlight: palette.honeyGold,
  highlightSoft: alpha(rgb.honeyGold, 0.22),
  danger: palette.dustyRose,
  success: palette.honeyGold,
  lengthTint: "#F7EBEC",
  weightTint: "#FBF3E4",
  overlay: alpha(rgb.nightPlum, 0.08),
  transparent: "transparent"
} as const;
