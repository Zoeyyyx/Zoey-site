# Zoey Site Supabase 配置说明

这次重构后的站点采用“静态前端 + Supabase Auth/Database/Storage”的方式工作。

前端公开站点只读取已发布内容。

后台管理页只使用 `anon key + 登录态 + RLS`，不会在前端暴露 `service_role key`。

## 1. 创建 Supabase 项目

1. 在 Supabase 控制台创建一个新项目。
2. 记录以下两个值：
   - `Project URL`
   - `anon / publishable key`

## 2. 配置本地环境变量

1. 复制项目根目录下的 `.env.example` 为 `.env`。
2. 填入你自己的值：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

3. 在项目根目录执行：

```powershell
.\scripts\sync-public-config.ps1
```

这一步会把 `.env` 里的公开配置同步到 `js/lib/runtime-config.js`，供浏览器端使用。

建议通过本地静态服务器访问这个项目，例如 VS Code Live Server、`python -m http.server` 或你常用的前端预览方式；不要直接双击 HTML 走 `file://`，否则登录跳转和浏览器模块加载更容易出问题。

## 3. 创建数据库表和 Bucket

1. 打开 Supabase 控制台的 SQL Editor。
2. 运行 [`supabase/schema.sql`](/c:/A_projects/260413_ZoeySite/supabase/schema.sql)。

这个文件会创建：

- `admin_users`
- `notes`
- `posts`
- `gallery_items`
- `music_items`
- `site_settings`

同时还会创建这 3 个 public bucket：

- `images`
- `covers`
- `audio`

## 4. 启用 RLS 和策略

1. 继续在 SQL Editor 中运行 [`supabase/policies.sql`](/c:/A_projects/260413_ZoeySite/supabase/policies.sql)。

这些策略的原则是：

- 公开前台只能读取 `is_published = true` 的内容
- 登录后的管理员可以读取全部内容
- 只有管理员可以新增 / 编辑 / 删除内容
- 只有管理员可以上传、更新、删除 `images / covers / audio` 里的文件

## 5. 创建管理员账号

1. 打开 Supabase 控制台的 `Authentication > Users`。
2. 创建一个邮箱密码账号，作为唯一管理员。
3. 创建完成后，在 SQL Editor 里执行下面的语句，把这个账号登记到 `admin_users` 表：

```sql
insert into public.admin_users (user_id, email)
select id, email
from auth.users
where email = '你的管理员邮箱@example.com'
on conflict (user_id) do nothing;
```

只有被写入 `admin_users` 的账号，才能登录后台并拥有写权限。

## 6. 可选初始化站点设置

如果你想预留首页或页脚文案，可以向 `site_settings` 写入 JSON：

```sql
insert into public.site_settings (setting_key, value)
values
  ('home_hero', '{"title":"Zoey，你在这里做甚？","intro":"慢慢整理，慢慢继续。"}'::jsonb)
on conflict (setting_key) do update
set value = excluded.value;
```

当前代码已经预留了 `site_settings` 表，后续可以继续接首页简介、联系方式、页脚等。

## 7. 后台入口

完成以上配置后，直接打开：

- [`admin/login.html`](/c:/A_projects/260413_ZoeySite/admin/login.html)

登录成功后可以进入：

- [`admin/index.html`](/c:/A_projects/260413_ZoeySite/admin/index.html)
- [`admin/notes.html`](/c:/A_projects/260413_ZoeySite/admin/notes.html)
- [`admin/posts.html`](/c:/A_projects/260413_ZoeySite/admin/posts.html)
- [`admin/gallery.html`](/c:/A_projects/260413_ZoeySite/admin/gallery.html)
- [`admin/music.html`](/c:/A_projects/260413_ZoeySite/admin/music.html)

## 8. 当前内容模型

### `notes`

- `id`
- `created_at`
- `updated_at`
- `publish_date`
- `title`
- `content`
- `tags`
- `mood`
- `is_published`
- `order_index`

### `posts`

- `id`
- `slug`
- `created_at`
- `updated_at`
- `publish_date`
- `title`
- `summary`
- `category`
- `cover_image_url`
- `content_html`
- `is_published`
- `featured`

### `gallery_items`

- `id`
- `created_at`
- `updated_at`
- `publish_date`
- `title`
- `category`
- `image_url`
- `thumbnail_url`
- `description`
- `is_published`
- `sort_order`

### `music_items`

- `id`
- `created_at`
- `updated_at`
- `publish_date`
- `title`
- `artist`
- `cover_image_url`
- `audio_url`
- `description`
- `lyrics_or_notes`
- `is_published`
- `sort_order`

### `site_settings`

- `setting_key`
- `value`
- `created_at`
- `updated_at`

## 9. 文件上传说明

后台页面的上传逻辑已经从表单写入逻辑里抽离到：

- [`storage.js`](/c:/A_projects/260413_ZoeySite/js/services/storage.js)

当前约定：

- 文章封面上传到 `covers`
- 视觉作品上传到 `images`
- 音乐封面上传到 `covers`
- 音频上传到 `audio`

上传后会自动拿到 public URL，并写回对应数据表。

## 10. 如果页面读不到数据

优先检查这几项：

1. `js/lib/runtime-config.js` 是否已经由 `.env` 同步生成
2. `schema.sql` 是否已执行
3. `policies.sql` 是否已执行
4. 管理员账号是否已写入 `admin_users`
5. bucket 名称是否与代码一致：`images / covers / audio`
