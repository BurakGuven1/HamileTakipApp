import { useEffect } from "react";

import { initializeAds } from "@/lib/admob";
import { registerForPushNotifications } from "@/lib/notifications";
import { configureRevenueCat } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";

export function useAppBootstrap() {
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      configureRevenueCat(user?.id);
      await initializeAds();
      await registerForPushNotifications();
    }

    bootstrap().catch((error) => {
      console.warn("App bootstrap failed", error);
    });

    return () => {
      mounted = false;
    };
  }, []);
}
