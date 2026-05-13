#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(__dirname, "migration-preview.json");
const CHUNK_SIZE = 50;
const CN_TZ_SUFFIX = "+08:00";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);

const args = parseArgs(process.argv.slice(2));
const env = loadEnv(path.join(ROOT, ".env"));

main().catch((error) => {
  console.error("[migrate-content] 迁移失败：", error.message);
  process.exitCode = 1;
});

async function main() {
  const scan = scanLegacySources(ROOT);
  const datasets = buildDatasets(scan);
  const preview = {
    generated_at: new Date().toISOString(),
    mode: {
      import: args.import,
      uploadStorage: args.uploadStorage
    },
    sources: scan.report,
    counts: {
      notes: datasets.notes.length,
      posts: datasets.posts.length,
      gallery_items: datasets.galleryItems.length,
      music_items: datasets.musicItems.length
    },
    data: {
      notes: datasets.notes,
      posts: datasets.posts,
      gallery_items: datasets.galleryItems,
      music_items: datasets.musicItems
    },
    warnings: datasets.warnings
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  console.log(`[migrate-content] 已生成预览文件：${relativeToRoot(OUTPUT_PATH)}`);
  printSummary(preview);

  if (!args.import) {
    console.log("[migrate-content] 当前为 dry run，仅扫描与生成预览，不会写入 Supabase。");
    return;
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (args.uploadStorage) {
    await uploadMediaAssets({
      supabaseUrl,
      serviceRoleKey,
      datasets
    });
  }

  await upsertTable({
    supabaseUrl,
    serviceRoleKey,
    table: "notes",
    rows: datasets.notes
  });
  await upsertTable({
    supabaseUrl,
    serviceRoleKey,
    table: "posts",
    rows: datasets.posts
  });
  await upsertTable({
    supabaseUrl,
    serviceRoleKey,
    table: "gallery_items",
    rows: datasets.galleryItems
  });
  await upsertTable({
    supabaseUrl,
    serviceRoleKey,
    table: "music_items",
    rows: datasets.musicItems
  });

  console.log("[migrate-content] Supabase 导入完成。");
}

function parseArgs(argv) {
  return {
    import: argv.includes("--import"),
    uploadStorage: argv.includes("--upload-storage")
  };
}

function loadEnv(filePath) {
  const result = { ...process.env };

  if (!fs.existsSync(filePath)) {
    return result;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (key && !(key in result)) {
      result[key] = value;
    }
  }

  return result;
}

function requireEnv(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}。请先在 .env 或系统环境变量中配置。`);
  }
  return value;
}

function scanLegacySources(rootDir) {
  const notesData = loadWindowData(path.join(rootDir, "js", "notes-data.js"), "notesData", []);
  const galleryData = loadWindowData(path.join(rootDir, "js", "gallery-data.js"), "galleryData", []);
  const writingData = loadWindowData(path.join(rootDir, "js", "writing-data.js"), "writingData", {
    categories: [],
    articles: []
  });

  const articleFiles = walkFiles(path.join(rootDir, "articles"), (filePath) => filePath.endsWith(".html"));
  const txtFiles = walkFiles(rootDir, (filePath) => filePath.endsWith(".txt") && !filePath.includes(`${path.sep}.git${path.sep}`));
  const imageFiles = walkFiles(path.join(rootDir, "images"), (filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  const audioFiles = walkFiles(path.join(rootDir, "audio"), (filePath) => AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  return {
    notesData,
    galleryData,
    writingData,
    articleFiles,
    txtFiles,
    imageFiles,
    audioFiles,
    report: {
      htmlSources: ["notes.html", "writing.html", "gallery.html", "music.html"].map((name) => ({
        file: name,
        exists: fs.existsSync(path.join(rootDir, name))
      })),
      jsSources: {
        notes: relativeIfExists(path.join(rootDir, "js", "notes-data.js")),
        gallery: relativeIfExists(path.join(rootDir, "js", "gallery-data.js")),
        writing: relativeIfExists(path.join(rootDir, "js", "writing-data.js"))
      },
      articleFiles: articleFiles.map(relativeToRoot),
      txtFiles: txtFiles.map(relativeToRoot),
      imageFileCount: imageFiles.length,
      audioFileCount: audioFiles.length
    }
  };
}

function buildDatasets(scan) {
  const warnings = [];
  const postsByCategory = new Map(
    (scan.writingData.categories || []).map((category) => [category.id, category.label || category.id])
  );

  const notes = (scan.notesData || []).map((item, index) => ({
    id: stableUuid(`notes:${item.id || item.datetime || item.content || index}`),
    title: null,
    content: normalizeText(item.content || ""),
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
    mood: null,
    publish_date: normalizeDate(item.datetime, index),
    is_published: true,
    order_index: null
  }));

  const posts = (scan.writingData.articles || []).map((item, index) => {
    const articlePath = item.link && item.link !== "#" ? path.join(ROOT, item.link) : null;
    const articleParsed = articlePath && fs.existsSync(articlePath) ? parseArticleHtml(articlePath) : null;

    if (item.link && item.link !== "#" && !articleParsed) {
      warnings.push(`文章 ${item.title} 的正文文件未解析成功：${item.link}`);
    }

    const slug =
      slugify(item.link && item.link !== "#" ? path.basename(item.link, path.extname(item.link)) : item.title) ||
      `post-${String(index + 1).padStart(3, "0")}`;
    const summary = normalizeText(item.summary || articleParsed?.description || extractSummary(articleParsed?.text || "", 140));
    const coverImageUrl = normalizeSitePath(item.cover || articleParsed?.cover || "");
    const contentHtml =
      articleParsed?.bodyHtml ||
      `<p>${escapeHtml(summary || "旧站缺少正文文件，这里先保留摘要，后续可在后台继续补充。")}</p>`;

    return {
      id: stableUuid(`posts:${item.id || slug}`),
      slug,
      title: normalizeText(item.title || articleParsed?.title || `未命名文章 ${index + 1}`),
      summary,
      category: normalizeText(postsByCategory.get(item.category) || item.category || "文章"),
      cover_image_url: coverImageUrl || null,
      content_html: contentHtml,
      is_published: true,
      featured: Boolean(item.featured),
      publish_date: normalizeDate(item.date || articleParsed?.publishDate, index)
    };
  });

  const galleryItems = (scan.galleryData || []).map((item, index) => {
    const imageUrl = normalizeSitePath(item.image || "");
    return {
      id: stableUuid(`gallery:${item.id || item.title || imageUrl || index}`),
      title: normalizeText(item.title || inferTitleFromPath(imageUrl) || `视觉作品 ${index + 1}`),
      category: mapGalleryCategory(item.type),
      image_url: imageUrl || "",
      thumbnail_url: imageUrl || null,
      description: normalizeText(item.description || ""),
      is_published: true,
      sort_order: index + 1,
      publish_date: normalizeDate(item.date, index)
    };
  });

  const musicItems = buildMusicItems(scan.audioFiles, scan.txtFiles, warnings);

  if (!musicItems.length) {
    warnings.push("未在 audio/ 目录中找到可迁移的本地音频文件，music_items 将保持为空。");
  }

  return {
    notes,
    posts,
    galleryItems,
    musicItems,
    warnings
  };
}

function buildMusicItems(audioFiles, txtFiles, warnings) {
  const sidecarMap = new Map();

  for (const txtPath of txtFiles) {
    const basename = path.basename(txtPath, path.extname(txtPath)).toLowerCase();
    sidecarMap.set(basename, readFileSafe(txtPath).trim());
  }

  return audioFiles.map((audioPath, index) => {
    const filename = path.basename(audioPath);
    const basename = path.basename(audioPath, path.extname(audioPath));
    const sidecar = sidecarMap.get(basename.toLowerCase()) || "";
    const publishDate = inferDateFromFilename(filename) || fileMtimeIso(audioPath);

    if (!publishDate) {
      warnings.push(`音频 ${relativeToRoot(audioPath)} 未能识别日期，已回退到文件修改时间。`);
    }

    return {
      id: stableUuid(`music:${relativeToRoot(audioPath)}`),
      title: humanizeFilename(basename),
      artist: "Zoey",
      cover_image_url: findMatchingCover(audioPath),
      audio_url: normalizeSitePath(relativeToRoot(audioPath)),
      description: sidecar ? extractSummary(sidecar, 120) : "从旧站本地音频目录导入。",
      lyrics_or_notes: sidecar,
      is_published: true,
      sort_order: index + 1,
      publish_date: normalizeDate(publishDate, index)
    };
  });
}

function parseArticleHtml(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const title = firstMatch(raw, /<h1>([\s\S]*?)<\/h1>/i) || firstMatch(raw, /<title>([\s\S]*?)\s*\|/i) || "";
  const description = firstMatch(raw, /<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i) || "";
  const publishDate = firstMatch(raw, /<time[^>]*datetime="([^"]+)"/i) || "";
  const cover = firstMatch(raw, /<figure class="article-cover">[\s\S]*?<img[^>]*src="([^"]+)"/i) || "";
  const bodyInner = firstMatch(raw, /<article class="article-body">([\s\S]*?)<\/article>/i) || "";
  const bodyHtml = normalizeArticleHtml(bodyInner, filePath);
  const text = stripHtml(bodyInner);

  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    publishDate,
    cover: normalizeSitePath(resolveAssetReference(cover, filePath)),
    bodyHtml,
    text
  };
}

function normalizeArticleHtml(html, filePath) {
  if (!html) {
    return "";
  }

  return html
    .replace(/\.\.\/(images\/[^"']+)/g, (_match, assetPath) => normalizeSitePath(assetPath))
    .replace(/src="(images\/[^"]+)"/g, (_match, assetPath) => `src="${normalizeSitePath(assetPath)}"`)
    .replace(/href="(images\/[^"]+)"/g, (_match, assetPath) => `href="${normalizeSitePath(assetPath)}"`)
    .replace(/\s+loading="lazy"/g, ' loading="lazy"')
    .replace(/\s+loading="eager"/g, ' loading="lazy"')
    .trim();
}

async function uploadMediaAssets({ supabaseUrl, serviceRoleKey, datasets }) {
  const uploadCache = new Map();

  for (const post of datasets.posts) {
    if (post.cover_image_url) {
      post.cover_image_url = await uploadSiteAsset({
        sitePath: post.cover_image_url,
        bucket: "covers",
        objectKey: `legacy/posts/${path.basename(post.cover_image_url)}`,
        supabaseUrl,
        serviceRoleKey,
        uploadCache
      });
    }

    post.content_html = await replaceArticleAssetUrls({
      html: post.content_html,
      supabaseUrl,
      serviceRoleKey,
      uploadCache
    });
  }

  for (const item of datasets.galleryItems) {
    if (!item.image_url) {
      continue;
    }
    const uploadedUrl = await uploadSiteAsset({
      sitePath: item.image_url,
      bucket: "images",
      objectKey: `legacy/${stripLeadingSlash(item.image_url)}`,
      supabaseUrl,
      serviceRoleKey,
      uploadCache
    });
    item.image_url = uploadedUrl;
    item.thumbnail_url = uploadedUrl;
  }

  for (const item of datasets.musicItems) {
    if (item.cover_image_url) {
      item.cover_image_url = await uploadSiteAsset({
        sitePath: item.cover_image_url,
        bucket: "covers",
        objectKey: `legacy/music-covers/${path.basename(item.cover_image_url)}`,
        supabaseUrl,
        serviceRoleKey,
        uploadCache
      });
    }

    item.audio_url = await uploadSiteAsset({
      sitePath: item.audio_url,
      bucket: "audio",
      objectKey: `legacy/${stripLeadingSlash(item.audio_url)}`,
      supabaseUrl,
      serviceRoleKey,
      uploadCache
    });
  }
}

async function replaceArticleAssetUrls({ html, supabaseUrl, serviceRoleKey, uploadCache }) {
  const matches = [...html.matchAll(/src="(\/images\/[^"]+)"/g)];
  if (!matches.length) {
    return html;
  }

  let nextHtml = html;
  for (const match of matches) {
    const originalPath = match[1];
    const uploadedUrl = await uploadSiteAsset({
      sitePath: originalPath,
      bucket: "images",
      objectKey: `legacy/${stripLeadingSlash(originalPath)}`,
      supabaseUrl,
      serviceRoleKey,
      uploadCache
    });
    nextHtml = nextHtml.replaceAll(`src="${originalPath}"`, `src="${uploadedUrl}"`);
  }

  return nextHtml;
}

async function uploadSiteAsset({ sitePath, bucket, objectKey, supabaseUrl, serviceRoleKey, uploadCache }) {
  if (!sitePath || /^https?:\/\//i.test(sitePath)) {
    return sitePath;
  }

  const normalizedPath = normalizeSitePath(sitePath);
  const cacheKey = `${bucket}:${normalizedPath}`;
  if (uploadCache.has(cacheKey)) {
    return uploadCache.get(cacheKey);
  }

  const absolutePath = path.join(ROOT, stripLeadingSlash(normalizedPath));
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[migrate-content] 跳过媒体上传，文件不存在：${relativeToRoot(absolutePath)}`);
    uploadCache.set(cacheKey, normalizedPath);
    return normalizedPath;
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeObjectKey(objectKey)}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "x-upsert": "true",
      "Content-Type": guessMimeType(absolutePath)
    },
    body: fs.readFileSync(absolutePath)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`上传媒体失败 ${normalizedPath}: ${response.status} ${detail}`);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${stripLeadingSlash(objectKey)}`;
  uploadCache.set(cacheKey, publicUrl);
  return publicUrl;
}

async function upsertTable({ supabaseUrl, serviceRoleKey, table, rows }) {
  if (!rows.length) {
    console.log(`[migrate-content] ${table} 无数据，跳过。`);
    return;
  }

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(chunk)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`写入 ${table} 失败: ${response.status} ${detail}`);
    }
  }

  console.log(`[migrate-content] ${table} 已写入 ${rows.length} 条。`);
}

function loadWindowData(filePath, propertyName, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), sandbox, { filename: filePath });
  return sandbox.window[propertyName] || fallbackValue;
}

function walkFiles(startPath, filter) {
  if (!fs.existsSync(startPath)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(startPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, filter));
      continue;
    }
    if (!filter || filter(fullPath)) {
      results.push(fullPath);
    }
  }

  return results.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function normalizeDate(value, fallbackIndex) {
  const raw = String(value || "").trim();
  if (!raw) {
    return new Date(Date.UTC(2024, 0, 1 + fallbackIndex, 4, 0, 0)).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return new Date(`${raw}${CN_TZ_SUFFIX}`).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00${CN_TZ_SUFFIX}`).toISOString();
  }

  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) {
    const normalized = raw.replace(/\./g, "-");
    return new Date(`${normalized}T12:00:00${CN_TZ_SUFFIX}`).toISOString();
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return new Date(`${raw}-01T12:00:00${CN_TZ_SUFFIX}`).toISOString();
  }

  if (/^\d{2}-\d{2}-\d{2}$/.test(raw)) {
    const [yy, mm, dd] = raw.split("-");
    return new Date(`20${yy}-${mm}-${dd}T12:00:00${CN_TZ_SUFFIX}`).toISOString();
  }

  const inferred = inferDateFromFilename(raw);
  if (inferred) {
    return new Date(`${inferred}T12:00:00${CN_TZ_SUFFIX}`).toISOString();
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return new Date(Date.UTC(2024, 0, 1 + fallbackIndex, 4, 0, 0)).toISOString();
}

