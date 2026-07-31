export function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

const dayInMs = 1000 * 60 * 60 * 24;
const pregnancyPastDueToleranceDays = 14;
const pregnancyMaximumDaysUntilDue = 294;

export function getPregnancyDueDateBounds(reference = new Date()) {
  const minimumDate = new Date(reference);
  const maximumDate = new Date(reference);
  minimumDate.setHours(0, 0, 0, 0);
  maximumDate.setHours(0, 0, 0, 0);
  minimumDate.setDate(minimumDate.getDate() - pregnancyPastDueToleranceDays);
  maximumDate.setDate(maximumDate.getDate() + pregnancyMaximumDaysUntilDue);
  return { maximumDate, minimumDate };
}

export function getPregnancyDueDateError(value?: string | null) {
  const dueDate = parseDateOnly(value);
  if (!dueDate || toDateOnly(dueDate) !== value) {
    return "Geçerli bir tahmini doğum tarihi seçmelisin.";
  }

  const { maximumDate, minimumDate } = getPregnancyDueDateBounds();
  if (dueDate < minimumDate || dueDate > maximumDate) {
    return "Tahmini doğum tarihi bugünden en fazla 14 gün önce veya 42 hafta sonra olabilir.";
  }

  return null;
}

function getDateOnlyDiffDays(target: Date, base = new Date()) {
  const targetDate = new Date(target);
  const baseDate = new Date(base);
  targetDate.setHours(0, 0, 0, 0);
  baseDate.setHours(0, 0, 0, 0);

  return Math.round((targetDate.getTime() - baseDate.getTime()) / dayInMs);
}

export function formatDate(value?: string | null) {
  const date = parseDateOnly(value);
  if (!date) {
    return "Tarih yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function getPregnancyProgress(dueDate?: string | null) {
  const due = parseDateOnly(dueDate);
  if (!due) {
    return null;
  }

  const totalDays = 280;
  const maxTrackedDays = 294;
  const daysUntilDue = getDateOnlyDiffDays(due);
  const day = Math.max(1, Math.min(maxTrackedDays, totalDays - daysUntilDue));
  const week = Math.max(1, Math.min(42, Math.floor(day / 7)));

  return {
    day,
    daysUntilDue: Math.max(0, daysUntilDue),
    totalDays,
    week
  };
}

export function getPregnancyWeek(dueDate?: string | null) {
  return getPregnancyProgress(dueDate)?.week ?? null;
}

export function getBabyAgeLabel(birthDate?: string | null) {
  const birth = parseDateOnly(birthDate);
  if (!birth) {
    return "Yaş bilgisi yok";
  }

  const today = new Date();
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    today.getMonth() -
    birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months < 1) {
    const days = Math.max(
      0,
      Math.floor((today.getTime() - birth.getTime()) / dayInMs)
    );
    return `${days} günlük`;
  }

  if (months < 12) {
    return `${months} aylık`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} yaş ${remainingMonths} aylık`
    : `${years} yaşında`;
}

export function getRelativeDayLabel(value?: string | null) {
  const date = parseDateOnly(value);
  if (!date) {
    return "Tarih yok";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / dayInMs
  );

  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Yarın";
  if (diffDays > 1) return `${diffDays} gün sonra`;
  if (diffDays === -1) return "Dün";
  return `${Math.abs(diffDays)} gün önce`;
}
