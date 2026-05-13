const storageKeys = ["endpoint", "importToken"];
const statusNode = document.querySelector("#status");
const extractMetaNode = document.querySelector("#extractMeta");
const form = document.querySelector("#saveForm");
const saveButton = document.querySelector("#saveButton");
const contentInput = document.querySelector("#content");
const titleInput = document.querySelector("#title");
const sourceUrlInput = document.querySelector("#sourceUrl");
const publishedAtInput = document.querySelector("#publishedAt");
const tagsInput = document.querySelector("#tags");
const isPublishedInput = document.querySelector("#isPublished");
const allowPinnedInput = document.querySelector("#allowPinned");
const endpointInput = document.querySelector("#endpoint");
const importTokenInput = document.querySelector("#importToken");

let currentExtraction = null;

function setStatus(message, type = "info") {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", type === "error");
  statusNode.classList.toggle("is-success", type === "success");
}

function setMeta(lines = []) {
  const visibleLines = lines.filter(Boolean);
  extractMetaNode.classList.toggle("is-hidden", !visibleLines.length);
  extractMetaNode.textContent = visibleLines.join(" · ");
}

function removeUrls(value) {
  return String(value || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function makeTitle(content) {
  const firstLine = removeUrls(content).split(/\n/).find(Boolean) || removeUrls(content);
  return firstLine.slice(0, 24).trim() || "未命名片段";
}

function makeExcerpt(content) {
  const cleaned = removeUrls(content).replace(/\n{2,}/g, "\n");
  return cleaned.length > 120 ? `${cleaned.slice(0, 120).trim()}…` : cleaned;
}

function inferTags(content) {
  if (/开心|难过|情绪|治愈|内耗/.test(content)) {
    return ["感受"];
  }

  if (/书|阅读|文章|论文/.test(content)) {
    return ["阅读"];
  }

  if (/生活|今天|窗|桌面|奶茶/.test(content)) {
    return ["生活"];
  }

  if (/聊天|朋友|对话/.test(content)) {
    return ["对话"];
  }

  if (/记录|提醒|复盘/.test(content)) {
    return ["记录"];
  }

  return ["随笔"];
}

function toDatetimeLocal(date = new Date()) {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const offset = safeDate.getTimezoneOffset();
  const localDate = new Date(safeDate.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function parseTags(value) {
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractTweetId(url) {
  return String(url || "").match(/\/status\/(\d+)/)?.[1] || "";
}

function chromeStorageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function chromeStorageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendExtractMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "ZOEY_EXTRACT_X_POST",
        options: {
          allowPinned: allowPinnedInput.checked
        }
      },
      (response) => {
        const error = chrome.runtime.lastError;

        if (error) {
          reject(error);
          return;
        }

        resolve(response);
      }
    );
  });
}

async function extractCurrentPost() {
  const tab = await getActiveTab();

  if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
    throw new Error("请在 x.com 或 twitter.com 的帖子或主页使用。");
  }

  try {
    return await sendExtractMessage(tab.id);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return sendExtractMessage(tab.id);
  }
}

function getModeMessage(extraction) {
  if (!extraction?.ok) {
    return "未识别到正文";
  }

  if (extraction.mode === "profile_latest") {
    return "主页最新帖子识别成功";
  }

  if (extraction.mode === "selection" || extraction.used_selection) {
    return "已使用选中文字";
  }

  return "单条帖子识别成功";
}

function fillForm(extraction) {
  currentExtraction = extraction;
  const content = extraction?.content || "";
  contentInput.value = content;
  sourceUrlInput.value = extraction?.source_url || "";
  publishedAtInput.value = toDatetimeLocal(extraction?.published_at ? new Date(extraction.published_at) : new Date());

  if (content) {
    titleInput.value = makeTitle(content);
    tagsInput.value = inferTags(content).join(", ");
  }

  setMeta([
    extraction?.username ? `@${extraction.username}` : "",
    extraction?.published_at ? new Date(extraction.published_at).toLocaleString() : "",
    extraction?.mode === "profile_latest" && !allowPinnedInput.checked ? "默认跳过置顶帖" : "",
    extraction?.isPinned ? "置顶帖" : "",
    extraction?.isReply ? "可能是回复" : "",
    extraction?.warnings?.join("；") || ""
  ]);
}

async function restoreSettings() {
  const settings = await chromeStorageGet(storageKeys);
  endpointInput.value = settings.endpoint || "";
  importTokenInput.value = settings.importToken || "";
}

async function refreshExtraction() {
  setStatus("正在读取当前页面…");
  setMeta([]);

  try {
    const extraction = await extractCurrentPost();
    fillForm(extraction);

    if (!extraction?.ok) {
      setStatus(extraction?.error || "请打开单条帖子页面或选中正文后再保存。", "error");
      return;
    }

    const warningText = extraction.warnings?.length ? `；${extraction.warnings.join("；")}` : "";
    setStatus(`${getModeMessage(extraction)}，请确认后保存${warningText}`, "success");
  } catch (error) {
    setStatus(error.message || "读取当前页面失败。", "error");
    setMeta([]);
  }
}

async function initPopup() {
  await restoreSettings();
  await refreshExtraction();
}

allowPinnedInput.addEventListener("change", refreshExtraction);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const endpoint = endpointInput.value.trim();
  const importToken = importTokenInput.value.trim();
  const content = contentInput.value.trim();

  if (!endpoint || !importToken) {
    setStatus("请先填写 Import Function URL 和 Personal Import Token。", "error");
    return;
  }

  if (!content) {
    setStatus("正文不能为空。", "error");
    return;
  }

  await chromeStorageSet({ endpoint, importToken });

  const sourceUrl = sourceUrlInput.value.trim() || currentExtraction?.source_url || "";
  const publishedAt = publishedAtInput.value ? new Date(publishedAtInput.value).toISOString() : new Date().toISOString();
  const tweetId = currentExtraction?.tweet_id || extractTweetId(sourceUrl);
  const tags = parseTags(tagsInput.value);
  const payload = {
    content,
    title: titleInput.value.trim() || makeTitle(content),
    source_url: sourceUrl,
    external_id: tweetId,
    published_at: publishedAt,
    tags,
    is_published: isPublishedInput.checked,
    raw_source: {
      provider: "x",
      mode: currentExtraction?.mode || "manual",
      username: currentExtraction?.username || "",
      tweet_id: tweetId,
      media_urls: currentExtraction?.media_urls || [],
      captured_at: new Date().toISOString(),
      used_selection: Boolean(currentExtraction?.used_selection),
      warnings: currentExtraction?.warnings || [],
      isPinned: Boolean(currentExtraction?.isPinned),
      isReply: Boolean(currentExtraction?.isReply),
      isRepost: Boolean(currentExtraction?.isRepost),
      excerpt: makeExcerpt(content)
    }
  };

  try {
    saveButton.disabled = true;
    setStatus("正在保存到碎碎念…");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zoey-import-token": importToken
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === "error") {
      throw new Error(data.error || `保存失败：${response.status}`);
    }

    if (data.status === "duplicate") {
      setStatus(data.message || "这条内容已经导入过。", "success");
      return;
    }

    setStatus("已保存到碎碎念。", "success");
  } catch (error) {
    setStatus(error.message || "保存失败。", "error");
  } finally {
    saveButton.disabled = false;
  }
});

initPopup();
