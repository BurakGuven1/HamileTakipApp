import { getCurrentProfile } from "@/api/profiles";
import { createRealtimeChannelName } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type BirthPreparationItem = Tables<"birth_preparation_items">;
export type BirthPreparationKind = BirthPreparationItem["kind"];

export async function listBirthPreparationItems() {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Oturum gerekli.");
  }

  const { error: defaultsError } = await supabase.rpc(
    "ensure_birth_preparation_defaults"
  );

  if (defaultsError) {
    throw defaultsError;
  }

  const { data, error } = await supabase
    .from("birth_preparation_items")
    .select("*")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function setBirthPreparationItemCompleted(
  itemId: string,
  completed: boolean
) {
  const { data, error } = await supabase.rpc(
    "set_birth_preparation_item_completed",
    {
      p_item_id: itemId,
      p_completed: completed
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function addCustomBirthPreparationItem({
  category,
  kind,
  title
}: {
  category: string;
  kind: BirthPreparationKind;
  title: string;
}) {
  const cleanTitle = title.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 140) {
    throw new Error("Madde 2–140 karakter arasında olmalı.");
  }

  const profile = await getCurrentProfile();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!profile || !user) {
    throw new Error("Oturum gerekli.");
  }

  const { data, error } = await supabase
    .from("birth_preparation_items")
    .insert({
      profile_id: profile.id,
      kind,
      category,
      title: cleanTitle,
      is_custom: true,
      created_by: user.id,
      sort_order: 10_000
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCustomBirthPreparationItem(itemId: string) {
  const { error } = await supabase
    .from("birth_preparation_items")
    .delete()
    .eq("id", itemId)
    .eq("is_custom", true);

  if (error) {
    throw error;
  }
}

export function subscribeToBirthPreparation(
  profileId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(createRealtimeChannelName("birth-preparation", profileId))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "birth_preparation_items",
        filter: `profile_id=eq.${profileId}`
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}
