import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ImportPayload = {
  content?: string;
  title?: string;
  source_url?: string;
  external_id?: string;
  published_at?: string;
  tags?: string[];
  is_published?: boolean;
};

const NOTES_TABLE = "notes";
const DEFAULT_TITLE_API_URL = "https://models.sjtu.edu.cn/api/v1/chat/completions";
const DEFAULT_TITLE_MODEL = "deepseek-chat";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-token, x-zoey-import-token",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function removeUrls(value: string) {
  return value.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function getTitle(content: string, providedTitle = "") {
  const cleanedTitle = removeUrls(providedTitle);

  if (cleanedTitle) {
    return cleanedTitle.slice(0, 24).trim();
  }

  const firstLine = removeUrls(content).split(/\n/).find(Boolean) || "";
  return firstLine.slice(0, 24).trim() || "未命名片段";
}

function cleanGeneratedTitle(value = "") {
  return String(value)
    .replace(/^["“”'《「『]+|["“”'》」』]+$/g, "")
    .replace(/^标题[:：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10);
}

async function generateSmartTitle(content: string) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("SJTU_MODELS_API_KEY") || "";

  if (!apiKey) {
    return "";
  }

  const apiUrl = Deno.env.get("DEEPSEEK_API_BASE_URL") || Deno.env.get("SJTU_MODELS_API_URL") || DEFAULT_TITLE_API_URL;
  const model = Deno.env.get("DEEPSEEK_TITLE_MODEL") || DEFAULT_TITLE_MODEL;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你在帮 Zoey 给私人碎碎念取标题。标题要像本人随手写下的小题目，不要像 AI 总结、新闻标题、作文题或鸡汤句。克制、具体、轻一点，可以有一点诗意。只输出标题。"
        },
        {
          role: "user",
          content: `请给下面这条碎碎念拟一个 4 到 10 个汉字的中文标题。不要加标点，不要用“关于/一种/那些/思考/记录/随笔/碎片”等空泛词：\n\n${removeUrls(content).slice(0, 1000)}`
        }
      ],
      temperature: 0.72,
      max_tokens: 32
    })
  });

  if (!response.ok) {
    return "";
  }

  const data = await response.json();
  return cleanGeneratedTitle(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.title || "");
}

async function resolveTitle(content: string, providedTitle = "") {
  const fallbackTitle = getTitle(content, providedTitle);

  if (removeUrls(providedTitle)) {
    return fallbackTitle;
  }

  return (await generateSmartTitle(content)) || fallbackTitle;
}

function getExcerpt(content: string) {
  const cleaned = removeUrls(content).replace(/\n{2,}/g, "\n");
  return cleaned.length > 120 ? `${cleaned.slice(0, 120).trim()}…` : cleaned;
}

function getLength(content: string) {
  const length = removeUrls(content).length;

  if (length <= 80) {
    return "short";
  }

  if (length <= 180) {
    return "medium";
  }

  return "long";
}

function inferTags(content: string) {
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

function normalizeTags(tags: unknown, content: string) {
  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => String(tag).trim()).filter(Boolean);

    if (normalized.length) {
      return [...new Set(normalized)];
    }
  }

  return inferTags(content);
}

function extractStatusId(sourceUrl: string) {
  return sourceUrl.match(/\/status\/(\d+)/)?.[1] || "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ status: "error", error: "Use POST." }, 405);
  }

  let supabaseUrl = "";
  let serviceRoleKey = "";
  let expectedToken = "";

  try {
    supabaseUrl = requireEnv("SUPABASE_URL");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    expectedToken = Deno.env.get("X_MANUAL_IMPORT_TOKEN")?.trim() || "";

    if (!expectedToken) {
      throw new Error("Missing required environment variable: X_MANUAL_IMPORT_TOKEN");
    }
  } catch (error) {
    return jsonResponse({ status: "error", error: getErrorMessage(error) }, 500);
  }

  const incomingToken =
    req.headers.get("x-zoey-import-token") ||
    req.headers.get("x-import-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const actualToken = incomingToken?.trim();

  if (!actualToken || actualToken !== expectedToken) {
    return jsonResponse(
      {
        status: "error",
        error: "Unauthorized import token.",
        debug: {
          hasExpectedToken: Boolean(expectedToken),
          hasActualToken: Boolean(actualToken),
          expectedLength: expectedToken?.length ?? 0,
          actualLength: actualToken?.length ?? 0
        }
      },
      401
    );
  }

  let body: ImportPayload;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "error", error: "Invalid JSON body." }, 400);
  }

  const content = normalizeText(body.content);

  if (!content) {
    return jsonResponse({ status: "error", error: "content is required." }, 400);
  }

  const sourceUrl = normalizeText(body.source_url);
  const externalId =
    normalizeText(body.external_id) ||
    extractStatusId(sourceUrl) ||
    `hash-${(await sha256(`${sourceUrl}\n${content}`)).slice(0, 24)}`;
  const publishedAt = body.published_at ? new Date(body.published_at) : new Date();

  if (Number.isNaN(publishedAt.getTime())) {
    return jsonResponse({ status: "error", error: "published_at is invalid." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: existing, error: existingError } = await supabase
    .from(NOTES_TABLE)
    .select("id")
    .eq("source_type", "x_manual")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existingError) {
    return jsonResponse({ status: "error", error: existingError.message }, 500);
  }

  if (existing?.id) {
    return jsonResponse({
      status: "duplicate",
      message: "这条内容已经导入过。",
      id: existing.id
    });
  }

  const tags = normalizeTags(body.tags, content);
  const title = await resolveTitle(content, body.title);
  const row = {
    publish_date: publishedAt.toISOString(),
    title,
    content,
    tags,
    mood: null,
    is_published: body.is_published !== false,
    order_index: null,
    source_type: "x_manual",
    external_id: externalId,
    source_url: sourceUrl || null,
    raw_source: {
      provider: "x",
      import_method: "edge_extension_manual",
      excerpt: getExcerpt(content),
      length: getLength(content),
      imported_at: new Date().toISOString()
    }
  };

  const { data, error } = await supabase.from(NOTES_TABLE).insert(row).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ status: "duplicate", message: "这条内容已经导入过。" });
    }

    return jsonResponse({ status: "error", error: error.message }, 500);
  }

  return jsonResponse({
    status: "ok",
    id: data.id,
    external_id: externalId
  });
});
