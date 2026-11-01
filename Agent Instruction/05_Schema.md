# 05_Schema — Data Model, Indexes, Authorization

> Status: LOCKED v1.0.
> **Important:** WordPress runs on MySQL/MariaDB, which has **no Row-Level Security**. RLS is a PostgreSQL/Supabase concept. The equivalent control here is **capability-based authorization + nonces + prepared statements** (§8). The site has **no public user accounts**, so there are no per-user data rows to protect; the only sensitive data is contact messages and ad code, both admin-only.

## 1. Strategy: Use WordPress Tables First

Custom tables are created **only** when WP's native tables would be abused. MVP has **one** custom table (`tn_contact_messages`). Everything else uses core tables.

```
wp_posts ─┬─< wp_postmeta            (tool fields, JSON blobs)
          └─< wp_term_relationships >─ wp_term_taxonomy >─ wp_terms   (tn_tool_category)
wp_options                          (ads, plugin settings, db version)
wp_users ─< wp_usermeta             (staff only; registration disabled)
{prefix}tn_contact_messages          (custom, MVP)
{prefix}tn_tool_daily_stats          (custom, POST-MVP, defined but NOT created in MVP)
```

## 2. Post Types & Taxonomies

| Registration | Spec |
|---|---|
| CPT `tn_tool` | `public: true`, `has_archive: 'tools'`, `rewrite: { slug: 'tools', with_front: false }`, `supports: [title, editor, excerpt, thumbnail, revisions, page-attributes]`, `show_in_rest: true`, `menu_icon: dashicons-hammer`, `capability_type: post` |
| Taxonomy `tn_tool_category` | hierarchical `false` (flat), `rewrite: { slug: 'tools/category' }`, `show_admin_column: true`, `show_in_rest: true`. Seed terms (locked): **Converters, Image, PDF, Business, Text, Developers** |
| Core `post` | Blog (permalink base `/blog/`), comments disabled |
| Core `page` | about, contact, privacy-policy, terms, disclaimer |

Field mapping on `wp_posts` for a tool: `post_title` = H1 English part · `post_name` = slug (same as static folder) · `post_excerpt` = intro paragraph + meta description source · `post_content` = "Why / features" section (block editor, rich text) · `menu_order` = manual sort · featured image = optional OG image.

## 3. Tool Meta (`wp_postmeta`)

All keys prefixed `_tn_`, registered with `register_post_meta()` (`single: true`, `show_in_rest: false`, `auth_callback` = `edit_post`). JSON fields store **validated, sanitized** arrays via `wp_json_encode`.

| Meta key | Type | Required | Description / validation |
|---|---|---|---|
| `_tn_module` | string (slug) | **yes** | Folder name in `toolnest-core/tools/` (e.g. `amount-to-words`). Must exist in tool registry; whitelist check on save. |
| `_tn_title_bn` | string ≤ 120 | no | Bangla H1 suffix, e.g. "(টাকা কথায় রূপান্তর)" |
| `_tn_icon` | string | no | Bootstrap Icons class `bi-[a-z0-9-]+` (regex validated). Default `bi-tools`. |
| `_tn_badge` | string ≤ 120 | no | Workspace badge text ("100% Client-Side • …"). Default from plugin. |
| `_tn_steps` | JSON array (≤ 5) | no | `[{ "title": str ≤80, "text": str ≤300 }]` — the numbered how-to |
| `_tn_faq` | JSON array (≤ 20) | no | `[{ "q": str ≤200, "a": wp_kses_post ≤2000 }]` — drives accordion + `FAQPage` |
| `_tn_related_ids` | JSON array of int (≤ 3) | no | Published `tn_tool` IDs, self excluded. Empty → auto from same category |
| `_tn_sidebar_title` | string ≤ 80 | no | Sidebar card heading (default "Quick Tool Navigation") |
| `_tn_sidebar_ids` | JSON array of int (≤ 6) | no | Empty → auto: popular tools |
| `_tn_featured` | bool (0/1) | no | Shown in Home "Popular" grid + footer "Popular Tools" auto-list |
| `_tn_popular_rank` | int 0–999 | no | Lower = earlier in popular lists; 0 = unranked |
| `_tn_ads_off` | bool (0/1) | no | Disable all 4 ad slots on this tool |
| `_tn_keywords` | string ≤ 300 | no | Search-index keywords (comma-separated; may include Bangla) |
| `_tn_app_category` | enum | no | Schema.org `applicationCategory`: `UtilitiesApplication`, `MultimediaApplication`, `BusinessApplication`, `DeveloperApplication` (default from category map) |
| `_tn_noindex` | bool | no | Adds `noindex` (for hub/draft pages) |

Post-meta table index note: `wp_postmeta` already has indexes on `post_id` and `meta_key(191)`. Do **not** query by meta value for lists; use taxonomy + `menu_order`, and cache the featured list in a transient.

