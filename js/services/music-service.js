import { getSupabaseClient } from "../lib/supabase-client.js";
import { slugify } from "../lib/utils.js";

const TABLE = "music_items";
const REVIEWS_TABLE = "music_reviews";

function orderedQuery(query) {
  return query.order("sort_order", { ascending: true, nullsFirst: false }).order("publish_date", { ascending: false });
}

function normalizeMusicPayload(payload) {
  return {
    id: payload.id || undefined,
    publish_date: payload.publish_date || new Date().toISOString(),
    title: payload.title || "",
    artist: payload.artist || "",
    cover_image_url: payload.cover_image_url || null,
    audio_url: payload.audio_url || "",
    description: payload.description || "",
    lyrics_or_notes: payload.lyrics_or_notes || "",
    is_published: Boolean(payload.is_published),
    sort_order: payload.sort_order === "" || payload.sort_order == null ? null : Number(payload.sort_order)
  };
}

export function parseNeteaseUrl(url) {
  const value = String(url || "").trim();
  const songMatch = value.match(/(?:#\/)?song\?id=(\d+)/);
  const playlistMatch = value.match(/(?:#\/)?playlist\?id=(\d+)/);

  return {
    songId: songMatch?.[1] || "",
    playlistId: playlistMatch?.[1] || ""
  };
}

function normalizeReviewPayload(payload) {
  const parsed = parseNeteaseUrl(payload.netease_url);
  const neteaseSongId = payload.netease_song_id || parsed.songId || "";
  const neteasePlaylistId = payload.netease_playlist_id || parsed.playlistId || "";
  const playerType =
    payload.player_type ||
    (neteasePlaylistId ? "netease_playlist" : neteaseSongId ? "netease_song" : "external_link");
  const title = payload.title || payload.song_name || "未命名乐评";

  return {
    id: payload.id || undefined,
    title,
    slug: payload.slug || slugify(`${title}-${payload.artist || ""}`),
    artist: payload.artist || "",
    album: payload.album || "",
    song_name: payload.song_name || title,
    netease_song_id: neteaseSongId || null,
    netease_playlist_id: neteasePlaylistId || null,
    netease_url: payload.netease_url || "",
    external_music_url: payload.external_music_url || "",
    preview_url: payload.preview_url || "",
    cover_url: payload.cover_url || null,
    rating: payload.rating === "" || payload.rating == null ? null : Number(payload.rating),
    review_short: payload.review_short || "",
    review_body: payload.review_body || "",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    mood: payload.mood || "",
    metadata_source: payload.metadata_source || "manual",
    metadata_raw: payload.metadata_raw || null,
    alternate_title: payload.alternate_title || "",
    featured_artists: Array.isArray(payload.featured_artists) ? payload.featured_artists : [],
    player_type: playerType,
    is_playable: Boolean(payload.is_playable),
    is_published: Boolean(payload.is_published),
    published_at: payload.published_at || new Date().toISOString()
  };
}

function orderedReviewsQuery(query) {
  return query.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
}

export async function listPublishedMusicItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedQuery(
    supabase.from(TABLE).select("*").eq("is_published", true)
  );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function listPublishedMusicReviews() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedReviewsQuery(
    supabase.from(REVIEWS_TABLE).select("*").eq("is_published", true)
  );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getPublishedMusicReviewBySlug(slug) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listAdminMusicItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedQuery(supabase.from(TABLE).select("*"));

  if (error) {
    throw error;
  }

  return data || [];
}

export async function listAdminMusicReviews() {
  const supabase = getSupabaseClient();
  const { data, error } = await orderedReviewsQuery(supabase.from(REVIEWS_TABLE).select("*"));

  if (error) {
    throw error;
  }

  return data || [];
}

export async function saveMusicItem(payload) {
  const supabase = getSupabaseClient();
  const normalized = normalizeMusicPayload(payload);

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

export async function saveMusicReview(payload) {
  const supabase = getSupabaseClient();
  const normalized = normalizeReviewPayload(payload);

  if (normalized.id) {
    const { data, error } = await supabase
      .from(REVIEWS_TABLE)
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
  const { data, error } = await supabase.from(REVIEWS_TABLE).insert(normalized).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteMusicItem(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteMusicReview(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(REVIEWS_TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}
