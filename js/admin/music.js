import { bootstrapAdminPage, defaultMeta, renderAdminList, setAdminNotice } from "./shared.js";
import { normalizeTagsInput, slugify, tagsToInput } from "../lib/utils.js";
import {
  normalizeCandidates,
  parseMusicInput,
  renderMusicCandidates,
  searchItunes,
  searchMusicBrainz
} from "./music-review-autofill.js";
import {
  deleteMusicItem,
  deleteMusicReview,
  listAdminMusicItems,
  listAdminMusicReviews,
  parseNeteaseUrl,
  saveMusicItem,
  saveMusicReview
} from "../services/music-service.js";
import { STORAGE_BUCKETS, uploadPublicAsset } from "../services/storage.js";

const listRoot = document.querySelector("#adminRecordList");
const itemForm = document.querySelector("#adminEditorForm");
const reviewForm = document.querySelector("#musicReviewForm");
const itemPanel = document.querySelector("#musicItemPanel");
const reviewPanel = document.querySelector("#musicReviewPanel");
const newButton = document.querySelector("#createNewRecord");
const deleteItemButton = document.querySelector("#deleteRecord");
const deleteReviewButton = document.querySelector("#deleteReviewRecord");
const itemModeButton = document.querySelector("#musicItemsMode");
const reviewModeButton = document.querySelector("#musicReviewsMode");
const saveMusicReviewButton = document.querySelector("#saveMusicReviewBtn");
const autoRecognizeMusicButton = document.querySelector("#autoRecognizeMusicBtn");
const musicCandidatesRoot = document.querySelector("#musicCandidates");
const musicAutofillStatus = document.querySelector("#musicAutofillStatus");

console.log("[admin] music admin loaded");
console.log("[admin] music reviews nav found", Boolean(reviewModeButton));

if (new URLSearchParams(window.location.search).get("view") === "reviews") {
  document.body.dataset.adminPage = "music-reviews";
}

let activeMode = "items";
let itemRecords = [];
let reviewRecords = [];
let activeItemId = null;
let activeReviewId = null;
let activeParsedMusicInput = null;
let activeCandidates = [];
let selectedCandidate = null;

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function resetItemForm() {
  itemForm?.reset();
  itemForm.elements.id.value = "";
  itemForm.elements.cover_image_url.value = "";
  itemForm.elements.audio_url.value = "";
  activeItemId = null;
}

function resetReviewForm() {
  reviewForm?.reset();
  reviewForm.elements.id.value = "";
  reviewForm.elements.is_playable.checked = true;
  reviewForm.elements.quick_is_published.checked = true;
  reviewForm.elements.player_type.value = "netease_song";
  activeReviewId = null;
  activeParsedMusicInput = null;
  activeCandidates = [];
  selectedCandidate = null;
  renderCandidateList();
  setAutofillStatus("粘贴后不会自动联网，只有点击“自动识别”才搜索候选。");
}

function populateItemForm(record) {
  if (!itemForm || !record) {
    return;
  }

  itemForm.elements.id.value = record.id || "";
  itemForm.elements.title.value = record.title || "";
  itemForm.elements.artist.value = record.artist || "";
  itemForm.elements.publish_date.value = toDatetimeLocal(record.publish_date);
  itemForm.elements.sort_order.value = record.sort_order ?? "";
  itemForm.elements.cover_image_url.value = record.cover_image_url || "";
  itemForm.elements.audio_url.value = record.audio_url || "";
  itemForm.elements.description.value = record.description || "";
  itemForm.elements.lyrics_or_notes.value = record.lyrics_or_notes || "";
  itemForm.elements.is_published.checked = Boolean(record.is_published);
  activeItemId = record.id;
}

