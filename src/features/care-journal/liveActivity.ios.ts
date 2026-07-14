import type { CareActiveTimer } from "@/api/careJournal";
import CareTimerLiveActivity, { type CareTimerLiveActivityProps } from "@/widgets/CareTimerLiveActivity.ios";

export async function syncCareTimerLiveActivity(babyName: string, timers: CareActiveTimer[]) {
  const active = timers.filter((timer) => !timer.ended_at);
  const instances = CareTimerLiveActivity.getInstances();
  if (active.length === 0) {
    await Promise.all(instances.map((instance) => instance.end("immediate")));
    return;
  }

  const pumping = active.filter((timer) => timer.timer_type === "pumping");
  const primary = pumping[0] ?? active[0];
  if (!primary) return;
  const props: CareTimerLiveActivityProps = {
    babyName,
    leftStartedAt: pumping.find((timer) => timer.breast_side === "left")?.started_at ?? null,
    rightStartedAt: pumping.find((timer) => timer.breast_side === "right")?.started_at ?? null,
    startedAt: primary.started_at,
    timerType: primary.timer_type
  };
  if (instances.length === 0) {
    CareTimerLiveActivity.start(props, "hamiletakip://care-journal");
    return;
  }
  const firstInstance = instances[0];
  if (!firstInstance) return;
  await firstInstance.update(props);
  await Promise.all(instances.slice(1).map((instance) => instance.end("immediate")));
}
