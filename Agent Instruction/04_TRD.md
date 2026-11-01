# 04_TRD — Technical Requirements (Locked Stack)

> Status: LOCKED v1.0. The agent MUST NOT add frameworks, plugins, build tools or libraries that are not listed here. If something seems missing, STOP and ask the owner.

## 1. Architecture Decision Summary (and why)

| Decision | Choice | Why |
|---|---|---|
| Theme type | **Classic PHP theme** (not block/FSE) | Source is Bootstrap HTML; template parts map 1:1; owner knows PHP/Bootstrap; no theme.json learning curve; lowest risk. |
| Code split | **Theme `toolnest`** (presentation) + **Plugin `toolnest-core`** (CPT, taxonomy, meta boxes, ads, search index, contact, tool modules) | Content/data must survive a theme switch; WordPress practice is "themes present, plugins store data". Theme must not fatal if the plugin is off. |
| Tool content model | Custom Post Type `tn_tool` + taxonomy `tn_tool_category` | Native admin UI, native sitemap/permalinks, zero extra plugins. |
| Custom fields | **Native meta boxes** (own small helper), JSON stored in post meta | No ACF/Carbon/Meta Box dependency (cost, lock-in, licence risk). |
| Tool logic | **Tool Modules**: self-contained folder per tool (`view.php` + `tool.js` + `tool.json`) | Moves existing tool JS with minimal change; loads assets only on that tool page. |
| Front-end | Vanilla JS (ES2018+, no bundler), Bootstrap 5.3.3, Bootstrap Icons 1.11.3 | Identical to static template; no build step; shared-hosting friendly. |
| Libraries | **Self-hosted vendor files**, pinned versions (§4) | No CDN outage/GDPR/privacy risk; consistent with "100% client-side" brand. |
| Authorization | WP roles/capabilities + nonces (no RLS) | WordPress/MySQL has no Row-Level Security; see 05_Schema §8. |

## 2. Locked Versions

### 2.1 Platform
| Component | Version / constraint |
|---|---|
| WordPress | **7.0.x** (latest 7.0 patch at project start; record exact in `docs/CHANGELOG`). Plugin/theme header `Requires at least: 6.6`, `Tested up to: 7.0`. |
| PHP | **Runtime target 8.3**; code must run on **≥ 8.1** (`Requires PHP: 8.1`). No PHP 8.2+ only syntax. |
| Database | MariaDB 10.11 LTS or MySQL 8.0+ (InnoDB, `utf8mb4`, collation `utf8mb4_unicode_520_ci`/WP default). |
| Web server | Apache (mod_rewrite) or LiteSpeed/Nginx with WP rewrites. HTTPS required. |
| Local dev | XAMPP (Windows) or LocalWP + **WP-CLI 2.x**. Debug: `WP_DEBUG`, `WP_DEBUG_LOG` on in dev only. |

### 2.2 Front-end vendor files (copied from the existing project, same versions)
| Library | Version | Used by |
|---|---|---|
| Bootstrap (CSS + bundle JS) | **5.3.3** | Global |
| Bootstrap Icons | **1.11.3** | Global |
| pdf-lib | **1.17.1** | pdf-merge-split, image-to-pdf, etc. |
| pdf.js (`pdf.min.js` + worker) | **3.11.174** | pdf-to-*, pdf-merge-split |
| JSZip | **3.10.1** | bulk-image-resizer, pdf-to-jpg, docx/xlsx builders |
| html2canvas | **1.4.1** | invoice, cv-maker, signature-maker |
| heic2any | **0.0.4** | image-format-converter |
| docx-preview | **0.1.20** | word-to-pdf |
| qrcode-generator | **1.4.4** | qr-code-generator |
| @huggingface/transformers | **3.7.2** (ESM) | background-remover, image-upscaler only |

Vendor files live in `toolnest-core/assets/vendor/<lib>/<version>/`. Register each with `wp_register_script()` and a version string; a tool's `tool.json` lists the handles it needs. **Never load a library globally.** Bootstrap/Icons live in the theme (`assets/vendor/`).

