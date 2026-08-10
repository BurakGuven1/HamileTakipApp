import * as ImageManipulator from "expo-image-manipulator";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type BabyPhoto = Tables<"baby_photos">;
export type BabyPhotoUpdate = TablesUpdate<"baby_photos">;

export type BabyGalleryAccess = {
  allowed: boolean;
  isPremium: boolean;
  limit: number;
  remaining: number | null;
  used: number;
};

const bucketName = "baby-photos";

export async function getBabyGalleryAccess(): Promise<BabyGalleryAccess> {
  const { data, error } = await supabase.rpc("get_baby_gallery_access");
  if (error) throw error;

  const value = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};

  return {
    allowed: value.allowed === true,
    isPremium: value.is_premium === true,
    limit: typeof value.limit === "number" ? value.limit : 5,
    remaining: typeof value.remaining === "number" ? value.remaining : null,
    used: typeof value.used === "number" ? value.used : 0
  };
}

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
    await supabase.storage.from(bucketName).remove([storagePath]).catch(() => undefined);
    throw error;
  }

  await trackEvent("photo_uploaded");

  return data;
}

export async function getBabyPhotoSignedUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function uploadBabyHomePhoto(input: {
  babyId: string;
  uri: string;
  previousPath?: string | null;
}) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Oturum gerekli.");

  const compressed = await ImageManipulator.manipulateAsync(
    input.uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  const response = await fetch(compressed.uri);
  const body = await response.arrayBuffer();
  const storagePath = `${user.id}/${input.babyId}/home-cover-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, body, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("babies")
    .update({ photo_url: storagePath, updated_at: new Date().toISOString() })
    .eq("id", input.babyId)
    .select()
    .single();

  if (error) {
    await supabase.storage.from(bucketName).remove([storagePath]).catch(() => undefined);
    throw error;
  }

  if (input.previousPath && !/^https?:\/\//i.test(input.previousPath)) {
    await supabase.storage.from(bucketName).remove([input.previousPath]).catch(() => undefined);
  }

  await trackEvent("home_photo_updated");
  return data;
}

export async function removeBabyHomePhoto(input: {
  babyId: string;
  storagePath?: string | null;
}) {
  const { data, error } = await supabase
    .from("babies")
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq("id", input.babyId)
    .select()
    .single();

  if (error) throw error;

  if (input.storagePath && !/^https?:\/\//i.test(input.storagePath)) {
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([input.storagePath]);
    if (storageError) throw storageError;
  }

  await trackEvent("home_photo_removed");
  return data;
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

  await trackEvent("photo_deleted");
}
