import { useEffect } from "react";

import { registerAndSavePushToken } from "@/lib/notifications";
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

      configureRevenueCat();
      if (user) {
        await registerAndSavePushToken();
      }
    }

    bootstrap().catch((error) => {
      console.warn("App bootstrap failed", error);
    });

    return () => {
      mounted = false;
    };
  }, []);
}
