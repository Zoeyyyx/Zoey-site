import { listPublishedNotes } from "../services/notes-service.js";
import { ensureArray, escapeHtml, formatDateTime, formatMonthLabel } from "../lib/utils.js";

const timelineRoot = document.querySelector("#notes-timeline");
const graphRoot = document.querySelector("#notes-graph");
const toggleButtons = document.querySelectorAll(".view-toggle");
const panels = document.querySelectorAll("[data-view-panel]");
const publishedCountNode = document.querySelector("#notesPublishedCount");
const tagPreviewNode = document.querySelector("#notesTagPreview");

function renderEmptyState(root, message) {
  if (root) {
    root.innerHTML = `<p class="notes-empty">${escapeHtml(message)}</p>`;
  }
}

function renderTimeline(notes) {
  if (!timelineRoot) {
    return;
  }

  if (!notes.length) {
    renderEmptyState(timelineRoot, "还没有已发布的碎碎念。");
    return;
  }

  const groups = notes.reduce((accumulator, note) => {
    const month = formatMonthLabel(note.publish_date || note.created_at);
    if (!accumulator.has(month)) {
      accumulator.set(month, []);
    }

    accumulator.get(month).push(note);
    return accumulator;
  }, new Map());

  timelineRoot.innerHTML = [...groups.entries()]
    .map(([month, monthNotes]) => `
      <section class="notes-group">
        <header class="notes-group-header">
          <h2>${escapeHtml(month)}</h2>
          <span>${monthNotes.length} 条</span>
        </header>
        <div class="notes-group-list">
          ${monthNotes
            .map((note, index) => {
              const tags = ensureArray(note.tags)
                .map((tag) => `<span class="visual-tag">${escapeHtml(tag)}</span>`)
                .join("");

              return `
                <article class="timeline-entry">
                  <div class="timeline-side">
                    <div class="timeline-stem">
                      <span class="timeline-dot" aria-hidden="true"></span>
                    </div>
                    <div class="timeline-date">
                      <p class="timeline-year">${escapeHtml(formatDateTime(note.publish_date || note.created_at).slice(0, 10))}</p>
                      <p class="timeline-index">No. ${String(index + 1).padStart(2, "0")}</p>
                    </div>
                  </div>
                  <div class="timeline-content">
                    <article class="note-card">
                      ${note.title ? `<h3 class="note-card-title">${escapeHtml(note.title)}</h3>` : ""}
                      <p class="note-card-meta">${escapeHtml(formatDateTime(note.publish_date || note.created_at))}${note.mood ? ` · ${escapeHtml(note.mood)}` : ""}</p>
                      ${String(note.content || "")
                        .split(/\n{2,}/)
                        .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
                        .join("")}
                      ${tags ? `<div class="visual-tags note-tags">${tags}</div>` : ""}
                    </article>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderGraphPanel(notes) {
  if (!graphRoot) {
    return;
  }

  const tagMap = new Map();
  notes.forEach((note) => {
    ensureArray(note.tags).forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  const tagCloud = [...tagMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([tag, count]) => `<span class="visual-tag">${escapeHtml(tag)} · ${count}</span>`)
    .join("");

  graphRoot.innerHTML = `
    <div class="notes-graph-placeholder">
      <div>
        <p class="section-label">Graph Interface Reserved</p>
        <h3>关系图入口已预留</h3>
        <p>这一层先作为结构接口，后续可以接入真正的标签关联、关键词聚类或笔记关系图。</p>
      </div>
      <div class="notes-graph-meta">
        <article class="paper content-card">
          <p class="section-label">Published</p>
          <h2>${notes.length}</h2>
          <p>当前已发布碎碎念数量。</p>
        </article>
        <article class="paper content-card">
          <p class="section-label">Tags</p>
          <h2>${tagMap.size}</h2>
          <p>当前已使用标签数量。</p>
        </article>
      </div>
      <div class="visual-tags notes-graph-tags">
        ${tagCloud || '<span class="visual-tag">暂时还没有标签</span>'}
      </div>
    </div>
  `;
}

function renderSidebarMeta(notes) {
  if (publishedCountNode) {
    publishedCountNode.textContent = String(notes.length);
  }

  if (!tagPreviewNode) {
    return;
  }

  const tagMap = new Map();
  notes.forEach((note) => {
    ensureArray(note.tags).forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  const topTags = [...tagMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  tagPreviewNode.innerHTML = topTags.length
    ? topTags.map(([tag]) => `<span class="subpage-side-chip">${escapeHtml(tag)}</span>`).join("")
    : '<span class="subpage-side-chip">暂无标签</span>';
}

function initViewSwitch() {
  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.viewTarget;

      toggleButtons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });

      panels.forEach((panel) => {
        const isTarget = panel.getAttribute("data-view-panel") === target;
        panel.classList.toggle("is-hidden", !isTarget);
        panel.classList.toggle("is-active-panel", isTarget);
      });
    });
  });
}

async function initNotesPage() {
  initViewSwitch();

  try {
    const notes = await listPublishedNotes();
    renderTimeline(notes);
    renderGraphPanel(notes);
    renderSidebarMeta(notes);
  } catch (error) {
    renderEmptyState(timelineRoot, "碎碎念暂时无法读取，请先完成 Supabase 配置。");
    renderEmptyState(graphRoot, "关系图接口需要在数据连通后继续使用。");
    renderSidebarMeta([]);
  }
}

initNotesPage();
