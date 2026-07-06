import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  InterstitialAd,
  TestIds
} from "react-native-google-mobile-ads";

import { getInterstitialAdUnitId } from "@/config/env";
import { trackEvent } from "@/lib/analytics";

let initialized = false;

export async function initializeAds() {
  if (initialized || Platform.OS === "web") {
    return;
  }

  await mobileAds().initialize();
  initialized = true;
}

export async function showInterstitialAd(triggerSource: string) {
  if (Platform.OS === "web") {
    return false;
  }

  await initializeAds();

  const unitId = getInterstitialAdUnitId() ?? TestIds.INTERSTITIAL;
  const interstitial = InterstitialAd.createForAdRequest(unitId);

  return new Promise<boolean>((resolve) => {
    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        trackEvent("ad_impression", { trigger_source: triggerSource });
        interstitial.show();
      }
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        trackEvent("ad_completed", { trigger_source: triggerSource });
        resolve(true);
      }
    );

    interstitial.load();
  });
}
