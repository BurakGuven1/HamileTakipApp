import { Platform } from "react-native";

import { palette } from "@/theme/colors";

/**
 * Gölge token'ları.
 *
 * Cam yüzeyler zeminden gölgeyle ayrılır; gölge nötr siyah değil, zeminin
 * iris tonunu taşır — böylece aurora ile aynı ışıkta kalır. Android'de
 * `elevation` gölgenin rengini yok saydığı için yalnızca yükseklik verilir.
 */
const shadow = (
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number
) =>
  Platform.select({
    ios: {
      shadowColor: palette.irisDeep,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur
    },
    android: { elevation },
    default: {
      shadowColor: palette.irisDeep,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur
    }
  });

export const shadows = {
  /** Listedeki sıradan kart. */
  soft: shadow(6, 16, 0.08, 2),
  /** Ana içerik kartı. */
  card: shadow(12, 28, 0.12, 6),
  /** Hero ve öne çıkan yüzey. */
  lifted: shadow(20, 40, 0.18, 12),
  /** Yüzen sekme çubuğu ve alt sayfa. */
  floating: shadow(16, 36, 0.22, 16)
} as const;
