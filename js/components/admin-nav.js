const ADMIN_NAV_ITEMS = [
  { id: "dashboard", href: "index.html", label: "总览" },
  { id: "notes", href: "notes.html", label: "碎碎念" },
  { id: "posts", href: "posts.html", label: "文章" },
  { id: "gallery", href: "gallery.html", label: "视觉" },
  { id: "music", href: "music.html", label: "音乐" },
  { id: "music-reviews", href: "music.html?view=reviews", label: "乐评" }
];

function buildLinks(items, activeId) {
  return items
    .map((item) => {
      const activeClass = item.id === activeId ? " is-active" : "";
      const current = item.id === activeId ? ' aria-current="page"' : "";
      return `<a class="nav-link${activeClass}" href="${item.href}" data-nav-id="${item.id}" data-admin-view="${item.id}"${current}>${item.label}</a>`;
    })
    .join("");
}

export function initAdminNavigation() {
  const nav = document.querySelector("#admin-nav");
  const activeId = document.body.dataset.adminPage || "";

  if (!nav) {
    return;
  }

  nav.innerHTML = buildLinks(ADMIN_NAV_ITEMS, activeId);
}
