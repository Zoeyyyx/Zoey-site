# Deployment

## 当前部署方式：GitHub Pages + Supabase

当前站点仍按静态站点方式部署：
- HTML / CSS / JS 由 GitHub Pages 托管
- 数据、登录、存储由 Supabase 提供

### 公开运行时配置

前端读取：
- `js/lib/runtime-config.js`

这个文件只允许包含：
- `SITE_BASE_PATH`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

不要放入：
- `SUPABASE_SERVICE_ROLE_KEY`

### 从 `.env` 同步公开配置

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-public-config.ps1
```

生成后请确认：
- `js/lib/runtime-config.js` 已更新
- 其中没有 `service_role` 密钥

## GitHub Pages 部署注意事项

1. 页面链接尽量保持相对路径
2. 不要把项目路径写死为 `/Zoey-site/`
3. 如果 Pages 部署在仓库子路径，可在 `.env` 中设置：

```env
SITE_BASE_PATH=Zoey-site
```

说明：
- 这个值不带首尾斜杠
- 当前导航组件会优先保留已有相对路径，所以旧页面不会因为这个配置立即失效
- 它主要用于后续把站点路径配置集中化，而不是强制把所有链接改成绝对路径

## 未来迁移到正式服务器时

### 需要保留的部分

- `admin/`、`js/`、`css/`、`supabase/`、`scripts/`
- Supabase 表结构、RLS、存储桶配置
- 当前前端页面结构与运行时配置方式

### 建议调整的部分

1. 把 `runtime-config.js` 改成由服务器模板、CI 或环境注入生成
2. 把历史本地资源逐步从 `images/`、`audio/` 收敛到 `assets/`
3. 若接入后端，再把迁移脚本和批量上传逻辑移到服务端任务
4. 统一处理缓存策略、图片压缩、音频分发和 CDN

### 迁移时通常只需要改这些配置

- 域名
- `SITE_BASE_PATH`
- Supabase 项目环境变量
- 静态资源托管位置

## 发布前检查

- 首页和子页面导航是否正常
- `admin/login.html` 是否可登录
- Supabase 数据读取是否正常
- 上传封面、文章、视觉、音乐是否正常
- `js/lib/runtime-config.js` 是否只包含公开配置