### 2.3 Dev tooling (never shipped to production)
| Tool | Constraint |
|---|---|
| Composer | 2.x |
| PHP_CodeSniffer + WordPress Coding Standards (`wp-coding-standards/wpcs`) | `^3.0` (pin in `composer.lock`) |
| PHPStan + `szepeviktor/phpstan-wordpress` | level 6, optional gate |
| Playwright (Node 20 LTS) | E2E smoke tests only (dev dependency, `package.json` devDependencies) |
| WP-CLI | content import/export scripts |

Exact patch versions are recorded in `composer.lock` / `package-lock.json` at Phase 0 and then frozen.

## 3. Third-Party Services

| Service | Purpose | Rules |
|---|---|---|
| Google AdSense (or any ad JS) | Ads | Pasted by admin in ToolNest Ads settings. Printed only on front-end, only when slot enabled. `async`, never blocks render. |
| Google Search Console / Bing Webmaster | SEO monitoring | No code. Verification meta via setting. |
| GA4 (optional) | Analytics | Off by default. Setting for Measurement ID; loaded `async`; honours a consent flag if added later. |
| Cloudflare Turnstile (optional) | Contact-form spam protection | Site key/secret as constants in `wp-config.php` (`TN_TURNSTILE_SITE`, `TN_TURNSTILE_SECRET`). If constants absent → use honeypot + signed time-token only. |
| open.er-api.com (`/v6/latest/USD`) | Live FX rates for currency-converter | Called from the browser. Cache last result in `localStorage` (`toolnest-fx`, with timestamp); fallback to cached/bundled rates when offline. |
| Hugging Face model hub | Downloads ML models at runtime for 2 AI tools | Browser-only; disclose in Privacy Policy; show "Loading engine…" UI; no keys. |
| SMTP (via host or plugin later) | `wp_mail()` delivery | Contact messages are stored in DB first, mail is best-effort. |

No other external requests (no Google Fonts, no CDN scripts, no tracking pixels).

## 4. Repository & Folder Structure

```
toolnest-wp/                      ← git repo root (NOT a full WordPress install)
├─ CLAUDE.md                      ← agent entry point
├─ .cursorrules
├─ docs/  01_PRD.md … 06_Plan.md
├─ source-html/                   ← the original static template, READ-ONLY reference
├─ wp-content/
│  ├─ themes/toolnest/
│  │  ├─ style.css                (theme header only)
│  │  ├─ functions.php            (loads inc/*)
│  │  ├─ header.php  footer.php  sidebar.php
│  │  ├─ front-page.php  home.php  page.php  single.php  archive.php  search.php  404.php  index.php
│  │  ├─ single-tn_tool.php  archive-tn_tool.php  taxonomy-tn_tool_category.php
│  │  ├─ template-parts/
│  │  │  ├─ header/{brand,primary-nav,mega-menu,search,theme-toggle}.php
│  │  │  ├─ footer/{brand,link-group,legal-bar}.php
│  │  │  ├─ ads/ad-slot.php
│  │  │  ├─ tool/{breadcrumb,workspace-open,workspace-close,how-to,features,faq,related,sidebar-nav}.php
│  │  │  ├─ cards/{tool-card,post-card,category-card}.php
│  │  │  └─ home/{hero,categories,popular,latest-posts,seo-text}.php
│  │  ├─ inc/
│  │  │  ├─ setup.php  enqueue.php  menus.php  customizer.php
│  │  │  ├─ class-tn-mega-walker.php  template-tags.php  seo.php  schema.php
│  │  │  └─ compat.php               (plugin-inactive fallbacks)
│  │  ├─ assets/{css/main.css, js/main.js, fonts/, vendor/bootstrap/, vendor/bootstrap-icons/, img/}
│  │  └─ languages/toolnest.pot
│  └─ plugins/toolnest-core/
│     ├─ toolnest-core.php         (bootstrap, constants, autoload)
│     ├─ uninstall.php
│     ├─ includes/
│     │  ├─ class-plugin.php  class-activator.php  class-post-types.php  class-taxonomies.php
│     │  ├─ class-meta-boxes.php  class-tool-registry.php  class-assets.php
│     │  ├─ class-ads.php  class-search-index.php  class-rest.php  class-contact.php
│     │  ├─ class-admin-messages.php  class-redirects.php  class-sitemap-robots.php  class-db.php
│     ├─ tools/<tool-slug>/{tool.json, view.php, tool.js, tool.css(optional)}   ← 37 modules
│     ├─ assets/{vendor/<lib>/<version>/, js/tn-core.js (TN.ui helpers), admin/}
│     └─ languages/
├─ tests/{e2e/ (Playwright), php/ (optional)}
├─ composer.json  phpcs.xml.dist  package.json (dev only)  .gitignore  .editorconfig
```

