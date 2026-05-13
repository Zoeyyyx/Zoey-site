import { getSupabaseClient } from "../lib/supabase-client.js";

const TABLE = "site_settings";

export async function getSiteSettingRecord(key) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("setting_key", key).maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getSiteSetting(key) {
  const data = await getSiteSettingRecord(key);
  return data?.value || null;
}

export async function upsertSiteSetting(setting_key, value) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ setting_key, value }, { onConflict: "setting_key" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
