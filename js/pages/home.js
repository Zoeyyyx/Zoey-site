import { listPublishedNotes } from "../services/notes-service.js";
import { listPublishedPosts } from "../services/posts-service.js";
import { listPublishedGalleryItems } from "../services/gallery-service.js";
import { listPublishedMusicItems } from "../services/music-service.js";
import { getSiteSetting } from "../services/site-settings-service.js";
import { escapeHtml, formatDate, plainTextExcerpt } from "../lib/utils.js";

const recentGrid = document.querySelector("#homeRecentGrid");
const recentStats = document.querySelector("#homeRecentStats");
const browseGrid = document.querySelector("#homeBrowseGrid");
const signalsGrid = document.querySelector("#homeSignalsGrid");
const heroCopy = document.querySelector("#homeHeroCopy");
const heroImage = document.querySelector("#homeHeroImage");
const HERO_SETTING_KEY = "home_hero";
const DEFAULT_HERO_IMAGE = "assets/images/home-hero.svg";
const HERO_PLACEHOLDER_SOURCE = "placeholder";
const HOME_HERO_COPY = {
  kicker: "Opening Frame / Zoey Site",
  titleLines: ["Zoey，", "你在这里", "做甚？"],
  actions: [
    {
      label: "探索更多",
      href: "#homeRecentGrid",
      className: "hero-copy__primary"
    },
    {
      label: "先看碎碎念",
      href: "notes.html",
      className: "hero-copy__secondary"
    }
  ]
};

function getGalleryImageUrl(item) {
  return item?.thumbnail_url || item?.image_url || "";
}

function buildMeta(parts) {
  return parts.filter(Boolean).map((part) => `<span>${escapeHtml(part)}</span>`).join("");
}

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, " ");
}

function estimateTextUnits(value = "") {
  const text = stripHtml(value).replace(/\s+/g, " ").trim();
  const cjkCount = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinWordCount = (text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ").match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
  return cjkCount + latinWordCount;
}

function estimateTotalWords(notes, posts) {
  const notesCount = notes.reduce((total, item) => total + estimateTextUnits(item.content), 0);
  const postsCount = posts.reduce(
    (total, item) => total + estimateTextUnits(`${item.content_html || ""} ${item.summary || ""}`),
    0
  );
  return notesCount + postsCount;
}

function formatCompactNumber(value) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return String(value);
}

function renderStatDoodle(type) {
  const doodles = {
    notes: `
      <svg class="stat-doodle stat-doodle--notes" viewBox="0 0 80 36" aria-hidden="true">
        <path d="M10 22c12 10 29-15 14-16-12-.8-10 25 8 23 19-2 13-26-1-20-13 5-4 25 12 19 11-4 10-17 1-15-11 2-8 20 8 18 8-1 13-7 16-14"></path>
        <path d="M16 10c6-6 14-8 24-7"></path>
      </svg>
    `,
    posts: `
      <svg class="stat-doodle stat-doodle--posts" viewBox="0 0 80 36" aria-hidden="true">
        <path d="M10 24c18-14 38-19 60-15"></path>
        <path d="M12 28c19-9 36-13 52-13"></path>
      </svg>
    `,
    visual: `
      <svg class="stat-doodle stat-doodle--visual" viewBox="0 0 80 36" aria-hidden="true">
        ${Array.from({ length: 16 })
          .map((_, index) => {
            const x = 18 + (index % 4) * 13;
            const y = 7 + Math.floor(index / 4) * 8;
            const fill = index === 11 || index === 14 ? "var(--color-yellow)" : "#0027BB";
            return `<circle cx="${x}" cy="${y}" r="3.4" fill="${fill}"></circle>`;
          })
          .join("")}
      </svg>
    `,
    music: `
      <svg class="stat-doodle stat-doodle--music" viewBox="0 0 80 36" aria-hidden="true">
        <circle cx="38" cy="18" r="4"></circle>
        <circle cx="38" cy="18" r="13"></circle>
        <circle cx="38" cy="18" r="21"></circle>
        <path d="M58 7c5 6 6 16 1 24"></path>
      </svg>
    `,
    words: `
      <svg class="stat-doodle stat-doodle--words" viewBox="0 0 80 36" aria-hidden="true">
        <path d="M8 24c7-20 12 12 20-6s14 12 23-5 11 9 21-6"></path>
        <circle cx="68" cy="8" r="3"></circle>
      </svg>
    `
  };

  return doodles[type] || "";
}

