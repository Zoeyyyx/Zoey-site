import { getSupabaseClient } from "../lib/supabase-client.js";
import { plainTextExcerpt, stripHtml } from "../lib/utils.js";

const TABLE = "notes";
const TEMP_TITLE_LENGTH = 18;
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

function buildTemporaryTitle(content) {
  return plainTextExcerpt(content, TEMP_TITLE_LENGTH) || "未命名碎片";
}

function cleanGeneratedTitle(value = "") {
  return String(value || "")
    .replace(/^["“”'《「『]+|["“”'》」』]+$/g, "")
    .replace(/^标题[:：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
}

async function completeMissingTitle(payload) {
  if (payload.title || !payload.content) {
    return payload;
  }

  const supabase = getSupabaseClient();
  const fallbackTitle = buildTemporaryTitle(payload.content);

  try {
    const config = window.__ZOEY_SITE_CONFIG__ || {};
    const functionName = config.DEEPSEEK_TITLE_FUNCTION || "generate-note-title";
    const model = config.DEEPSEEK_TITLE_MODEL || "deepseek-chat";
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: {
        content: stripHtml(payload.content).slice(0, 1000),
        model
      }
    });

    if (error) {
      throw error;
    }

    const generatedTitle = cleanGeneratedTitle(data?.title);
    return {
      ...payload,
      title: generatedTitle || fallbackTitle
    };
  } catch (error) {
    return {
      ...payload,
      title: fallbackTitle
    };
  }
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
  const normalized = await completeMissingTitle(normalizeNotePayload(payload));

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
