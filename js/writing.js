const writingPage = document.body.dataset.page === "writing";

if (writingPage) {
  const writingRoot = window.writingData || { categories: [], articles: [] };
  const categories = Array.isArray(writingRoot.categories) ? writingRoot.categories : [];
  const articles = Array.isArray(writingRoot.articles) ? [...writingRoot.articles] : [];
  const navRoot = document.querySelector("#writingCategoryNav");
  const sectionsRoot = document.querySelector("#writingSections");
  const statsRoot = document.querySelector("#writingStats");
  const recentRoot = document.querySelector("#writingRecent");
  const recommendedRoot = document.querySelector("#writingRecommended");
  const searchInput = document.querySelector("#writingSearchInput");
  const pageTitle = document.querySelector("#writingPageTitle");
  const pageLead = document.querySelector("#writingPageLead");

  let currentCategory = "all";
  let query = "";

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const getFilteredArticles = () => {
    return articles
      .filter((article) => currentCategory === "all" || article.category === currentCategory)
      .filter((article) => {
        if (!query) {
          return true;
        }

        const haystack = [
          article.title,
          article.summary,
          article.date,
          ...(Array.isArray(article.tags) ? article.tags : [])
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => new Date(right.date) - new Date(left.date));
  };

  const createArticleCard = (article) => {
    const coverMarkup = article.cover
      ? `<img src="${escapeHtml(article.cover)}" alt="${escapeHtml(article.title)}" loading="lazy">`
      : `
        <div class="writing-card-cover-placeholder writing-card-cover-${escapeHtml(article.category)}">
          <span>${escapeHtml(categoryMap.get(article.category)?.label || "文章")}</span>
        </div>
      `;

    const tags = Array.isArray(article.tags) ? article.tags : [];

    return `
      <article class="writing-card">
        <a class="writing-card-link" href="${escapeHtml(article.link || "#")}" aria-label="查看文章：${escapeHtml(article.title)}">
          <div class="writing-card-cover">
            ${coverMarkup}
          </div>
          <div class="writing-card-copy">
            <div class="writing-card-meta">
              <span class="writing-card-category">${escapeHtml(categoryMap.get(article.category)?.label || "文章")}</span>
              <time datetime="${escapeHtml(article.date)}">${formatDate(article.date)}</time>
            </div>
            <h3>${escapeHtml(article.title)}</h3>
            <p>${escapeHtml(article.summary)}</p>
            <div class="writing-card-tags">
              ${tags.map((tag) => `<span class="writing-card-tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </a>
      </article>
    `;
  };

  const renderNav = () => {
    if (!navRoot) {
      return;
    }

    navRoot.innerHTML = categories
      .map((category) => `
        <button
          class="writing-category-button${category.id === currentCategory ? " is-active" : ""}"
          type="button"
          data-writing-category="${escapeHtml(category.id)}"
          aria-pressed="${String(category.id === currentCategory)}"
        >
          <span>${escapeHtml(category.label)}</span>
          <small>${category.id === "all" ? articles.length : articles.filter((article) => article.category === category.id).length}</small>
        </button>
      `)
      .join("");

    navRoot.querySelectorAll("[data-writing-category]").forEach((button) => {
      button.addEventListener("click", () => {
        currentCategory = button.getAttribute("data-writing-category") || "all";
        renderWritingPage();
      });
    });
  };

  const renderStats = () => {
    if (!statsRoot) {
      return;
    }

    statsRoot.innerHTML = categories
      .filter((category) => category.id !== "all")
      .map((category) => `
        <li>
          <button type="button" class="writing-meta-button" data-writing-category="${escapeHtml(category.id)}">
            <span>${escapeHtml(category.label)}</span>
            <strong>${articles.filter((article) => article.category === category.id).length}</strong>
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
  };

  const renderSideList = (root, list) => {
    if (!root) {
      return;
    }

    root.innerHTML = list
      .map((article) => `
        <a class="writing-side-item" href="${escapeHtml(article.link || "#")}">
          <span class="writing-side-item-category">${escapeHtml(categoryMap.get(article.category)?.label || "文章")}</span>
          <strong>${escapeHtml(article.title)}</strong>
          <small>${formatDate(article.date)}</small>
        </a>
      `)
      .join("");
  };

  const renderSections = () => {
    if (!sectionsRoot) {
      return;
    }

    const filteredArticles = getFilteredArticles();
    const visibleCategories = currentCategory === "all"
      ? categories.filter((category) => category.id !== "all")
      : categories.filter((category) => category.id === currentCategory);

    if (pageTitle) {
      pageTitle.textContent = categoryMap.get(currentCategory)?.label || "全部";
    }

    if (pageLead) {
      pageLead.textContent = categoryMap.get(currentCategory)?.description || "这里先展示所有写作方向的文章预览，你可以从评论、见闻、阅读切进去继续看。";
    }

    sectionsRoot.innerHTML = visibleCategories
      .map((category) => {
        const categoryArticles = filteredArticles.filter((article) => article.category === category.id);

        return `
          <section class="writing-section">
            <header class="writing-section-head">
              <div>
                <p class="section-label">${escapeHtml(category.label)}</p>
                <h3>${escapeHtml(category.label)}</h3>
              </div>
              <a href="#" class="writing-more-link">查看更多</a>
            </header>
            <div class="writing-card-list">
              ${
                categoryArticles.length
                  ? categoryArticles.map((article) => createArticleCard(article)).join("")
                  : '<p class="writing-empty">这个方向还没有符合当前筛选条件的文章。</p>'
              }
            </div>
          </section>
        `;
      })
      .join("");
  };

  const renderWritingPage = () => {
    renderNav();
    renderStats();
    renderSections();
    renderSideList(recommendedRoot, articles.filter((article) => article.featured));
    renderSideList(
      recentRoot,
      [...articles].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 4)
    );
  };

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      renderSections();
    });
  }

  renderWritingPage();
}
