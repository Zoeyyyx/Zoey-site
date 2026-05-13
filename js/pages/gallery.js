import { listPublishedGalleryItems } from "../services/gallery-service.js";
import { escapeHtml, formatDate } from "../lib/utils.js";

const gridRoot = document.querySelector("#visual-grid");
const filterButtons = document.querySelectorAll("[data-visual-filter]");
const publishedCountNode = document.querySelector("#galleryPublishedCount");

let items = [];
let currentFilter = "all";
let lightbox;

function resolveCategoryLabel(category) {
  if (category === "drawing" || category === "画画") {
    return "画画";
  }
  if (category === "photo" || category === "摄影") {
    return "摄影";
  }
  return "杂项";
}

function normalizeCategory(category) {
  if (category === "画画") {
    return "drawing";
  }
  if (category === "摄影") {
    return "photo";
  }
  if (category === "杂项") {
    return "misc";
  }
  return category || "misc";
}

function ensureLightbox() {
  if (lightbox) {
    return;
  }

  lightbox = document.createElement("div");
  lightbox.className = "visual-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="visual-lightbox-backdrop" data-lightbox-close></div>
    <div class="visual-lightbox-dialog" role="dialog" aria-modal="true" aria-label="查看作品大图">
      <button class="visual-lightbox-close" type="button" data-lightbox-close aria-label="关闭">×</button>
      <div class="visual-lightbox-layout">
        <div class="visual-lightbox-media"></div>
        <div class="visual-lightbox-copy">
          <p class="section-label visual-lightbox-label"></p>
          <h2 class="visual-lightbox-title"></h2>
          <p class="visual-lightbox-date"></p>
          <p class="visual-lightbox-desc"></p>
        </div>
      </div>
    </div>
  `;

  lightbox.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.hasAttribute("data-lightbox-close")) {
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox?.classList.contains("open")) {
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
    }
  });

  document.body.append(lightbox);
}

function openLightbox(item) {
  ensureLightbox();
  const media = lightbox.querySelector(".visual-lightbox-media");
  const label = lightbox.querySelector(".visual-lightbox-label");
  const title = lightbox.querySelector(".visual-lightbox-title");
  const date = lightbox.querySelector(".visual-lightbox-date");
  const desc = lightbox.querySelector(".visual-lightbox-desc");

  if (media) {
    media.innerHTML = `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}">`;
  }
  if (label) {
    label.textContent = resolveCategoryLabel(item.category);
  }
  if (title) {
    title.textContent = item.title;
  }
  if (date) {
    date.textContent = formatDate(item.publish_date);
  }
  if (desc) {
    desc.textContent = item.description || "这里还没有补充作品说明。";
  }

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
}

function renderGrid() {
  if (!gridRoot) {
    return;
  }

  const filteredItems = items.filter((item) => currentFilter === "all" || normalizeCategory(item.category) === currentFilter);

  if (!filteredItems.length) {
    gridRoot.innerHTML = '<p class="notes-empty visual-empty">这个分类下还没有已发布的作品。</p>';
    return;
  }

  gridRoot.innerHTML = filteredItems
    .map((item) => `
      <article class="visual-work">
        <button class="visual-work-hitarea" type="button" data-gallery-id="${escapeHtml(item.id)}">
          <div class="visual-work-media">
            <img src="${escapeHtml(item.thumbnail_url || item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
          </div>
          <div class="visual-work-meta">
            <div class="visual-work-head">
              <p class="section-label">${escapeHtml(resolveCategoryLabel(item.category))}</p>
              <span class="visual-work-date">${escapeHtml(formatDate(item.publish_date))}</span>
            </div>
            <h2 class="visual-work-title">${escapeHtml(item.title)}</h2>
            <p class="visual-work-desc">${escapeHtml(item.description || "")}</p>
          </div>
        </button>
      </article>
    `)
    .join("");

  gridRoot.querySelectorAll("[data-gallery-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-gallery-id");
      const item = items.find((entry) => entry.id === id);
      if (item) {
        openLightbox(item);
      }
    });
  });
}

function renderSidebarMeta() {
  if (publishedCountNode) {
    publishedCountNode.textContent = String(items.length);
  }
}

async function initGalleryPage() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.visualFilter || "all";
      filterButtons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });
      renderGrid();
    });
  });

  try {
    items = await listPublishedGalleryItems();
    renderSidebarMeta();
    renderGrid();
  } catch (error) {
    if (gridRoot) {
      gridRoot.innerHTML = '<p class="notes-empty visual-empty">视觉作品暂时无法读取，请先完成 Supabase 配置。</p>';
    }
    renderSidebarMeta();
  }
}

initGalleryPage();
