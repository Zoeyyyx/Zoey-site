export function getSiteConfig() {
  return window.__ZOEY_SITE_CONFIG__ || {};
}

export function getSiteBasePath() {
  const config = getSiteConfig();
  const value = typeof config.SITE_BASE_PATH === "string" ? config.SITE_BASE_PATH.trim() : "";

  if (!value || value === "/") {
    return "";
  }

  return value.replace(/^\/+|\/+$/g, "");
}

export function resolveSitePath(relativePath = "") {
  const rawPath = String(relativePath).trim();

  if (!rawPath) {
    return "";
  }

  if (/^(\.\.\/|\.\/)/.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.replace(/^\/+/, "");
  const basePath = getSiteBasePath();

  if (!basePath) {
    return normalizedPath;
  }

  return normalizedPath ? `${basePath}/${normalizedPath}` : basePath;
}
