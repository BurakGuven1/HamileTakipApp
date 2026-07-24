import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type RevealProps = PropsWithChildren<{
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function Reveal({ children, delay = 0, style }: RevealProps) {
  void delay;

  return (
    <View style={style}>{children}</View>
  );
}
