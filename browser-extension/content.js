const RESERVED_PATHS = new Set([
  "compose",
  "explore",
  "home",
  "i",
  "messages",
  "notifications",
  "search",
  "settings"
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSelectedText() {
  return normalizeText(window.getSelection?.().toString() || "");
}

function parseStatusUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/^\/([^/?#]+)\/status\/(\d+)/);

    if (!match) {
      return null;
    }

    return {
      username: decodeURIComponent(match[1]),
      tweet_id: match[2],
      source_url: `https://x.com/${decodeURIComponent(match[1])}/status/${match[2]}`
    };
  } catch {
    return null;
  }
}

function getProfileUsername(url = window.location.href) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (!segments.length || RESERVED_PATHS.has(segments[0])) {
      return "";
    }

    if (segments.length === 1 || ["with_replies", "media"].includes(segments[1])) {
      return decodeURIComponent(segments[0]);
    }

    return "";
  } catch {
    return "";
  }
}

function isVisibleArticle(article) {
  const rect = article.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight * 1.5;
}

function getArticleText(article) {
  return normalizeText(article.querySelector('[data-testid="tweetText"]')?.innerText || "");
}

function getArticleStatus(article) {
  const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));

  for (const link of links) {
    const status = parseStatusUrl(link.getAttribute("href") || link.href);

    if (status) {
      return status;
    }
  }

  return null;
}

function getArticlePublishedAt(article) {
  return article.querySelector("time[datetime]")?.getAttribute("datetime") || "";
}

function getArticleMediaUrls(article) {
  return Array.from(article.querySelectorAll('img[src], video[poster]'))
    .map((element) => element.getAttribute("src") || element.getAttribute("poster") || "")
    .filter((url) => /^https?:\/\//.test(url))
    .filter((url) => !/profile_images|emoji|abs-0.twimg.com/.test(url));
}

function getArticleFlags(article) {
  const text = article.innerText || "";

  return {
    isPinned: /Pinned|已置顶|置顶/i.test(text),
    isReply: /Replying to|回复给/i.test(text),
    isRepost: /Reposted|转帖|转发/i.test(text)
  };
}

function buildCandidate(article) {
  const content = getArticleText(article);
  const status = getArticleStatus(article);
  const published_at = getArticlePublishedAt(article);

  if (!content || !status?.tweet_id || !published_at) {
    return null;
  }

  return {
    article,
    content,
    source_url: status.source_url,
    tweet_id: status.tweet_id,
    username: status.username,
    published_at,
    media_urls: getArticleMediaUrls(article),
    ...getArticleFlags(article)
  };
}

function selectionFallback(error, warnings = []) {
  const content = getSelectedText();

  if (!content) {
    return {
      ok: false,
      mode: "selection",
      source: "x",
      source_url: window.location.href,
      tweet_id: "",
      username: getProfileUsername() || parseStatusUrl(window.location.href)?.username || "",
      content: "",
      published_at: "",
      media_urls: [],
      used_selection: false,
      warnings,
      error: error || "请打开单条帖子页面或选中正文后再保存。"
    };
  }

  const status = parseStatusUrl(window.location.href);
  return {
    ok: true,
    mode: "selection",
    source: "x",
    source_url: status?.source_url || window.location.href,
    tweet_id: status?.tweet_id || "",
    username: status?.username || getProfileUsername() || "",
    content,
    published_at: new Date().toISOString(),
    media_urls: [],
    used_selection: true,
    warnings
  };
}

function extractCurrentXPost() {
  const status = parseStatusUrl(window.location.href);

  if (!status) {
    return selectionFallback("当前页面不是单条帖子链接。");
  }

  const selectedText = getSelectedText();
  const articles = Array.from(document.querySelectorAll("article")).filter(isVisibleArticle);
  const matchingArticle =
    articles.find((article) => article.querySelector(`a[href*="/status/${status.tweet_id}"]`)) ||
    articles[0];
  const candidate = matchingArticle ? buildCandidate(matchingArticle) : null;
  const content = selectedText || candidate?.content || "";

  if (!content) {
    return selectionFallback("请打开单条帖子页面或选中正文后再保存。");
  }

  return {
    ok: true,
    mode: selectedText ? "selection" : "status",
    source: "x",
    source_url: status.source_url,
    tweet_id: status.tweet_id,
    username: status.username,
    content,
    published_at: candidate?.published_at || new Date().toISOString(),
    media_urls: candidate?.media_urls || [],
    used_selection: Boolean(selectedText),
    warnings: [],
    isPinned: candidate?.isPinned || false,
    isReply: candidate?.isReply || false,
    isRepost: candidate?.isRepost || false
  };
}

function extractLatestPostFromProfile(options = {}) {
  const profileUsername = getProfileUsername();

  if (!profileUsername) {
    return selectionFallback("请打开自己的 X 主页、单条帖子页面，或选中正文后再保存。");
  }

  const warnings = [];
  const articles = Array.from(document.querySelectorAll("article")).filter(isVisibleArticle);
  const candidates = articles
    .map(buildCandidate)
    .filter(Boolean)
    .filter((candidate) => candidate.username.toLowerCase() === profileUsername.toLowerCase())
    .filter((candidate) => !candidate.isRepost)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const unpinnedCandidates = candidates.filter((candidate) => !candidate.isPinned);
  const selected = options.allowPinned ? candidates[0] : unpinnedCandidates[0];

  if (selected && !options.allowPinned && candidates[0]?.isPinned) {
    warnings.push("已跳过置顶帖。");
  }

  if (!selected && candidates.some((candidate) => candidate.isPinned)) {
    warnings.push("当前只识别到置顶帖。可勾选允许置顶帖，或打开具体帖子页面保存。");
  }

  if (!selected) {
    return selectionFallback("未识别到最新帖子，请进入单条帖子页面或选中正文后再保存。", warnings);
  }

  if (window.location.pathname.includes("/with_replies") || selected.isReply) {
    warnings.push("当前在回复页或识别结果可能是回复内容。");
  }

  return {
    ok: true,
    mode: "profile_latest",
    source: "x",
    source_url: selected.source_url,
    tweet_id: selected.tweet_id,
    username: selected.username,
    content: selected.content,
    published_at: selected.published_at,
    media_urls: selected.media_urls,
    used_selection: false,
    warnings,
    isPinned: selected.isPinned,
    isReply: selected.isReply,
    isRepost: selected.isRepost
  };
}

function extractXContent(options = {}) {
  if (/\/status\/\d+/.test(window.location.href)) {
    return extractCurrentXPost();
  }

  if (getProfileUsername()) {
    return extractLatestPostFromProfile(options);
  }

  return selectionFallback("请打开单条帖子页面或选中正文后再保存。");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ZOEY_EXTRACT_X_POST") {
    return false;
  }

  sendResponse(extractXContent(message.options || {}));
  return false;
});
