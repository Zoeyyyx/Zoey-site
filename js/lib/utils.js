export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeTagsInput(value) {
  return String(value ?? "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function tagsToInput(tags) {
  return ensureArray(tags).join(", ");
}

export function plainTextExcerpt(value, maxLength = 110) {
  const normalized = stripHtml(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}…` : normalized;
}

export function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatMonthLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 7);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function slugify(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `post-${Date.now()}`;
}

function paragraphToHtml(paragraph) {
  const trimmed = paragraph.trim();

  if (!trimmed) {
    return "";
  }

  if (/^###\s+/.test(trimmed)) {
    return `<h4>${escapeHtml(trimmed.replace(/^###\s+/, ""))}</h4>`;
  }

  if (/^##\s+/.test(trimmed)) {
    return `<h3>${escapeHtml(trimmed.replace(/^##\s+/, ""))}</h3>`;
  }

  if (/^#\s+/.test(trimmed)) {
    return `<h2>${escapeHtml(trimmed.replace(/^#\s+/, ""))}</h2>`;
  }

  if (/^>\s+/.test(trimmed)) {
    return `<blockquote><p>${escapeHtml(trimmed.replace(/^>\s+/, "")).replaceAll("\n", "<br>")}</p></blockquote>`;
  }

  if (/^-\s+/.test(trimmed)) {
    const items = trimmed
      .split("\n")
      .map((line) => line.replace(/^-\s+/, "").trim())
      .filter(Boolean)
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");

    return `<ul>${items}</ul>`;
  }

  return `<p>${escapeHtml(trimmed).replaceAll("\n", "<br>")}</p>`;
}

export function renderRichText(value) {
  const content = String(value ?? "").trim();
  if (!content) {
    return '<p class="writing-empty">还没有写入正文。</p>';
  }

  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }

  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraphToHtml(paragraph))
    .join("");
}

export function getSearchParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

export function setText(node, value) {
  if (node) {
    node.textContent = value ?? "";
  }
}

export function toggleHidden(node, shouldHide) {
  if (node) {
    node.hidden = Boolean(shouldHide);
  }
}

export function createElementFromHtml(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

export function sortByDateDesc(list, key = "publish_date") {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left?.[key] || left?.created_at || 0).getTime();
    const rightTime = new Date(right?.[key] || right?.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}