function renderRecentStats({ notes, posts, galleryItems, musicItems }) {
  if (!recentStats) {
    return;
  }

  const stats = [
    { type: "notes", label: "NOTES", zh: "碎碎念", value: notes.length },
    { type: "posts", label: "POSTS", zh: "文章", value: posts.length },
    { type: "visual", label: "VISUAL", zh: "影像", value: galleryItems.length },
    { type: "music", label: "MUSIC", zh: "音乐", value: musicItems.length },
    { type: "words", label: "WORDS", zh: "字数", value: formatCompactNumber(estimateTotalWords(notes, posts)) }
  ];

  recentStats.innerHTML = stats
    .map(
      (item) => `
        <article class="home-recent-stat home-recent-stat--${escapeHtml(item.type)}">
          <span class="home-recent-stat__mark">
            ${renderStatDoodle(item.type)}
            <strong>${escapeHtml(String(item.value))}</strong>
          </span>
          <span class="home-recent-stat__label">${escapeHtml(item.label)}</span>
          <span class="home-recent-stat__zh">${escapeHtml(item.zh)}</span>
        </article>
      `
    )
    .join("");
}

function renderQuickIcon(type) {
  const icons = {
    notes: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.75h10A1.75 1.75 0 0 1 18.75 6.5v11A1.75 1.75 0 0 1 17 19.25H7A1.75 1.75 0 0 1 5.25 17.5v-11A1.75 1.75 0 0 1 7 4.75Z"></path>
        <path d="M8.5 9.25h7"></path>
        <path d="M8.5 12h7"></path>
        <path d="M8.5 14.75H13"></path>
      </svg>
    `,
    writing: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 4.75h8.5l3 3v11.5H6.75z"></path>
        <path d="M15.25 4.75v3.5h3"></path>
        <path d="M9 12.25h6"></path>
        <path d="M9 15h6"></path>
      </svg>
    `,
    visual: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.75" y="5.5" width="14.5" height="13" rx="2"></rect>
        <circle cx="9" cy="10" r="1.6"></circle>
        <path d="m6.75 16 3.5-3.5 2.5 2.5 2.75-2.75L19 16"></path>
      </svg>
    `,
    music: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18.25a2.25 2.25 0 1 1 0-4.5"></path>
        <path d="M16 16.75a2.25 2.25 0 1 1 0-4.5"></path>
        <path d="M11.25 18V7.25l7-1.5v8.75"></path>
      </svg>
    `,
    tools: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 5.5a3.25 3.25 0 0 0-4.8 4.35l-4.2 4.2a1.7 1.7 0 1 0 2.4 2.4l4.2-4.2a3.25 3.25 0 0 0 4.35-4.8l-2.15 2.15-2.15-2.15Z"></path>
      </svg>
    `
  };

  return icons[type] || icons.notes;
}

function getContentDate(item) {
  return item?.publish_date || item?.created_at || item?.updated_at || "";
}

function getDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function buildActivityHeatmap({ notes, posts, galleryItems, musicItems }) {
  const counts = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayCount = 90;
  const start = addDays(today, -(dayCount - 1));

  [...notes, ...posts, ...galleryItems, ...musicItems].forEach((item) => {
    const date = new Date(getContentDate(item));

    if (Number.isNaN(date.getTime())) {
      return;
    }

    date.setHours(0, 0, 0, 0);

    if (date < start || date > today) {
      return;
    }

    const key = getDateKey(date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(start, index);
    const dateKey = getDateKey(date);
    const count = counts.get(dateKey) || 0;
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;

    return {
      date: dateKey,
      count,
      level
    };
  });
}

function formatActivityCount(count) {
  return count > 0 ? `${count} 条记录` : "暂无记录";
}

function renderActivityHeatmap(data) {
  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const legendLevels = [0, 1, 2, 3, 4];
  const heatmapData = buildActivityHeatmap(data);
  const cellCount = Math.ceil(heatmapData.length / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => heatmapData[index] || null);

  return `
    <section class="activity-heatmap-card" aria-label="最近 90 天记录热力图">
      <div class="activity-heatmap-card__head">
        <p class="section-label">ACTIVITY HEATMAP</p>
        <h3>最近 90 天的记录热力图</h3>
      </div>

      <div class="activity-heatmap__body">
        <div class="activity-heatmap__plot">
          <div class="activity-heatmap__weekday-labels" aria-hidden="true">
            ${weekdayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
          </div>
          <div class="activity-heatmap__grid" aria-label="最近 90 天记录热力图">
            ${cells
              .map((cell) => {
                if (!cell) {
                  return '<span class="activity-heatmap__cell activity-heatmap__cell--empty" aria-hidden="true"></span>';
                }

                const countLabel = formatActivityCount(cell.count);
                const tooltip = `${cell.date} · ${countLabel}`;

                return `
                  <button
                    type="button"
                    class="activity-heatmap__cell activity-heatmap__cell--level-${cell.level}"
                    data-date="${escapeHtml(cell.date)}"
                    data-count="${cell.count}"
                    data-label="${escapeHtml(countLabel)}"
                    data-tooltip="${escapeHtml(tooltip)}"
                    aria-label="${escapeHtml(tooltip)}"
                  ></button>
                `;
              })
              .join("")}
          </div>
        </div>
        <div class="activity-heatmap__selection" aria-live="polite" hidden></div>
        <div class="activity-heatmap__footer">
          <span>More active days, more stories.</span>
          <span class="activity-heatmap__legend" aria-label="活跃程度图例">
            <span>Less</span>
            ${legendLevels.map((level) => `<i class="activity-heatmap__cell activity-heatmap__cell--level-${level}" aria-hidden="true"></i>`).join("")}
            <span>More</span>
          </span>
        </div>
      </div>
    </section>
  `;
}

function initActivityHeatmap(root = document) {
  const heatmap = root.querySelector(".activity-heatmap-card");

  if (!heatmap) {
    return;
  }

  const selection = heatmap.querySelector(".activity-heatmap__selection");

  heatmap.addEventListener("click", (event) => {
    const cell = event.target.closest(".activity-heatmap__grid .activity-heatmap__cell:not(.activity-heatmap__cell--empty)");

    if (!cell) {
      return;
    }

    heatmap.querySelectorAll(".activity-heatmap__cell--selected").forEach((selectedCell) => {
      selectedCell.classList.remove("activity-heatmap__cell--selected");
    });

    cell.classList.add("activity-heatmap__cell--selected");

    if (selection) {
      selection.textContent = `${cell.dataset.date}：${cell.dataset.label}`;
      selection.hidden = false;
    }
  });
}

function estimateReadingMinutes(value = "") {
  return Math.max(1, Math.ceil(estimateTextUnits(value) / 420));
}

function resolveRecentHighlights({ notes, posts, galleryItems }) {
  return [
    ...posts.map((item) => ({
      type: "post",
      label: `${item.category || "文章"} · POST`,
      title: item.title || "未命名文章",
      date: getContentDate(item),
      meta: `${estimateReadingMinutes(`${item.content_html || ""} ${item.summary || ""}`)} min read`,
      href: item.slug ? `post.html?slug=${encodeURIComponent(item.slug)}` : "writing.html",
      imageUrl: item.cover_image_url || "",
      imageAlt: item.title || "文章封面"
    })),
    ...galleryItems.map((item) => ({
      type: "visual",
      label: "影像 · VISUAL",
      title: item.title || "未命名影像",
      date: getContentDate(item),
      meta: item.category || "Visual",
      href: "gallery.html",
      imageUrl: getGalleryImageUrl(item),
      imageAlt: item.title || "视觉作品"
    })),
    ...notes.map((item) => ({
      type: "note",
      label: "碎碎念 · NOTE",
      title: item.title || plainTextExcerpt(item.content, 20) || "一些突然的想法",
      date: getContentDate(item),
      meta: `${estimateTextUnits(item.content)} words`,
      href: "notes.html",
      imageUrl: "",
      imageAlt: "碎碎念"
    }))
  ]
    .filter((item) => item.date)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 3);
}

function renderHighlightThumb(item) {
  if (item.imageUrl) {
    return `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy">`;
  }

  return `
    <span class="recent-highlight__thumb-doodle" aria-hidden="true">
      <svg viewBox="0 0 96 96">
        <path d="M22 60c12-20 24 16 35-9 8-18 15 6 24-14"></path>
        <path d="M26 28c14 7 28 7 43-2"></path>
        <circle cx="29" cy="70" r="4"></circle>
        <circle cx="68" cy="58" r="5"></circle>
      </svg>
    </span>
  `;
}

function renderRecentHighlights(data) {
  const highlights = resolveRecentHighlights(data);

  return `
    <section class="recent-highlights-card" aria-label="最新精选">
      <div class="recent-highlights-card__head">
        <div>
          <p class="section-label">Recent Highlights</p>
          <h3>最新精选</h3>
        </div>
        <a class="recent-highlights-card__view-all" href="#homeBrowseGrid">View all →</a>
      </div>

      <div class="recent-highlights-card__list">
        ${
          highlights.length
            ? highlights
                .map(
                  (item) => `
                    <a class="recent-highlight-item recent-highlight-item--${escapeHtml(item.type)}" href="${escapeHtml(item.href)}">
                      <span class="recent-highlight__thumb recent-highlight__thumb--${escapeHtml(item.type)}">
                        ${renderHighlightThumb(item)}
                      </span>
                      <span class="recent-highlight__copy">
                        <span class="recent-highlight__type">${escapeHtml(item.label)}</span>
                        <strong>${escapeHtml(item.title)}</strong>
                        <span>${escapeHtml(formatDate(item.date))} <em></em> ${escapeHtml(item.meta)}</span>
                      </span>
                      <i class="recent-highlight__dot" aria-hidden="true"></i>
                    </a>
                  `
                )
                .join("")
            : '<p class="home-empty-note">内容发布后会自动形成最新精选。</p>'
        }
      </div>
    </section>
  `;
}

function renderHomeHeroCopy() {
  if (!heroCopy) {
    return;
  }

  heroCopy.innerHTML = `
    <p class="hero-copy__kicker">${escapeHtml(HOME_HERO_COPY.kicker)}</p>
    <h1 class="hero-copy__title">
      ${HOME_HERO_COPY.titleLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
    </h1>
    <p class="hero-copy__desc">${escapeHtml(HOME_HERO_COPY.description)}</p>
    <p class="hero-copy__lead">${escapeHtml(HOME_HERO_COPY.lead)}</p>
    <div class="hero-copy__actions">
      ${HOME_HERO_COPY.actions
        .map(
          (action) => `
            <a class="${escapeHtml(action.className)}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>
          `
        )
        .join("")}
    </div>
  `;
}

function bindHomeHeroScrollEffect() {
  const hero = document.querySelector(".home-hero");

  if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.style.setProperty("--home-hero-scroll-progress", "0");
    document.documentElement.style.setProperty("--home-hero-effect-progress", "0");
    return;
  }

  let ticking = false;

  const syncProgress = () => {
    const scrollY = window.scrollY;
    const progress = Math.min(Math.max(scrollY / 280, 0), 1);
    const effectProgress = Math.min(Math.max((scrollY - 112) / 168, 0), 1);
    document.documentElement.style.setProperty("--home-hero-scroll-progress", progress.toFixed(3));
    document.documentElement.style.setProperty("--home-hero-effect-progress", effectProgress.toFixed(3));
    ticking = false;
  };

  syncProgress();

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(syncProgress);
    },
    { passive: true }
  );
}

