import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getCurrentProfile } from "@/api/profiles";
import { getCurrentFamilyMembership } from "@/api/familyAccess";
import { QueryState } from "@/components/QueryState";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

type StartRoute = "/sign-in" | "/onboarding" | "/home";

export default function IndexRoute() {
  const [route, setRoute] = useState<StartRoute>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(false);
    setRoute(undefined);
    setAttempt((value) => value + 1);
  }, []);

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

      const [profile, membership] = await Promise.all([
        getCurrentProfile(),
        getCurrentFamilyMembership()
      ]);
      if (!mounted) return;

      if (membership) {
        setRoute("/home");
        return;
      }

      const hasParentNames =
        Boolean(profile?.mother_name?.trim()) &&
        Boolean(profile?.father_name?.trim());
      setRoute(profile?.onboarding_completed && hasParentNames ? "/home" : "/onboarding");
    }

    resolveRoute().catch(() => {
      if (mounted) setError(true);
    });

    return () => {
      mounted = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <View style={styles.loading}>
        <QueryState
          description="Oturum ve profil bilgilerin alınamadı. İnternet bağlantını kontrol edip tekrar deneyebilirsin."
          onRetry={retry}
          title="Uygulama başlatılamadı"
        />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.loading}>
        <QueryState loading description="Profilin hazırlanıyor…" />
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
    justifyContent: "center",
    paddingHorizontal: 24
  }
});
