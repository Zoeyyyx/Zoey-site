import { getSupabaseClient } from "./supabase-client.js";

export async function signInWithPassword(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutCurrentUser() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function isCurrentUserAdmin() {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data?.user_id);
}

export function getNextUrl() {
  return encodeURIComponent(`${window.location.pathname}${window.location.search}`);
}

export function redirectToLogin(loginPath = "login.html") {
  window.location.href = `${loginPath}?next=${getNextUrl()}`;
}

export async function requireAdminSession(options = {}) {
  const { loginPath = "login.html", allowRedirect = true } = options;
  const session = await getCurrentSession();

  if (!session) {
    if (allowRedirect) {
      redirectToLogin(loginPath);
    }
    return null;
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    await signOutCurrentUser().catch(() => null);
    if (allowRedirect) {
      redirectToLogin(loginPath);
    }
    return null;
  }

  return session;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange(callback);
}
