import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const NOTES_TABLE = "notes";
const DEFAULT_API_URL = "https://models.sjtu.edu.cn/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 120;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function stripUrls(value: string) {
  return value.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function temporaryTitle(content: string) {
  return stripUrls(content).slice(0, 10).trim() || "未命名碎片";
}

function cleanGeneratedTitle(value = "") {
  return String(value)
    .replace(/^["“”'《「『]+|["“”'》」』]+$/g, "")
    .replace(/^标题[:：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10);
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

async function requireAdmin(request: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = request.headers.get("Authorization") || "";

  if (!authHeader) {
    return false;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData.user?.id) {
    return false;
  }

  const { data, error } = await userClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return !error && Boolean(data?.user_id);
}

async function generateSmartTitle(content: string, model: string) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("SJTU_MODELS_API_KEY") || "";

  if (!apiKey) {
    return "";
  }

  const apiUrl = Deno.env.get("DEEPSEEK_API_BASE_URL") || Deno.env.get("SJTU_MODELS_API_URL") || DEFAULT_API_URL;
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
          content: `请给下面这条碎碎念拟一个 4 到 10 个汉字的中文标题。不要加标点，不要用“关于/一种/那些/思考/记录/随笔/碎片”等空泛词：\n\n${stripUrls(content).slice(0, 1000)}`
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let supabaseUrl = "";
  let anonKey = "";
  let serviceRoleKey = "";

  try {
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }

  if (!(await requireAdmin(request, supabaseUrl, anonKey))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit || DEFAULT_LIMIT)));
  const model = String(body.model || Deno.env.get("DEEPSEEK_TITLE_MODEL") || DEFAULT_MODEL);
  const dryRun = Boolean(body.dry_run);
  const force = Boolean(body.force);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  let query = serviceClient
    .from(NOTES_TABLE)
    .select("id, content, title")
    .limit(limit);

  if (!force) {
    query = query.or("title.is.null,title.eq.");
  }

  const { data: notes, error } = await query;

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const results = [];

  for (const note of notes || []) {
    const fallbackTitle = temporaryTitle(note.content || "");
    const smartTitle = await generateSmartTitle(note.content || "", model);
    const title = smartTitle || fallbackTitle;

    if (!dryRun) {
      const { error: updateError } = await serviceClient.from(NOTES_TABLE).update({ title }).eq("id", note.id);

      if (updateError) {
        results.push({ id: note.id, status: "error", error: updateError.message });
        continue;
      }
    }

    results.push({
      id: note.id,
      status: dryRun ? "preview" : "updated",
      title,
      source: smartTitle ? "deepseek" : "temporary"
    });
  }

  return jsonResponse({
    status: "ok",
    dry_run: dryRun,
    force,
    count: results.length,
    results
  });
});
