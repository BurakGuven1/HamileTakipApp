import type { DocumentInterpretationContext } from "./types.ts";

/**
 * Which reference ranges apply is a function of whether the reader is pregnant
 * and how far along she is. When either is unknown the context stays "unknown",
 * which the guard treats as *possibly pregnant* — for a pregnancy app, assuming
 * the non-pregnant ranges is the wrong way to be wrong.
 */
export function resolveInterpretationContext(input: {
  isPregnant: boolean | null | undefined;
  pregnancyWeek: number | null;
}): DocumentInterpretationContext {
  if (input.isPregnant === false) {
    return { pregnancyStatus: "not_pregnant", trimester: null, pregnancyWeek: null };
  }
  if (input.isPregnant !== true) {
    return { pregnancyStatus: "unknown", trimester: null, pregnancyWeek: null };
  }
  const week = input.pregnancyWeek;
  return {
    pregnancyStatus: "pregnant",
    trimester: getTrimester(week),
    pregnancyWeek: week !== null && Number.isFinite(week) && week >= 1 && week <= 45 ? week : null
  };
}

export function getTrimester(week: number | null): 1 | 2 | 3 | null {
  if (week === null || !Number.isFinite(week) || week < 1 || week > 45) return null;
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

export function getTrimesterLabel(context: DocumentInterpretationContext) {
  if (context.pregnancyStatus !== "pregnant") return "";
  if (!context.trimester) return "Gebelik dönemi";
  return `Gebelik ${context.trimester}. dönem`;
}
