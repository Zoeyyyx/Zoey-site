const menuButton = document.querySelector(".menu-toggle");
const currentPage = document.body.dataset.page;
  const navActivePage = document.body.dataset.navActive || currentPage;
  const navRoot = document.body.dataset.navRoot || "";
const nav = document.querySelector(".nav");
const NAV_ITEMS = [
  {
    id: "notes",
    href: "notes.html",
    label: "碎碎念",
    subtitle: "最近的片段与记录"
  },
  {
    id: "writing",
    href: "writing.html",
    label: "文章",
    subtitle: "较完整的文字与思考"
  },
  {
    id: "music",
    href: "music.html",
    label: "音乐",
    subtitle: "正在听与留下的旋律"
  },
  {
    id: "gallery",
    href: "gallery.html",
    label: "视觉",
    subtitle: "摄影与绘画作品"
  },
  {
    id: "tools",
    href: "tools.html",
    label: "工具",
    subtitle: "一些常用小东西"
  }
];

if (nav) {
  const isHomeNav = currentPage === "home";
  nav.innerHTML = NAV_ITEMS.map((item) => {
    if (isHomeNav) {
      return `
        <a href="${navRoot}${item.href}" data-home-link data-nav-id="${item.id}" ${item.id === "notes" ? 'class="notes-entry-link"' : ""}>
          <span class="home-nav-title">${item.label}</span>
          <span class="home-nav-sub">${item.subtitle}</span>
        </a>
      `;
    }

      return `<a href="${navRoot}${item.href}" data-nav-id="${item.id}">${item.label}</a>`;
  }).join("");
}

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href");
      const normalizedHref = href ? href.split("/").pop() : "";

    if (navActivePage && normalizedHref === `${navActivePage}.html`) {
        link.classList.add("is-active");
      }

    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

const messageForm = document.querySelector(".message-form");

if (messageForm) {
  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = messageForm.querySelector("button");

    if (button) {
      const originalText = button.textContent;
      button.textContent = "已贴好";
      button.disabled = true;

      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        messageForm.reset();
      }, 1600);
    }
  });
}

const notesPage = currentPage === "notes";
const homePage = currentPage === "home";
const galleryPage = currentPage === "gallery";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (homePage) {
  const homeLinks = document.querySelectorAll("[data-home-link]");
  const homeBody = document.body;

  window.requestAnimationFrame(() => {
    homeBody.classList.add("home-ready");
  });

  homeLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");

      if (!href || homeBody.classList.contains("home-leaving")) {
        return;
      }

      event.preventDefault();
      homeBody.classList.add("home-compact");
        const isNotesLink = href ? href.endsWith("notes.html") : false;

      // Morph the large home entries into the top navigation before navigating away.
      window.requestAnimationFrame(() => {
        homeBody.classList.add("home-leaving");
        link.classList.add("is-target");

        if (isNotesLink) {
          homeBody.classList.add("notes-transitioning");
        }
      });

      window.setTimeout(() => {
        window.location.href = href;
      }, isNotesLink ? (prefersReducedMotion ? 80 : 180) : (prefersReducedMotion ? 60 : 140));
    });
  });
}

