import { getSupabaseClient } from "../lib/supabase-client.js";

const TABLE = "notes";
const ORDER_QUERY = [
  { column: "publish_date", options: { ascending: false } },
  { column: "created_at", options: { ascending: false } }
];

function applyOrdering(query) {
  return ORDER_QUERY.reduce(
    (currentQuery, entry) => currentQuery.order(entry.column, entry.options),
    query
  );
}

function normalizeNotePayload(payload) {
  return {
    id: payload.id || undefined,
    publish_date: payload.publish_date || new Date().toISOString(),
    title: payload.title || null,
    content: payload.content || "",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    mood: payload.mood || null,
    is_published: Boolean(payload.is_published),
    order_index: payload.order_index === "" || payload.order_index == null ? null : Number(payload.order_index)
  };
}

export async function listPublishedNotes() {
  const supabase = getSupabaseClient();
  let query = supabase.from(TABLE).select("*").eq("is_published", true);
  query = applyOrdering(query);
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function listAdminNotes() {
  const supabase = getSupabaseClient();
  let query = supabase.from(TABLE).select("*");
  query = applyOrdering(query);
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveNote(payload) {
  const supabase = getSupabaseClient();
  const normalized = normalizeNotePayload(payload);

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

export async function deleteNote(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}
