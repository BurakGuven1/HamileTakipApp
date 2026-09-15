import { forwardRef, type PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/glass/AuroraBackground";
import { colors, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  /** Aurora zemini kapat (tam ekran görsel taşıyan ekranlar için). */
  plain?: boolean;
  /** Aurora ışıklarının şiddeti. Metin yoğun ekranlarda düşürülür. */
  auroraIntensity?: number;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Her ekranın zemini: aurora ışıkları + güvenli alan + klavye kaçınması.
 *
 * Alt dolgu yüzen sekme çubuğunu temizler; içerik oraya kaydığında cam
 * çubuğun altından geçtiği görülür, kesilmez.
 */
export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  { auroraIntensity = 1, children, contentStyle, plain = false, scroll = true },
  ref
) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <View style={styles.root}>
      {plain ? null : <AuroraBackground intensity={auroraIntensity} />}
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoiding}
        >
          {scroll ? (
            <ScrollView
              ref={ref}
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {content}
            </ScrollView>
          ) : (
            content
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  keyboardAvoiding: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 124
  }
});
