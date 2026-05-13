import { initAdminNavigation } from "../components/admin-nav.js";
import { requireAdminSession, signOutCurrentUser } from "../lib/auth.js";
import { escapeHtml, formatDate, formatDateTime, plainTextExcerpt } from "../lib/utils.js";

export async function bootstrapAdminPage() {
  initAdminNavigation();
  bindSignOut();
  const session = await requireAdminSession({ loginPath: "login.html" });

  const userNode = document.querySelector("#adminUserEmail");
  if (userNode && session?.user?.email) {
    userNode.textContent = session.user.email;
  }

  return session;
}

export function bindSignOut() {
  const signOutButton = document.querySelector("#adminSignOut");
  if (!signOutButton) {
    return;
  }

  signOutButton.addEventListener("click", async () => {
    await signOutCurrentUser();
    window.location.href = "login.html";
  });
}

export function setAdminNotice(message, type = "info") {
  const notice = document.querySelector("#adminNotice");
  if (!notice) {
    return;
  }

  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    notice.className = "admin-notice";
    return;
  }

  notice.hidden = false;
  notice.textContent = message;
  notice.className = `admin-notice is-${type}`;
}

export function renderAdminList(root, items, activeId, renderMeta) {
  if (!root) {
    return;
  }

  if (!items.length) {
    root.innerHTML = '<p class="writing-empty">这里还没有内容。</p>';
    return;
  }

  root.innerHTML = items
    .map((item) => `
      <button class="admin-record-item${item.id === activeId ? " is-active" : ""}" type="button" data-record-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.title || item.slug || "未命名内容")}</strong>
        <span>${escapeHtml(renderMeta(item))}</span>
        <small>${item.is_published ? "已发布" : "草稿"}</small>
      </button>
    `)
    .join("");
}

export function defaultMeta(item) {
  return item.publish_date ? formatDate(item.publish_date) : formatDateTime(item.created_at);
}

export function textPreview(value) {
  return plainTextExcerpt(value || "", 80);
}