function populateReviewForm(record) {
  if (!reviewForm || !record) {
    return;
  }

  reviewForm.elements.id.value = record.id || "";
  reviewForm.elements.title.value = record.title || "";
  reviewForm.elements.slug.value = record.slug || "";
  reviewForm.elements.song_name.value = record.song_name || "";
  reviewForm.elements.artist.value = record.artist || "";
  reviewForm.elements.album.value = record.album || "";
  reviewForm.elements.rating.value = record.rating ?? "";
  reviewForm.elements.netease_url.value = record.netease_url || "";
  reviewForm.elements.external_music_url.value = record.external_music_url || "";
  reviewForm.elements.preview_url.value = record.preview_url || "";
  reviewForm.elements.netease_song_id.value = record.netease_song_id || "";
  reviewForm.elements.netease_playlist_id.value = record.netease_playlist_id || "";
  reviewForm.elements.player_type.value = record.player_type || "netease_song";
  reviewForm.elements.metadata_source.value = record.metadata_source || "manual";
  reviewForm.elements.mood.value = record.mood || "";
  reviewForm.elements.cover_url.value = record.cover_url || "";
  reviewForm.elements.tags.value = tagsToInput(record.tags);
  reviewForm.elements.quick_tags.value = tagsToInput(record.tags);
  reviewForm.elements.published_at.value = toDatetimeLocal(record.published_at);
  reviewForm.elements.review_short.value = record.review_short || "";
  reviewForm.elements.quick_review_short.value = record.review_short || "";
  reviewForm.elements.review_body.value = record.review_body || "";
  reviewForm.elements.quick_rating.value = record.rating ?? "";
  reviewForm.elements.alternate_title.value = record.alternate_title || "";
  reviewForm.elements.featured_artists.value = tagsToInput(record.featured_artists);
  reviewForm.elements.is_playable.checked = Boolean(record.is_playable);
  reviewForm.elements.is_published.checked = Boolean(record.is_published);
  reviewForm.elements.quick_is_published.checked = Boolean(record.is_published);
  reviewForm.elements.quick_music_input.value = [record.song_name || record.title || "", record.alternate_title || ""].filter(Boolean).join("\n");
  activeReviewId = record.id;
  selectedCandidate = null;
  activeCandidates = [];
  activeParsedMusicInput = null;
  renderCandidateList();
  setAutofillStatus("已载入现有乐评，可直接修改短评后保存。");
}

function setMode(mode) {
  console.log("[admin] switch view", mode === "reviews" ? "music-reviews" : "music-items");
  activeMode = mode;
  const isReviewMode = mode === "reviews";

  if (!itemPanel || !reviewPanel) {
    console.error("[admin] view not found", mode === "reviews" ? "musicReviewsView" : "musicItemPanel");
    setAdminNotice("后台音乐视图容器不存在，请检查 admin/music.html。", "error");
    return;
  }

  itemPanel.hidden = isReviewMode;
  reviewPanel.hidden = !isReviewMode;
  itemModeButton?.classList.toggle("is-active", !isReviewMode);
  reviewModeButton?.classList.toggle("is-active", isReviewMode);

  if (newButton) {
    newButton.textContent = isReviewMode ? "新建乐评" : "新建音乐条目";
  }

  refreshList();
}

function refreshList() {
  const records = activeMode === "reviews" ? reviewRecords : itemRecords;
  const activeId = activeMode === "reviews" ? activeReviewId : activeItemId;
  const renderMeta =
    activeMode === "reviews"
      ? (item) => `${item.song_name || item.title || "未命名歌曲"} · ${item.artist || "未署名"}`
      : (item) => `${item.artist || "未署名"} · ${defaultMeta(item)}`;

  renderAdminList(listRoot, records, activeId, renderMeta);

  listRoot?.querySelectorAll("[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-record-id");

      if (activeMode === "reviews") {
        const record = reviewRecords.find((entry) => entry.id === id);
        if (record) {
          populateReviewForm(record);
        }
      } else {
        const record = itemRecords.find((entry) => entry.id === id);
        if (record) {
          populateItemForm(record);
        }
      }

      refreshList();
    });
  });
}

async function loadItemRecords(selectId) {
  itemRecords = await listAdminMusicItems();
  if (selectId) {
    const target = itemRecords.find((record) => record.id === selectId);
    if (target) {
      populateItemForm(target);
    }
  }
}

async function loadReviewRecords(selectId) {
  reviewRecords = await listAdminMusicReviews();
  if (selectId) {
    const target = reviewRecords.find((record) => record.id === selectId);
    if (target) {
      populateReviewForm(target);
    }
  }
}

