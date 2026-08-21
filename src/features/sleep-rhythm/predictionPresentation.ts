export type SleepPredictionPresentation =
  | "checking_access"
  | "learning"
  | "locked"
  | "ready"
  | "updating";

export function getSleepPredictionPresentation({
  isAccessLoading = false,
  isPremium,
  predictionReady,
  requiredSampleCount,
  sampleCount
}: {
  isAccessLoading?: boolean;
  isPremium: boolean;
  predictionReady: boolean;
  requiredSampleCount: number;
  sampleCount: number;
}): SleepPredictionPresentation {
  if (sampleCount < requiredSampleCount) return "learning";
  if (isAccessLoading) return "checking_access";
  if (!isPremium) return "locked";
  return predictionReady ? "ready" : "updating";
}
