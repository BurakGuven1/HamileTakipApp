import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = "forum.blockedNicknames";

export async function getBlockedForumNicknames() {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function blockForumNickname(nickname: string) {
  const clean = nickname.trim();
  if (!clean) return [];

  const current = await getBlockedForumNicknames();
  const next = Array.from(new Set([...current, clean]));
  await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export async function unblockForumNickname(nickname: string) {
  const next = (await getBlockedForumNicknames()).filter((item) => item !== nickname);
  await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
