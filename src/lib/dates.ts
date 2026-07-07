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

export function getPregnancyWeek(dueDate?: string | null) {
  const date = parseDateOnly(dueDate);
  if (!date) {
    return null;
  }

  const totalDays = 280;
  const today = new Date();
  const daysUntilDue = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const pregnantDays = totalDays - daysUntilDue;
  return Math.max(1, Math.min(42, Math.floor(pregnantDays / 7)));
}

export function getBabyAgeLabel(birthDate?: string | null) {
  const birth = parseDateOnly(birthDate);
  if (!birth) {
    return "Yas bilgisi yok";
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
      Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
    );
    return `${days} gunluk`;
  }

  if (months < 12) {
    return `${months} aylik`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} yas ${remainingMonths} aylik`
    : `${years} yasinda`;
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
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Yarin";
  if (diffDays > 1) return `${diffDays} gun sonra`;
  if (diffDays === -1) return "Dun";
  return `${Math.abs(diffDays)} gun once`;
}
