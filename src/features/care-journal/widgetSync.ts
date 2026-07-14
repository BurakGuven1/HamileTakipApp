import { Platform } from "react-native";

import type { CareJournalEntry } from "@/api/careJournal";

export async function syncCareQuickWidget(
  babyName: string,
  entries: CareJournalEntry[]
) {
  if (Platform.OS !== "ios") return;

  try {
    const { default: CareQuickWidget } = await import("@/widgets/CareQuickWidget.ios");
    const lastFeed = entries.find(
      (entry) => entry.entry_type === "breastfeeding" || entry.entry_type === "bottle"
    );
    const lastDiaper = entries.find((entry) => entry.entry_type === "diaper");
    const sleepMinutes = entries
      .filter((entry) => entry.entry_type === "sleep" && isToday(entry.occurred_at))
      .reduce((sum, entry) => sum + durationMinutes(entry), 0);

    CareQuickWidget.updateSnapshot({
      babyName,
      lastDiaper: lastDiaper ? relativeTime(lastDiaper.occurred_at) : "Kayıt yok",
      lastFeed: lastFeed ? relativeTime(lastFeed.occurred_at) : "Kayıt yok",
      sleepToday: formatMinutes(sleepMinutes)
    });
  } catch (error) {
    console.warn("Care widget snapshot could not be updated", error);
  }
}

function durationMinutes(entry: CareJournalEntry) {
  if (!entry.ended_at) return 0;
  return Math.max(0, Math.round((Date.parse(entry.ended_at) - Date.parse(entry.occurred_at)) / 60_000));
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  return `${Math.floor(minutes / 60)} sa önce`;
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} dk`;
  return `${Math.floor(value / 60)} sa ${value % 60} dk`;
}
