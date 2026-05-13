import { getSupabaseClient } from "../lib/supabase-client.js";

const TABLE = "gallery_items";

function orderedQuery(query) {
  return query.order("sort_order", { ascending: true, nullsFirst: false }).order("publish_date", { ascending: false });
}

function normalizeGalleryPayload(payload) {
  return {
    id: payload.id || undefined,
    publish_date: payload.publish_date || new Date().toISOString(),
    title: payload.title || "",
    category: payload.category || "misc",
    image_url: payload.image_url || "",
    thumbnail_url: payload.thumbnail_url || null,
    description: payload.description || "",
    is_published: Boolean(payload.is_published),
    sort_order: payload.sort_order === "" || payload.sort_order == null ? null : Number(payload.sort_order)
  };
}

export async function listPublishedGalleryItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedQuery(
    supabase.from(TABLE).select("*").eq("is_published", true)
  );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function listAdminGalleryItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedQuery(supabase.from(TABLE).select("*"));

  if (error) {
    throw error;
  }

  return data || [];
}

export async function saveGalleryItem(payload) {
  const supabase = getSupabaseClient();
  const normalized = normalizeGalleryPayload(payload);

  if (normalized.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(normalized)
      .eq("id", normalized.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  delete normalized.id;
  const { data, error } = await supabase.from(TABLE).insert(normalized).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteGalleryItem(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}
