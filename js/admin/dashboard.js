import { listAdminNotes } from "../services/notes-service.js";
import { listAdminPosts } from "../services/posts-service.js";
import { listAdminGalleryItems } from "../services/gallery-service.js";
import { listAdminMusicItems } from "../services/music-service.js";
import { getSiteSettingRecord, upsertSiteSetting } from "../services/site-settings-service.js";
import { STORAGE_BUCKETS, uploadPublicAsset } from "../services/storage.js";
import { bootstrapAdminPage, setAdminNotice } from "./shared.js";

console.log("[admin] dashboard loaded");

const statsRoot = document.querySelector("#dashboardStats");
const heroCoverForm = document.querySelector("#heroCoverForm");
const heroCoverFile = document.querySelector("#heroCoverFile");
const heroCoverPreview = document.querySelector("#heroCoverPreview");
const heroCoverActiveUrl = document.querySelector("#heroCoverActiveUrl");
const heroCoverStatusList = document.querySelector("#heroCoverStatusList");
const heroCoverSubmit = document.querySelector("#heroCoverSubmit");
const musicReviewsNav = document.querySelector('[data-admin-view="music-reviews"]');

const HERO_SETTING_KEY = "home_hero";
const DEFAULT_HERO_PATH = "../assets/images/home-hero.svg";
let isHeroCoverReady = false;
let isHeroCoverUploading = false;

console.log("[admin] music reviews nav found", Boolean(musicReviewsNav));

function showAdminView(viewName) {
  console.log("[admin] switch view", viewName);

  const target = document.querySelector(`[data-admin-panel="${viewName}"]`);
  if (!target) {
    console.error("[admin] view not found", viewName);
    setAdminNotice(`找不到后台视图：${viewName}`, "error");
    return;
  }

  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== viewName;
  });

  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminView === viewName);
  });

  target.scrollIntoView({ block: "start", behavior: "smooth" });
}

function bindDashboardViewNavigation() {
  if (!musicReviewsNav) {
    console.warn("music reviews nav not found");
    return;
  }

  musicReviewsNav.addEventListener("click", () => {
    console.log("[admin] music reviews nav clicked");
    showAdminView("music-reviews");
  });
}

function renderStats({ notes, posts, gallery, music }) {
  if (!statsRoot) {
    return;
  }

  const draftCount =
    notes.filter((item) => !item.is_published).length +
    posts.filter((item) => !item.is_published).length +
    gallery.filter((item) => !item.is_published).length +
    music.filter((item) => !item.is_published).length;

  statsRoot.innerHTML = `
    <article class="paper content-card admin-stat-card">
      <p class="section-label">Notes</p>
      <h2>${notes.length}</h2>
      <p>碎碎念总数</p>
    </article>
    <article class="paper content-card admin-stat-card">
      <p class="section-label">Posts</p>
      <h2>${posts.length}</h2>
      <p>文章总数</p>
    </article>
    <article class="paper content-card admin-stat-card">
      <p class="section-label">Gallery</p>
      <h2>${gallery.length}</h2>
      <p>视觉作品总数</p>
    </article>
    <article class="paper content-card admin-stat-card">
      <p class="section-label">Music</p>
      <h2>${music.length}</h2>
      <p>音乐条目总数</p>
    </article>
    <article class="paper content-card admin-stat-card">
      <p class="section-label">Drafts</p>
      <h2>${draftCount}</h2>
      <p>草稿总数</p>
    </article>
  `;
}

function setActiveUrl(url, source = "default") {
  if (!heroCoverActiveUrl) {
    return;
  }

  heroCoverActiveUrl.value = url || DEFAULT_HERO_PATH;
  heroCoverActiveUrl.dataset.source = source;
}

function renderHeroPreview(url, source = "default") {
  if (!heroCoverPreview) {
    return;
  }

  const previewUrl = url || DEFAULT_HERO_PATH;
  const sourceLabel =
    source === "remote"
      ? "当前使用 site_settings 中的后台封面"
      : "当前使用本地默认封面（回退）";

  heroCoverPreview.innerHTML = `
    <figure class="admin-hero-preview-media">
      <img src="${previewUrl}" alt="首页封面预览">
      <figcaption>${sourceLabel}</figcaption>
    </figure>
  `;
}

function renderStatusItems(items) {
  if (!heroCoverStatusList) {
    return;
  }

  heroCoverStatusList.innerHTML = items
    .map(
      (item) => `
        <article class="admin-status-item is-${item.type}">
          <strong>${item.title}</strong>
          <small>${item.message}</small>
        </article>
      `
    )
    .join("");
}

function setHeroCoverFormEnabled(enabled) {
  if (heroCoverFile) {
    heroCoverFile.disabled = !enabled;
  }

  if (heroCoverSubmit) {
    heroCoverSubmit.disabled = !enabled;
    heroCoverSubmit.textContent = enabled ? "上传并应用" : "初始化中…";
  }
}

function extractHeroUrl(settingRecord) {
  const value = settingRecord?.value;

  if (value && typeof value === "object" && typeof value.image_url === "string") {
    return value.image_url;
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function verifyImageUrl(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("URL 为空，无法验证。"));
      return;
    }

    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      reject(new Error("图片地址验证超时，可能 bucket 未公开或链接不可访问。"));
    }, 8000);

    image.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };

    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("图片地址无法加载，可能 public URL 不可访问。"));
    };

    image.src = url;
  });
}

