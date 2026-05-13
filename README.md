# Zoey Site

Zoey Site 是一个仍可直接部署在 GitHub Pages 的静态前端站点，内容数据与后台管理依赖 Supabase。

当前目标是两件事同时成立：
- 现在继续以 `GitHub Pages + Supabase` 正常运行
- 未来迁移到自定义域名或正式服务器时，不需要推翻目录和前端结构

## 当前结构

```text
/admin
/archive
/assets
  /audio
  /brand
  /fonts
  /images
/css
/js
  /admin
  /components
  /lib
  /pages
  /services
/scripts
/supabase
```

补充说明：
- `images/` 和 `audio/` 目前仍然保留，主要是为了兼容现有文章资源、本地历史数据和迁移脚本
- `archive/` 用于存放旧版本实现、临时稿和暂不删除的历史文件
- `assets/` 是未来更标准的静态资源收口方向

## 本地开发

1. 复制 `.env.example` 为 `.env`
2. 填入 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`
3. 生成前端公开配置：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-public-config.ps1
```

4. 启动静态服务：

```powershell
python -m http.server 8080
```

5. 打开：
- `http://localhost:8080/index.html`
- `http://localhost:8080/admin/login.html`

## 路径与部署约定

- 公开页面继续优先使用相对路径，保持 GitHub Pages 兼容
- 运行时公开配置在 `js/lib/runtime-config.js`
- 可选站点基路径配置为 `SITE_BASE_PATH`
- 前台导航会读取运行时配置，但会优先保留已有相对路径写法，避免破坏文章页和子目录页

## Supabase 约定

- 前端只使用 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
- `service_role` 只允许出现在本地 `.env`、迁移脚本或受控服务端环境中
- 不要把 `service_role` 写进 `js/lib/runtime-config.js`

## Edge 扩展手动保存 X posts

- 扩展目录：`browser-extension/`
- Edge Function：`supabase/functions/import-x-manual/index.ts`
- 数据落点：复用 `public.notes`，用 `source_type='x_manual'` 和 `external_id` 去重
- 不使用 X API、不需要 `X_BEARER_TOKEN`、不自动滚动、不批量抓取
- 服务端环境变量：`X_MANUAL_IMPORT_TOKEN`、`SUPABASE_SERVICE_ROLE_KEY`
- 扩展内只保存个人导入 token 和函数 URL，不保存 `service_role`
- Obsidian 单向导出：`node scripts/export-x-posts-to-obsidian.js`，只导出 `source_type='x_manual'`
- 当前站点是静态前端，因此采用个人导入 token 方案；部署 Edge Function 后，把函数 URL 和 `X_MANUAL_IMPORT_TOKEN` 填进扩展 popup
- 如果 Edge Function 使用自定义域名，需要把该域名加入 `browser-extension/manifest.json` 的 `host_permissions`

Edge 本地安装：

1. 打开 Edge，访问 `edge://extensions`
2. 打开“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择 `browser-extension/` 目录
5. 打开 `x.com` 的某条帖子
6. 选中帖子正文，点击扩展
7. 在 popup 中填写 `Import Function URL` 和 `Personal Import Token`
8. 确认内容后保存
9. 回到 `notes.html` 检查碎碎念三视图

## 文档

- 部署说明：`DEPLOYMENT.md`
- Supabase 接入：`SUPABASE_SETUP.md`
- 内容迁移：`MIGRATION.md`
