import Svg, { Path } from "react-native-svg";

import { colors } from "@/theme";

type ThreadVariant = "progress" | "chart" | "decorative";

type ThreadProps = {
  color?: string;
  height?: number;
  mutedColor?: string;
  progress?: number;
  variant?: ThreadVariant;
  width?: number | string;
};

const paths: Record<ThreadVariant, string> = {
  progress: "M4 24 C42 6 78 42 116 24 S190 6 228 24 S302 42 340 24",
  chart: "M4 60 C40 52 52 28 88 36 C122 44 134 18 170 24 C212 31 210 70 252 54 C288 40 300 24 340 32",
  decorative:
    "M15 78 C38 22 102 16 120 58 C139 103 68 116 54 72 C38 21 124 8 174 36 C224 64 207 119 154 104 C97 88 139 23 212 18 C286 12 330 58 307 104"
};

export function Thread({
  color = colors.primary,
  height = 56,
  mutedColor = colors.border,
  progress = 1,
  variant = "decorative",
  width = "100%"
}: ThreadProps) {
  const viewBox = variant === "decorative" ? "0 0 340 132" : "0 0 344 88";
  const strokeWidth = variant === "decorative" ? 2 : 3;
  const dashLength = 360;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <Svg
      height={height}
      pointerEvents="none"
      viewBox={viewBox}
      width={width}
    >
      <Path
        d={paths[variant]}
        fill="none"
        opacity={variant === "decorative" ? 0.45 : 1}
        stroke={mutedColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d={paths[variant]}
        fill="none"
        stroke={color}
        strokeDasharray={`${dashLength * clampedProgress}, ${dashLength}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
