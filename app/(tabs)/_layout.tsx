import { Tabs } from "expo-router";

import { colors, typography } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: typography.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingBottom: 10,
          paddingTop: 8
        }
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Ana" }} />
      <Tabs.Screen name="baby" options={{ title: "Bebek" }} />
      <Tabs.Screen name="gallery" options={{ title: "Galeri" }} />
      <Tabs.Screen name="lullaby" options={{ title: "Ninni" }} />
      <Tabs.Screen name="forum" options={{ title: "Forum" }} />
      <Tabs.Screen name="settings" options={{ title: "Ayar" }} />
    </Tabs>
  );
}
