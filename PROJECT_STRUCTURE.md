# Zoey Site Project Structure

This project is a static front-end site that can run on GitHub Pages today. Supabase is used from browser-side service modules, so the same layout can later move behind a server without changing page ownership.

## Directory Map

- `/`
  Public page entries. Main pages such as `index.html`, `notes.html`, `writing.html`, `gallery.html`, `music.html`, `tools.html`, `doremi.html`, `doremi-app.html`, and `post.html` live here so GitHub Pages can serve them directly.
- `/admin`
  Browser-based admin pages. Each page calls a matching module under `js/admin/`.
- `/articles`
  Static long-form article pages that are not rendered through `post.html`.
- `/css`
  Stylesheets. `style.css` is the only HTML-facing CSS entry and imports the real responsibility files.
- `/css/pages`
  Page-specific CSS for non-home public pages.
- `/js/components`
  Shared UI components: global header, sidebar normalization, admin navigation.
- `/js/pages`
  One file per public page entry.
- `/js/admin`
  Admin page controllers and admin shared helpers.
- `/js/services`
  Supabase data/storage access. Page and admin modules should call these instead of talking to Supabase directly.
- `/js/lib`
  Runtime config, Supabase client creation, auth, site path helpers, formatting utilities.
- `/assets`
  Site-level assets by type: fonts, images, audio, brand.
- `/images`
  Content images by use: article images and gallery images.
- `/supabase`
  Database schema and policies.
- `/scripts`
  Local maintenance and migration scripts.
- `/archive`
  Old, duplicate, temporary, or uncertain files kept out of the active runtime.

## Core Files

- `index.html` -> site home.
- `notes.html` -> notes timeline/graph page.
- `writing.html` -> writing archive page.
- `post.html` -> dynamic Supabase post detail page.
- `gallery.html` -> visual gallery page.
- `music.html` -> music archive page.
- `tools.html` -> tools landing page.
- `doremi.html` -> Doremi tool hub.
- `doremi-app.html` -> Doremi React app shell.
- `admin/index.html` -> admin dashboard and home hero upload.
- `admin/login.html` -> admin login.
- `admin/posts.html`, `admin/notes.html`, `admin/gallery.html`, `admin/music.html` -> content editors.

## Page Entrypoints

- `index.html` loads `js/main.js` and `js/pages/home.js`.
- `notes.html` loads `js/main.js` and `js/pages/notes.js`.
- `writing.html` loads `js/main.js` and `js/pages/writing.js`.
- `post.html` loads `js/main.js` and `js/pages/post.js`.
- `gallery.html` loads `js/main.js` and `js/pages/gallery.js`.
- `music.html` loads `js/main.js` and `js/pages/music.js`.
- `tools.html` loads `js/main.js`.
- `doremi.html` loads `js/main.js`.
- `doremi-app.html` loads `js/main.js` plus its embedded React/Babel app.
- Admin pages load one matching `js/admin/*.js` controller.

## CSS Dependency

All HTML files should link only `css/style.css`. That file is the stylesheet manifest:

1. `base.css` - browser reset, media defaults, shared utility primitives.
2. `shared.css` - tokens, fonts, global typography, page background defaults.
3. `layout.css` - page shells, subpage grid, left/right columns, responsive layout.
4. `sidebar.css` - sidebar rail presentation and sidebar actions.
5. `components.css` - shared cards, buttons, filters, small reusable UI surfaces.
6. `header.css` - global header and navigation.
7. `home.css` - home page and home hero only.
8. `pages/notes.css` - notes page only.
9. `pages/writing.css` - writing archive and article styling.
10. `pages/tools.css` - tools and Doremi styling.
11. `pages/gallery.css` - gallery/lightbox styling and shared late responsive rules from the old split.
12. `admin.css` - admin UI.
13. `theme.css` - final visual theme layer for the Midnight Radio palette, typography, paper texture, navigation, cards, buttons, and cross-page color overrides.

The legacy monolithic stylesheet is archived at `archive/css/style.legacy.css`.

## JS Call Graph

- `js/main.js` initializes shared UI:
  - `js/components/global-header.js`
  - `js/components/sidebar.js`
- `js/pages/*.js` own public page behavior and call services:
  - `home.js` -> notes, posts, gallery, music, site settings services.
  - `notes.js` -> notes service.
  - `writing.js` and `post.js` -> posts service.
  - `gallery.js` -> gallery service.
  - `music.js` -> music service.
- `js/admin/*.js` own admin forms and call services/storage/auth through:
  - `js/admin/shared.js`
  - `js/components/admin-nav.js`
  - `js/lib/auth.js`
  - `js/services/*.js`
- `js/services/*.js` are the only data/storage modules that import `js/lib/supabase-client.js`.

## Assets

- `assets/fonts/` stores global font files.
- `assets/images/home-hero.svg` is the default home hero image placeholder/fallback.
- `images/articles/` stores static article images.
- `images/gallery/` stores gallery items.
- `archive/assets/images/` stores old or uncertain image files.

## Adding A New Page

1. Add `new-page.html` at the project root for a public GitHub Pages route.
2. Link only `css/style.css`.
3. Add page-specific behavior in `js/pages/new-page.js`.
4. If the page needs CSS, add `css/pages/new-page.css` and import it from `css/style.css`.
5. Put reusable UI in `js/components/`.
6. Put Supabase reads/writes in `js/services/`.
7. Put content images under `images/<content-type>/` or site assets under `assets/<asset-type>/`.
8. If replacing old experiments, move uncertain files into `archive/` before deleting anything.
