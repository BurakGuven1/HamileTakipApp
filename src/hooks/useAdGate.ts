import { showInterstitialAd } from "@/lib/admob";
import { useAdGateStore } from "@/store/adGateStore";

export function useAdGate() {
  const canShowInterstitial = useAdGateStore(
    (state) => state.canShowInterstitial
  );
  const recordInterstitial = useAdGateStore(
    (state) => state.recordInterstitial
  );

  async function maybeShowInterstitial(triggerSource: string) {
    if (!canShowInterstitial()) {
      return false;
    }

    const shown = await showInterstitialAd(triggerSource);

    if (shown) {
      recordInterstitial();
    }

    return shown;
  }

  return { maybeShowInterstitial };
}
