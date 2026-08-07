import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function ForumLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "ios_from_right",
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        headerShown: false
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="moderation" />
    </Stack>
  );
}
