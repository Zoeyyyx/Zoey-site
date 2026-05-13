#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const env = loadEnv(path.join(ROOT, ".env"));
const args = new Set(process.argv.slice(2));

main().catch((error) => {
  console.error(`[export-x-posts-to-obsidian] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const vaultPath = requireEnv("OBSIDIAN_VAULT_PATH");
  const dryRun = args.has("--dry-run");
  const notes = await fetchXNotes({ supabaseUrl, serviceRoleKey });
  const summary = {
    fetched: notes.length,
    written: 0,
    skipped: 0
  };

  for (const note of notes) {
    const date = parseDate(note.publish_date);
    const fileId = note.external_id || note.id;
    const targetDir = path.join(
      vaultPath,
      "Fragments",
      "X",
      String(date.getFullYear()),
      padNumber(date.getMonth() + 1)
    );
    const targetPath = path.join(targetDir, `x-${sanitizeFileName(fileId)}.md`);

    if (fs.existsSync(targetPath)) {
      summary.skipped += 1;
      continue;
    }

    const markdown = renderMarkdown(note, date);

    if (!dryRun) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(targetPath, markdown, "utf8");
    }

    summary.written += 1;
    console.log(`${dryRun ? "[dry-run] " : ""}wrote ${path.relative(vaultPath, targetPath)}`);
  }

  console.log(
    `[export-x-posts-to-obsidian] fetched=${summary.fetched} written=${summary.written} skipped=${summary.skipped}`
  );
}

function loadEnv(filePath) {
  const result = { ...process.env };

  if (!fs.existsSync(filePath)) {
    return result;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function fetchXNotes({ supabaseUrl, serviceRoleKey }) {
  const url = new URL("/rest/v1/notes", supabaseUrl);
  url.searchParams.set(
    "select",
    "id,publish_date,title,content,tags,source_type,external_id,source_url,raw_source,is_published"
  );
  url.searchParams.set("source_type", "eq.x_manual");
  url.searchParams.set("is_published", "eq.true");
  url.searchParams.set("external_id", "not.is.null");
  url.searchParams.set("order", "publish_date.asc");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase query failed: ${response.status} ${body}`);
  }

  return response.json();
}

function parseDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function formatTime(date) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function sanitizeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function yamlArray(values) {
  return `[${values.map((value) => yamlString(value)).join(", ")}]`;
}

function normalizeTags(note) {
  const tags = Array.isArray(note.tags) && note.tags.length ? note.tags : ["随笔"];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

function renderMarkdown(note, date) {
  const tags = normalizeTags(note);
  const title = note.title || "未命名片段";
  const sourceUrl = note.source_url || "";
  const links = ["X碎碎念", ...tags].map((tag) => `[[${tag}]]`).join(" ");

  return `---
title: ${yamlString(title)}
date: ${formatDate(date)}
time: ${formatTime(date)}
source: x_manual
source_url: ${yamlString(sourceUrl)}
tags: ${yamlArray(tags)}
publish: true
---

${String(note.content || "").trim() || "（空内容）"}

来源：X

关联：${links}
`;
}
