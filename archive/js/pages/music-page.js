import { listPublishedMusicItems } from "../services/music-service.js";
import { escapeHtml, formatDate } from "../lib/utils.js";

const musicRoot = document.querySelector("#musicList");
const publishedCountNode = document.querySelector("#musicPublishedCount");
const recentListNode = document.querySelector("#musicRecentList");

function renderMusicItems(items) {
  if (!musicRoot) {
    return;
  }

  if (!items.length) {
    musicRoot.innerHTML = '<p class="writing-empty">还没有已发布的音乐条目。</p>';
    return;
  }

  musicRoot.innerHTML = items
    .map((item) => `
      <article class="paper content-card music-card">
        <div class="music-card-cover">
          ${
            item.cover_image_url
              ? `<img src="${escapeHtml(item.cover_image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`
              : '<div class="music-card-cover-placeholder"><span>Music</span></div>'
          }
        </div>
        <div class="music-card-body">
          <div class="music-card-head">
            <div>
              <p class="section-label">Music Item</p>
              <h2>${escapeHtml(item.title)}</h2>
            </div>
            <span class="music-card-date">${escapeHtml(formatDate(item.publish_date))}</span>
          </div>
          <p class="music-card-artist">${escapeHtml(item.artist || "未署名")}</p>
          <p class="music-card-description">${escapeHtml(item.description || "暂无说明。")}</p>
          <audio controls preload="none" src="${escapeHtml(item.audio_url)}"></audio>
          ${
            item.lyrics_or_notes
              ? `<details class="music-card-notes"><summary>歌词 / 备注</summary><p>${escapeHtml(item.lyrics_or_notes).replaceAll("\n", "<br>")}</p></details>`
              : ""
          }
        </div>
      </article>
    `)
    .join("");
}

function renderSidebarMeta(items) {
  if (publishedCountNode) {
    publishedCountNode.textContent = String(items.length);
  }

  if (!recentListNode) {
    return;
  }

  recentListNode.innerHTML = items.length
    ? items
        .slice(0, 4)
        .map((item) => `
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(formatDate(item.publish_date))}</small>
          </span>
        `)
        .join("")
    : `
      <span>
        <strong>暂无条目</strong>
        <small>发布后会自动出现在这里</small>
      </span>
    `;
}

async function initMusicPage() {
  try {
    const items = await listPublishedMusicItems();
    renderMusicItems(items);
    renderSidebarMeta(items);
  } catch (error) {
    if (musicRoot) {
      musicRoot.innerHTML = '<p class="writing-empty">音乐内容暂时无法读取，请先完成 Supabase 配置。</p>';
    }
    renderSidebarMeta([]);
  }
}

initMusicPage();
