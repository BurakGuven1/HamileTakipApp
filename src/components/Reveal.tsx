import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { FadeSlideIn } from "@/components/motion/FadeSlideIn";
import { distances } from "@/theme/motion";

type RevealProps = PropsWithChildren<{
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * İçeriği ölçülü bir giriş hareketiyle açar. Hareket katmanının ortak
 * primitifine (FadeSlideIn) bağlıdır; Reduce Motion tercihine saygı gösterir.
 */
export function Reveal({ children, delay = 0, style }: RevealProps) {
  return (
    <FadeSlideIn delay={delay} distance={distances.sm} style={style}>
      {children}
    </FadeSlideIn>
  );
}