function extractHeroImageUrl(value) {
  if (value && typeof value === "object" && typeof value.image_url === "string") {
    return value.image_url;
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function setHeroState(source, status) {
  document.body.dataset.homeHeroSource = source;
  document.body.dataset.homeHeroStatus = status;
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing hero image source"));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = reject;
    image.src = src;
  });
}

async function setHomeHeroImage(src, source) {
  if (!heroImage || !src) {
    setHeroState(source || HERO_PLACEHOLDER_SOURCE, "empty");
    return false;
  }

  try {
    const loadedSrc = await preloadImage(src);
    heroImage.classList.remove("is-loaded");
    heroImage.src = loadedSrc;
    document.documentElement.style.setProperty("--home-hero-image", `url("${loadedSrc}")`);
    document.body.style.setProperty("--home-hero-image", `url("${loadedSrc}")`);
    requestAnimationFrame(() => {
      heroImage.classList.add("is-loaded");
      setHeroState(source, "loaded");
    });
    return true;
  } catch (error) {
    setHeroState(source || HERO_PLACEHOLDER_SOURCE, "failed");
    return false;
  }
}

function resolveFeaturedStory(notes, posts) {
  const featuredNote = notes.find((item) => item?.featured || item?.pinned) || null;
  const latestPost = posts[0] || null;

  if (featuredNote) {
    return {
      label: "碎碎念",
      title: plainTextExcerpt(featuredNote.content, 26) || "置顶碎碎念",
      summary: plainTextExcerpt(featuredNote.content, 110),
      date: featuredNote.publish_date || featuredNote.created_at,
      href: "notes.html"
    };
  }

  return {
    label: latestPost?.category || "文章",
    title: latestPost?.title || "最新文章",
    summary: latestPost
      ? plainTextExcerpt(latestPost.summary || latestPost.title, 120)
      : "这里会优先显示一篇最新文章或置顶碎碎念。",
    date: latestPost?.publish_date || "",
    href: latestPost ? `post.html?slug=${encodeURIComponent(latestPost.slug)}` : "writing.html"
  };
}

