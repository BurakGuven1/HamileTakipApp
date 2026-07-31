import { X } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "@/lib/errors";
import { colors, radii, spacing, typography } from "@/theme";

type FeedbackKind = "error" | "success" | "info";

type FeedbackState = {
  id: number;
  kind: FeedbackKind;
  message: string;
  title: string;
};

type FeedbackContextValue = {
  showError: (error: unknown, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const hide = useCallback(() => {
    translateY.value = withTiming(-120, { duration: 220 });
    opacity.value = withTiming(0, { duration: 180 });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [opacity, translateY]);

  const show = useCallback(
    (kind: FeedbackKind, title: string, message: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setFeedback({ id: Date.now(), kind, message, title });
      translateY.value = withTiming(0, { duration: 260 });
      opacity.value = withTiming(1, { duration: 220 });
      timeoutRef.current = setTimeout(hide, 5000);
    },
    [hide, opacity, translateY]
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showError: (error, title = "Bir sorun oldu") =>
        show("error", title, getErrorMessage(error)),
      showInfo: (message, title = "Bilgi") => show("info", title, message),
      showSuccess: (message, title = "Tamamlandı") => show("success", title, message)
    }),
    [show]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {feedback ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            { paddingTop: Math.max(insets.top, spacing.sm) },
            animatedStyle
          ]}
        >
          <View
            style={[
              styles.toast,
              styles[feedback.kind]
            ]}
          >
            <View style={styles.copy}>
              <Text style={styles.title}>{feedback.title}</Text>
              <Text style={styles.message}>{feedback.message}</Text>
            </View>
            <Pressable
              accessibilityLabel="Bildirimi kapat"
              accessibilityRole="button"
              onPress={hide}
              style={styles.close}
            >
              <X color={colors.feedbackForeground} size={18} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  toastWrap: {
    left: spacing.lg,
    position: "absolute",
    right: spacing.lg,
    top: 0,
    zIndex: 100
  },
  toast: {
    ...radii.card,
    alignItems: "center",
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24
  },
  error: {
    backgroundColor: colors.feedbackErrorBackground
  },
  success: {
    backgroundColor: colors.feedbackSuccessBackground
  },
  info: {
    backgroundColor: colors.feedbackInfoBackground
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    ...typography.label,
    color: colors.feedbackForeground
  },
  message: {
    ...typography.body,
    color: colors.feedbackForeground,
    fontSize: 14,
    lineHeight: 20
  },
  close: {
    alignItems: "center",
    backgroundColor: colors.feedbackActionBackground,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  }
});
