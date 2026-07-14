import type { CareActiveTimer } from "@/api/careJournal";

export async function syncCareTimerLiveActivity(_babyName: string, _timers: CareActiveTimer[]) {
  // Live Activities are an iOS system surface. Android keeps using the shared
  // server timestamp and local notification flow.
}
