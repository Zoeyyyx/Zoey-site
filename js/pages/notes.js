import { listPublishedNotes } from "../services/notes-service.js";
import { ensureArray, escapeHtml, plainTextExcerpt, stripHtml } from "../lib/utils.js";

const timelineRoot = document.querySelector("#notesTimelineView");
const cardsRoot = document.querySelector("#notesCardsView");
const graphRoot = document.querySelector("#notesGraphView");
const monthArchiveRoot = document.querySelector("#notesMonthArchive");
const tagFiltersRoot = document.querySelector("#notesTagFilters");
const graphControlsRoot = document.querySelector("#notesGraphControls");
const detailPanel = document.querySelector("#notesDetailPanel");
const toggleButtons = document.querySelectorAll(".view-toggle");
const panels = document.querySelectorAll("[data-view-panel]");
let noteModalRoot;
let lastModalTrigger = null;

const TEMP_TITLE_LENGTH = 18;

const VIEW_LABELS = {
  timeline: "时间线",
  cards: "卡片",
  graph: "关系"
};

const TAG_TONES = {
  随笔: "essay",
  感受: "feeling",
  想法: "idea",
  对话: "dialogue",
  生活: "life",
  阅读: "reading",
  记录: "record"
};

const GRAPH_FILTERS = [
  { id: "all", label: "所有笔记" },
  { id: "month", label: "本月新增" },
  { id: "untagged", label: "未归档" },
  { id: "tagged", label: "有标签" },
  { id: "linked", label: "有连接" }
];

const TOPIC_RULES = [
  { id: "topic-start", label: "关于开始", keywords: ["开始", "第一次", "起点", "重新"] },
  { id: "topic-slow", label: "慢一点也没关系", keywords: ["慢", "不要急", "缓慢", "耐心"] },
  { id: "topic-light", label: "雨后总有光", keywords: ["雨", "光", "太阳", "明媚"] },
  { id: "topic-small-joy", label: "小小的幸福", keywords: ["开心", "幸福", "快乐", "满足"] },
  { id: "topic-night", label: "夜晚的对话", keywords: ["夜", "聊天", "交流", "对话"] },
  { id: "topic-reminder", label: "今天的提醒", keywords: ["今天", "提醒", "意识", "记得"] },
  { id: "topic-spring", label: "春天在做的事", keywords: ["春天", "天气", "日子", "生活"] },
  { id: "topic-growth", label: "成长", keywords: ["成长", "进步", "成熟", "接受"] },
  { id: "topic-hope", label: "希望", keywords: ["希望", "相信", "意义", "人生"] }
];

const state = {
  activeView: "timeline",
  notes: [],
  selectedMonth: "",
  selectedTag: "",
  searchQuery: "",
  selectedNoteId: "",
  selectedNodeId: "",
  graphMode: "relation",
  graphFilter: "all",
  graphZoom: 1
};

function parseNoteDate(note) {
  const rawValue = note.publish_date || note.datetime || note.date || note.created_at;
  const date = rawValue ? new Date(rawValue) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatDateParts(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());

  return {
    date: `${year}/${month}/${day}`,
    dayLabel: `${month} / ${day}`,
    monthKey: `${year}-${month}`,
    monthLabel: `${year} / ${month}`,
    time: `${hour}:${minute}`,
    datetime: `${year}/${month}/${day} ${hour}:${minute}`
  };
}

function inferTag(note) {
  const content = `${note.title || ""} ${note.content || ""}`;

  if (/书|阅读|读|文章|文字|解释|比喻/.test(content)) {
    return "阅读";
  }

  if (/说|聊|交流|对话|他人|关系|回应|问/.test(content)) {
    return "对话";
  }

  if (/开心|痛苦|焦虑|希望|情绪|孤独|担忧|放松|快乐/.test(content)) {
    return "感受";
  }

  if (/今天|日子|同学|天气|春天|雨|生活/.test(content)) {
    return "生活";
  }

  if (/意识|认为|也许|事实|判断|追求|问题|真实/.test(content)) {
    return "想法";
  }

  return "记录";
}

function inferLength(content) {
  const length = stripHtml(content).length;

  if (length <= 56) {
    return "short";
  }

  if (length <= 170) {
    return "medium";
  }

  return "long";
}

function buildTemporaryTitle(content) {
  return plainTextExcerpt(content, TEMP_TITLE_LENGTH) || "未命名碎片";
}

function buildTitle(note, content) {
  return note.title || buildTemporaryTitle(content);
}

