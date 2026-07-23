import { forwardRef, type PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Thread } from "@/components/Thread";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  { children, scroll = true },
  ref
) {
  const appTheme = useAppTheme();
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.ambientThread}>
        <Thread
          color={appTheme.accent}
          height={160}
          mutedColor={appTheme.primary}
          progress={0.62}
          variant="decorative"
        />
      </View>
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
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden"
  },
  ambientThread: {
    left: -48,
    opacity: 0.08,
    position: "absolute",
    right: -48,
    top: -28
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
    paddingTop: spacing.lg,
    paddingBottom: 112
  }
});
