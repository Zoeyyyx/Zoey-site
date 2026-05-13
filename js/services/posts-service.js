import { getSupabaseClient } from "../lib/supabase-client.js";

const TABLE = "posts";

function baseOrderedQuery(query) {
  return query.order("publish_date", { ascending: false }).order("updated_at", { ascending: false });
}

function normalizePostPayload(payload) {
  return {
    id: payload.id || undefined,
    slug: payload.slug,
    publish_date: payload.publish_date || new Date().toISOString(),
    title: payload.title || "",
    summary: payload.summary || "",
    category: payload.category || "essay",
    cover_image_url: payload.cover_image_url || null,
    content_html: payload.content_html || "",
    is_published: Boolean(payload.is_published),
    featured: Boolean(payload.featured)
  };
}

export async function listPublishedPosts() {
  const supabase = getSupabaseClient();
  const { data, error } = await baseOrderedQuery(
    supabase.from(TABLE).select("*").eq("is_published", true)
  );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function listAdminPosts() {
  const supabase = getSupabaseClient();
  const { data, error } = await baseOrderedQuery(supabase.from(TABLE).select("*"));

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getPublishedPostBySlug(slug) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function savePost(payload) {
  const supabase = getSupabaseClient();
  const normalized = normalizePostPayload(payload);

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

export async function deletePost(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}
