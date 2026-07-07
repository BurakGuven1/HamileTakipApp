import { Tabs } from "expo-router";
import {
  Baby,
  Home,
  Images,
  MessageCircleHeart,
  Music2,
  UserRound
} from "lucide-react-native";
import type { ColorValue } from "react-native";

import { colors, radii, spacing, typography } from "@/theme";

type TabIconProps = {
  color: ColorValue;
  size: number;
};

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
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderTopWidth: 1,
          bottom: spacing.sm,
          height: 72,
          left: spacing.sm,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
          position: "absolute",
          right: spacing.sm,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 8
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Ana",
          tabBarIcon: (props) => <HomeIcon {...props} />
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          title: "Bebek",
          tabBarIcon: (props) => <BabyIcon {...props} />
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: "Galeri",
          tabBarIcon: (props) => <GalleryIcon {...props} />
        }}
      />
      <Tabs.Screen
        name="lullaby"
        options={{
          title: "Ninni",
          tabBarIcon: (props) => <LullabyIcon {...props} />
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: "Forum",
          tabBarIcon: (props) => <ForumIcon {...props} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profil",
          tabBarIcon: (props) => <ProfileIcon {...props} />
        }}
      />
    </Tabs>
  );
}

function HomeIcon({ color, size }: TabIconProps) {
  return <Home color={String(color)} size={size} strokeWidth={2.4} />;
}

function BabyIcon({ color, size }: TabIconProps) {
  return <Baby color={String(color)} size={size} strokeWidth={2.4} />;
}

function GalleryIcon({ color, size }: TabIconProps) {
  return <Images color={String(color)} size={size} strokeWidth={2.4} />;
}

function LullabyIcon({ color, size }: TabIconProps) {
  return <Music2 color={String(color)} size={size} strokeWidth={2.4} />;
}

function ForumIcon({ color, size }: TabIconProps) {
  return <MessageCircleHeart color={String(color)} size={size} strokeWidth={2.4} />;
}

function ProfileIcon({ color, size }: TabIconProps) {
  return <UserRound color={String(color)} size={size} strokeWidth={2.4} />;
}
