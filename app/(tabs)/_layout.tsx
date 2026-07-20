import { useQuery } from "@tanstack/react-query";
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
import { isCurrentUserFamilyFather } from "@/api/familyAccess";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type TabIconProps = {
  color: ColorValue;
  focused?: boolean;
  size: number;
};

export default function TabsLayout() {
  const accentColor = useAppTheme();
  const fatherRoleQuery = useQuery({
    queryKey: ["current-user-is-family-father"],
    queryFn: isCurrentUserFamilyFather
  });
  const hideWomensForum =
    fatherRoleQuery.isPending || fatherRoleQuery.isError || fatherRoleQuery.data === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accentColor.theme.navigationPrimary,
        tabBarInactiveTintColor: accentColor.isDark ? "#C8C1CB" : "#655F57",
        tabBarLabelStyle: typography.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...radii.card,
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
          href: hideWomensForum ? null : undefined,
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
      <Tabs.Screen
        name="pregnancy-tools"
        options={{
          href: null,
          title: "Hamilelik Araçları"
        }}
      />
      <Tabs.Screen
        name="pregnancy-exercise"
        options={{
          href: null,
          title: "Hamile Egzersizi"
        }}
      />
      <Tabs.Screen
        name="pregnancy-timeline"
        options={{
          href: null,
          title: "Hamilelik Çizelgesi"
        }}
      />
      <Tabs.Screen
        name="pregnancy-nutrition"
        options={{ href: null, title: "Su ve Takviye Rehberi" }}
      />
      <Tabs.Screen
        name="care-journal"
        options={{ href: null, title: "Akıllı bakım günlüğü" }}
      />
      <Tabs.Screen
        name="birth-preparation"
        options={{ href: null, title: "Doğuma hazırlık" }}
      />
      <Tabs.Screen
        name="night-shift"
        options={{ href: null, title: "Gece vardiyası", tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="document-insight"
        options={{ href: null, title: "Belgeyi Anla" }}
      />
    </Tabs>
  );
}

function HomeIcon({ color, focused, size }: TabIconProps) {
  return <Home color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function BabyIcon({ color, focused, size }: TabIconProps) {
  return <Baby color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function GalleryIcon({ color, focused, size }: TabIconProps) {
  return <Images color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function LullabyIcon({ color, focused, size }: TabIconProps) {
  return <Music2 color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function ForumIcon({ color, focused, size }: TabIconProps) {
  return <MessageCircleHeart color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function ProfileIcon({ color, focused, size }: TabIconProps) {
  return <UserRound color={resolveIconColor(color, focused)} size={size} strokeWidth={2.4} />;
}

function resolveIconColor(color: ColorValue, focused = false) {
  return typeof color === "string" ? color : focused ? "#3F6F59" : "#655F57";
}