function inferDateFromFilename(input) {
  const value = String(input || "");
  let match = value.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  match = value.match(/(^|[^0-9])(\d{2})(\d{2})(\d{2})([^0-9]|$)/);
  if (match) {
    return `20${match[2]}-${match[3]}-${match[4]}`;
  }

  return "";
}

function fileMtimeIso(filePath) {
  const stats = fs.statSync(filePath);
  return stats.mtime.toISOString();
}

function stableUuid(seed) {
  const hash = crypto.createHash("sha1").update(seed).digest("hex");
  const chars = hash.slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function slugify(value) {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (cleaned) {
    return cleaned;
  }

  const fallback = crypto.createHash("md5").update(String(value || "untitled")).digest("hex").slice(0, 10);
  return `entry-${fallback}`;
}

function normalizeSitePath(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const normalized = raw.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\.\.\//, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function resolveAssetReference(reference, fromFile) {
  const raw = String(reference || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const absolutePath = path.resolve(path.dirname(fromFile), raw);
  return relativeToRoot(absolutePath);
}

function mapGalleryCategory(type) {
  switch (String(type || "").toLowerCase()) {
    case "drawing":
      return "画画";
    case "photo":
      return "摄影";
    default:
      return "杂项";
  }
}

function findMatchingCover(audioPath) {
  const basename = path.basename(audioPath, path.extname(audioPath)).toLowerCase();
  const candidateDirs = [
    path.join(ROOT, "images", "music"),
    path.join(ROOT, "images", "covers"),
    path.dirname(audioPath)
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const match = fs
      .readdirSync(dir)
      .find((name) => path.basename(name, path.extname(name)).toLowerCase() === basename && IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
    if (match) {
      return normalizeSitePath(relativeToRoot(path.join(dir, match)));
    }
  }

  return null;
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}

function encodeObjectKey(value) {
  return String(value)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function inferTitleFromPath(sitePath) {
  if (!sitePath) {
    return "";
  }
  return humanizeFilename(path.basename(sitePath, path.extname(sitePath)));
}

function humanizeFilename(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummary(text, maxLength) {
  const plain = normalizeText(stripHtml(text)).replace(/\s+/g, " ");
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trim()}...`;
}

function stripHtml(html) {
  return decodeHtmlEntities(String(html || "").replace(/<[^>]+>/g, " "));
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value || "").replace(/\r\n/g, "\n").trim());
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstMatch(input, pattern) {
  const match = String(input || "").match(pattern);
  return match ? match[1].trim() : "";
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_error) {
    return "";
  }
}

function printSummary(preview) {
  console.log("[migrate-content] 扫描结果：");
  console.log(`  notes        ${preview.counts.notes}`);
  console.log(`  posts        ${preview.counts.posts}`);
  console.log(`  gallery      ${preview.counts.gallery_items}`);
  console.log(`  music        ${preview.counts.music_items}`);
  if (preview.warnings.length) {
    console.log("[migrate-content] 注意：");
    for (const warning of preview.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

function relativeIfExists(filePath) {
  return fs.existsSync(filePath) ? relativeToRoot(filePath) : null;
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function stripLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}