async function applyHomeHeroSetting() {
  setHeroState(HERO_PLACEHOLDER_SOURCE, "loading");

  try {
    const value = await getSiteSetting(HERO_SETTING_KEY);
    const imageUrl = extractHeroImageUrl(value);

    if (imageUrl) {
      const didLoadRemoteHero = await setHomeHeroImage(imageUrl, "site_settings");
      if (didLoadRemoteHero) {
        return;
      }
    }

    await setHomeHeroImage(DEFAULT_HERO_IMAGE, "default");
  } catch (error) {
    await setHomeHeroImage(DEFAULT_HERO_IMAGE, "default");
  }
}

function renderHomePreview({ notes, posts, galleryItems, musicItems }) {
  if (!recentGrid) {
    return;
  }

  const quickLinks = [
    { type: "notes", label: "碎碎念", meta: "Notes", href: "notes.html", icon: "notes" },
    { type: "writing", label: "文章", meta: "Writing", href: "writing.html", icon: "writing" },
    { type: "visual", label: "视觉", meta: "Visual", href: "gallery.html", icon: "visual" },
    { type: "music", label: "音乐", meta: "Music", href: "music.html", icon: "music" },
    { type: "tools", label: "工具箱", meta: "Tools", href: "tools.html", icon: "tools" }
  ];

  recentGrid.innerHTML = `
    <div class="recent-main-grid">
      ${renderActivityHeatmap({ notes, posts, galleryItems, musicItems })}
      ${renderRecentHighlights({ notes, posts, galleryItems })}

      <aside class="home-quick-access" aria-label="快速入口">
        <p class="home-quick-access__title">快速入口</p>
        <div class="home-quick-access__list">
          ${quickLinks
            .map(
              (item) => `
                <a class="home-quick-access__button home-quick-access__button--${escapeHtml(item.type)}" href="${escapeHtml(item.href)}">
                  <span class="home-quick-access__icon">${renderQuickIcon(item.icon)}</span>
                  <span class="home-quick-access__copy">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.meta)}</span>
                  </span>
                </a>
              `
            )
            .join("")}
        </div>
      </aside>
    </div>
  `;

  initActivityHeatmap(recentGrid);
}

