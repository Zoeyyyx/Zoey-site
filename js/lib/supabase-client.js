let supabaseClient;

export function getSupabaseConfig() {
  const config = window.__ZOEY_SITE_CONFIG__ || {};

  return {
    url: config.SUPABASE_URL || "",
    anonKey: config.SUPABASE_ANON_KEY || ""
  };
}

export function hasSupabaseConfig() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase runtime config is missing. Fill js/lib/runtime-config.js first.");
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase browser SDK is not loaded.");
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}
