import { Children, isValidElement, type PropsWithChildren, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { FadeSlideIn } from "@/components/motion/FadeSlideIn";
import { distances, stagger } from "@/theme/motion";

type StaggeredListProps = PropsWithChildren<{
  /** İlk öğeden önceki gecikme (ms). */
  delay?: number;
  distance?: number;
  /** Öğeler arası gecikme (ms). Varsayılan: stagger.step */
  interval?: number;
  /** Her öğenin sarmalayıcısına uygulanır (ör. satırda flex: 1). */
  itemStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Alt öğelerini sırayla (varsayılan 40 ms aralıkla) ekrana getirir.
 * Çok uzun listelerde gecikme stagger.maxItems ile sınırlanır; böylece
 * ekranın altındaki öğeler beklemez.
 */
export function StaggeredList({
  children,
  delay = 0,
  distance = distances.sm,
  interval = stagger.step,
  itemStyle,
  style
}: StaggeredListProps) {
  // Children.toArray null, undefined ve boolean çocukları zaten temizler.
  const items = Children.toArray(children);

  return (
    <View style={style}>
      {items.map((child, index) => (
        <FadeSlideIn
          key={resolveKey(child, index)}
          delay={delay + Math.min(index, stagger.maxItems) * interval}
          distance={distance}
          style={itemStyle}
        >
          {child}
        </FadeSlideIn>
      ))}
    </View>
  );
}

function resolveKey(child: ReactNode, index: number) {
  if (isValidElement(child) && child.key != null) {
    return child.key;
  }
  return `staggered-${index}`;
}
