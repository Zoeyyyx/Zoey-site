import {
  getPublishedMusicReviewBySlug,
  listPublishedMusicItems,
  listPublishedMusicReviews
} from "../services/music-service.js";
import { ensureArray, escapeHtml, formatDate, getSearchParam, renderRichText } from "../lib/utils.js";

const musicRoot = document.querySelector("#musicList");
const publishedCountNode = document.querySelector("#musicPublishedCount");
const recentListNode = document.querySelector("#musicRecentList");

function renderTags(tags) {
  return ensureArray(tags)
    .map((tag) => `<span class="music-review-tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function buildNeteaseUrl(review) {
  if (review.netease_url) {
    return review.netease_url;
  }

  if (review.netease_song_id) {
    return `https://music.163.com/#/song?id=${encodeURIComponent(review.netease_song_id)}`;
  }

  if (review.netease_playlist_id) {
    return `https://music.163.com/#/playlist?id=${encodeURIComponent(review.netease_playlist_id)}`;
  }

  return "";
}

function buildExternalMusicUrl(review) {
  return buildNeteaseUrl(review) || review.external_music_url || "";
}

function buildPlayer(review) {
  const externalUrl = buildExternalMusicUrl(review);
  const isPlaylist = review.player_type === "netease_playlist";
  const playerId = isPlaylist ? review.netease_playlist_id : review.netease_song_id;

  if (review.is_playable && playerId && ["netease_song", "netease_playlist"].includes(review.player_type)) {
    const type = isPlaylist ? "0" : "2";
    const height = isPlaylist ? 110 : 86;
    const playerHeight = isPlaylist ? 90 : 66;
    const src = `https://music.163.com/outchain/player?type=${type}&id=${encodeURIComponent(playerId)}&auto=0&height=${playerHeight}`;

    return `
      <div class="music-player-shell">
        <iframe
          title="${escapeHtml(review.title)} 网易云音乐播放器"
          src="${escapeHtml(src)}"
          width="100%"
          height="${height}"
          frameborder="0"
          loading="lazy"
          allow="encrypted-media"
        ></iframe>
      </div>
    `;
  }

  if (review.is_playable && review.player_type === "preview" && review.preview_url) {
    return `
      <div class="music-player-shell">
        <audio controls preload="none" src="${escapeHtml(review.preview_url)}"></audio>
      </div>
    `;
  }

  if (!externalUrl) {
    return '<p class="music-player-fallback">暂未填写音乐平台链接。</p>';
  }

  const label = buildNeteaseUrl(review) ? "在网易云音乐打开" : "打开音乐平台";
  return `
    <a class="music-open-link" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>
  `;
}

function renderCover(imageUrl, title) {
  return imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy">`
    : '<div class="music-card-cover-placeholder"><span>Music</span></div>';
}

