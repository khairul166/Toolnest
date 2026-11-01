# 02_AppFlow — Screens, Routes, State Machine

> Status: LOCKED v1.0. Every route, button and state below must exist and behave as written.

## 1. Global Shell (every screen)

```
[Header: logo · Home · All Tools · Explore ▾ · Categories · Blog · Contact · Search · Theme toggle]
[Ad: Leaderboard 728×90 / 320×50]
[Main: col-lg-8 content | col-lg-4 sidebar (sticky ad 300×250 + nav card)]
[Ad: Above-footer banner]
[Footer: brand + 3 link groups + legal bar]   [Back-to-top button]
```

Sidebar is shown on tool, blog-single, page and archive screens. Front page uses full-width sections (no sidebar), but still shows leaderboard + footer ad.

## 2. Route Map (WordPress permalinks: `/%postname%/`)

| Screen | URL | Template | Notes |
|---|---|---|---|
| Home | `/` | `front-page.php` | Static front page setting |
| All Tools | `/tools/` | `archive-tn_tool.php` | CPT archive, category filter chips |
| Tool category | `/tools/category/{slug}/` | `taxonomy-tn_tool_category.php` | Converters, Image, PDF, Business, Text, Developers |
| Tool page | `/tools/{tool-slug}/` | `single-tn_tool.php` | Same slug as static (`/tools/amount-to-words/`) to preserve SEO |
| Blog index | `/blog/` | `home.php` | Posts page setting |
| Blog post | `/blog/{post-slug}/` | `single.php` | |
| Blog category/tag/author/date | `/blog/category/{slug}/` … | `archive.php` | |
| Static page | `/about/`, `/contact/`, `/privacy-policy/`, `/terms/`, `/disclaimer/` | `page.php` | Contact uses shortcode/template part |
| Search results | `/?s={q}` | `search.php` | Searches tools first, then posts |
| 404 | any unknown | `404.php` | |
| Sitemap | `/wp-sitemap.xml` | WP core | Include `tn_tool` + taxonomy |
| robots.txt | `/robots.txt` | virtual (filter) | Points to sitemap |
| REST: search index | `GET /wp-json/toolnest/v1/search-index` | plugin | Public, cached |
| REST: contact | `POST /wp-json/toolnest/v1/contact` | plugin | Public, rate-limited |
| REST: form token | `GET /wp-json/toolnest/v1/form-token` | plugin | Cache-safe anti-spam token |

**Redirects:** old static URLs (`/tools/x/index.html`, `/pages/about.html`, `/index.html`) → 301 to clean URLs (`.htaccess`/`template_redirect`). Required to keep any already-indexed URLs.

## 3. Screen State Machines

### 3.1 Home (`/`)
States: `loading` → `ready` | `empty-tools`.
- `ready`: hero + search box, category grid (6 cards with tool counts), Popular tools, All-tools grid, Blog section (latest 3 posts), SEO text.
- `empty-tools` (no published tools): show "No tools published yet" card + link to wp-admin for logged-in admins only; visitors see a neutral message.
- Blog section: if 0 posts → hide the entire section (no empty heading).
- Buttons: category card → `/tools/category/{slug}/`; tool card → tool page; "View all tools" → `/tools/`.

### 3.2 All Tools (`/tools/`) and Category
States: `ready` | `filtered` | `no-results`.
- Filter chips (All + 6 categories): click toggles `filtered`; URL updates to category route (no JS-only state).
- In-page filter input (client-side over rendered cards): zero matches → `no-results` card "No tools match “{q}”. Clear filter" (button resets).
- Pagination: not used (all tools on one page; ≤ 100 tools). If tools > 100 → paginate 48 per page.

### 3.3 Tool Page (`/tools/{slug}/`) — the core screen

Vertical order (fixed): Leaderboard ad → Breadcrumb (Home / Tools / {Title}) → H1 (+ Bangla suffix) → Intro paragraph → **Workspace card** → In-content ad → How-to card → Why/Features card (post content) → FAQ accordion → Related Tools (3 cards) → [Sidebar: sticky ad + nav card] → Above-footer ad → Footer.

Workspace state machine (each tool module implements the subset that applies):

```
idle ──(file/input provided)──► validating ──ok──► ready ──(action click)──► processing ──► success
  ▲                                │ invalid                                   │ error
  │                                ▼                                           ▼
  └────────(Reset / Clear)──── error-inline ◄──────────────────────────── error-inline
success ──(Download / Copy)──► toast "Copied/Downloaded" ──► success
```

| State | UI requirement |
|---|---|
| `idle` | Empty dropzone/inputs, primary action disabled, helper text visible |
| `validating` | Inline check only; no spinner unless > 300 ms |
| `error-inline` | `.alert-danger` message directly above the action row, `role="alert"`, plain language, never a browser `alert()` |
| `processing` | Action button disabled + spinner, progress bar for multi-file/long jobs, Cancel where the library supports it |
| `success` | Result box (`.tn-result-box`), Download/Copy buttons enabled, Reset button visible |
| `heavy-asset-loading` | Tools that lazy-load big libs/models (background-remover, image-upscaler, pdf tools): show "Loading engine…" with progress; on failure show retry button |

Common button actions: **Copy** (clipboard API → fallback `execCommand`; toast "Copied"), **Download** (Blob URL, revoked after use), **Reset** (clears inputs, results, revokes URLs, returns to `idle`), **Sample/Presets** (fills inputs, stays `ready`).

