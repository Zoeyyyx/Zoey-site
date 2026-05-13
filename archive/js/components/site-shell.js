const MAIN_NAV_ITEMS = [
  { id: "notes", href: "notes.html", label: "碎碎念" },
  { id: "writing", href: "writing.html", label: "文章" },
  { id: "music", href: "music.html", label: "音乐" },
  { id: "gallery", href: "gallery.html", label: "视觉" },
  { id: "tools", href: "tools.html", label: "工具" }
];

const ADMIN_NAV_ITEMS = [
  { id: "dashboard", href: "index.html", label: "总览" },
  { id: "notes", href: "notes.html", label: "碎碎念" },
  { id: "posts", href: "posts.html", label: "文章" },
  { id: "gallery", href: "gallery.html", label: "视觉" },
  { id: "music", href: "music.html", label: "音乐" }
];

function buildLinks(items, root, activeId) {
  return items
    .map((item) => {
      const activeClass = item.id === activeId ? " is-active" : "";
      return `<a class="nav-link${activeClass}" href="${root}${item.href}" data-nav-id="${item.id}">${item.label}</a>`;
    })
    .join("");
}

export function initSiteNavigation() {
  const nav = document.querySelector("#site-nav");
  const menuButton = document.querySelector(".menu-toggle");
  const activeId = document.body.dataset.navActive || document.body.dataset.page || "";
  const root = document.body.dataset.navRoot || "";

  if (nav) {
    nav.innerHTML = buildLinks(MAIN_NAV_ITEMS, root, activeId);
  }

  if (!menuButton || !nav) {
    return;
  }

  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

export function initAdminNavigation() {
  const nav = document.querySelector("#admin-nav");
  const activeId = document.body.dataset.adminPage || "";
  const root = document.body.dataset.navRoot || "../admin/";

  if (nav) {
    nav.innerHTML = buildLinks(ADMIN_NAV_ITEMS, root, activeId);
  }
}