function renderReviewCard(review) {
  return `
    <article class="paper content-card music-review-card">
      <a class="music-review-cover" href="music.html?review=${encodeURIComponent(review.slug)}" aria-label="阅读 ${escapeHtml(review.title)}">
        ${renderCover(review.cover_url, review.title)}
      </a>
      <div class="music-review-card-body">
        <div class="music-card-head">
          <div>
            <p class="section-label">Music Review</p>
            <h2>${escapeHtml(review.song_name || review.title)}</h2>
          </div>
          <span class="music-card-date">${escapeHtml(formatDate(review.published_at))}</span>
        </div>
        <p class="music-card-artist">${escapeHtml(review.artist || "未署名")}${review.album ? ` · ${escapeHtml(review.album)}` : ""}</p>
        <p class="music-card-description">${escapeHtml(review.review_short || "还没有写入短评。")}</p>
        <div class="music-review-meta">
          ${review.rating != null ? `<span>评分 ${escapeHtml(review.rating)} / 10</span>` : ""}
          ${review.player_type === "preview" ? "<span>30 秒试听</span>" : review.is_playable ? "<span>网易云外链播放器</span>" : "<span>外链打开</span>"}
        </div>
        <div class="music-review-tags">${renderTags(review.tags)}</div>
        <div class="music-review-actions">
          <a class="music-open-link" href="music.html?review=${encodeURIComponent(review.slug)}">阅读全文</a>
          ${
            !review.is_playable && buildExternalMusicUrl(review)
              ? `<a class="music-open-link is-ghost" href="${escapeHtml(buildExternalMusicUrl(review))}" target="_blank" rel="noopener noreferrer">打开音乐平台</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderMusicItem(item) {
  return `
    <article class="paper content-card music-card">
      <div class="music-card-cover">
        ${renderCover(item.cover_image_url, item.title)}
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
        ${item.audio_url ? `<audio controls preload="none" src="${escapeHtml(item.audio_url)}"></audio>` : ""}
        ${
          item.lyrics_or_notes
            ? `<details class="music-card-notes"><summary>歌词 / 备注</summary><p>${escapeHtml(item.lyrics_or_notes).replaceAll("\n", "<br>")}</p></details>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderMusicPage({ items, reviews }) {
  if (!musicRoot) {
    return;
  }

  if (!items.length && !reviews.length) {
    musicRoot.innerHTML = '<p class="writing-empty">还没有已发布的音乐内容。</p>';
    return;
  }

  musicRoot.innerHTML = `
    <section class="music-section-block">
      <div class="music-section-head">
        <div>
          <p class="section-label">Reviews</p>
          <h2>乐评</h2>
        </div>
        <span>${reviews.length} 篇</span>
      </div>
      <div class="music-review-list">
        ${
          reviews.length
            ? reviews.map(renderReviewCard).join("")
            : '<p class="writing-empty">还没有发布的乐评。</p>'
        }
      </div>
    </section>

    <section class="music-section-block">
      <div class="music-section-head">
        <div>
          <p class="section-label">Archive</p>
          <h2>音乐条目</h2>
        </div>
        <span>${items.length} 条</span>
      </div>
      ${items.length ? items.map(renderMusicItem).join("") : '<p class="writing-empty">还没有已发布的音乐条目。</p>'}
    </section>
  `;
}

function renderReviewDetail(review) {
  if (!musicRoot) {
    return;
  }

  musicRoot.innerHTML = `
    <article class="paper content-card music-review-detail">
      <a class="music-back-link" href="music.html">← 返回 Music</a>
      <div class="music-review-hero">
        <div class="music-review-cover music-review-cover-large">
          ${renderCover(review.cover_url, review.title)}
        </div>
        <div class="music-review-hero-copy">
          <p class="section-label">Music Review</p>
          <h2>${escapeHtml(review.title)}</h2>
          <p class="music-card-artist">${escapeHtml(review.song_name || "未命名歌曲")} · ${escapeHtml(review.artist || "未署名")}</p>
          ${review.album ? `<p class="music-card-description">专辑：${escapeHtml(review.album)}</p>` : ""}
          <div class="music-review-meta">
            ${review.rating != null ? `<span>评分 ${escapeHtml(review.rating)} / 10</span>` : ""}
            ${review.mood ? `<span>${escapeHtml(review.mood)}</span>` : ""}
            ${review.published_at ? `<span>${escapeHtml(formatDate(review.published_at))}</span>` : ""}
          </div>
          <div class="music-review-tags">${renderTags(review.tags)}</div>
        </div>
      </div>

      ${buildPlayer(review)}

      <div class="article-body music-review-body">
        ${renderRichText(review.review_body || review.review_short || "还没有写入完整乐评。")}
      </div>

      ${
        buildExternalMusicUrl(review)
          ? `<a class="music-open-link is-inline" href="${escapeHtml(buildExternalMusicUrl(review))}" target="_blank" rel="noopener noreferrer">${buildNeteaseUrl(review) ? "在网易云音乐打开" : "打开音乐平台"}</a>`
          : ""
      }
    </article>
  `;
}

function renderSidebarMeta({ items, reviews }) {
  if (publishedCountNode) {
    publishedCountNode.textContent = String(items.length + reviews.length);
  }

  if (!recentListNode) {
    return;
  }

  const recent = [
    ...reviews.map((item) => ({ ...item, type: "乐评", date: item.published_at })),
    ...items.map((item) => ({ ...item, type: "音乐", date: item.publish_date }))
  ]
    .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime())
    .slice(0, 4);

  recentListNode.innerHTML = recent.length
    ? recent
        .map((item) => `
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.type)} · ${escapeHtml(formatDate(item.date))}</small>
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
  const reviewSlug = getSearchParam("review");

  try {
    if (reviewSlug) {
      const review = await getPublishedMusicReviewBySlug(reviewSlug);
      renderReviewDetail(review);
      renderSidebarMeta({ items: [], reviews: [review] });
      return;
    }

    const [items, reviews] = await Promise.all([listPublishedMusicItems(), listPublishedMusicReviews()]);
    renderMusicPage({ items, reviews });
    renderSidebarMeta({ items, reviews });
  } catch (error) {
    if (musicRoot) {
      musicRoot.innerHTML = '<p class="writing-empty">音乐内容暂时无法读取，请先完成 Supabase 配置。</p>';
    }
    renderSidebarMeta({ items: [], reviews: [] });
  }
}

initMusicPage();