function renderBrowseGrid({ notes, posts, galleryItems, musicItems }) {
  if (!browseGrid) {
    return;
  }

  const noteItems = notes.slice(0, 3);
  const postItems = posts.slice(0, 3);
  const visualItems = galleryItems.slice(0, 4);
  const latestMusic = musicItems[0] || null;

  browseGrid.innerHTML = `
    <div class="section-grid">
      <section class="section-grid__column section-grid__column--notes">
        <div class="section-grid__head">
          <p class="section-label">Notes</p>
          <h3>碎碎念精选</h3>
        </div>
        <div class="section-grid__list">
          ${
            noteItems.length
              ? noteItems
                  .map(
                    (item) => `
                      <a class="section-grid__list-row" href="notes.html">
                        <strong>${escapeHtml(plainTextExcerpt(item.content, 34) || "一条碎碎念")}</strong>
                        <span>${escapeHtml(formatDate(item.publish_date || item.created_at))}</span>
                      </a>
                    `
                  )
                  .join("")
              : '<p class="home-empty-note">发布后会自动显示在这里。</p>'
          }
        </div>
        <a class="section-grid__more" href="notes.html">查看全部</a>
      </section>

      <section class="section-grid__column section-grid__column--writing">
        <div class="section-grid__head">
          <p class="section-label">Writing</p>
          <h3>文章精选</h3>
        </div>
        <div class="section-grid__list">
          ${
            postItems.length
              ? postItems
                  .map(
                    (item) => `
                      <a class="section-grid__list-row" href="${item ? `post.html?slug=${encodeURIComponent(item.slug)}` : "writing.html"}">
                        <strong>${escapeHtml(item.title || "文章")}</strong>
                        <span>${escapeHtml(formatDate(item.publish_date))}</span>
                      </a>
                    `
                  )
                  .join("")
              : '<p class="home-empty-note">发布后会自动显示在这里。</p>'
          }
        </div>
        <a class="section-grid__more" href="writing.html">查看全部</a>
      </section>

      <section class="section-grid__column section-grid__column--visual">
        <div class="section-grid__head">
          <p class="section-label">Visual</p>
          <h3>视觉精选</h3>
        </div>
        <div class="section-grid__visuals">
          ${
            visualItems.length
              ? visualItems
                  .map(
                    (item) => `
                      <a class="home-visual-card" href="gallery.html">
                        ${
                          getGalleryImageUrl(item)
                            ? `<img src="${escapeHtml(getGalleryImageUrl(item))}" alt="${escapeHtml(item.title || "视觉作品")}" loading="lazy">`
                            : '<div class="home-visual-card__placeholder">Visual</div>'
                        }
                        <span>${escapeHtml(item.title || "视觉作品")}</span>
                      </a>
                    `
                  )
                  .join("")
              : '<p class="home-empty-note">视觉作品发布后会在这里出现。</p>'
          }
        </div>
        <a class="section-grid__more" href="gallery.html">查看全部</a>
      </section>

      <section class="section-grid__column section-grid__column--music">
        <div class="section-grid__head">
          <p class="section-label">Music</p>
          <h3>音乐精选</h3>
        </div>
        <article class="home-music-feature">
          <div class="home-music-feature__copy">
            <p class="section-label">${escapeHtml(latestMusic?.artist || "最新曲目")}</p>
            <h4>${escapeHtml(latestMusic?.title || "最近音乐")}</h4>
            <p>${escapeHtml(latestMusic?.description || "这里会显示最新发布的音乐条目与简短介绍。")}</p>
            <div class="home-meta-line">
              ${buildMeta([latestMusic ? formatDate(latestMusic.publish_date) : "--"])}
            </div>
          </div>
        </article>
        <a class="section-grid__more" href="music.html">进入音乐页</a>
      </section>
    </div>
  `;
}

