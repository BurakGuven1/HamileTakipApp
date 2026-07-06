import * as ImageManipulator from "expo-image-manipulator";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert } from "@/types/database";

export type BabyPhoto = Tables<"baby_photos">;

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
  const storagePath = `${input.babyId}/${Date.now()}.jpg`;

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
    taken_at: input.takenAt ?? new Date().toISOString()
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