function getTagTone(tag) {
  if (TAG_TONES[tag]) {
    return TAG_TONES[tag];
  }

  const tones = Object.values(TAG_TONES);
  const sum = Array.from(tag).reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function normalizeNotes(rawNotes) {
  const normalized = rawNotes
    .map((note, index) => {
      const date = parseNoteDate(note);
      const parts = formatDateParts(date);
      const rawTags = ensureArray(note.tags).filter(Boolean);
      const tags = rawTags.length ? rawTags : [note.tag || inferTag(note)];
      const content = String(note.content || "");
      const excerpt = plainTextExcerpt(content, 136);
      const hasOriginalTitle = Boolean(String(note.title || "").trim());
      const title = buildTitle(note, content);

      return {
        id: note.id || `note-${date.getTime()}-${index}`,
        title,
        hasOriginalTitle,
        date: parts.date,
        time: parts.time,
        datetime: parts.datetime,
        monthKey: parts.monthKey,
        monthLabel: parts.monthLabel,
        dayLabel: parts.dayLabel,
        excerpt,
        content,
        tag: tags[0],
        tags,
        rawTags,
        mood: note.mood || "neutral",
        length: note.length || note.raw_source?.length || inferLength(content),
        timestamp: date.getTime(),
        orderIndex: Number.isFinite(Number(note.order_index)) ? Number(note.order_index) : index,
        relatedRaw: ensureArray(note.related || note.relatedTo),
        sourceType: note.source_type || "manual",
        externalId: note.external_id || "",
        sourceUrl: note.source_url || "",
        rawSource: note.raw_source || null,
        sourceKind: note.raw_source?.source_kind || ""
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp || left.orderIndex - right.orderIndex);

  const ids = new Set(normalized.map((note) => note.id));

  return normalized.map((note) => {
    const directRelated = note.relatedRaw.filter((id) => ids.has(id));
    const tagRelated = normalized
      .filter((candidate) => candidate.id !== note.id && candidate.tags.some((tag) => note.tags.includes(tag)))
      .slice(0, 4)
      .map((candidate) => candidate.id);

    return {
      ...note,
      related: [...new Set([...directRelated, ...tagRelated])]
    };
  });
}

function getMonthStats(notes = state.notes) {
  const stats = new Map();

  notes.forEach((note) => {
    if (!stats.has(note.monthKey)) {
      stats.set(note.monthKey, {
        key: note.monthKey,
        label: note.monthLabel,
        count: 0
      });
    }

    stats.get(note.monthKey).count += 1;
  });

  return [...stats.values()];
}

function getTagStats(notes = state.notes) {
  const stats = new Map();

  notes.forEach((note) => {
    note.tags.forEach((tag) => {
      stats.set(tag, (stats.get(tag) || 0) + 1);
    });
  });

  return [...stats.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .map(([tag, count]) => ({ tag, count }));
}

function getLatestMonth() {
  return state.notes[0]?.monthKey || "";
}

function noteMatchesTopic(note, topic) {
  const haystack = `${note.title} ${note.content}`;
  return topic.keywords.some((keyword) => haystack.includes(keyword));
}

function getFilteredNotes(view = state.activeView) {
  let notes = [...state.notes];

  if (state.selectedMonth) {
    notes = notes.filter((note) => note.monthKey === state.selectedMonth);
  }

  if (state.selectedTag) {
    notes = notes.filter((note) => note.tags.includes(state.selectedTag));
  }

  const keyword = state.searchQuery.trim().toLowerCase();
  if (keyword) {
    notes = notes.filter((note) => {
      const haystack = `${note.title} ${note.content} ${note.datetime} ${note.tags.join(" ")}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }

  if (view === "graph") {
    if (state.graphFilter === "month") {
      const latestMonth = getLatestMonth();
      notes = notes.filter((note) => note.monthKey === latestMonth);
    }

    if (state.graphFilter === "untagged") {
      notes = notes.filter((note) => !note.rawTags.length);
    }

    if (state.graphFilter === "tagged") {
      notes = notes.filter((note) => note.rawTags.length > 0);
    }

    if (state.graphFilter === "linked") {
      notes = notes.filter((note) => note.related.length > 0);
    }
  }

  return notes;
}

function renderTag(tag) {
  return `<span class="notes-tag notes-tag--${getTagTone(tag)}">${escapeHtml(tag)}</span>`;
}

function renderTags(tags) {
  return tags.map((tag) => renderTag(tag)).join("");
}

function renderSourceBadge(note) {
  if (note.sourceType !== "x" && note.sourceType !== "x_manual") {
    return "";
  }

  const label =
    note.sourceType === "x_manual"
      ? "from X"
      : note.sourceKind === "quote"
        ? "from X · Quote"
        : note.sourceKind === "reply"
          ? "from X · Reply"
          : "from X";
  return `<span class="notes-source-badge">${escapeHtml(label)}</span>`;
}

function renderEmptyState(message) {
  return `<p class="notes-empty">${escapeHtml(message)}</p>`;
}

function renderNoteParagraphs(note) {
  return String(note?.content || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function findNoteById(noteId) {
  return state.notes.find((note) => note.id === noteId) || null;
}

function ensureNoteModal() {
  if (noteModalRoot) {
    return noteModalRoot;
  }

  noteModalRoot = document.createElement("div");
  noteModalRoot.className = "notes-modal";
  noteModalRoot.setAttribute("hidden", "");
  noteModalRoot.innerHTML = `
    <div class="notes-modal__backdrop" data-notes-modal-close></div>
    <section class="notes-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="notesModalTitle" tabindex="-1">
      <button class="notes-modal__close" type="button" data-notes-modal-close aria-label="关闭全文">×</button>
      <div class="notes-modal__content" id="notesModalContent"></div>
    </section>
  `;
  document.body.append(noteModalRoot);

  noteModalRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-notes-modal-close]")) {
      closeNoteModal();
    }
  });

  noteModalRoot.addEventListener("wheel", (event) => {
    if (event.target.closest(".notes-modal__body")) {
      return;
    }

    event.preventDefault();
  }, { passive: false });

  return noteModalRoot;
}

function openNoteModal(noteId) {
  const note = findNoteById(noteId);

  if (!note) {
    return;
  }

  const modal = ensureNoteModal();
  const content = modal.querySelector("#notesModalContent");
  const dialog = modal.querySelector(".notes-modal__dialog");
  lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  content.innerHTML = `
    <header class="notes-modal__header">
      <p class="section-label notes-modal__kicker">Full Note</p>
      <h2 class="notes-modal__title" id="notesModalTitle">${escapeHtml(note.title)}</h2>
      <div class="notes-modal__info">
        <p class="notes-modal__meta">
          <span>${escapeHtml(note.datetime)}</span>
          <span class="notes-modal__meta-extra">${renderSourceBadge(note)}</span>
        </p>
        <div class="notes-modal__tags">${renderTags(note.tags)}</div>
      </div>
    </header>
    <div class="notes-modal__body">
      ${renderNoteParagraphs(note)}
    </div>
  `;

  const body = content.querySelector(".notes-modal__body");
  let bounceTimer = 0;
  const isBodyScrollable = () => Boolean(body && body.scrollHeight - body.clientHeight > 4);
  const pulseBodyFeedback = (direction = "down") => {
    if (!body) {
      return;
    }

    modal.classList.remove("notes-modal--body-bounce-up", "notes-modal--body-bounce-down");
    window.clearTimeout(bounceTimer);
    window.requestAnimationFrame(() => {
      modal.classList.add(direction === "up" ? "notes-modal--body-bounce-up" : "notes-modal--body-bounce-down");
      bounceTimer = window.setTimeout(() => {
        modal.classList.remove("notes-modal--body-bounce-up", "notes-modal--body-bounce-down");
      }, 360);
    });
  };
  const collapseModalHeader = () => {
    if (!isBodyScrollable()) {
      return;
    }

    modal.classList.add("notes-modal--scrolled");
  };

  modal.classList.remove("notes-modal--scrolled", "notes-modal--can-collapse");
  if (body) {
    body.scrollTop = 0;
    body.onwheel = (event) => {
      const canScroll = isBodyScrollable();
      const atTop = body.scrollTop <= 0;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;

      if (canScroll && !((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom))) {
        return;
      }

      pulseBodyFeedback(event.deltaY < 0 ? "up" : "down");
      event.preventDefault();
    };
    body.addEventListener("scroll", () => {
      if (body.scrollTop > 0) {
        collapseModalHeader();
      }
    });
  }

  if (dialog) {
    dialog.onwheel = (event) => {
      const bodyIsEventTarget = event.target.closest(".notes-modal__body");

      if (bodyIsEventTarget) {
        return;
      }

      if (!modal.classList.contains("notes-modal--can-collapse")) {
        pulseBodyFeedback(event.deltaY < 0 ? "up" : "down");
        event.preventDefault();
        return;
      }

      if (event.deltaY <= 0 || modal.classList.contains("notes-modal--scrolled")) {
        return;
      }

      collapseModalHeader();
      event.preventDefault();
    };
  }

  modal.removeAttribute("hidden");
  document.body.classList.add("notes-modal-open");
  window.requestAnimationFrame(() => {
    const canScroll = isBodyScrollable();
    modal.classList.toggle("notes-modal--can-collapse", canScroll);
    modal.classList.toggle("notes-modal--no-scroll", !canScroll);
    dialog?.focus();
  });
}

function closeNoteModal() {
  if (!noteModalRoot) {
    return;
  }

  noteModalRoot.setAttribute("hidden", "");
  document.body.classList.remove("notes-modal-open");
  lastModalTrigger?.focus?.();
  lastModalTrigger = null;
}

function updateViewChrome() {
  document.body.dataset.notesView = state.activeView;

  toggleButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === state.activeView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.getAttribute("data-view-panel") === state.activeView;
    panel.classList.toggle("is-hidden", !isActive);
    panel.classList.toggle("is-active-panel", isActive);
  });
}

function renderSidebarControls() {
  if (monthArchiveRoot) {
    const months = getMonthStats();
    monthArchiveRoot.innerHTML = months.length
      ? months
          .map(
            (month) => `
              <button class="notes-month-button${state.selectedMonth === month.key ? " is-active" : ""}" type="button" data-month="${escapeHtml(month.key)}">
                <span>${escapeHtml(month.label)}</span>
                <small>${month.count}</small>
              </button>
            `
          )
          .join("")
      : '<span class="notes-rail-empty">暂无归档</span>';
  }

  if (tagFiltersRoot) {
    const tags = getTagStats().slice(0, 12);
    tagFiltersRoot.innerHTML = tags.length
      ? tags
          .map(
            ({ tag, count }) => `
              <button class="notes-tag-filter${state.selectedTag === tag ? " is-active" : ""}" type="button" data-tag="${escapeHtml(tag)}">
                ${renderTag(tag)}
                <small>${count}</small>
              </button>
            `
          )
          .join("")
      : '<span class="notes-rail-empty">暂无标签</span>';
  }

  if (graphControlsRoot) {
    graphControlsRoot.innerHTML = `
      <div class="notes-control-group" aria-label="关系图视图">
        ${[
          ["relation", "关系视图"],
          ["topic", "主题视图"]
        ]
          .map(
            ([mode, label]) => `
              <button class="notes-control-pill${state.graphMode === mode ? " is-active" : ""}" type="button" data-graph-mode="${mode}">
                ${label}
              </button>
            `
          )
          .join("")}
      </div>
      <div class="notes-control-group" aria-label="关系图筛选">
        ${GRAPH_FILTERS.map(
          (filter) => `
            <button class="notes-control-pill${state.graphFilter === filter.id ? " is-active" : ""}" type="button" data-graph-filter="${filter.id}">
              ${filter.label}
            </button>
          `
        ).join("")}
      </div>
    `;
  }
}

function renderTimeline() {
  if (!timelineRoot) {
    return;
  }

  if (!state.notes.length) {
    timelineRoot.innerHTML = renderEmptyState("还没有已发布的碎碎念。");
    return;
  }

  const notes = getFilteredNotes("timeline");

  if (!notes.length) {
    timelineRoot.innerHTML = renderEmptyState(state.searchQuery || state.selectedTag || state.selectedMonth ? "当前筛选下没有碎碎念。" : "还没有已发布的碎碎念。");
    return;
  }

  const groups = notes.reduce((accumulator, note) => {
    if (!accumulator.has(note.monthKey)) {
      accumulator.set(note.monthKey, {
        label: note.monthLabel,
        notes: []
      });
    }

    accumulator.get(note.monthKey).notes.push(note);
    return accumulator;
  }, new Map());

  timelineRoot.innerHTML = `
    <div class="notes-timeline">
      ${[...groups.entries()]
        .map(
          ([monthKey, group]) => `
            <section class="notes-month-group" data-month-section="${escapeHtml(monthKey)}">
              <header class="notes-month-heading">
                <h3>${escapeHtml(group.label)}</h3>
                <span>${group.notes.length} 条</span>
              </header>
              <div class="notes-timeline-list">
                ${group.notes
                  .map((note, index) => {
                    const isSelected = state.selectedNoteId === note.id;
                    const isExpanded = isSelected || (!state.selectedNoteId && index === 0 && monthKey === notes[0].monthKey);
                    const noteNumber = group.notes.length - index;

                    return `
                      <button
                        class="notes-timeline-entry${isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}"
                        type="button"
                        data-note-id="${escapeHtml(note.id)}"
                      >
                        <span class="notes-timeline-marker" aria-hidden="true"></span>
                        <span class="notes-timeline-date">
                          <strong>${escapeHtml(note.dayLabel)}</strong>
                          <small>NO. ${String(noteNumber).padStart(2, "0")}</small>
                        </span>
                        <span class="notes-timeline-copy">
                          <strong>${escapeHtml(note.title)}</strong>
                          <span>${escapeHtml(isExpanded ? plainTextExcerpt(note.content, 240) : note.excerpt)}</span>
                        </span>
                        <span class="notes-timeline-tags">${renderSourceBadge(note)}${renderTags([note.tag])}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCards() {
  if (!cardsRoot) {
    return;
  }

  const notes = getFilteredNotes("cards");

  cardsRoot.innerHTML = `
    ${
      notes.length
        ? `<div class="notes-card-masonry">
            ${notes
              .map(
                (note) => `
                  <button
                    class="notes-note-card notes-note-card--${escapeHtml(note.length)}${state.selectedNoteId === note.id ? " is-selected" : ""}"
                    type="button"
                    data-note-id="${escapeHtml(note.id)}"
                  >
                    <span class="notes-card-dot notes-card-dot--${getTagTone(note.tag)}" aria-hidden="true"></span>
                    <span class="notes-card-date">${escapeHtml(note.date)} · ${escapeHtml(note.time)} ${renderSourceBadge(note)}</span>
                    <strong>${escapeHtml(note.title)}</strong>
                    <span class="notes-card-excerpt">${escapeHtml(plainTextExcerpt(note.content, note.length === "long" ? 220 : note.length === "medium" ? 150 : 86))}</span>
                    ${note.length === "long" ? `<span class="notes-card-quote">${escapeHtml(plainTextExcerpt(note.content, 92))}</span>` : ""}
                    <span class="notes-card-tags">${renderTags([note.tag])}</span>
                  </button>
                `
              )
              .join("")}
          </div>`
        : renderEmptyState("当前筛选下没有碎碎念。")
    }
  `;
}

function buildTopicStats(notes) {
  return TOPIC_RULES.map((topic) => ({
    ...topic,
    notes: notes.filter((note) => noteMatchesTopic(note, topic))
  }))
    .filter((topic) => topic.notes.length)
    .sort((left, right) => right.notes.length - left.notes.length);
}

function makeEdgeId(from, to) {
  return [from, to].sort().join("__");
}

function buildGraph(notes) {
  if (!notes.length) {
    return { nodes: [], edges: [] };
  }

  const selectedNote = notes.find((note) => note.id === state.selectedNoteId) || notes[0];
  const noteNodes = [selectedNote, ...notes.filter((note) => note.id !== selectedNote.id)].slice(0, state.graphMode === "topic" ? 10 : 13);
  const tagStats = getTagStats(noteNodes).slice(0, state.graphMode === "topic" ? 5 : 8);
  const topics = buildTopicStats(noteNodes).slice(0, state.graphMode === "topic" ? 8 : 4);
  const nodes = [];
  const edgeMap = new Map();

  noteNodes.forEach((note, index) => {
    const isMain = note.id === selectedNote.id;
    const angle = noteNodes.length > 1 ? ((index - 1) / Math.max(1, noteNodes.length - 1)) * Math.PI * 2 - Math.PI / 2 : 0;
    const x = isMain ? 450 : 450 + Math.cos(angle) * 246;
    const y = isMain ? 282 : 282 + Math.sin(angle) * 174;

    nodes.push({
      id: note.id,
      type: "note",
      title: note.title,
      meta: note.date,
      x,
      y,
      radius: isMain ? 36 : note.related.length > 2 ? 28 : 24
    });
  });

  tagStats.forEach(({ tag, count }, index) => {
    const denominator = Math.max(1, tagStats.length - 1);
    const x = 120 + (660 / denominator) * index;
    const y = index % 2 === 0 ? 84 : 486;
    nodes.push({
      id: `tag:${tag}`,
      type: "tag",
      title: tag,
      meta: `${count} 条`,
      x,
      y,
      radius: 21 + Math.min(count, 4)
    });
  });

  topics.forEach((topic, index) => {
    const angle = (index / Math.max(1, topics.length)) * Math.PI * 2 + Math.PI / 7;
    nodes.push({
      id: topic.id,
      type: "topic",
      title: topic.label,
      meta: `${topic.notes.length} 条`,
      x: 450 + Math.cos(angle) * 332,
      y: 282 + Math.sin(angle) * 222,
      radius: 22 + Math.min(topic.notes.length, 4)
    });
  });

  function addEdge(from, to, strength = "medium") {
    if (!from || !to || from === to) {
      return;
    }

    const id = makeEdgeId(from, to);
    if (!edgeMap.has(id)) {
      edgeMap.set(id, { id, from, to, strength });
    }
  }

  const tagSet = new Set(tagStats.map(({ tag }) => tag));
  noteNodes.forEach((note) => {
    note.tags.forEach((tag) => {
      if (tagSet.has(tag)) {
        addEdge(note.id, `tag:${tag}`, note.id === selectedNote.id ? "strong" : "medium");
      }
    });

    topics.forEach((topic) => {
      if (noteMatchesTopic(note, topic)) {
        addEdge(note.id, topic.id, "weak");
      }
    });

    if (note.id !== selectedNote.id && note.tags.some((tag) => selectedNote.tags.includes(tag))) {
      addEdge(selectedNote.id, note.id, "strong");
    }
  });

  return { nodes, edges: [...edgeMap.values()] };
}

function getConnectedNodeIds(graph, nodeId) {
  if (!nodeId) {
    return new Set();
  }

  const connected = new Set([nodeId]);
  graph.edges.forEach((edge) => {
    if (edge.from === nodeId) {
      connected.add(edge.to);
    }

    if (edge.to === nodeId) {
      connected.add(edge.from);
    }
  });
  return connected;
}

function renderGraph() {
  if (!graphRoot) {
    return;
  }

  const notes = getFilteredNotes("graph");
  const graph = buildGraph(notes);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const connectedIds = getConnectedNodeIds(graph, state.selectedNodeId);

  graphRoot.innerHTML = `
    <header class="notes-view-head notes-view-head--graph">
      <div>
        <p class="section-label">Knowledge Graph</p>
        <h2>${state.graphMode === "topic" ? "主题视图" : "关系视图"}</h2>
      </div>
      <div class="notes-graph-zoom" aria-label="关系图缩放">
        <button type="button" data-graph-zoom="out">−</button>
        <button type="button" data-graph-zoom="reset">Reset</button>
        <button type="button" data-graph-zoom="in">＋</button>
      </div>
    </header>
    ${
      graph.nodes.length
        ? `<div class="notes-graph-canvas">
            <svg class="notes-graph-svg" viewBox="0 0 900 560" role="img" aria-label="碎碎念关系图" style="--graph-zoom: ${state.graphZoom}">
              <g class="notes-graph-stage">
                <g class="notes-graph-edges">
                  ${graph.edges
                    .map((edge) => {
                      const from = nodesById.get(edge.from);
                      const to = nodesById.get(edge.to);
                      const isActive = state.selectedNodeId && (edge.from === state.selectedNodeId || edge.to === state.selectedNodeId);
                      const isMuted = state.selectedNodeId && !isActive;

                      if (!from || !to) {
                        return "";
                      }

                      return `
                        <line
                          class="notes-graph-edge notes-graph-edge--${edge.strength}${isActive ? " is-active" : ""}${isMuted ? " is-muted" : ""}"
                          x1="${from.x}"
                          y1="${from.y}"
                          x2="${to.x}"
                          y2="${to.y}"
                        />
                      `;
                    })
                    .join("")}
                </g>
                <g class="notes-graph-nodes">
                  ${graph.nodes
                    .map((node) => {
                      const isSelected = state.selectedNodeId === node.id;
                      const isMuted = state.selectedNodeId && !connectedIds.has(node.id);

                      return `
                        <g
                          class="notes-graph-node notes-graph-node--${node.type}${isSelected ? " is-selected" : ""}${isMuted ? " is-muted" : ""}"
                          transform="translate(${node.x} ${node.y})"
                          data-node-id="${escapeHtml(node.id)}"
                          data-node-type="${escapeHtml(node.type)}"
                          tabindex="0"
                        >
                          <title>${escapeHtml(`${node.title} · ${node.meta}`)}</title>
                          <circle r="${node.radius}"></circle>
                          <text class="notes-graph-node-title" y="-3">${escapeHtml(plainTextExcerpt(node.title, 9))}</text>
                          <text class="notes-graph-node-meta" y="13">${escapeHtml(node.meta)}</text>
                        </g>
                      `;
                    })
                    .join("")}
                </g>
              </g>
            </svg>
          </div>`
        : renderEmptyState("当前筛选下没有可展示的关系。")
    }
  `;
}

function getFilterSummary() {
  const month = state.selectedMonth ? getMonthStats().find((item) => item.key === state.selectedMonth)?.label : "";
  const filters = [
    month,
    state.selectedTag,
    state.searchQuery.trim() ? `搜索：${state.searchQuery.trim()}` : "",
    state.graphFilter !== "all" && state.activeView === "graph" ? GRAPH_FILTERS.find((item) => item.id === state.graphFilter)?.label : ""
  ].filter(Boolean);
  return filters.length ? filters.join(" · ") : "全部内容";
}

function getNoteStats() {
  const latest = state.notes[0];
  const currentMonth = getLatestMonth();
  const totalWords = state.notes.reduce((total, note) => total + stripHtml(note.content).length, 0);

  return [
    ["总条数", state.notes.length],
    ["估算字数", totalWords >= 10000 ? `${Math.round(totalWords / 1000)}k` : totalWords]
  ];
}

function getRelatedNotes(note) {
  const relatedIds = new Set(note.related);
  return state.notes
    .filter((candidate) => relatedIds.has(candidate.id) || (candidate.id !== note.id && candidate.tags.some((tag) => note.tags.includes(tag))))
    .slice(0, 4);
}

function renderDetailPanel() {
  if (!detailPanel) {
    return;
  }

  const visibleNotes = getFilteredNotes(state.activeView);
  const tagStats = getTagStats();
  const noteStats = getNoteStats();

  detailPanel.innerHTML = `
    <div class="notes-control-panel">
      <header class="notes-control-panel__head">
        <p class="section-label">FILTER</p>
        <strong data-visible-count>${visibleNotes.length}</strong>
      </header>

      <label class="notes-search-field">
        <span>关键词搜索</span>
        <input type="search" value="${escapeHtml(state.searchQuery)}" placeholder="搜索内容、标题或日期" data-notes-search>
      </label>

      <section class="notes-category-box" aria-label="标签分类筛选">
        <div class="notes-category-box__head">
          <span>标签分类</span>
          <button type="button" data-detail-action="clear-filters">清空</button>
        </div>
        <div class="notes-category-list">
          <button class="notes-category-item${state.selectedTag ? "" : " is-active"}" type="button" data-detail-tag="">
            <span>全部</span>
            <small>${state.notes.length}</small>
          </button>
          ${tagStats
            .map(
              ({ tag, count }) => `
                <button class="notes-category-item${state.selectedTag === tag ? " is-active" : ""}" type="button" data-detail-tag="${escapeHtml(tag)}">
                  <span>${escapeHtml(tag)}</span>
                  <small>${count}</small>
                </button>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="notes-stats-box" aria-label="碎碎念数据概览">
        <div class="notes-stats-box__head">
          <span>数据概览</span>
          <small aria-hidden="true">↗</small>
        </div>
        <div class="notes-stats-list">
          ${noteStats
            .map(
              ([label, value]) => `
                <div class="notes-stat-row">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(String(value))}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </section>

    </div>
  `;
}

function renderAll() {
  updateViewChrome();
  renderSidebarControls();
  renderTimeline();
  renderCards();
  renderGraph();
  renderDetailPanel();
}

function findNoteElement(noteId) {
  return Array.from(document.querySelectorAll("[data-note-id]")).find((element) => element.dataset.noteId === noteId);
}

function scrollToSelectedNote() {
  window.requestAnimationFrame(() => {
    const element = findNoteElement(state.selectedNoteId);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function selectNote(noteId, shouldScroll = false) {
  if (!state.notes.some((note) => note.id === noteId)) {
    return;
  }

  state.selectedNoteId = noteId;
  state.selectedNodeId = noteId;
  renderAll();

  if (shouldScroll) {
    scrollToSelectedNote();
  }
}

function setActiveView(view) {
  if (!VIEW_LABELS[view]) {
    return;
  }

  state.activeView = view;
  renderAll();
}

function handleMonthClick(monthKey) {
  state.selectedMonth = state.selectedMonth === monthKey ? "" : monthKey;

  if (state.activeView === "timeline") {
    renderAll();
    window.requestAnimationFrame(() => {
      const section = document.querySelector(`[data-month-section="${monthKey}"]`);
      section?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return;
  }

  renderAll();
}

function moveSelection(direction) {
  const notes = getFilteredNotes(state.activeView);

  if (!notes.length) {
    return;
  }

  const currentIndex = notes.findIndex((note) => note.id === state.selectedNoteId);
  const nextIndex = currentIndex < 0 ? 0 : Math.min(notes.length - 1, Math.max(0, currentIndex + direction));
  selectNote(notes[nextIndex].id, true);
}

function initEvents() {
  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget);
    });
  });

  monthArchiveRoot?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-month]");
    const action = event.target.closest("[data-filter-action]");

    if (button) {
      handleMonthClick(button.dataset.month);
    }

    if (action?.dataset.filterAction === "clear-month") {
      state.selectedMonth = "";
      renderAll();
    }
  });

  tagFiltersRoot?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    const action = event.target.closest("[data-filter-action]");

    if (button) {
      state.selectedTag = state.selectedTag === button.dataset.tag ? "" : button.dataset.tag;
      renderAll();
    }

    if (action?.dataset.filterAction === "clear-tag") {
      state.selectedTag = "";
      renderAll();
    }
  });

  document.querySelector(".subpage-rail-card")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-filter-action]");

    if (!action) {
      return;
    }

    if (action.dataset.filterAction === "clear-month") {
      state.selectedMonth = "";
    }

    if (action.dataset.filterAction === "clear-tag") {
      state.selectedTag = "";
    }

    if (action.dataset.filterAction === "reset-graph") {
      state.selectedMonth = "";
      state.selectedTag = "";
      state.graphFilter = "all";
      state.graphMode = "relation";
      state.graphZoom = 1;
      state.selectedNodeId = "";
      state.selectedNoteId = "";
    }

    renderAll();
  });

  graphControlsRoot?.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-graph-mode]");
    const filterButton = event.target.closest("[data-graph-filter]");

    if (modeButton) {
      state.graphMode = modeButton.dataset.graphMode;
      renderAll();
    }

    if (filterButton) {
      state.graphFilter = filterButton.dataset.graphFilter;
      renderAll();
    }
  });

  timelineRoot?.addEventListener("click", (event) => {
    const entry = event.target.closest("[data-note-id]");
    if (entry) {
      selectNote(entry.dataset.noteId);
      openNoteModal(entry.dataset.noteId);
    }
  });

  cardsRoot?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-note-id]");
    if (card) {
      selectNote(card.dataset.noteId);
      openNoteModal(card.dataset.noteId);
    }
  });

  graphRoot?.addEventListener("click", (event) => {
    const zoomButton = event.target.closest("[data-graph-zoom]");
    const node = event.target.closest("[data-node-id]");

    if (zoomButton) {
      const action = zoomButton.dataset.graphZoom;
      state.graphZoom = action === "reset" ? 1 : Math.min(1.24, Math.max(0.78, state.graphZoom + (action === "in" ? 0.08 : -0.08)));
      renderGraph();
      return;
    }

    if (node) {
      state.selectedNodeId = node.dataset.nodeId;
      state.selectedNoteId = node.dataset.nodeType === "note" ? node.dataset.nodeId : "";
      renderAll();
    }
  });

  graphRoot?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    const node = event.target.closest("[data-node-id]");
    if (node) {
      state.selectedNodeId = node.dataset.nodeId;
      state.selectedNoteId = node.dataset.nodeType === "note" ? node.dataset.nodeId : "";
      renderAll();
    }
  });

  detailPanel?.addEventListener("click", (event) => {
    const tagButton = event.target.closest("[data-detail-tag]");
    const action = event.target.closest("[data-detail-action]");

    if (tagButton) {
      state.selectedTag = state.selectedTag === tagButton.dataset.detailTag ? "" : tagButton.dataset.detailTag;
      state.selectedNoteId = "";
      state.selectedNodeId = "";
      renderAll();
      return;
    }

    if (!action) {
      return;
    }

    if (action.dataset.detailAction === "clear-filters") {
      state.searchQuery = "";
      state.selectedTag = "";
      state.selectedMonth = "";
      state.graphFilter = "all";
      state.selectedNoteId = "";
      state.selectedNodeId = "";
      renderAll();
    }
  });

  detailPanel?.addEventListener("input", (event) => {
    const searchInput = event.target.closest("[data-notes-search]");

    if (!searchInput) {
      return;
    }

    state.searchQuery = searchInput.value;
    state.selectedNoteId = "";
    state.selectedNodeId = "";
    renderSidebarControls();
    renderTimeline();
    renderCards();
    renderGraph();
    const visibleCount = detailPanel.querySelector("[data-visible-count]");
    if (visibleCount) {
      visibleCount.textContent = String(getFilteredNotes(state.activeView).length);
    }
  });

  document.addEventListener("keydown", (event) => {
    const tagName = document.activeElement?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }

    if (event.key === "Enter" && state.selectedNoteId) {
      event.preventDefault();
      openNoteModal(state.selectedNoteId);
    }

    if (event.key === "Escape") {
      closeNoteModal();
    }
  });
}

async function initNotesPage() {
  initEvents();

  try {
    const notes = await listPublishedNotes();
    state.notes = normalizeNotes(notes);
    renderAll();
  } catch (error) {
    state.notes = [];
    renderAll();

    if (timelineRoot) {
      timelineRoot.innerHTML = renderEmptyState("碎碎念暂时无法读取，请先完成 Supabase 配置。");
    }
  }
}

initNotesPage();
