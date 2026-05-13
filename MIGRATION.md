# 旧内容迁移到 Supabase

这套迁移方案的目标很直接：把 Zoey-site 旧站里还散落在 `html / txt / 本地图片 / 本地音频 / 本地数据文件` 里的内容，一次性导入到 Supabase，而不是手工逐条复制。

当前脚本文件：

- [scripts/migrate-content.js](/C:/A_projects/260413_ZoeySite/scripts/migrate-content.js)

## 迁移范围

脚本会扫描这些来源：

- `notes.html`
- `writing.html`
- `gallery.html`
- `music.html`
- `js/notes-data.js`
- `js/writing-data.js`
- `js/gallery-data.js`
- `articles/*.html`
- `*.txt`
- `images/**`
- `audio/**`

目前这版脚本优先使用结构化程度最高的旧来源：

- `js/notes-data.js` -> `notes`
- `js/writing-data.js` + `articles/*.html` -> `posts`
- `js/gallery-data.js` + `images/gallery/**` -> `gallery_items`
- `audio/**` + 同名 `.txt` 侧边文件 -> `music_items`

`notes.html / writing.html / gallery.html / music.html` 这几个页面会被记录为扫描来源，用于确认旧页面仍然存在；真正导入时，优先采用更稳定的 JS 数据文件和正文 HTML 文件，避免从已经改造过的新页面里误抓空结构。

## 迁移前准备

### 1. 确认数据库结构已经创建

确保你已经在 Supabase 执行过：

- [supabase/schema.sql](/C:/A_projects/260413_ZoeySite/supabase/schema.sql)
- [supabase/policies.sql](/C:/A_projects/260413_ZoeySite/supabase/policies.sql)

### 2. 准备环境变量

`.env` 里至少需要：

```env
SUPABASE_URL=你的项目 URL
SUPABASE_ANON_KEY=前台匿名 key
SUPABASE_SERVICE_ROLE_KEY=仅本地迁移时临时使用
```

说明：

- `SUPABASE_ANON_KEY` 给前端继续用。
- `SUPABASE_SERVICE_ROLE_KEY` 只给本地迁移脚本使用，不要写进前端代码，也不要提交到公开仓库。

## 迁移命令

### 1. 先做 Dry Run

先只扫描和生成预览，不写入数据库：

```powershell
node scripts/migrate-content.js
```

运行后会生成：

- `scripts/migration-preview.json`

你可以先看这个文件，确认：

- 导入条数是否正常
- 标题 / slug / 日期是否合理
- 文章正文是否提取成功
- 图片和音频路径是否正确

### 2. 正式写入数据库

确认预览没问题后：

```powershell
node scripts/migrate-content.js --import
```

这会把数据直接 upsert 到这些表：

- `notes`
- `posts`
- `gallery_items`
- `music_items`

脚本会为每条旧内容生成稳定 `id`，所以重复执行时会尽量走更新而不是无限重复插入。

### 3. 连媒体一起上传到 Supabase Storage

如果你希望旧图片 / 音频也一起搬到 Storage，而不是继续保留本地路径：

```powershell
node scripts/migrate-content.js --import --upload-storage
```

对应规则：

- 文章封面 -> `covers`
- 文章正文内图片 -> `images`
- 视觉作品图片 -> `images`
- 音频封面 -> `covers`
- 音频文件 -> `audio`

上传后，脚本会自动把数据库里的 URL 换成 Supabase Storage 公共地址。

## 字段映射说明

### `notes`

来源：

- `js/notes-data.js`

映射：

- `id`：由旧 note id 稳定生成
- `publish_date`：来自 `datetime`
- `title`：暂留空
- `content`：来自 `content`
- `tags`：来自 `tags`
- `is_published`：统一导入为 `true`

### `posts`

来源：

- `js/writing-data.js`
- `articles/*.html`

映射：

- `slug`：优先由旧文章文件名生成
- `title`：优先旧数据里的标题
- `summary`：优先旧摘要，没有就从正文前部截取
- `category`：来自旧分类
- `cover_image_url`：优先旧封面路径
- `content_html`：提取自 `article-body`
- `publish_date`：来自旧日期
- `featured`：来自旧字段
- `is_published`：统一导入为 `true`

### `gallery_items`

来源：

- `js/gallery-data.js`
- `images/gallery/**`

映射：

- `title`
- `category`
- `image_url`
- `thumbnail_url`
- `description`
- `sort_order`
- `publish_date`
- `is_published`

分类映射：

- `drawing` -> `画画`
- `photo` -> `摄影`
- 其他 -> `杂项`

### `music_items`

来源：

- `audio/**`
- 同名 `.txt` 文件

映射：

- `title`：由文件名推导
- `artist`：默认 `Zoey`
- `audio_url`：保留本地路径，或上传到 `audio`
- `cover_image_url`：尝试匹配同名封面
- `description`：优先同名 `.txt` 内容摘要
- `lyrics_or_notes`：完整 `.txt` 内容
- `publish_date`：优先从文件名推导，否则用文件修改时间
- `is_published`：统一导入为 `true`

## 当前项目里的已知情况

这次扫描下来的旧内容特征大致是：

- `notes`：主要来自 `js/notes-data.js`
- `posts`：可从 `js/writing-data.js` 和 `articles/*.html` 导入
- `gallery_items`：已有本地图片和数据清单
- `music_items`：当前 `audio/` 目录里没有实际音频文件，导入时大概率为空

这意味着第一轮迁移最容易先完整跑通的是：

1. `notes`
2. `posts`
3. `gallery_items`

`music_items` 需要你把旧音频文件放回 `audio/` 目录，或者后续再补一次导入。

## 推荐迁移顺序

1. 跑 `node scripts/migrate-content.js`
2. 检查 `scripts/migration-preview.json`
3. 跑 `node scripts/migrate-content.js --import`
4. 前台确认旧内容已经能显示
5. 如果需要统一媒体地址，再跑 `node scripts/migrate-content.js --import --upload-storage`

## 注意事项

- 迁移脚本是给本地运行的，不应该部署到前端。
- `SUPABASE_SERVICE_ROLE_KEY` 只用于这类一次性后台迁移。
- 文章正文内图片在开启 `--upload-storage` 时也会一起替换 URL。
- 如果某篇旧文章没有对应正文文件，脚本会先导入摘要，方便你后续在后台继续补。
- 如果你重复执行迁移，脚本会尽量用稳定 `id` 做 upsert，减少重复数据。

## 迁移后建议

迁移成功后，建议优先做两件事：

1. 在后台打开几篇旧文章，确认正文、封面、日期都正常。
2. 把确认无误的本地旧路径逐步切到 Storage，后续部署会更稳。
