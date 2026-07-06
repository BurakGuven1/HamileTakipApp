import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AdGateState = {
  dateKey: string;
  interstitialCount: number;
  recordInterstitial: () => void;
  canShowInterstitial: (limit?: number) => boolean;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const useAdGateStore = create<AdGateState>()(
  persist(
    (set, get) => ({
      dateKey: todayKey(),
      interstitialCount: 0,
      recordInterstitial: () =>
        set((state) => {
          const nextDateKey = todayKey();

          if (state.dateKey !== nextDateKey) {
            return { dateKey: nextDateKey, interstitialCount: 1 };
          }

          return { interstitialCount: state.interstitialCount + 1 };
        }),
      canShowInterstitial: (limit = 4) => {
        const state = get();
        const nextDateKey = todayKey();

        if (state.dateKey !== nextDateKey) {
          return true;
        }

        return state.interstitialCount < limit;
      }
    }),
    {
      name: "ad-gate",
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
