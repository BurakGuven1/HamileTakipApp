import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BabyNameRecord } from "@/features/baby-names/babyNames";

const BABY_NAME_FAVORITES_KEY = "anne_plus_baby_name_favorites_v1";

export type BabyNameFavorite = BabyNameRecord & {
  savedAt: string;
};

export async function listBabyNameFavorites() {
  const stored = await AsyncStorage.getItem(BABY_NAME_FAVORITES_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBabyNameFavorite).sort((left, right) =>
      right.savedAt.localeCompare(left.savedAt)
    );
  } catch {
    return [];
  }
}

export async function toggleBabyNameFavorite(item: BabyNameRecord) {
  const current = await listBabyNameFavorites();
  const exists = current.some((favorite) => favorite.id === item.id);
  const next = exists
    ? current.filter((favorite) => favorite.id !== item.id)
    : [{ ...item, savedAt: new Date().toISOString() }, ...current];

  await AsyncStorage.setItem(BABY_NAME_FAVORITES_KEY, JSON.stringify(next));
  return { favorites: next, isFavorite: !exists };
}

export async function removeBabyNameFavorite(id: string) {
  const current = await listBabyNameFavorites();
  const next = current.filter((favorite) => favorite.id !== id);
  await AsyncStorage.setItem(BABY_NAME_FAVORITES_KEY, JSON.stringify(next));
  return next;
}

function isBabyNameFavorite(value: unknown): value is BabyNameFavorite {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BabyNameFavorite>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.meaning === "string" &&
    typeof item.savedAt === "string" &&
    (item.gender === "girl" || item.gender === "boy") &&
    (item.kind === "single" || item.kind === "double")
  );
}