Tool-page empty/edge states:
- No FAQ entered → hide FAQ section and its JSON-LD (never output an empty heading).
- No related tools chosen → auto-fill with 3 other tools from the same category.
- No sidebar links chosen → auto-fill with 6 popular tools; sidebar title default "Quick Tool Navigation".
- Ads disabled/empty → the slot wrapper is **not rendered** for visitors (admins see a dashed placeholder labelled with slot name + size).
- JavaScript disabled → show `<noscript>` card: "This tool needs JavaScript. Your files never leave your device."
- Unsupported browser API (e.g. no `File`/`Blob`/`canvas`) → feature-detect and show a clear compatibility message in the workspace.

### 3.4 Blog index / Blog post / Archives
States: `ready` | `empty` ("No posts yet") | `paginated`.
- Post meta: date, category, reading time. Next/Prev links on single. Related posts (same category, max 3; hide if none).
- Comments: **disabled globally** (out of scope).

### 3.5 Static pages
- `ready` only. Same shell with sidebar. Title → H1, content from editor.

### 3.6 Contact (`/contact/`)

```
form-idle ─(submit)─► client-validate ─fail─► field-errors (aria-invalid + message under field)
                              │ pass
                              ▼
                        submitting (button disabled, spinner)
                              │
        ┌─────────────┬───────┴────────┬──────────────┐
     success       rate-limited     spam-rejected   server-error
 (green alert,     (429: "Please    (silent success  (red alert + retry;
  form cleared)     wait a minute")  message to bot)  message not lost: kept in form)
```
Fields: Name (required, ≤120), Email (required, valid), Subject (optional, ≤190), Message (required, 10–5000 chars), hidden honeypot `website`, hidden time-token. Server stores the message in DB **first**, then attempts email; if email fails the message is still saved and the user still sees success.

### 3.7 Search

Header search (every page):
```
closed ─(focus/typing ≥2 chars)─► loading-index (first time only, ≤ 1 request, cached in sessionStorage)
      ─► results (max 8, keyboard ↑/↓/Enter/Esc) | no-results ("No tools found. Try “pdf”, “image”, “bijoy”")
```
- Enter with a query → `/?s={q}`. Esc closes. Click outside closes. Index fetch error → fall back to submitting the form to `/?s=`.
- `search.php`: lists matching tools (cards) then posts; zero → friendly empty state with category links.

### 3.8 404
Message, search box, 6 category links, 6 popular tools. HTTP status must be 404.

### 3.9 Theme toggle / Back-to-top / Menus
- Theme: `light ⇄ dark`. Initial = saved `localStorage['toolnest-theme']`, else `prefers-color-scheme`, else Customizer default. Set on `<html data-theme>` **before first paint** (inline head script).
- Back-to-top: hidden until scrollY > 400px; click smooth-scrolls (respect `prefers-reduced-motion`).
- Mobile menu: Bootstrap collapse (`#tnMainNav`); closes on link click and Esc; focus returns to toggler.
- Explore mega menu: opens on hover (desktop, with 150 ms delay) and click/tap; keyboard accessible (`aria-expanded`); lists the 6 categories with their tools (auto from taxonomy).

## 4. Admin Flows (wp-admin)

| Flow | Path | Result / error handling |
|---|---|---|
| Create tool | Tools → Add New | Required: Title, Category, Tool Module key. Save blocked with admin notice if module key unknown. Publishing a tool without excerpt shows a non-blocking warning (SEO). |
| Edit FAQ | Tool edit screen → "FAQ" box | Repeater (add/remove/reorder). Empty rows ignored on save. |
| Related/sidebar picks | Tool edit screen | Multi-select of published tools; self excluded; max 3 related, 6 sidebar. |
| Ads | Settings → ToolNest Ads | 4 slots × (enabled, code). Only `manage_options` users. Saved with nonce; invalid/empty → slot disabled. |
| Customizer | Appearance → Customize | Live preview of colours/logo; reset to defaults button. |
| Menus | Appearance → Menus | Locations: Primary, Footer Popular, Footer Utilities, Footer Legal. Empty location → fallback list generated from taxonomy. |
| Contact messages | ToolNest → Messages | List, mark read/spam/archived, delete (nonce + capability). |
| Flush search index | Settings → ToolNest → "Rebuild index" | Auto on `save_post_tn_tool`; manual button as fallback. |

## 5. Error & Empty-State Matrix (global rules)

| Situation | Behaviour |
|---|---|
| Plugin `toolnest-core` deactivated | Theme must not fatal. Show front-end notice to admins only: "Activate ToolNest Core". Visitors see standard content. |
| Tool module file missing | Workspace area shows "This tool is temporarily unavailable" (visitors) / exact missing path (admins). Page still renders rest of layout. |
| Third-party API down (currency rates) | Tool falls back to last-known cached rates with a visible "Rates may be outdated" label; never a blank screen. |
| Large file / out of memory | Catch error, show "File too large for your browser. Try a smaller file." Suggest limit text per tool. |
| CDN/vendor asset fails | Vendor libs are self-hosted; if a model download (Hugging Face) fails → retry button + explanation. |
| 500 on contact REST | Generic error alert, form values preserved. |
| JS error in a tool | Global `window.onerror` is NOT used to alert users; tool modules own try/catch and call `TN.ui.showError()`. |

## 6. Accessibility rules tied to flows
- All interactive controls ≥ 44×44 px touch target; visible focus ring (`outline` using `--tn-primary`).
- Status messages use `aria-live="polite"`; errors use `role="alert"`.
- Accordion (FAQ): button with `aria-expanded`/`aria-controls`; only one open optional.
- Skip link "Skip to content" as first focusable element → `#main-content`.
