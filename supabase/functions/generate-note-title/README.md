# generate-note-title

Generates short Chinese titles for untitled notes through the SJTU models API.

## Required Secret

Set the API key as a Supabase Edge Function secret:

```bash
supabase secrets set DEEPSEEK_API_KEY="your-api-key"
```

Optional overrides:

```bash
supabase secrets set DEEPSEEK_API_BASE_URL="https://models.sjtu.edu.cn/api/v1/chat/completions"
supabase secrets set DEEPSEEK_TITLE_MODEL="deepseek-chat"
```

Supported model names from the SJTU endpoint include:

- `deepseek-chat`
- `deepseek-v3.2`
- `minimax`
- `minimax-m2.5`
- `qwen3coder`
- `qwen3vl`

Deploy:

```bash
supabase functions deploy generate-note-title
supabase functions deploy backfill-note-titles
```

Usage:

- New notes saved from the admin UI call `generate-note-title` once when `title` is empty.
- X/manual imports generate the title inside `import-x-manual` before inserting.
- Existing untitled notes can be backfilled from the Notes admin page with "批量补标题", or by invoking `backfill-note-titles` as an authenticated admin.
