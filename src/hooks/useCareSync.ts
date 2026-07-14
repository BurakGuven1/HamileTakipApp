import NetInfo from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import {
  flushCareSyncQueue,
  getCareSyncStatus,
  setCareSyncOnline,
  subscribeCareSync
} from "@/features/care-journal/careSync";

export function useCareSyncBootstrap() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshCareData = () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["care-journal"] }),
        queryClient.invalidateQueries({ queryKey: ["care-handover"] }),
        queryClient.invalidateQueries({ queryKey: ["care-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["care-sync-status"] }),
        queryClient.invalidateQueries({ queryKey: ["shared-care-timers"] })
      ]).catch(() => undefined);
    };

    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setCareSyncOnline(online);
      if (online) {
        flushCareSyncQueue().then(refreshCareData).catch(() => undefined);
      }
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        flushCareSyncQueue().then(refreshCareData).catch(() => undefined);
      }
    });
    const unsubscribeSync = subscribeCareSync(refreshCareData);

    flushCareSyncQueue().then(refreshCareData).catch(() => undefined);
    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
      appStateSubscription.remove();
    };
  }, [queryClient]);
}

export function useCareSyncStatus(babyId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => subscribeCareSync(() => {
    queryClient.invalidateQueries({ queryKey: ["care-sync-status", babyId] }).catch(() => undefined);
  }), [babyId, queryClient]);

  return useQuery({
    queryKey: ["care-sync-status", babyId],
    queryFn: () => getCareSyncStatus(babyId),
    refetchInterval: 15_000
  });
}
