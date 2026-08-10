import Constants from "expo-constants";

import {
  getAnalyticsContext,
  trackProductEvent
} from "@/services/analytics/productAnalytics";
import { supabase } from "@/lib/supabase";

export async function trackPaywallView(
  source: string,
  options: { paywallViewId?: string } = {}
): Promise<void> {
  try {
    const [context, { data, error: userError }] = await Promise.all([
      getAnalyticsContext(),
      supabase.auth.getUser()
    ]);

    if (userError) {
      console.warn("Paywall kullanicisi alinamadi", userError);
      return;
    }

    if (!data.user) return;

    const paywallViewId = options.paywallViewId;

    const { error } = await supabase.from("paywall_views").insert({
      app_version:
        Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
      id: paywallViewId,
      installation_id: context.installationId,
      session_id: context.sessionId,
      source,
      user_id: data.user.id
    });

    if (error) {
      console.warn("Paywall goruntulemesi kaydedilemedi", error);
      return;
    }

    await trackProductEvent(
      "paywall_presented",
      { source },
      { paywallViewId }
    );
  } catch (error) {
    console.warn("Paywall goruntulemesi kaydedilemedi", error);
  }
}