function syncNeteaseIdsFromUrl() {
  if (!reviewForm) {
    return;
  }

  const parsed = parseNeteaseUrl(reviewForm.elements.netease_url.value);

  if (parsed.songId) {
    reviewForm.elements.netease_song_id.value = parsed.songId;
    reviewForm.elements.player_type.value = "netease_song";
  }

  if (parsed.playlistId) {
    reviewForm.elements.netease_playlist_id.value = parsed.playlistId;
    reviewForm.elements.player_type.value = "netease_playlist";
  }
}

function setAutofillStatus(message, type = "info") {
  if (!musicAutofillStatus) {
    return;
  }

  musicAutofillStatus.textContent = message;
  musicAutofillStatus.classList.toggle("is-error", type === "error");
  musicAutofillStatus.classList.toggle("is-success", type === "success");
}

function renderCandidateList() {
  if (!musicCandidatesRoot) {
    return;
  }

  musicCandidatesRoot.innerHTML = renderMusicCandidates(activeCandidates, selectedCandidate?.id || "");
  musicCandidatesRoot.querySelectorAll("[data-use-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const candidateId = button.getAttribute("data-use-candidate");
      const candidate = activeCandidates.find((item) => item.id === candidateId);
      if (candidate) {
        applyCandidate(candidate);
      }
    });
  });
}

function applyParsedMusicInput(parsed) {
  if (!reviewForm || !parsed) {
    return;
  }

  reviewForm.elements.song_name.value = parsed.song_name_guess || parsed.display_title || "";
  reviewForm.elements.title.value = parsed.song_name_guess || parsed.display_title || "未命名乐评";
  reviewForm.elements.alternate_title.value = parsed.alternate_title || "";
  reviewForm.elements.featured_artists.value = tagsToInput(parsed.featured_artists);
  reviewForm.elements.artist.value = parsed.artist_guess || "";
  reviewForm.elements.netease_song_id.value = parsed.netease_song_id || "";
  reviewForm.elements.netease_playlist_id.value = parsed.netease_playlist_id || "";
  reviewForm.elements.netease_url.value = parsed.netease_url || "";
  reviewForm.elements.metadata_source.value = parsed.netease_song_id || parsed.netease_playlist_id ? "netease_link" : "manual";

  if (parsed.netease_playlist_id) {
    reviewForm.elements.player_type.value = "netease_playlist";
  } else if (parsed.netease_song_id) {
    reviewForm.elements.player_type.value = "netease_song";
  }
}

function applyCandidate(candidate) {
  selectedCandidate = candidate;
  reviewForm.elements.song_name.value = candidate.title || "";
  reviewForm.elements.title.value = candidate.title || activeParsedMusicInput?.song_name_guess || "未命名乐评";
  reviewForm.elements.artist.value = candidate.artist || "";
  reviewForm.elements.album.value = candidate.album || "";
  reviewForm.elements.cover_url.value = candidate.cover_url || "";
  reviewForm.elements.netease_song_id.value = candidate.netease_song_id || "";
  reviewForm.elements.netease_playlist_id.value = candidate.netease_playlist_id || "";
  reviewForm.elements.netease_url.value = candidate.netease_url || "";
  reviewForm.elements.external_music_url.value = candidate.external_music_url || "";
  reviewForm.elements.preview_url.value = candidate.preview_url || "";
  reviewForm.elements.player_type.value = candidate.player_type || "external_link";
  reviewForm.elements.is_playable.checked = Boolean(candidate.is_playable);
  reviewForm.elements.metadata_source.value = candidate.metadata_source || "manual";

  renderCandidateList();
  setAutofillStatus(`已使用候选：${candidate.title || "未命名歌曲"}。`, "success");
}

async function handleAutoRecognizeMusic() {
  const input = reviewForm?.elements.quick_music_input.value.trim() || "";
  if (!input) {
    setAutofillStatus("请先粘贴歌名、歌手或网易云链接。", "error");
    return;
  }

  activeParsedMusicInput = parseMusicInput(input);
  selectedCandidate = null;
  applyParsedMusicInput(activeParsedMusicInput);
  setAutofillStatus(`正在搜索候选：${activeParsedMusicInput.query}`);
  activeCandidates = [];
  renderCandidateList();

  const [itunesResult, musicBrainzResult] = await Promise.allSettled([
    searchItunes(activeParsedMusicInput.query),
    searchMusicBrainz(activeParsedMusicInput.query)
  ]);

  const errors = [itunesResult, musicBrainzResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "搜索失败");

  activeCandidates = normalizeCandidates({
    parsed: activeParsedMusicInput,
    itunes: itunesResult.status === "fulfilled" ? itunesResult.value : [],
    musicBrainz: musicBrainzResult.status === "fulfilled" ? musicBrainzResult.value : []
  });
  renderCandidateList();

  const warningText = activeParsedMusicInput.warnings.length ? ` ${activeParsedMusicInput.warnings.join(" ")}` : "";
  if (activeCandidates.length) {
    setAutofillStatus(`找到 ${activeCandidates.length} 个候选。${warningText}`, "success");
  } else {
    setAutofillStatus(`未找到候选，可手动填写高级信息。${errors.join("；") || warningText}`, errors.length ? "error" : "info");
  }
}

