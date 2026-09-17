import { parseDateOnly } from "@/lib/dates";

import type { MilestoneSlot, MilestoneValues } from "./types";

/**
 * Kart üzerindeki serbest yazı. Uzun cümle kartın kompozisyonunu bozuyor;
 * 30 karakter, "Bir aylık oldun canım" gibi kısa bir seslenişe yetiyor.
 */
export const MAX_CAPTION_LENGTH = 30;

export function sanitizeCaption(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  // Emoji ve birleşik harfler tek karakter sayılsın diye kod birimi değil,
  // kod noktası üzerinden kesiyoruz.
  const collapsed = input.replace(/\s+/g, " ").trim();
  return Array.from(collapsed).slice(0, MAX_CAPTION_LENGTH).join("").trim();
}

export function formatWeightLabel(weightKg: number | null | undefined) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const rounded = Math.round(weightKg * 100) / 100;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
  return `${text.replace(".", ",")} kg`;
}

export function formatHeightLabel(heightCm: number | null | undefined) {
  if (typeof heightCm !== "number" || !Number.isFinite(heightCm) || heightCm <= 0) {
    return null;
  }

  const rounded = Math.round(heightCm * 10) / 10;
  const text = rounded % 1 === 0 ? String(rounded) : String(rounded).replace(".", ",");
  return `${text} cm`;
}

export function formatCardDate(value: string | null | undefined) {
  const date = parseDateOnly(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })
    .format(date)
    .toLocaleUpperCase("tr-TR");
}

/**
 * Yaş etiketi fotoğrafın çekildiği güne göre hesaplanır; anne üç ay önceki bir
 * kareyi bugün kart yaparsa "3 AYLIK" yazmalı, "bugün kaç aylık" değil.
 */
export function getMilestoneAgeLabel(
  birthDate: string | null | undefined,
  photoDate: string | null | undefined
) {
  const birth = parseDateOnly(birthDate);
  const taken = parseDateOnly(photoDate) ?? new Date();
  if (!birth || taken.getTime() < birth.getTime()) {
    return null;
  }

  let months =
    (taken.getFullYear() - birth.getFullYear()) * 12 +
    taken.getMonth() -
    birth.getMonth();
  if (taken.getDate() < birth.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);

  if (months < 1) {
    const days = Math.max(
      0,
      Math.round((taken.getTime() - birth.getTime()) / 86_400_000)
    );
    return days <= 0 ? "YENİ DOĞAN" : `${days} GÜNLÜK`;
  }

  if (months < 12) {
    return `${months} AYLIK`;
  }

  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return remaining > 0 ? `${years} YAŞ ${remaining} AY` : `${years} YAŞINDA`;
}

/**
 * Kart yerleşimi sabit slotlardan oluşur; bebek fotoğrafın ortasında durduğu
 * için süslemeler kenarlarda kalır. Değeri olmayan rozet hiç çizilmez ve
 * altındakiler yukarı kayar, yoksa sağ sütunda boşluk kalıyor.
 */
export function getMilestoneSlots(values: MilestoneValues): MilestoneSlot[] {
  const slots: MilestoneSlot[] = [
    { align: "left", id: "headline", position: { x: 0.06, y: 0.05 }, width: 0.42 }
  ];

  const badgeIds = (["weight", "height", "date"] as const).filter((id) => {
    if (id === "weight") return Boolean(values.weightLabel);
    if (id === "height") return Boolean(values.heightLabel);
    return Boolean(values.dateLabel);
  });

  badgeIds.forEach((id, index) => {
    slots.push({
      align: "right",
      id,
      position: { x: 0.94, y: 0.06 + index * 0.115 },
      width: 0.42
    });
  });

  if (values.ageLabel) {
    slots.push({ align: "right", id: "age", position: { x: 0.94, y: 0.56 }, width: 0.32 });
  }

  if (values.caption) {
    slots.push({ align: "left", id: "caption", position: { x: 0.06, y: 0.9 }, width: 0.5 });
  }

  return slots;
}
