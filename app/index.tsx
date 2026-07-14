import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getCurrentProfile } from "@/api/profiles";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

type StartRoute = "/sign-in" | "/onboarding" | "/home";

export default function IndexRoute() {
  const [route, setRoute] = useState<StartRoute>();

  useEffect(() => {
    let mounted = true;

    async function resolveRoute() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        setRoute("/sign-in");
        return;
      }

      const profile = await getCurrentProfile();
      if (!mounted) return;

      const hasParentNames =
        Boolean(profile?.mother_name?.trim()) &&
        Boolean(profile?.father_name?.trim());
      setRoute(profile?.onboarding_completed && hasParentNames ? "/home" : "/onboarding");
    }

    resolveRoute().catch(() => {
      if (mounted) setRoute("/sign-in");
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!route) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={route} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  }
});
