import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, durations, easings, radii, spacing, springs, typography } from "@/theme";

type GlassSheetProps = PropsWithChildren<{
  onClose: () => void;
  /** Başlık; verilmezse yalnızca tutamak gösterilir. */
  title?: string;
  subtitle?: string;
  visible: boolean;
  /** İçeriği kaydırılabilir yap. Form içeren sayfalarda açılır. */
  scroll?: boolean;
}>;

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 900;

/**
 * Aşağı sürüklenerek kapanan cam alt sayfa.
 *
 * Uygulamada bir sheet kütüphanesi yok; her ekran kendi `Modal`'ını
 * kuruyordu ve hiçbiri sürüklenmiyordu. Bu bileşen tek bir davranış
 * tanımlar: arka plan bulanıklaşır, sayfa yay ile gelir, aşağı sürükleme
 * yeterince ilerlerse ya da hızlıysa kapanır, değilse geri yerine oturur.
 */
export function GlassSheet({
  children,
  onClose,
  scroll = false,
  subtitle,
  title,
  visible
}: GlassSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [translateY, visible]);

  const dragGesture = Gesture.Pan()
    .onChange((event) => {
      // Yalnızca aşağı yönde takip et; yukarı çekiş sayfayı esnetmez.
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd((event) => {
      const shouldClose =
        translateY.value > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(
          600,
          { duration: durations.fast, easing: easings.exit },
          () => runOnJS(onClose)()
        );
        return;
      }
      translateY.value = reducedMotion
        ? withTiming(0, { duration: durations.instant })
        : withSpring(0, springs.sheet);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, translateY.value / 400)
  }));

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={24} style={StyleSheet.absoluteFill} tint="systemThickMaterialDark" />
          ) : null}
          <Pressable
            accessibilityLabel="Kapat"
            accessibilityRole="button"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          />
        </Animated.View>

        <GestureDetector gesture={dragGesture}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg },
              sheetStyle
            ]}
          >
            {Platform.OS === "ios" ? (
              <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="default" />
            ) : null}
            <View style={[StyleSheet.absoluteFill, styles.sheetFill]} />
            <View style={styles.handle} />
            {title ? (
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            ) : null}
            {scroll ? (
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.content}>{children}</View>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    maxHeight: "88%",
    overflow: "hidden",
    paddingTop: spacing.sm
  },
  sheetFill: {
    backgroundColor: Platform.OS === "ios" ? colors.glassStrong : colors.surface
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: radii.pill,
    height: 5,
    marginBottom: spacing.sm,
    width: 40
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  title: {
    ...typography.heading2
  },
  subtitle: {
    ...typography.caption
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm
  }
});