async function loadHeroSetting() {
  try {
    const record = await getSiteSettingRecord(HERO_SETTING_KEY);
    const activeUrl = extractHeroUrl(record);

    if (activeUrl) {
      renderHeroPreview(activeUrl, "remote");
      setActiveUrl(activeUrl, "remote");
      renderStatusItems([
        {
          type: "success",
          title: "site_settings 读取成功",
          message: `当前前台应优先使用：${activeUrl}`
        }
      ]);
    } else {
      renderHeroPreview("", "default");
      setActiveUrl("", "default");
      renderStatusItems([
        {
          type: "error",
          title: "当前回退到本地默认图",
          message: "原因：site_settings 中不存在 home_hero，或 value 里没有 image_url。"
        }
      ]);
    }
  } catch (error) {
    renderHeroPreview("", "default");
    setActiveUrl("", "default");
    renderStatusItems([
      {
        type: "error",
        title: "读取 site_settings 失败",
        message: error?.message || "未知错误"
      }
    ]);
  }
}

function bindHeroCoverForm() {
  if (!heroCoverForm || !heroCoverFile) {
    return;
  }

  heroCoverFile.addEventListener("change", () => {
    const [file] = heroCoverFile.files || [];

    if (!file) {
      renderStatusItems([
        {
          type: "error",
          title: "还没有选择文件",
          message: "请选择一张封面图后再上传。"
        }
      ]);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    renderHeroPreview(objectUrl, "default");
    setAdminNotice(`已选择：${file.name}，点击“上传并应用”开始上传。`, "info");
    renderStatusItems([
      {
        type: "success",
        title: "文件已选择",
        message: `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
      }
    ]);
  });

  heroCoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isHeroCoverReady) {
      setAdminNotice("后台仍在校验登录状态，请稍后再试。", "info");
      renderStatusItems([
        {
          type: "error",
          title: "上传暂未开始",
          message: "后台初始化还没完成，所以这次点击不会执行上传。"
        }
      ]);
      return;
    }

    if (isHeroCoverUploading) {
      return;
    }

    const [file] = heroCoverFile.files || [];
    if (!file) {
      setAdminNotice("请先选择一张封面图。", "error");
      renderStatusItems([
        {
          type: "error",
          title: "上传未开始",
          message: "原因：还没有选择文件。"
        }
      ]);
      return;
    }

    const statuses = [];

    try {
      isHeroCoverUploading = true;
      setHeroCoverFormEnabled(false);
      if (heroCoverSubmit) {
        heroCoverSubmit.textContent = "上传中…";
      }
      setAdminNotice("正在上传首页封面…");
      renderStatusItems([
        {
          type: "success",
          title: "上传已开始",
          message: `正在处理 ${file.name}`
        }
      ]);
      let asset;
      try {
        asset = await uploadPublicAsset({
          bucket: STORAGE_BUCKETS.covers,
          file,
          folder: "home",
          baseName: "home-hero"
        });
      } catch (error) {
        throw new Error(`Storage 上传失败：${error?.message || "未知错误"}`);
      }

      statuses.push({
        type: "success",
        title: "上传成功",
        message: `文件已上传到 covers/${asset.path}`
      });

      statuses.push({
        type: "success",
        title: "Public URL 已生成",
        message: asset.url
      });

      try {
        await verifyImageUrl(asset.url);
      } catch (error) {
        throw new Error(`Public URL 验证失败：${error?.message || "未知错误"}`);
      }

      statuses.push({
        type: "success",
        title: "Public URL 可访问",
        message: "浏览器已验证这张图可以被加载。"
      });

      let savedRecord;
      try {
        savedRecord = await upsertSiteSetting(HERO_SETTING_KEY, {
          image_url: asset.url,
          storage_bucket: asset.bucket,
          storage_path: asset.path,
          updated_at: new Date().toISOString()
        });
      } catch (error) {
        throw new Error(`site_settings 写入失败：${error?.message || "未知错误"}`);
      }

      statuses.push({
        type: "success",
        title: "写入 site_settings 成功",
        message: `setting_key=${savedRecord.setting_key}`
      });

      let verifiedRecord;
      try {
        verifiedRecord = await getSiteSettingRecord(HERO_SETTING_KEY);
      } catch (error) {
        throw new Error(`site_settings 回读失败：${error?.message || "未知错误"}`);
      }

      const verifiedUrl = extractHeroUrl(verifiedRecord);

      if (!verifiedUrl) {
        throw new Error("site_settings 已写入，但回读时没有拿到 image_url。");
      }

      statuses.push({
        type: "success",
        title: "site_settings 回读成功",
        message: verifiedUrl
      });

      renderHeroPreview(verifiedUrl, "remote");
      setActiveUrl(verifiedUrl, "remote");
      renderStatusItems(statuses);
      heroCoverForm.reset();
      setAdminNotice("首页封面已更新，前台刷新后应立即显示新图。", "success");
    } catch (error) {
      statuses.push({
        type: "error",
        title: "流程中断",
        message: error?.message || "未知错误"
      });
      renderStatusItems(statuses);
      setAdminNotice(`封面链路失败：${error?.message || "未知错误"}`, "error");
    } finally {
      isHeroCoverUploading = false;
      setHeroCoverFormEnabled(true);
    }
  });
}

async function initDashboard() {
  bindDashboardViewNavigation();
  setHeroCoverFormEnabled(false);
  bindHeroCoverForm();

  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }
  isHeroCoverReady = true;
  setHeroCoverFormEnabled(true);

  try {
    const [notes, posts, gallery, music] = await Promise.all([
      listAdminNotes(),
      listAdminPosts(),
      listAdminGalleryItems(),
      listAdminMusicItems()
    ]);

    renderStats({ notes, posts, gallery, music });
    await loadHeroSetting();
  } catch (error) {
    setAdminNotice("后台概览暂时无法读取，请确认 Supabase 配置和 RLS 已完成。", "error");
  }
}

initDashboard();
