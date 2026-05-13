import { resolveSitePath } from "../lib/site-config.js";

const PUBLIC_NAV_ITEMS = [
  {
    id: "notes",
    href: "notes.html",
    title: "碎碎念",
    subtitle: "Notes",
    tooltip: "最近的片段、念头与记录",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.75h10A1.75 1.75 0 0 1 18.75 6.5v11A1.75 1.75 0 0 1 17 19.25H7A1.75 1.75 0 0 1 5.25 17.5v-11A1.75 1.75 0 0 1 7 4.75Z"></path>
        <path d="M8.5 9.25h7"></path>
        <path d="M8.5 12h7"></path>
        <path d="M8.5 14.75H13"></path>
      </svg>
    `
  },
  {
    id: "writing",
    href: "writing.html",
    title: "文章",
    subtitle: "Writing",
    tooltip: "较完整的文字与思考",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.75h8.5l3 3v11.5H6.75z"></path>
        <path d="M15.25 4.75v3.5h3"></path>
        <path d="M9 12.25h6"></path>
        <path d="M9 15h6"></path>
      </svg>
    `
  },
  {
    id: "music",
    href: "music.html",
    title: "音乐",
    subtitle: "Music",
    tooltip: "封面、旋律与声音档案",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18.25a2.25 2.25 0 1 1 0-4.5"></path>
        <path d="M16 16.75a2.25 2.25 0 1 1 0-4.5"></path>
        <path d="M11.25 18V7.25l7-1.5v8.75"></path>
      </svg>
    `
  },
  {
    id: "gallery",
    href: "gallery.html",
    title: "视觉",
    subtitle: "Visual",
    tooltip: "摄影、画画与视觉片段",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.75" y="5.5" width="14.5" height="13" rx="2"></rect>
        <circle cx="9" cy="10" r="1.6"></circle>
        <path d="m6.75 16 3.5-3.5 2.5 2.5 2.75-2.75L19 16"></path>
      </svg>
    `
  },
  {
    id: "tools",
    href: "tools.html",
    title: "工具箱",
    subtitle: "Tools",
    tooltip: "一些慢慢长出来的小工具",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 5.5a3.25 3.25 0 0 0-4.8 4.35l-4.2 4.2a1.7 1.7 0 1 0 2.4 2.4l4.2-4.2a3.25 3.25 0 0 0 4.35-4.8l-2.15 2.15-2.15-2.15Z"></path>
      </svg>
    `
  }
];

function buildNavItems(items, root, activeId) {
  return items
    .map((item) => `
      <a
        class="global-header-link${item.id === activeId ? " is-active" : ""}"
        href="${resolveSitePath(`${root}${item.href}`)}"
        data-nav-id="${item.id}"
        ${item.id === activeId ? 'aria-current="page"' : ""}
      >
        <span class="global-header-icon">${item.icon}</span>
        <span class="global-header-copy">
          <strong>${item.title}</strong>
          <small>${item.subtitle}</small>
        </span>
        <span class="global-header-tooltip" role="tooltip">${item.tooltip}</span>
      </a>
    `)
    .join("");
}

function buildHeaderMarkup(root, activeId) {
  return `
    <div class="global-header-shell">
      <div class="global-header-brand-wrap">
        <a class="global-header-brand" href="${resolveSitePath(`${root}index.html`)}" aria-label="回到 Zoey 首页">
          <span class="global-header-brand-mark">Z</span>
          <span class="global-header-brand-copy">
            <strong>Zoey</strong>
            <small>notes, works, fragments</small>
          </span>
        </a>
        <button class="global-header-menu" type="button" aria-expanded="false" aria-controls="site-nav">
          <span></span>
          <span></span>
        </button>
      </div>
      <nav class="global-header-nav" id="site-nav" aria-label="全站主导航">
        ${buildNavItems(PUBLIC_NAV_ITEMS, root, activeId)}
      </nav>
    </div>
  `;
}

function bindMobileMenu(header) {
  const menuButton = header.querySelector(".global-header-menu");
  const nav = header.querySelector(".global-header-nav");

  if (!menuButton || !nav) {
    return;
  }

  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

function bindScrollBehavior(header) {
  let lastY = window.scrollY;
  let ticking = false;

  const syncState = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    const nav = header.querySelector(".global-header-nav");
    const isMenuOpen = Boolean(nav?.classList.contains("is-open"));

    header.classList.toggle("is-scrolled", currentY > 8);
    header.classList.toggle("is-condensed", currentY > 30);

    if (isMenuOpen || currentY <= 72) {
      header.classList.remove("is-hidden");
    } else if (delta > 10 && currentY > 220) {
      header.classList.add("is-hidden");
    } else if (delta < -8) {
      header.classList.remove("is-hidden");
    }

    lastY = currentY;
    ticking = false;
  };

  syncState();

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(syncState);
    },
    { passive: true }
  );
}

export function initGlobalHeader() {
  const header = document.querySelector(".topbar");
  if (!header || document.body.dataset.page === "admin") {
    return;
  }

  const activeId = document.body.dataset.navActive || document.body.dataset.page || "home";
  const root = document.body.dataset.navRoot || "";

  header.classList.add("global-header");
  header.innerHTML = buildHeaderMarkup(root, activeId);
  bindMobileMenu(header);
  bindScrollBehavior(header);
}
