import * as ImageManipulator from "expo-image-manipulator";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type BabyPhoto = Tables<"baby_photos">;
export type BabyPhotoUpdate = TablesUpdate<"baby_photos">;

const bucketName = "baby-photos";

export async function listBabyPhotos(babyId: string) {
  const { data, error } = await supabase
    .from("baby_photos")
    .select("*")
    .eq("baby_id", babyId)
    .order("taken_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function uploadBabyPhoto(input: {
  babyId: string;
  uri: string;
  caption?: string;
  takenAt?: string;
}) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Oturum gerekli.");
  }

  const compressed = await ImageManipulator.manipulateAsync(
    input.uri,
    [{ resize: { width: 1920 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  const response = await fetch(compressed.uri);
  const body = await response.arrayBuffer();
  const storagePath = `${user.id}/${input.babyId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, body, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  const photoInsert: TablesInsert<"baby_photos"> = {
    baby_id: input.babyId,
    storage_path: storagePath,
    caption: input.caption,
    taken_at: (input.takenAt ?? new Date().toISOString()).slice(0, 10)
  };

  const { data, error } = await supabase
    .from("baby_photos")
    .insert(photoInsert)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await trackEvent("photo_uploaded", { baby_id: input.babyId });

  return data;
}

export async function getBabyPhotoSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function updateBabyPhoto(id: string, input: BabyPhotoUpdate) {
  const { data, error } = await supabase
    .from("baby_photos")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteBabyPhoto(photo: BabyPhoto) {
  const { error: storageError } = await supabase.storage
    .from(bucketName)
    .remove([photo.storage_path]);

  if (storageError) {
    throw storageError;
  }

  const { error } = await supabase.from("baby_photos").delete().eq("id", photo.id);

  if (error) {
    throw error;
  }

  await trackEvent("photo_deleted", { baby_id: photo.baby_id });
}