function renderSignalsGrid({ notes, posts, galleryItems, musicItems }) {
  if (!signalsGrid) {
    return;
  }

  const randomNote = notes.length ? notes[Math.floor(Math.random() * notes.length)] : null;
  const updates = [
    ...notes.slice(0, 2).map((item) => ({
      type: "碎碎念",
      title: plainTextExcerpt(item.content, 32) || "一条碎碎念",
      date: item.publish_date || item.created_at,
      href: "notes.html"
    })),
    ...posts.slice(0, 2).map((item) => ({
      type: "文章",
      title: item.title,
      date: item.publish_date,
      href: `post.html?slug=${encodeURIComponent(item.slug)}`
    })),
    ...galleryItems.slice(0, 1).map((item) => ({
      type: "视觉",
      title: item.title || "视觉作品",
      date: item.publish_date,
      href: "gallery.html"
    })),
    ...musicItems.slice(0, 1).map((item) => ({
      type: "音乐",
      title: item.title || "音乐条目",
      date: item.publish_date,
      href: "music.html"
    }))
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  signalsGrid.innerHTML = `
    <div class="home-content-flow">
      <section class="home-row home-row--signals">
        <article class="home-quote-feature">
          <p class="section-label">Random Line</p>
          <h3>随机一句话</h3>
          <blockquote class="home-random-quote">${escapeHtml(randomNote ? plainTextExcerpt(randomNote.content, 120) : "等有更多碎碎念之后，这里会随机出现一句。")}</blockquote>
        </article>

        <section class="home-updates-block">
          <div class="home-row__intro home-row__intro--compact">
            <p class="section-label">Updates</p>
            <h3>最近更新</h3>
          </div>
          <div class="home-updates-block__list">
            ${
              updates.length
                ? updates
                    .map(
                      (item) => `
                        <a class="home-list-item" href="${escapeHtml(item.href)}">
                          <strong>${escapeHtml(item.title)}</strong>
                          <span>${escapeHtml(`${item.type} · ${formatDate(item.date)}`)}</span>
                        </a>
                      `
                    )
                    .join("")
                : '<p class="home-empty-note">近期更新会自动汇总在这里。</p>'
            }
          </div>
        </section>
      </section>
    </div>
  `;
}

async function initHomePage() {
  renderHomeHeroCopy();
  bindHomeHeroScrollEffect();
  applyHomeHeroSetting();

  try {
    const [notes, posts, galleryItems, musicItems] = await Promise.all([
      listPublishedNotes(),
      listPublishedPosts(),
      listPublishedGalleryItems(),
      listPublishedMusicItems()
    ]);

    renderRecentStats({ notes, posts, galleryItems, musicItems });
    renderHomePreview({ notes, posts, galleryItems, musicItems });
    renderBrowseGrid({ notes, posts, galleryItems, musicItems });
  } catch (error) {
    if (recentStats) {
      recentStats.innerHTML = "";
    }

    if (recentGrid) {
      recentGrid.innerHTML = `
        <article class="home-empty-state">
          <p class="section-label">Supabase</p>
          <h3>等待接入</h3>
          <p>首页预览区暂时无法读取数据。请先完成 Supabase 配置，然后刷新页面。</p>
        </article>
      `;
    }

    if (browseGrid) {
      browseGrid.innerHTML = `
        <article class="home-empty-state">
          <p class="section-label">Browse</p>
          <h3>等待内容</h3>
          <p class="home-empty-note">数据接通后，这里会按栏目自动填充首页内容。</p>
        </article>
      `;
    }

    if (signalsGrid) {
      signalsGrid.innerHTML = `
        <article class="home-empty-state">
          <p class="section-label">Signals</p>
          <h3>等待接入</h3>
          <p>随机一句话和最近更新会在 Supabase 数据可用后自动显示。</p>
        </article>
      `;
    }
  }
}

initHomePage();
