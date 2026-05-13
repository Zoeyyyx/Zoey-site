import { getSupabaseClient } from "../lib/supabase-client.js";
import { slugify } from "../lib/utils.js";

export const STORAGE_BUCKETS = Object.freeze({
  images: "images",
  covers: "covers",
  audio: "audio"
});

export async function uploadPublicAsset({ bucket, file, folder = "uploads", baseName = "asset" }) {
  if (!file) {
    return null;
  }

  const supabase = getSupabaseClient();
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const safeBaseName = slugify(baseName);
  const fileName = `${Date.now()}-${safeBaseName}${extension ? `.${extension}` : ""}`;
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    bucket,
    path: filePath,
    url: data.publicUrl
  };
}
