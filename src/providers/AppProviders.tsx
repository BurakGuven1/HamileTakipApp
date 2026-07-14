import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useCareReminderVoice } from "@/hooks/useCareReminderVoice";
import { useCareSyncBootstrap } from "@/hooks/useCareSync";
import { useNotificationNavigation } from "@/hooks/useNotificationNavigation";
import { useRevenueCatSync } from "@/hooks/useRevenueCatSync";
import { queryClient } from "@/lib/queryClient";
import { AppThemeProvider } from "@/providers/AppThemeProvider";
import { FeedbackProvider } from "@/providers/FeedbackProvider";
import { LullabyPlayerProvider } from "@/providers/LullabyPlayerProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppBootstrappers />
          <AppThemeProvider>
            <FeedbackProvider>
              <LullabyPlayerProvider>{children}</LullabyPlayerProvider>
            </FeedbackProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppBootstrappers() {
  useAppBootstrap();
  useCareReminderVoice();
  useCareSyncBootstrap();
  useNotificationNavigation();
  useRevenueCatSync();

  return null;
}