Blog posts/pages: use core fields only. Optional page meta `_tn_hide_sidebar` (bool) for full-width pages.

## 4. Options (`wp_options`, autoload as noted)

| Option name | Autoload | Shape | Notes |
|---|---|---|---|
| `tn_ads` | **no** | `{ "slots": { "leaderboard": {"enabled":bool,"code":string}, "incontent": {...}, "sidebar": {...}, "footer": {...} }, "show_placeholders_admin": bool }` | Admin-only; code is raw trusted JS/HTML |
| `tn_settings` | yes | `{ "ga4_id": string, "gsc_verification": string, "social": {"facebook":url,"youtube":url,"x":url,"linkedin":url}, "footer_note": string, "contact_email": email, "search_index_version": int }` | |
| `tn_db_version` | yes | string (e.g. `1.0.0`) | Drives migrations |
| `theme_mods_toolnest` | yes | Customizer values (see §5) | Core mechanism |
| Transient `tn_search_index` | — | JSON string | 12 h, busted on tool/term save |
| Transient `tn_popular_tools` | — | int[] | 12 h |
| Transients `tn_rl_{ip_hash}` | — | int | Contact rate limit, 1 h |

## 5. Customizer Settings (`theme_mods`)

| Key | Type | Default | Sanitizer |
|---|---|---|---|
| `tn_logo` | attachment ID | bundled SVG | `absint` |
| `tn_color_primary` | hex | `#2563EB` | `sanitize_hex_color` |
| `tn_color_primary_dark` | hex | `#1E40AF` | same |
| `tn_color_accent` | hex | `#F59E0B` | same |
| `tn_color_accent_hover` | hex | `#D97706` | same |
| `tn_color_footer_bg` | hex | `#0F172A` | same |
| `tn_default_theme` | enum `light|dark|system` | `system` | whitelist |
| `tn_hero_title` / `tn_hero_text` | string | from template | `sanitize_text_field` / `wp_kses_post` |
| `tn_footer_copyright` | string | "© {year} ToolNest. All rights reserved. Built for Global & Bangladesh users." | `wp_kses_post` |
| `tn_show_back_to_top` | bool | true | boolean |

## 6. Custom Tables

### 6.1 `{prefix}tn_contact_messages` (MVP)

Created in `class-activator.php` via `dbDelta()` (note: two spaces after `PRIMARY KEY`, one column per line, `KEY` not `INDEX`).

```sql
CREATE TABLE {prefix}tn_contact_messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(120)    NOT NULL,
  email        VARCHAR(190)    NOT NULL,
  subject      VARCHAR(190)    NOT NULL DEFAULT '',
  message      TEXT            NOT NULL,
  ip_hash      CHAR(64)        NOT NULL,
  user_agent   VARCHAR(255)    NOT NULL DEFAULT '',
  status       VARCHAR(12)     NOT NULL DEFAULT 'new',
  mail_sent    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at   DATETIME        NOT NULL,
  updated_at   DATETIME        NOT NULL,
  PRIMARY KEY  (id),
  KEY status_created (status, created_at),
  KEY email (email),
  KEY ip_created (ip_hash, created_at)
) {charset_collate};
```

| Column | Rule |
|---|---|
| `status` | enum-by-convention (whitelist in code): `new`, `read`, `spam`, `archived` (VARCHAR chosen over ENUM so `dbDelta` and future values are safe) |
| `ip_hash` | `hash('sha256', $ip . wp_salt('auth'))`; raw IP is never stored |
| `created_at`/`updated_at` | UTC (`gmdate('Y-m-d H:i:s')`) |
| Retention | WP-Cron daily event `toolnest_purge_messages` deletes rows older than 180 days (`status` ≠ `new`); `new` older than 365 days |
| Foreign keys | None (WP convention; integrity enforced in code) |
| Indexes rationale | `status_created` → admin list/filter; `email` → lookup/spam; `ip_created` → rate limit/abuse |

### 6.2 `{prefix}tn_tool_daily_stats` (POST-MVP — define only, do not create)

```sql
CREATE TABLE {prefix}tn_tool_daily_stats (
  tool_id    BIGINT UNSIGNED NOT NULL,
  stat_date  DATE            NOT NULL,
  views      INT UNSIGNED    NOT NULL DEFAULT 0,
  uses       INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY  (tool_id, stat_date),
  KEY stat_date (stat_date)
) {charset_collate};
```
Counters only. No IP, no user agent, no file info (brand privacy promise). `tool_id` logically references `wp_posts.ID`.

## 7. Entity Relationships (logical)