function bindModeControls() {
  if (!reviewModeButton) {
    console.warn("music reviews nav not found");
  }

  itemModeButton?.addEventListener("click", () => setMode("items"));
  reviewModeButton?.addEventListener("click", () => {
    console.log("[admin] music reviews nav clicked");
    setMode("reviews");
  });

  newButton?.addEventListener("click", () => {
    if (activeMode === "reviews") {
      resetReviewForm();
    } else {
      resetItemForm();
    }
    refreshList();
  });
}

function bindItemForm() {
  deleteItemButton?.addEventListener("click", async () => {
    if (!activeItemId || !window.confirm("确定删除这条音乐内容吗？")) {
      return;
    }

    try {
      await deleteMusicItem(activeItemId);
      setAdminNotice("音乐条目已删除。", "success");
      resetItemForm();
      await loadItemRecords();
      refreshList();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  itemForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      let coverImageUrl = itemForm.elements.cover_image_url.value.trim();
      let audioUrl = itemForm.elements.audio_url.value.trim();
      const coverFile = itemForm.elements.cover_file.files?.[0];
      const audioFile = itemForm.elements.audio_file.files?.[0];

      if (coverFile) {
        const uploadedCover = await uploadPublicAsset({
          bucket: STORAGE_BUCKETS.covers,
          file: coverFile,
          folder: "music-covers",
          baseName: itemForm.elements.title.value
        });

        coverImageUrl = uploadedCover.url;
      }

      if (audioFile) {
        const uploadedAudio = await uploadPublicAsset({
          bucket: STORAGE_BUCKETS.audio,
          file: audioFile,
          folder: "tracks",
          baseName: itemForm.elements.title.value
        });

        audioUrl = uploadedAudio.url;
      }

      const payload = {
        id: itemForm.elements.id.value || undefined,
        title: itemForm.elements.title.value.trim(),
        artist: itemForm.elements.artist.value.trim(),
        publish_date: itemForm.elements.publish_date.value ? new Date(itemForm.elements.publish_date.value).toISOString() : new Date().toISOString(),
        sort_order: itemForm.elements.sort_order.value,
        cover_image_url: coverImageUrl || null,
        audio_url: audioUrl,
        description: itemForm.elements.description.value.trim(),
        lyrics_or_notes: itemForm.elements.lyrics_or_notes.value.trim(),
        is_published: itemForm.elements.is_published.checked
      };

      const record = await saveMusicItem(payload);
      setAdminNotice("音乐条目已保存。", "success");
      await loadItemRecords(record.id);
      refreshList();
    } catch (error) {
      setAdminNotice(error.message || "保存失败，请检查权限配置。", "error");
    }
  });
}

