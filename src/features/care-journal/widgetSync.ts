import { Platform } from "react-native";

import {
  getCareHandoverSnapshot,
  getNightShiftState,
  listCareJournalEntries,
  listCareReminders,
  type CareJournalEntry
} from "@/api/careJournal";
import { getNextUpcomingVaccination } from "@/api/vaccinations";

type ContextCard = {
  headline: string;
  detail: string;
  destination: string;
};

export async function syncCareQuickWidget(
  babyId: string | null,
  subjectName: string,
  suppliedEntries?: CareJournalEntry[]
) {
  if (Platform.OS !== "ios") return;

  try {
    const { default: CareQuickWidget } = await import(
      "@/widgets/CareQuickWidget.ios"
    );
    const [entries, snapshot, shift, reminders, vaccination] = await Promise.all([
      suppliedEntries
        ? Promise.resolve(suppliedEntries)
        : babyId
          ? listCareJournalEntries(babyId, 300).catch(() => [])
          : Promise.resolve([]),
      babyId ? getCareHandoverSnapshot(babyId).catch(() => null) : Promise.resolve(null),
      babyId ? getNightShiftState(babyId).catch(() => null) : Promise.resolve(null),
      babyId ? listCareReminders(babyId).catch(() => []) : Promise.resolve([]),
      getNextUpcomingVaccination(babyId, subjectName).catch(() => null)
    ]);

    const activeSleep = snapshot?.active_timers?.find(
      (timer) => timer.timer_type === "sleep"
    );
    const nextReminder = reminders
      .filter(
        (reminder) =>
          reminder.status === "scheduled" &&
          reminder.alarm_kind !== "shift_summary" &&
          Date.parse(reminder.scheduled_for) > Date.now()
      )
      .sort(
        (a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for)
      )[0];
    const lastEntry = findLatestEntry(entries, () => true);
    const now = new Date();

    CareQuickWidget.updateTimeline(
      Array.from({ length: 25 }, (_, hour) => {
        const date = new Date(now.getTime() + hour * 60 * 60 * 1000);
        const cards: ContextCard[] = [];

        if (activeSleep) {
          cards.push({
            headline: `Uyku ${relativeStart(activeSleep.started_at, date)} başladı`,
            detail: `${formatClock(activeSleep.started_at)} başlangıç · süre devam ediyor`,
            destination: babyId
              ? `hamiletakip://night-shift?babyId=${babyId}`
              : "hamiletakip://care-journal"
          });
        }

        if (shift?.status === "active") {
          const hasEnded = Date.parse(shift.planned_end_at) <= date.getTime();
          cards.push({
            headline: hasEnded
              ? "Gece vardiyası planlanan saatte tamamlandı"
              : `Gece vardiyası ${formatClock(shift.planned_end_at)}’da bitecek`,
            detail: hasEnded
              ? "Teslim özetini görmek için dokun."
              : `${shift.caregiver_name} vardiyada`,
            destination: `hamiletakip://night-shift?babyId=${shift.baby_id}`
          });
        }

        if (vaccination && !vaccination.completed) {
          const days = calendarDaysBetween(date, vaccination.scheduledDate);
          if (days >= 0 && days <= 7) {
            cards.push({
              headline:
                days === 0
                  ? `${vaccination.vaccineName} bugün`
                  : days === 1
                    ? `${vaccination.vaccineName} yarın`
                    : `${vaccination.vaccineName} aşısına ${days} gün kaldı`,
              detail: `${vaccination.subjectName} · ${formatDate(vaccination.scheduledDate)}`,
              destination: "hamiletakip://vaccines"
            });
          }
        }

        if (nextReminder) {
          const reminderAt = Date.parse(nextReminder.scheduled_for);
          const hoursUntil = (reminderAt - date.getTime()) / 3_600_000;
          if (hoursUntil >= 0 && hoursUntil <= 12) {
            cards.push({
              headline: `Sıradaki hatırlatma ${formatClock(nextReminder.scheduled_for)}`,
              detail: nextReminder.title,
              destination: babyId
                ? `hamiletakip://night-shift?babyId=${babyId}`
                : "hamiletakip://home"
            });
          }
        }

        if (cards.length === 0) {
          const hasTodayEntry = entries.some((entry) =>
            isSameLocalDay(entry.occurred_at, date)
          );
          cards.push(
            hasTodayEntry && lastEntry
              ? {
                  headline: `Son durum: ${entryLabel(lastEntry.entry_type)} ${relativeTime(lastEntry.occurred_at, date)}`,
                  detail: `${formatClock(lastEntry.occurred_at)} tarihinde kaydedildi`,
                  destination: "hamiletakip://care-journal"
                }
              : {
                  headline: "Bugün yeni kayıt yok",
                  detail: "İstersen yalnızca son durumu görmek için dokun.",
                  destination: babyId
                    ? "hamiletakip://care-journal"
                    : "hamiletakip://home"
                }
          );
        }

        const primary = cards[0] ?? {
          headline: "Bugün yeni kayıt yok",
          detail: "İstersen yalnızca son durumu görmek için dokun.",
          destination: "hamiletakip://home"
        };
        const alternate = cards[1];
        return {
          date,
          props: {
            subjectName,
            headline: primary.headline,
            detail: primary.detail,
            alternateHeadline: alternate?.headline ?? "",
            alternateDetail: alternate?.detail ?? "",
            alternateDestination: alternate?.destination ?? "",
            destination: primary.destination,
            showAlternate: false
          }
        };
      })
    );
  } catch (error) {
    console.warn("Care context widget could not be updated", error);
  }
}

function findLatestEntry(
  entries: CareJournalEntry[],
  predicate: (entry: CareJournalEntry) => boolean
) {
  return entries
    .filter(predicate)
    .reduce<CareJournalEntry | undefined>((latest, entry) => {
      if (!latest) return entry;
      return Date.parse(entry.occurred_at) > Date.parse(latest.occurred_at)
        ? entry
        : latest;
    }, undefined);
}

function isSameLocalDay(value: string, target: Date) {
  return new Date(value).toDateString() === target.toDateString();
}

function relativeStart(value: string, target: Date) {
  const minutes = Math.max(
    0,
    Math.round((target.getTime() - Date.parse(value)) / 60_000)
  );
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  return `${hours} sa ${minutes % 60} dk önce`;
}

function relativeTime(value: string, target: Date) {
  const minutes = Math.max(
    0,
    Math.round((target.getTime() - Date.parse(value)) / 60_000)
  );
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function entryLabel(type: CareJournalEntry["entry_type"]) {
  if (type === "breastfeeding" || type === "bottle") return "beslenme";
  if (type === "diaper") return "bez";
  if (type === "sleep") return "uyku";
  return "bakım kaydı";
}

function calendarDaysBetween(from: Date, dateOnly: string) {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const [year = 1970, month = 1, day = 1] = dateOnly.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  return Math.round((target.getTime() - fromDay.getTime()) / 86_400_000);
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long"
  }).format(new Date(year, month - 1, day));
}
