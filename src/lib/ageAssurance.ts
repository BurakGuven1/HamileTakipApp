import { supabase } from "@/lib/supabase";

export const AGE_ASSURANCE_VERSION = "1";

export type AgeAssuranceContext =
  | "sign_up"
  | "sign_in"
  | "family_code";

export function getAdultBirthDateCutoff(today = new Date()) {
  const cutoff = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );

  return toLocalDateOnly(cutoff);
}

export function isAdultBirthDate(
  birthDate: string,
  today = new Date()
) {
  return isValidDateOnly(birthDate) && birthDate <= getAdultBirthDateCutoff(today);
}

export async function recordAgeAssurance({
  context,
  birthDate
}: {
  context: AgeAssuranceContext;
  birthDate?: string;
}) {
  const { data, error } = await supabase.rpc("record_age_assurance", {
    p_birth_date: birthDate,
    p_context: context,
    p_is_over_18: true,
    p_version: AGE_ASSURANCE_VERSION
  });

  if (error) {
    throw error;
  }

  return data;
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function toLocalDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
