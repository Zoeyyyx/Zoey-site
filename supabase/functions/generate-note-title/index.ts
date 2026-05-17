import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const DEFAULT_API_URL = "https://models.sjtu.edu.cn/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function cleanTitle(value = "") {
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("SJTU_MODELS_API_KEY") || "";
  const apiUrl = Deno.env.get("DEEPSEEK_API_BASE_URL") || Deno.env.get("SJTU_MODELS_API_URL") || DEFAULT_API_URL;
  const defaultModel = Deno.env.get("DEEPSEEK_TITLE_MODEL") || DEFAULT_MODEL;
  let supabaseUrl = "";
  let anonKey = "";

  try {
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }

  if (!(await requireAdmin(request, supabaseUrl, anonKey))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (!apiKey) {
    return jsonResponse({ error: "Missing DEEPSEEK_API_KEY Supabase secret" }, 500);
  }

  let payload: { content?: string; model?: string };

  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const content = String(payload.content || "").trim().slice(0, 1000);
  const model = String(payload.model || defaultModel || DEFAULT_MODEL).trim();

  if (!content) {
    return jsonResponse({ title: "" });
  }

  const upstreamResponse = await fetch(apiUrl, {
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
          content: "给碎碎念取标题。标题要像本人随手写下的小题目，不要像 AI 总结、新闻标题、作文题或鸡汤句。克制，突出核心意象，不直述正文，追求自然。像诗人和哲学家理解文本内容，只输出标题。"
        },
        {
          role: "user",
          content: `给下面这条碎碎念拟一个 4 到 10 个汉字的中文标题。不要加标点，不要用“关于/一种/那些/思考/记录/随笔/碎片”等空泛词：\n\n${content}`
        }
      ],
      temperature: 0.72,
      max_tokens: 32
    })
  });

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();
    return jsonResponse(
      {
        error: "Title generation failed",
        status: upstreamResponse.status,
        detail: errorText.slice(0, 240)
      },
      502
    );
  }

  const data = await upstreamResponse.json();
  const title = cleanTitle(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.title || "");

  return jsonResponse({ title, model });
});