Deployment artefacts: zip of `themes/toolnest` and `plugins/toolnest-core` only.

## 5. Coding Conventions (enforced by PHPCS)

- Namespace `ToolNest\Core\` (plugin) and `ToolNest\Theme\` (theme) with PSR-4-style autoload via a tiny `spl_autoload_register`. Functions in global scope use prefix `tn_`; hooks `toolnest_*`; CPT `tn_tool`; taxonomy `tn_tool_category`; meta keys `_tn_*`; options `tn_*`; text domain `toolnest`; CSS classes `tn-*`; JS global `window.TN` (single namespace).
- Every PHP file starts with `defined( 'ABSPATH' ) || exit;`.
- **Escape late, sanitize early** (§6). All user-visible strings wrapped in `__()`/`esc_html__()` with `toolnest`.
- Enqueue assets only via `wp_enqueue_*`; **no inline `<script>`/`<style>` except** (a) the theme-bootstrap one-liner in `<head>`, (b) `tn-custom-vars` style block, (c) JSON config printed with `wp_json_encode` inside `<script type="application/json">`.
- No `eval`, no `create_function`, no `extract()`, no direct `$_GET/$_POST` use without sanitization.
- Template parts get data via `get_template_part( $slug, $name, $args )` `$args`, not globals.
- Theme never calls plugin classes directly: use `do_action( 'toolnest_*' )` and `apply_filters()`; wrap with `has_action()`/`function_exists()` so the theme survives plugin deactivation.
- JS: `'use strict'`, IIFE or ES module-free scripts (no bundler), no jQuery, no globals other than `window.TN`. Each tool exposes `TN.tools['<slug>'] = { init(rootEl, config) }`.

## 6. Security Constraints (non-negotiable)

1. **Capabilities:** settings and ads need `manage_options`; tool editing uses core `edit_posts` family; messages admin screen needs `manage_options`. Check capability **and** nonce on every admin POST (`check_admin_referer`, `current_user_can`).
2. **Input:** sanitize on save/receive (`sanitize_text_field`, `sanitize_email`, `wp_kses_post` for rich text, `absint`, whitelist arrays). Validate type/length server-side even if JS validated.
3. **Output:** escape on output (`esc_html`, `esc_attr`, `esc_url`, `esc_textarea`, `wp_kses_post`). JSON in HTML via `wp_json_encode` with `JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT`.
4. **SQL:** only `$wpdb->prepare()`; no string-built queries. Use WP_Query/APIs wherever possible. Custom tables via `dbDelta` only.
5. **Ad code:** stored in option `tn_ads`; editable only by `manage_options`; printed raw only for the slot it belongs to (it is trusted admin input). Never pass ad code through any front-end request parameter.
6. **REST:** every route has an explicit `permission_callback` (`__return_true` only for read-only public routes). Contact POST: honeypot + HMAC time-token (min 3 s, max 2 h) + per-IP-hash rate limit (5/hour via transient) + optional Turnstile. Max body 10 KB. Reject non-JSON.
7. **Cache-safe CSRF:** pages may be served from a full-page cache, so page-embedded nonces are not used for public forms; the form token is fetched from `GET /form-token` at submit time.
8. **Privacy:** store only `ip_hash` (SHA-256 of IP + site salt) for rate limiting, purge contact rows after 180 days (WP-Cron). No IP in logs. No cookies set by the theme/plugin (theme preference is `localStorage`).
9. **Headers (via `send_headers`, front-end only):** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. **CSP is report-only first** (ad networks and Hugging Face require broad allow-lists); never enforce a CSP that breaks AdSense without testing.
10. **Hardening:** disable XML-RPC (`xmlrpc_enabled` false), user registration off, comments off, file editor off (`DISALLOW_FILE_EDIT`), author archives disabled/redirect, REST user enumeration (`/wp/v2/users`) restricted for anonymous users, hide WP version.
11. **Supply chain:** vendor JS is committed with its version folder and checksum (`SHA256SUMS` file in `assets/vendor/`). Do not add new libraries without owner approval.
12. **Uploads:** no front-end upload endpoint exists. Do not create one.
13. **Secrets:** keys only in `wp-config.php` constants; never in the repo, options table or JS.

## 7. Performance Requirements

- Load per page only what is needed: global = Bootstrap CSS/JS + theme CSS/JS (+ icons font). Tool page adds only that tool's declared handles. Heavy libs (`pdf.js`, `transformers`) load on user action, not on page load, where the tool allows it.
- Scripts `defer` (or `type="module"`). No render-blocking JS. Preload Inter 400/600 latin woff2.
- Images: `loading="lazy"`, explicit width/height. SVG for logo/icons.
- Reserve ad-slot heights (03_UI_Spec §4) to keep CLS < 0.1.
- Search index JSON: ≤ 30 KB gzip; cached in transient `tn_search_index` (12 h) + `ETag`; rebuilt on `save_post_tn_tool`/term changes.
- Page cache: one page-cache plugin on the host (LiteSpeed Cache or WP Super Cache, per host). Cache bypass for logged-in users and REST. Document exact settings in `docs/CHANGELOG`.
- Remove WP bloat on front-end: emoji scripts, `wp-embed`, block-library CSS (only if no blocks used on that template; otherwise keep for posts).

## 8. SEO & Structured Data (theme `inc/seo.php`, `inc/schema.php`)

- Theme outputs title, meta description (excerpt → 160 chars), canonical, robots, OG/Twitter. **If Yoast/Rank Math is active, theme disables its own output** (`defined('WPSEO_VERSION')` / `class_exists('RankMath')`).
- JSON-LD per tool: `WebApplication` (`applicationCategory` from category map, `operatingSystem: "Any"`, `offers.price: 0`), `BreadcrumbList`, `FAQPage` (only when FAQ exists), optional `HowTo`. Blog posts: `Article`. Site: `WebSite` + `SearchAction` + `Organization`.
- Permalinks `/%postname%/`; tool slugs identical to the static site; 301 map for legacy `.html` URLs.
- Sitemap: WP core `wp-sitemap.xml` (tool CPT + taxonomy included); virtual `robots.txt` appends `Sitemap:`; **`[DOMAIN]` placeholders do not exist in WP** (use `home_url()`/`get_permalink()`).

## 9. Browser Support
Evergreen Chrome/Edge/Firefox/Safari (last 2 versions), Android Chrome, iOS Safari 15+. Tools needing unsupported APIs must feature-detect and show a message (02_AppFlow §5).

## 10. Portability Rules (Laravel-later)

1. Tool JS must not call any WordPress PHP/JS API (no `wp.*`, no `ajaxurl`). Configuration enters only via `data-tn-config='{"slug":"…"}'` JSON on the root element.
2. The only server contracts are the 3 REST endpoints in 02_AppFlow §2 with plain JSON; they can be re-implemented in Laravel 1:1.
3. Content model maps to: `tools`, `tool_categories`, `tool_faqs`, `tool_relations`, `settings`, `contact_messages`, `pages`, `posts`. Keep meta keys flat and JSON-valid so a one-time WP-CLI export → Laravel seeder is possible.
4. Business logic (ad slot selection, related-tool fallback, search ranking) lives in plugin classes, not in templates.

## 11. Definition of Done (applies to every plan step)
- PHPCS clean, no PHP notices with `WP_DEBUG` on, no JS console errors.
- Escaping/sanitizing review done for any new output/input.
- Light + dark, mobile (375px) + desktop (1280px) checked against the static page.
- `docs/06_Plan.md` updated.