if (galleryPage) {
  const visualGrid = document.querySelector("#visual-grid");
  const filterButtons = document.querySelectorAll("[data-visual-filter]");
  const works = Array.isArray(window.galleryData) ? [...window.galleryData] : [];
  let currentFilter = "all";
  let lightbox = null;

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const typeLabelMap = {
    photo: "摄影",
    drawing: "绘画"
  };

  const placeholderLabelMap = {
    photo: "Photo",
    drawing: "Drawing"
  };

  const createWorkCard = (work) => {
    const card = document.createElement("article");
    card.className = "visual-work";
    card.dataset.type = work.type;

    const tagMarkup = Array.isArray(work.tags) && work.tags.length
      ? `<div class="visual-tags">${work.tags.map((tag) => `<span class="visual-tag">${escapeHtml(tag)}</span>`).join("")}</div>`
      : "";

    const descriptionMarkup = work.description
      ? `<p class="visual-work-desc">${escapeHtml(work.description)}</p>`
      : "";

    const imageMarkup = work.image
      ? `<img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title || typeLabelMap[work.type] || "视觉作品")}" loading="lazy">`
      : `
        <div class="visual-work-placeholder visual-work-placeholder-${work.type}">
          <span>${placeholderLabelMap[work.type] || "Work"}</span>
        </div>
      `;

    card.innerHTML = `
      <button class="visual-work-hitarea" type="button" aria-label="查看作品：${escapeHtml(work.title || "未命名作品")}">
        <div class="visual-work-media">
          ${imageMarkup}
        </div>
        <div class="visual-work-meta">
          <div class="visual-work-head">
            <p class="section-label">${typeLabelMap[work.type] || "作品"}</p>
            ${work.date ? `<span class="visual-work-date">${escapeHtml(work.date)}</span>` : ""}
          </div>
          ${work.title ? `<h2 class="visual-work-title">${escapeHtml(work.title)}</h2>` : ""}
          ${descriptionMarkup}
          ${tagMarkup}
        </div>
      </button>
    `;

    card.querySelector(".visual-work-hitarea")?.addEventListener("click", () => {
      if (!lightbox) {
        return;
      }

      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");

      const lightboxLabel = lightbox.querySelector(".visual-lightbox-label");
      const lightboxTitle = lightbox.querySelector(".visual-lightbox-title");
      const lightboxDate = lightbox.querySelector(".visual-lightbox-date");
      const lightboxDesc = lightbox.querySelector(".visual-lightbox-desc");
      const lightboxMedia = lightbox.querySelector(".visual-lightbox-media");
      const lightboxTags = lightbox.querySelector(".visual-lightbox-tags");

      if (lightboxLabel) {
        lightboxLabel.textContent = typeLabelMap[work.type] || "作品";
      }

      if (lightboxTitle) {
        lightboxTitle.textContent = work.title || "未命名作品";
      }

      if (lightboxDate) {
        lightboxDate.textContent = work.date || "";
      }

      if (lightboxDesc) {
        lightboxDesc.textContent = work.description || "这里可以继续补充作品说明、拍摄背景或绘画笔记。";
      }

      if (lightboxTags) {
        lightboxTags.innerHTML = Array.isArray(work.tags)
          ? work.tags.map((tag) => `<span class="visual-tag">${escapeHtml(tag)}</span>`).join("")
          : "";
      }

      if (lightboxMedia) {
        lightboxMedia.innerHTML = work.image
          ? `<img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title || "视觉作品")}" loading="eager">`
          : `
            <div class="visual-work-placeholder visual-work-placeholder-${work.type}">
              <span>${placeholderLabelMap[work.type] || "Work"}</span>
            </div>
          `;
      }
    });

    return card;
  };

  const renderWorks = () => {
    if (!visualGrid) {
      return;
    }

    const filteredWorks = works.filter((work) => currentFilter === "all" || work.type === currentFilter);

    visualGrid.innerHTML = "";

    if (!filteredWorks.length) {
      visualGrid.innerHTML = '<p class="notes-empty visual-empty">这个分类里还没有放入作品，之后可以继续补上。</p>';
      return;
    }

    filteredWorks.forEach((work) => {
      visualGrid.append(createWorkCard(work));
    });
  };

  const ensureLightbox = () => {
    if (lightbox) {
      return;
    }

    lightbox = document.createElement("div");
    lightbox.className = "visual-lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
      <div class="visual-lightbox-backdrop" data-lightbox-close></div>
      <div class="visual-lightbox-dialog" role="dialog" aria-modal="true" aria-label="作品大图查看">
        <button class="visual-lightbox-close" type="button" aria-label="关闭大图" data-lightbox-close>×</button>
        <div class="visual-lightbox-layout">
          <div class="visual-lightbox-media"></div>
          <div class="visual-lightbox-copy">
            <p class="section-label visual-lightbox-label"></p>
            <h2 class="visual-lightbox-title"></h2>
            <p class="visual-lightbox-date"></p>
            <p class="visual-lightbox-desc"></p>
            <div class="visual-lightbox-tags"></div>
          </div>
        </div>
      </div>
    `;

    lightbox.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.hasAttribute("data-lightbox-close")) {
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
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.visualFilter || "all";
      filterButtons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });
      renderWorks();
    });
  });

  ensureLightbox();
  renderWorks();
}

if (notesPage) {
  const notes = Array.isArray(window.notesData) ? [...window.notesData] : [];
  const timelineRoot = document.querySelector("#notes-timeline");
  const graphRoot = document.querySelector("#notes-graph");
  const toggleButtons = document.querySelectorAll(".view-toggle");
  const panels = document.querySelectorAll("[data-view-panel]");
  let graphController = null;
  let graphInitialized = false;

  const formatMonthLabel = (value) => value.slice(0, 7);

  const formatDateLabel = (datetime) => {
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatYearLabel = (datetime) => {
    const date = new Date(datetime);
    return String(date.getFullYear());
  };

  const formatMonthDayLabel = (datetime) => {
    const date = new Date(datetime);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const excerptText = (value, maxLength = 78) => {
    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
  };

  const splitNoteParagraphs = (value) =>
    String(value)
      .trim()
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  const tokenize = (value) => {
    const normalized = String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = normalized ? normalized.split(" ").filter((token) => token.length > 1) : [];
    const compact = normalized.replace(/\s+/g, "");

    for (let index = 0; index < compact.length - 1; index += 1) {
      const gram = compact.slice(index, index + 2);
      if (gram.trim()) {
        tokens.push(gram);
      }
    }

    return [...new Set(tokens)];
  };

  const stopTokens = new Set([
    "自己", "今天", "有些", "一些", "这个", "那个", "不是", "没有", "如果", "可以", "因为",
    "时候", "事情", "一种", "已经", "还是", "也许", "其实", "这样", "什么", "怎么", "只是",
    "the", "and", "for", "with", "that", "this", "from", "have", "will"
  ]);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const createSeededRandom = (seedValue) => {
    let seed = seedValue % 2147483647;
    if (seed <= 0) {
      seed += 2147483646;
    }

    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  };

  const getSeedFromText = (value) =>
    [...String(value)].reduce((accumulator, char, index) => accumulator + (char.charCodeAt(0) * (index + 1)), 0);

  // Analysis view keeps the existing notes data, then maps it to floating slips.
  const createGraphView = () => {
    if (!graphRoot) {
      return null;
    }

    const frame = graphRoot.querySelector(".analysis-frame");
    const stage = graphRoot.querySelector(".analysis-stage");
    const centerCard = graphRoot.querySelector(".analysis-center-card");
    const input = graphRoot.querySelector(".analysis-input");
    const nodesLayer = graphRoot.querySelector(".analysis-nodes");
    const svg = graphRoot.querySelector(".analysis-links");
    const hint = graphRoot.querySelector(".analysis-hint strong");

    if (!frame || !stage || !centerCard || !input || !nodesLayer || !svg || !hint) {
      return null;
    }

    const nodeData = sortedNotes.slice(0, Math.min(sortedNotes.length, 18)).map((note, index) => {
      const seededRandom = createSeededRandom(getSeedFromText(note.id));
      const element = document.createElement("article");
      element.className = "analysis-node";
      element.dataset.noteId = note.id;
      element.innerHTML = `
        <p class="analysis-node-date">${formatDateLabel(note.datetime)}</p>
        <p class="analysis-node-text">${escapeHtml(excerptText(note.content, 90))}</p>
      `;
      nodesLayer.append(element);

      return {
        note,
        element,
        tokens: tokenize(`${note.content} ${(note.tags || []).join(" ")}`),
        keywords: [],
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        anchorX: 0,
        anchorY: 0,
        width: 0,
        height: 0,
        relevance: 0,
        linkedWeight: 0,
        hovered: false,
        active: false,
        index,
        random: seededRandom,
        driftPhaseX: seededRandom() * Math.PI * 2,
        driftPhaseY: seededRandom() * Math.PI * 2,
        driftSpeedX: 0.00015 + seededRandom() * 0.00016,
        driftSpeedY: 0.00013 + seededRandom() * 0.00014,
        driftAmpX: 20 + seededRandom() * 26,
        driftAmpY: 16 + seededRandom() * 24
      };
    });

    const tokenFrequency = new Map();
    nodeData.forEach((node) => {
      node.tokens.forEach((token) => {
        if (!stopTokens.has(token)) {
          tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
        }
      });
    });

    nodeData.forEach((node) => {
      node.keywords = node.tokens.filter((token) => {
        const frequency = tokenFrequency.get(token) || 0;
        return !stopTokens.has(token) && frequency >= 2 && frequency <= Math.ceil(nodeData.length * 0.5);
      });
    });

    const allEdges = [];
    const edgeLimitByNode = new Map();

    nodeData.forEach((source, sourceIndex) => {
      nodeData.slice(sourceIndex + 1).forEach((target) => {
        const overlap = source.keywords.filter((token) => target.keywords.includes(token));
        if (!overlap.length) {
          return;
        }

        const score = overlap.length / Math.sqrt(Math.max(source.keywords.length, 1) * Math.max(target.keywords.length, 1));
        if (score < 0.16) {
          return;
        }

        allEdges.push({
          source,
          target,
          overlap,
          score
        });
      });
    });

    allEdges
      .sort((left, right) => right.score - left.score)
      .forEach((edge) => {
        const sourceCount = edgeLimitByNode.get(edge.source.note.id) || 0;
        const targetCount = edgeLimitByNode.get(edge.target.note.id) || 0;

        if (sourceCount >= 3 || targetCount >= 3) {
          return;
        }

        edgeLimitByNode.set(edge.source.note.id, sourceCount + 1);
        edgeLimitByNode.set(edge.target.note.id, targetCount + 1);
        edge.isPinned = true;
      });

    const state = {
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
      frameHandle: 0,
      lastLinkDraw: 0,
      inputText: input.value.trim(),
      now: 0,
      visibleEdges: [],
      centerLinks: []
    };

    // Distribute note slips across the whole canvas and keep a clear exclusion zone around the center card.
    const placeNodes = () => {
      const frameRect = frame.getBoundingClientRect();
      const centerRect = centerCard.getBoundingClientRect();
      state.width = frameRect.width;
      state.height = frameRect.height;
      state.centerX = centerRect.left - frameRect.left + centerRect.width / 2;
      state.centerY = centerRect.top - frameRect.top + centerRect.height / 2;

      const exclusionBox = {
        left: centerRect.left - frameRect.left - 130,
        right: centerRect.right - frameRect.left + 130,
        top: centerRect.top - frameRect.top - 90,
        bottom: centerRect.bottom - frameRect.top + 90
      };

      const placedNodes = [];

      nodeData.forEach((node, index) => {
        const rect = node.element.getBoundingClientRect();
        node.width = rect.width || 180;
        node.height = rect.height || 120;

        const marginX = 26 + node.width / 2;
        const marginY = 26 + node.height / 2;
        const minRadius = Math.min(state.width, state.height) * 0.24;
        let bestCandidate = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (let attempt = 0; attempt < 80; attempt += 1) {
          const x = marginX + (node.random() * (state.width - (marginX * 2)));
          const y = marginY + (node.random() * (state.height - (marginY * 2)));
          const insideExclusion =
            x > exclusionBox.left &&
            x < exclusionBox.right &&
            y > exclusionBox.top &&
            y < exclusionBox.bottom;

          if (insideExclusion) {
            continue;
          }

          const distanceToCenter = Math.hypot(x - state.centerX, y - state.centerY);
          if (distanceToCenter < minRadius) {
            continue;
          }

          let nearestNodeDistance = Infinity;
          placedNodes.forEach((placedNode) => {
            const distance = Math.hypot(x - placedNode.anchorX, y - placedNode.anchorY);
            nearestNodeDistance = Math.min(nearestNodeDistance, distance);
          });

          const edgeBias = Math.min(
            Math.min(x - marginX, state.width - marginX - x),
            Math.min(y - marginY, state.height - marginY - y)
          );
          const score = (nearestNodeDistance * 1.2) + (distanceToCenter * 0.32) + (edgeBias * 0.18);

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = { x, y };
          }
        }

        if (!bestCandidate) {
          const angle = ((index + 1) / nodeData.length) * Math.PI * 2;
          bestCandidate = {
            x: clamp(state.centerX + Math.cos(angle) * (state.width * 0.36), marginX, state.width - marginX),
            y: clamp(state.centerY + Math.sin(angle) * (state.height * 0.32), marginY, state.height - marginY)
          };
        }

        node.anchorX = bestCandidate.x;
        node.anchorY = bestCandidate.y;
        placedNodes.push(node);

        if (!node.x && !node.y) {
          node.x = node.anchorX;
          node.y = node.anchorY;
        }
      });
    };

    // Lightweight relevance: input text matches note keywords and can light up a topic cluster.
    const updateRelevance = () => {
      const queryTokens = tokenize(state.inputText);
      let strongest = null;
      const activeNodeSet = new Set();
      const activeKeywordSet = new Set();

      nodeData.forEach((node) => {
        if (!queryTokens.length) {
          node.relevance = 0;
          node.active = false;
          node.linkedWeight = 0;
          return;
        }

        const overlapTokens = queryTokens.filter((token) => node.tokens.includes(token));
        const overlap = overlapTokens.length;
        const score = Math.min(overlap / Math.max(queryTokens.length, 3), 1);
        node.relevance = score;
        node.active = score >= 0.12;
        node.linkedWeight = 0;

        if (node.active) {
          activeNodeSet.add(node.note.id);
          overlapTokens.forEach((token) => activeKeywordSet.add(token));
        }

        if (!strongest || score > strongest.relevance) {
          strongest = node;
        }
      });

      const pinnedEdges = allEdges.filter((edge) => edge.isPinned);
      const baseEdges = queryTokens.length
        ? allEdges
            .filter((edge) => {
              const queryOverlap = edge.overlap.some((token) => activeKeywordSet.has(token));
              return queryOverlap && (activeNodeSet.has(edge.source.note.id) || activeNodeSet.has(edge.target.note.id));
            })
            .sort((left, right) => right.score - left.score)
            .slice(0, 10)
        : pinnedEdges.slice(0, 8);

      const visibleEdges = [];
      const visibleNodeIds = new Set();

      baseEdges.forEach((edge) => {
        visibleEdges.push(edge);
        visibleNodeIds.add(edge.source.note.id);
        visibleNodeIds.add(edge.target.note.id);
        edge.source.linkedWeight = Math.max(edge.source.linkedWeight, edge.score);
        edge.target.linkedWeight = Math.max(edge.target.linkedWeight, edge.score);
      });

      state.visibleEdges = visibleEdges;
      state.centerLinks = queryTokens.length
        ? nodeData
            .filter((node) => node.relevance > 0.1)
            .sort((left, right) => right.relevance - left.relevance)
            .slice(0, 5)
        : [];

      nodeData.forEach((node) => {
        node.active = node.active || visibleNodeIds.has(node.note.id);
      });

      hint.textContent =
        queryTokens.length && strongest && strongest.relevance > 0
          ? `最接近：${excerptText(strongest.note.content, 24)}`
          : "带有共同关键词的旧纸片，会自己连成隐约的线";
    };

    // Only show relationship lines that come from shared keywords, not random geometry.
    const drawLinks = () => {
      svg.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
      svg.innerHTML = "";

      state.visibleEdges.forEach((edge) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const strength = Math.min(0.32, 0.08 + (edge.score * 0.32));
        line.setAttribute("x1", String(edge.source.x));
        line.setAttribute("y1", String(edge.source.y));
        line.setAttribute("x2", String(edge.target.x));
        line.setAttribute("y2", String(edge.target.y));
        line.setAttribute("stroke", `rgba(214, 202, 188, ${strength.toFixed(3)})`);
        line.setAttribute("stroke-width", edge.score > 0.32 ? "1.4" : "1");
        svg.append(line);
      });

      state.centerLinks.forEach((node) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const strength = 0.08 + (node.relevance * 0.22);
        line.setAttribute("x1", String(state.centerX));
        line.setAttribute("y1", String(state.centerY));
        line.setAttribute("x2", String(node.x));
        line.setAttribute("y2", String(node.y));
        line.setAttribute("stroke", `rgba(232, 221, 208, ${strength.toFixed(3)})`);
        line.setAttribute("stroke-width", "1.1");
        svg.append(line);
      });
    };

    const resolveCollisions = () => {
      for (let sourceIndex = 0; sourceIndex < nodeData.length; sourceIndex += 1) {
        for (let targetIndex = sourceIndex + 1; targetIndex < nodeData.length; targetIndex += 1) {
          const source = nodeData[sourceIndex];
          const target = nodeData[targetIndex];
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.hypot(dx, dy) || 1;
          const desired = (Math.max(source.width, source.height) + Math.max(target.width, target.height)) * 0.34;

          if (distance < desired) {
            const push = (desired - distance) * 0.018;
            const unitX = dx / distance;
            const unitY = dy / distance;
            source.vx -= unitX * push;
            source.vy -= unitY * push;
            target.vx += unitX * push;
            target.vy += unitY * push;
          }
        }
      }
    };

    // Global drift model: each note slowly roams within its own region, while relationships affect clarity.
    const tick = () => {
      state.now = performance.now();
      resolveCollisions();

      nodeData.forEach((node) => {
        const driftX =
          Math.sin(state.now * node.driftSpeedX + node.driftPhaseX) * node.driftAmpX +
          Math.cos(state.now * node.driftSpeedX * 0.61 + node.driftPhaseY) * (node.driftAmpX * 0.35);
        const driftY =
          Math.cos(state.now * node.driftSpeedY + node.driftPhaseY) * node.driftAmpY +
          Math.sin(state.now * node.driftSpeedY * 0.58 + node.driftPhaseX) * (node.driftAmpY * 0.4);

        let targetX = node.anchorX + driftX;
        let targetY = node.anchorY + driftY;

        if (node.relevance > 0) {
          const dxCenter = state.centerX - node.anchorX;
          const dyCenter = state.centerY - node.anchorY;
          const distanceToCenter = Math.hypot(dxCenter, dyCenter) || 1;
          const pullDistance = Math.min(56, distanceToCenter * node.relevance * 0.16);
          targetX += (dxCenter / distanceToCenter) * pullDistance;
          targetY += (dyCenter / distanceToCenter) * pullDistance;
        }

        node.vx += (targetX - node.x) * 0.014;
        node.vy += (targetY - node.y) * 0.014;
        node.vx *= 0.94;
        node.vy *= 0.94;
        node.x += node.vx;
        node.y += node.vy;

        const minX = node.width / 2;
        const maxX = state.width - node.width / 2;
        const minY = node.height / 2;
        const maxY = state.height - node.height / 2;

        node.x = clamp(node.x, minX, maxX);
        node.y = clamp(node.y, minY, maxY);

        const emphasis = Math.max(node.relevance, node.linkedWeight);
        const opacity = 0.42 + (emphasis * 0.42) + (node.hovered ? 0.14 : 0);
        const scale = 1 + (emphasis * 0.055) + (node.hovered ? 0.035 : 0);
        const rotate = Math.sin(state.now * 0.00008 + node.driftPhaseX) * 1.6;

        node.element.style.setProperty("--node-x", `${node.x - node.width / 2}px`);
        node.element.style.setProperty("--node-y", `${node.y - node.height / 2}px`);
        node.element.style.setProperty("--node-scale", scale.toFixed(3));
        node.element.style.setProperty("--node-opacity", opacity.toFixed(3));
        node.element.style.setProperty("--node-rotate", `${rotate.toFixed(2)}deg`);
        node.element.classList.toggle("is-related", node.active);
        node.element.classList.toggle("is-linked", node.linkedWeight > 0.14);
        node.element.classList.toggle("is-hovered", node.hovered);
      });

      if (state.now - state.lastLinkDraw > 32) {
        drawLinks();
        state.lastLinkDraw = state.now;
      }

      state.frameHandle = window.requestAnimationFrame(tick);
    };

    nodeData.forEach((node) => {
      node.element.addEventListener("mouseenter", () => {
        node.hovered = true;
      });

      node.element.addEventListener("mouseleave", () => {
        node.hovered = false;
      });
    });

    input.addEventListener("input", () => {
      state.inputText = input.value.trim();
      updateRelevance();
    });

    const refresh = () => {
      placeNodes();
      updateRelevance();
      drawLinks();
    };

    const activate = () => {
      refresh();
      if (!state.frameHandle) {
        state.frameHandle = window.requestAnimationFrame(tick);
      }
    };

    const deactivate = () => {
      if (state.frameHandle) {
        window.cancelAnimationFrame(state.frameHandle);
        state.frameHandle = 0;
      }
    };

    window.addEventListener("resize", refresh);

    return {
      activate,
      deactivate,
      refresh
    };
  };

  const sortedNotes = notes.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const renderTimeline = () => {
    if (!timelineRoot) {
      return;
    }

    if (!sortedNotes.length) {
      timelineRoot.innerHTML = '<p class="notes-empty">还没有内容，之后可以从数据文件里继续追加。</p>';
      return;
    }

    const groups = sortedNotes.reduce((accumulator, note) => {
      const monthKey = formatMonthLabel(note.datetime);
      if (!accumulator[monthKey]) {
        accumulator[monthKey] = [];
      }
      accumulator[monthKey].push(note);
      return accumulator;
    }, {});

    timelineRoot.innerHTML = Object.entries(groups)
      .map(([month, items]) => `
        <section class="notes-group">
          <header class="notes-group-header">
            <h2>${month}</h2>
            <span>${items.length} 条</span>
          </header>
          <div class="notes-group-list">
            ${(() => {
              const monthOrderMap = new Map(
                [...items]
                  .sort((left, right) => new Date(left.datetime) - new Date(right.datetime))
                  .map((note, index) => [note.id, index + 1])
              );

              return items
                .map((note) => `
                <article class="timeline-entry" data-note-id="${note.id}">
                  <aside class="timeline-side" aria-label="时间信息">
                    <div class="timeline-stem" aria-hidden="true">
                      <span class="timeline-dot"></span>
                    </div>
                    <div class="timeline-date">
                      <p class="timeline-year">${formatYearLabel(note.datetime)}</p>
                      <p class="timeline-day">${formatMonthDayLabel(note.datetime)}</p>
                      <p class="timeline-index">#${monthOrderMap.get(note.id)}</p>
                    </div>
                  </aside>
                  <div class="timeline-content">
                    <section class="note-card">
                      <div class="note-card-body">
                        <div class="note-card-content">
                          ${splitNoteParagraphs(note.content)
                            .map((paragraph) => `<p class="note-card-paragraph">${escapeHtml(paragraph)}</p>`)
                            .join("")}
                        </div>
                      </div>
                    </section>
                  </div>
                </article>
              `)
                .join("");
            })()}
          </div>
        </section>
      `)
      .join("");
  };

  const renderGraph = () => {
    if (!graphRoot) {
      return;
    }

    if (!sortedNotes.length) {
      graphRoot.innerHTML = '<p class="notes-empty">关系图视图暂无内容。</p>';
      return;
    }

    graphRoot.innerHTML = `
      <div class="analysis-frame">
        <svg class="analysis-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="analysis-stage">
          <div class="analysis-nodes" aria-hidden="false"></div>
          <section class="analysis-center-card">
            <p class="analysis-center-eyebrow">Analysis View</p>
            <h3 class="analysis-center-title">此刻</h3>
            <textarea
              class="analysis-input"
              rows="6"
              placeholder="输入一段正在想的句子、关键词，周围的旧纸片会慢慢向它靠近。"
            >想把散落的碎碎念重新看成一张有呼吸的记忆地图。</textarea>
            <p class="analysis-hint">最接近的旧纸片：<strong>输入一点关键词，旧纸片会慢慢靠近</strong></p>
          </section>
        </div>
      </div>
    `;

    graphController = createGraphView();
    graphInitialized = true;
  };

  const setActiveView = (viewName) => {
    toggleButtons.forEach((button) => {
      const isActive = button.dataset.viewTarget === viewName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    panels.forEach((panel) => {
      const isActivePanel = panel.dataset.viewPanel === viewName;
      panel.classList.toggle("is-hidden", !isActivePanel);
      panel.classList.toggle("is-active-panel", isActivePanel);
    });

    if (viewName === "graph" && !graphInitialized) {
      renderGraph();
    }

    if (graphController) {
      if (viewName === "graph") {
        graphController.activate();
      } else {
        graphController.deactivate();
      }
    }
  };

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget);
    });
  });

  renderTimeline();
  setActiveView("timeline");
}
