import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type Profile = Tables<"profiles">;
export type ProfileInsert = TablesInsert<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export async function getCurrentProfile() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_active_profile");

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertProfile(profile: ProfileInsert) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCurrentProfile(update: ProfileUpdate) {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Oturum gerekli.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function isNicknameAvailable(nickname: string) {
  const { data, error } = await supabase.rpc("is_nickname_available", {
    nickname
  });

  if (error) {
    throw error;
  }

  return data;
}