```
tn_tool (wp_posts) 1───N tn_tool meta (_tn_*)
tn_tool N───1 tn_tool_category (term)           [exactly one primary category]
tn_tool N───N tn_tool  via _tn_related_ids      [JSON, ≤3]
tn_tool N───N tn_tool  via _tn_sidebar_ids      [JSON, ≤6]
tn_tool 1───1 tool module folder via _tn_module [file system, not DB]
contact message — standalone (no FK)
```
Integrity rules enforced in code: on tool trash/delete → remove its ID from other tools' `_tn_related_ids/_tn_sidebar_ids` (hook `before_delete_post`/`wp_trash_post`).

## 8. Authentication & Authorization Flow (replaces RLS)

### 8.1 Actors
| Actor | Auth | Can do |
|---|---|---|
| Visitor (anonymous) | none | Read public pages, call public REST (search-index, form-token), POST contact |
| Editor | wp-admin login | Edit posts/pages/tools (core `edit_posts`, `edit_pages`) — **cannot** touch Ads, Settings, Messages |
| Administrator | wp-admin login (2FA recommended via host/plugin, out of scope to build) | Everything incl. `manage_options` screens |

No Subscriber/Contributor accounts are used; `users_can_register = 0`, default role `subscriber` unused.

### 8.2 Capability matrix
| Operation | Capability | Extra guard |
|---|---|---|
| Edit tool / meta boxes | `edit_post` (per post) | nonce per meta box, sanitize all fields |
| Save ads | `manage_options` | `check_admin_referer('tn_save_ads')` |
| Customizer | `customize` | core |
| View/modify messages | `manage_options` | nonce on every status/delete action; bulk actions whitelist |
| Rebuild search index | `manage_options` | nonce |
| Public REST `GET /search-index` | none | read-only, no user data |
| Public REST `POST /contact` | none | honeypot + HMAC time token + rate limit + optional Turnstile + body size cap |

### 8.3 Contact submission flow
```
Browser  ──GET /form-token──────────────► server: token = HMAC(secret, timestamp)  (cacheable? NO: no-store)
Browser  ──POST /contact {fields, token, website(honeypot)} ──►
  1 reject if content-type ≠ JSON or body > 10 KB          → 413/415
  2 reject if honeypot filled                               → 200 (silent, nothing stored)
  3 verify token signature, age 3s–2h                       → 400 on fail
  4 rate limit: transient tn_rl_{ip_hash} ≥ 5/hour          → 429
  5 (optional) verify Turnstile                             → 400 on fail
  6 validate + sanitize fields (lengths, email)             → 422 with field errors
  7 INSERT via $wpdb->insert() (prepared) status=new
  8 wp_mail() to admin; set mail_sent=1 on success          (failure does NOT fail request)
  9 respond 200 {ok:true}
```

### 8.4 Mapping to a future Laravel build (reference only)
Capabilities → Gates/Policies (`manage-settings`, `manage-messages`); nonces → CSRF middleware; `permission_callback` → route middleware; `tn_contact_messages` → `contact_messages` migration unchanged.

## 9. Migrations & Versioning
- `tn_db_version` compared on `plugins_loaded`; `class-db.php::migrate()` runs ordered steps (`1.0.0`, `1.1.0`, …), each idempotent. Never edit a shipped step; add a new one.
- Activation: create table, seed 6 terms, register rewrite rules, `flush_rewrite_rules()` (activation only — never on `init`).
- Uninstall (`uninstall.php`): delete options/transients; delete `tn_contact_messages` **only if** option `tn_delete_data_on_uninstall` = 1 (default 0). Never delete posts/terms automatically.

## 10. Seed / Import Spec
A WP-CLI command `wp toolnest import-static <source-html-dir>` (Phase 3) reads each `source-html/tools/<slug>/index.html` and creates a `tn_tool` with: title (H1 split EN/BN), excerpt (intro `<p>`), category (from registry map), icon, steps, FAQ, related, sidebar title/links, workspace left to the module. Must be re-runnable (upsert by `_tn_module`).

Category map (from the static `TOOLS_REGISTRY`):
- **Converters (5):** bijoy-to-unicode, amount-to-words, age-calculator, land-area-converter, currency-converter
- **Image (9):** image-compressor, background-remover, image-upscaler, image-resizer, bulk-image-resizer, color-picker, passport-photo-maker, image-format-converter, signature-maker
- **PDF (7):** pdf-merge-split, image-to-pdf, pdf-to-jpg, pdf-to-word, pdf-to-excel, word-to-pdf, excel-to-pdf
- **Business (7):** qr-code-generator, invoice-generator, discount-vat-profit-calculator, utm-link-builder, cv-maker, whatsapp-link-generator, loan-emi-fdr-dps-calculator
- **Text (4):** text-tools, bold-text-generator, bangla-typing-test, lorem-ipsum-generator
- **Developers (4):** json-formatter, password-generator, meta-tag-generator, robots-txt-generator
- **Unmapped:** `developer-webmaster-tools` (decision in 06_Plan Phase 0)
