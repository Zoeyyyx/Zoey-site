import { listPublishedPosts } from "../services/posts-service.js";
import { escapeHtml, formatDate, plainTextExcerpt } from "../lib/utils.js";

const categoryNav = document.querySelector("#writingCategoryNav");
const sectionsRoot = document.querySelector("#writingSections");
const statsRoot = document.querySelector("#writingStats");
const recentRoot = document.querySelector("#writingRecent");
const recommendedRoot = document.querySelector("#writingRecommended");
const searchInput = document.querySelector("#writingSearchInput");
const pageTitle = document.querySelector("#writingPageTitle");
const pageLead = document.querySelector("#writingPageLead");

let posts = [];
let currentCategory = "all";
let currentQuery = "";

function getCategories() {
  const categoryMap = new Map();
  categoryMap.set("all", {
    id: "all",
    label: "全部",
    description: "这里展示所有已发布文章，你可以按分类继续筛选。"
  });

  posts.forEach((post) => {
    if (!categoryMap.has(post.category)) {
      categoryMap.set(post.category, {
        id: post.category,
        label: post.category,
        description: `${post.category} 分类下的已发布文章。`
      });
    }
  });

  return [...categoryMap.values()];
}

function filterPosts() {
  return posts.filter((post) => {
    const categoryMatch = currentCategory === "all" || post.category === currentCategory;
    const queryMatch =
      !currentQuery ||
      [post.title, post.summary, post.category].join(" ").toLowerCase().includes(currentQuery);

    return categoryMatch && queryMatch;
  });
}

function createPostCard(post) {
  const coverMarkup = post.cover_image_url
    ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" loading="lazy">`
    : `
      <div class="writing-card-cover-placeholder writing-card-cover-${escapeHtml(post.category || "essay")}">
        <span>${escapeHtml(post.category || "文章")}</span>
      </div>
    `;

  return `
    <article class="writing-card">
      <a class="writing-card-link" href="post.html?slug=${encodeURIComponent(post.slug)}" aria-label="查看文章：${escapeHtml(post.title)}">
        <div class="writing-card-cover">${coverMarkup}</div>
        <div class="writing-card-copy">
          <div class="writing-card-meta">
            <span class="writing-card-category">${escapeHtml(post.category)}</span>
            <time datetime="${escapeHtml(post.publish_date)}">${escapeHtml(formatDate(post.publish_date))}</time>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(plainTextExcerpt(post.summary, 120))}</p>
        </div>
      </a>
    </article>
  `;
}

function renderSideLinks(root, list) {
  if (!root) {
    return;
  }

  root.innerHTML = list
    .map((post) => `
      <a class="writing-side-item" href="post.html?slug=${encodeURIComponent(post.slug)}">
        <span class="writing-side-item-category">${escapeHtml(post.category)}</span>
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(formatDate(post.publish_date))}</small>
      </a>
    `)
    .join("");
}

function renderStats(categories) {
  if (!statsRoot) {
    return;
  }

  statsRoot.innerHTML = categories
    .filter((category) => category.id !== "all")
    .map((category) => `
      <li>
        <button type="button" class="writing-meta-button" data-writing-category="${escapeHtml(category.id)}">
          <span>${escapeHtml(category.label)}</span>
          <strong>${posts.filter((post) => post.category === category.id).length}</strong>
        </button>
      </li>
    `)
    .join("");

  statsRoot.querySelectorAll("[data-writing-category]").forEach((button) => {
    button.addEventListener("click", () => {
      currentCategory = button.getAttribute("data-writing-category") || "all";
      renderWritingPage();
    });
  });
}

function renderCategoryNav(categories) {
  if (!categoryNav) {
    return;
  }

  categoryNav.innerHTML = categories
    .map((category) => `
      <button
        class="writing-category-button${category.id === currentCategory ? " is-active" : ""}"
        type="button"
        data-writing-category="${escapeHtml(category.id)}"
        aria-pressed="${String(category.id === currentCategory)}"
      >
        <span>${escapeHtml(category.label)}</span>
        <small>${category.id === "all" ? posts.length : posts.filter((post) => post.category === category.id).length}</small>
      </button>
    `)
    .join("");

  categoryNav.querySelectorAll("[data-writing-category]").forEach((button) => {
    button.addEventListener("click", () => {
      currentCategory = button.getAttribute("data-writing-category") || "all";
      renderWritingPage();
    });
  });
}

function renderSections(categories) {
  if (!sectionsRoot) {
    return;
  }

  const filtered = filterPosts();
  const visibleCategories =
    currentCategory === "all"
      ? categories.filter((category) => category.id !== "all")
      : categories.filter((category) => category.id === currentCategory);

  const activeCategory = categories.find((category) => category.id === currentCategory) || categories[0];
  if (pageTitle) {
    pageTitle.textContent = activeCategory?.label || "全部";
  }
  if (pageLead) {
    pageLead.textContent = activeCategory?.description || "这里展示所有已发布文章。";
  }

  sectionsRoot.innerHTML = visibleCategories
    .map((category) => {
      const categoryPosts = filtered.filter((post) => post.category === category.id);

      return `
        <section class="writing-section">
          <header class="writing-section-head">
            <div>
              <p class="section-label">${escapeHtml(category.label)}</p>
              <h3>${escapeHtml(category.label)}</h3>
            </div>
          </header>
          <div class="writing-card-list">
            ${
              categoryPosts.length
                ? categoryPosts.map((post) => createPostCard(post)).join("")
                : '<p class="writing-empty">这个分类下暂时没有符合筛选条件的文章。</p>'
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function renderWritingPage() {
  const categories = getCategories();
  renderCategoryNav(categories);
  renderStats(categories);
  renderSections(categories);
  renderSideLinks(recommendedRoot, posts.filter((post) => post.featured).slice(0, 4));
  renderSideLinks(recentRoot, posts.slice(0, 4));
}

async function initWritingPage() {
  try {
    posts = await listPublishedPosts();
    renderWritingPage();
  } catch (error) {
    if (sectionsRoot) {
      sectionsRoot.innerHTML = '<p class="writing-empty">文章列表暂时无法读取，请先完成 Supabase 配置。</p>';
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentQuery = searchInput.value.trim().toLowerCase();
      renderWritingPage();
    });
  }
}

initWritingPage();
