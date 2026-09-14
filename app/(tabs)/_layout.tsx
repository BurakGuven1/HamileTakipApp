import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  Baby,
  CalendarHeart,
  Home,
  Images,
  MessageCircleHeart,
  Music2,
  UserRound
} from "lucide-react-native";
import type { ColorValue } from "react-native";

import { listBabies } from "@/api/babies";
import { isCurrentUserFamilyFather } from "@/api/familyAccess";
import { AnimatedTabIcon } from "@/components/motion";
import { getCurrentProfile } from "@/api/profiles";
import { getExperienceStage } from "@/features/life-stage/lifeStage";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

type TabIconProps = {
  activeBackground: string;
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
  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const babiesQuery = useQuery({
    queryKey: ["babies"],
    queryFn: listBabies
  });
  const experienceStage = getExperienceStage(
    profileQuery.data,
    Boolean(babiesQuery.data?.length)
  );
  const lifeStageUnavailable =
    profileQuery.isPending ||
    profileQuery.isError ||
    babiesQuery.isPending ||
    babiesQuery.isError ||
    !profileQuery.data;
  const activeBackground = colors.tabActiveSurface;
  const hideWomensForum =
    fatherRoleQuery.isPending || fatherRoleQuery.isError || fatherRoleQuery.data === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accentColor.theme.navigationPrimary,
        tabBarInactiveTintColor: colors.tabInactive,
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
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={Home} />
        }}
      />
      <Tabs.Screen
        name="pregnancy-tools"
        options={{
          href:
            lifeStageUnavailable || experienceStage !== "pregnancy"
              ? null
              : undefined,
          title: "Araçlar",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={CalendarHeart} />
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          href:
            lifeStageUnavailable || experienceStage === "pregnancy"
              ? null
              : undefined,
          title: "Bebek",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={Baby} />
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          href:
            lifeStageUnavailable || experienceStage !== "postpartum"
              ? null
              : undefined,
          title: "Galeri",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={Images} />
        }}
      />
      <Tabs.Screen
        name="lullaby"
        options={{
          href: null,
          title: "Ninni",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={Music2} />
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          href: hideWomensForum ? null : undefined,
          title: "Forum",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={MessageCircleHeart} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profil",
          tabBarIcon: (props) => <TabIcon {...props} activeBackground={activeBackground} icon={UserRound} />
        }}
      />
      <Tabs.Screen
        name="vaccines"
        options={{ href: null, title: "Aşı merkezi" }}
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
        name="pregnancy-health-file"
        options={{ href: null, title: "Sağlık Dosyam" }}
      />
      <Tabs.Screen
        name="pregnancy-nutrition"
        options={{ href: null, title: "Su ve Takviye Rehberi" }}
      />
      <Tabs.Screen
        name="baby-names"
        options={{ href: null, title: "Bebek İsimleri", tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="care-journal"
        options={{ href: null, title: "Akıllı bakım günlüğü" }}
      />
      <Tabs.Screen
        name="family-planner"
        options={{ href: null, title: "Aile görevleri" }}
      />
      <Tabs.Screen
        name="doctor-visit"
        options={{ href: null, title: "Doktor görüşmesine hazırlan" }}
      />
      <Tabs.Screen
        name="teething"
        options={{ href: null, title: "Diş takibi" }}
      />
      <Tabs.Screen
        name="solid-food-recipes"
        options={{ href: null, title: "Ek gıda tarifleri" }}
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
        name="symptom-check"
        options={{ href: null, title: "Bu normal mi?" }}
      />
      <Tabs.Screen
        name="contraction-timer"
        options={{ href: null, title: "Kasılma sayacı" }}
      />
      <Tabs.Screen
        name="document-insight"
        options={{ href: null, title: "Belgeyi Anla" }}
      />
      <Tabs.Screen
        name="sleep-rhythm"
        options={{ href: null, title: "Uyku Ritmi", tabBarStyle: { display: "none" } }}
      />
    </Tabs>
  );
}

function TabIcon({
  activeBackground,
  color,
  focused = false,
  icon,
  size
}: TabIconProps & { icon: LucideIcon }) {
  return (
    <AnimatedTabIcon
      activeBackground={activeBackground}
      color={resolveIconColor(color, focused)}
      focused={focused}
      icon={icon}
      size={size}
    />
  );
}

function resolveIconColor(color: ColorValue, focused = false) {
  return typeof color === "string"
    ? color
    : focused
      ? colors.primary
      : colors.tabInactive;
}