function bindReviewForm() {
  reviewForm?.elements.netease_url.addEventListener("change", syncNeteaseIdsFromUrl);
  reviewForm?.elements.netease_url.addEventListener("blur", syncNeteaseIdsFromUrl);
  reviewForm?.elements.quick_music_input.addEventListener("input", () => {
    const parsed = parseMusicInput(reviewForm.elements.quick_music_input.value);
    activeParsedMusicInput = parsed;
    applyParsedMusicInput(parsed);
  });
  autoRecognizeMusicButton?.addEventListener("click", async () => {
    try {
      await handleAutoRecognizeMusic();
    } catch (error) {
      console.error(error);
      setAutofillStatus(error.message || "自动识别失败。", "error");
    }
  });

  saveMusicReviewButton?.addEventListener("click", () => {
    console.log("[music review] save clicked");
  });

  deleteReviewButton?.addEventListener("click", async () => {
    if (!activeReviewId || !window.confirm("确定删除这篇乐评吗？")) {
      return;
    }

    try {
      await deleteMusicReview(activeReviewId);
      setAdminNotice("乐评已删除。", "success");
      resetReviewForm();
      await loadReviewRecords();
      refreshList();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  reviewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncNeteaseIdsFromUrl();

    try {
      const quickInput = reviewForm.elements.quick_music_input.value.trim();
      const parsed = activeParsedMusicInput || parseMusicInput(quickInput);
      if (!reviewForm.elements.song_name.value.trim() && parsed.song_name_guess) {
        applyParsedMusicInput(parsed);
      }

      const title =
        reviewForm.elements.title.value.trim() ||
        reviewForm.elements.song_name.value.trim() ||
        parsed.song_name_guess ||
        "未命名乐评";
      if (!title) {
        setAdminNotice("请先填写乐评标题。", "error");
        return;
      }

      const payload = {
        id: reviewForm.elements.id.value || undefined,
        title,
        slug: reviewForm.elements.slug.value.trim() || slugify(`${title}-${reviewForm.elements.artist.value}`),
        song_name: reviewForm.elements.song_name.value.trim(),
        artist: reviewForm.elements.artist.value.trim(),
        album: reviewForm.elements.album.value.trim(),
        rating: reviewForm.elements.quick_rating.value || reviewForm.elements.rating.value,
        netease_url: reviewForm.elements.netease_url.value.trim(),
        netease_song_id: reviewForm.elements.netease_song_id.value.trim(),
        netease_playlist_id: reviewForm.elements.netease_playlist_id.value.trim(),
        external_music_url: reviewForm.elements.external_music_url.value.trim(),
        preview_url: reviewForm.elements.preview_url.value.trim(),
        player_type: reviewForm.elements.player_type.value,
        mood: reviewForm.elements.mood.value.trim(),
        cover_url: reviewForm.elements.cover_url.value.trim() || null,
        tags: normalizeTagsInput(reviewForm.elements.quick_tags.value || reviewForm.elements.tags.value),
        published_at: reviewForm.elements.published_at.value ? new Date(reviewForm.elements.published_at.value).toISOString() : new Date().toISOString(),
        review_short: reviewForm.elements.quick_review_short.value.trim() || reviewForm.elements.review_short.value.trim(),
        review_body: reviewForm.elements.review_body.value.trim(),
        is_playable: reviewForm.elements.is_playable.checked,
        is_published: reviewForm.elements.quick_is_published.checked || reviewForm.elements.is_published.checked,
        metadata_source: reviewForm.elements.metadata_source.value.trim() || selectedCandidate?.metadata_source || "manual",
        metadata_raw: selectedCandidate?.metadata_raw || parsed,
        alternate_title: reviewForm.elements.alternate_title.value.trim() || parsed.alternate_title,
        featured_artists: normalizeTagsInput(reviewForm.elements.featured_artists.value).length
          ? normalizeTagsInput(reviewForm.elements.featured_artists.value)
          : parsed.featured_artists
      };

      console.log("[music review] save payload", {
        hasId: Boolean(payload.id),
        title: payload.title,
        slug: payload.slug,
        player_type: payload.player_type,
        hasSongId: Boolean(payload.netease_song_id),
        hasPlaylistId: Boolean(payload.netease_playlist_id),
        is_published: payload.is_published
      });

      const record = await saveMusicReview(payload);
      setAdminNotice("乐评已保存。", "success");
      await loadReviewRecords(record.id);
      refreshList();
    } catch (error) {
      console.error(error);
      setAdminNotice(error.message || "保存失败，请检查乐评字段或权限配置。", "error");
    }
  });
}

async function initMusicAdminPage() {
  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }

  try {
    await Promise.all([loadItemRecords(), loadReviewRecords()]);
  } catch (error) {
    console.error(error);
    setAdminNotice(`音乐内容列表读取失败：${error.message || "请确认 Supabase 配置和 music_reviews 表已创建。"}`, "error");
  }

  bindModeControls();
  bindItemForm();
  bindReviewForm();
  setMode(new URLSearchParams(window.location.search).get("view") === "reviews" ? "reviews" : "items");
}

initMusicAdminPage();
