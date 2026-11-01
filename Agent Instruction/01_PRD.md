# 01_PRD — ToolNest WordPress Theme Conversion

> Status: LOCKED v1.0 · Owner: Khirul · Read this before any task. Change only via an explicit "PRD change" commit.

## 1. Core Problem

ToolNest is a finished static site (plain HTML + Bootstrap 5.3.3 + vanilla JS, 37 browser-only tools, one shared layout). It cannot be managed by a non-developer: every title, FAQ, ad slot, menu link and footer link is hard-coded into 45+ HTML files, and the nav/footer are copy-pasted into each page.

**The problem to solve:** turn the static template into a WordPress theme + companion plugin so that:

1. Every piece of text, menu, ad slot, colour and tool page is editable from wp-admin with **no code change**.
2. Adding tool #38 means "create one Tool post", not "edit 45 files".
3. The site stays fast, SEO-clean and **100% client-side for tool processing** (the brand promise: user files never leave the browser).
4. The architecture stays portable: tool logic is framework-agnostic so the site can later move to Laravel (owner's stated roadmap) without rewriting tools.

## 2. Target Persona

| | Site operator (primary) | Visitor (secondary) |
|---|---|---|
| Who | Khirul, 28. Knows HTML/CSS/Bootstrap, moderate PHP. Works bilingually (Bengali/English). | Bangladesh-first audience (job applicants, small online sellers, students, office staff) plus global users of image/PDF/text utilities. |
| Needs | Edit content, ads, menus, colours from wp-admin. Low hosting cost (shared hosting). Add tools quickly. | Free tool that works instantly on a phone, in Bengali or English, without sign-up or upload. |
| Pain today | Editing 45 files for one footer change. No admin UI. | None with tools; wants fast load and trust ("my file is not uploaded"). |

## 3. Scope: Template → Theme Mapping

| Static template | WordPress implementation |
|---|---|
| `index.html` | `front-page.php` (hero, category grid, featured/popular tools, blog section) |
| `tools/index.html` | `archive-tn_tool.php` (All Tools, filter by category) |
| `tools/<slug>/index.html` (37) | `single-tn_tool.php` + one **Tool Module** per tool |
| `pages/*.html` (about, contact, privacy, terms, disclaimer) | Standard WP Pages via `page.php` (contact has a native form) |
| Blog section | Standard WP Posts: `home.php`, `single.php`, `archive.php` |
| Header, mega menu "Explore", footer, 4 ad slots, sidebar nav | Template parts + WP menus + Customizer + ad settings |
| `robots.txt`, `sitemap.xml` | Dynamic: WP core sitemap + virtual robots.txt (no static files) |
| `TOOLS_REGISTRY` in `main.js` | Generated JSON search index from `tn_tool` posts |

Tool categories (existing, locked): **Converters (5), Image (9), PDF (7), Business (7), Text (4), Developers (4)** = 36 registered tools, plus `developer-webmaster-tools` (hub page, not in the registry today; decision logged in 06_Plan Phase 0).

## 4. MVP User Stories

### Operator (admin)
- **US-A1** As the operator I can create/edit a Tool (title, Bangla title, intro, category, icon, FAQ, how-to steps, related tools, sidebar links) in wp-admin, and the public page matches the static design exactly.
- **US-A2** I can paste AdSense/ad code into each of the 4 slots (leaderboard, in-content, sidebar, footer), toggle each slot, and disable ads on a single tool.
- **US-A3** I can change logo, primary/accent colours, default theme (light/dark), footer text and social links in the Customizer without touching code.
- **US-A4** I can edit header, footer (3 link groups + legal) and the Explore mega menu from Appearance → Menus / auto-built from categories.
- **US-A5** I can read contact-form messages inside wp-admin.
- **US-A6** I can publish blog posts and static pages with the same layout (header, ad slots, sidebar, footer).

### Visitor
- **US-V1** I can find a tool via header search (live suggestions), category pages, All Tools, or the sidebar/related links.
- **US-V2** I can use any tool fully in the browser; files are never uploaded to the server.
- **US-V3** I can switch light/dark mode and it persists.
- **US-V4** I can read the how-to, FAQ and related tools on every tool page, in a clean mobile layout.
- **US-V5** I can send a message via the contact form and see clear success/error feedback.

### SEO / Platform
- **US-S1** Every tool page outputs: unique title/meta description, canonical, Open Graph/Twitter tags, `WebApplication` + `FAQPage` + `BreadcrumbList` JSON-LD.
- **US-S2** The XML sitemap lists every published tool, category, page and post automatically.

## 5. Success Metrics (proposed targets; confirm after launch baseline)

| Area | Metric | Target |
|---|---|---|
| Parity | Tools migrated with identical behaviour | 37/37 |
| Parity | Pixel regression vs static template (desktop + mobile, light + dark) | No visible layout differences on reference pages |
| Performance | Core Web Vitals on tool pages (mobile, field or Lighthouse) | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 |
| Performance | Lighthouse mobile: Performance / Accessibility / Best Practices / SEO | ≥ 90 / ≥ 95 / ≥ 95 / ≥ 95 |
| Editability | Add a new tool without editing PHP/HTML templates | ≤ 15 minutes |
| Editability | Files to edit to change the footer | 0 (admin only) |
| Quality | PHPCS (WordPress standard) errors | 0 |
| Security | Unescaped output / unsanitized input found in review | 0 |
| SEO | Tool pages with valid structured data (Rich Results test) | 100% |
| Business | AdSense policy readiness (about/contact/privacy/terms/disclaimer live, content on every tool) | Yes before applying |

## 6. Out of Scope (Non-Goals) — STRICT

The agent MUST NOT build, suggest adding, or "improve" any of the following in v1:

1. **No server-side processing of user files** (no uploads, no PHP image/PDF handling). Tools stay 100% in-browser.
2. **No public user accounts**: no registration, login, profiles, saved history, dashboards. (Registration disabled; wp-admin is staff-only.)
3. **No e-commerce, payments, subscriptions, premium tiers, paywalls.**
4. **No Gutenberg block theme / Full Site Editing / theme.json-driven templates.** Classic PHP theme only.
5. **No page builders** (Elementor, Divi, WPBakery) and no ACF/Carbon Fields/Meta Box dependency.
6. **No rewrite of tool logic.** Existing tool JS is moved, not redesigned. Bug fixes only if a tool breaks in WP.
7. **No new tools** during conversion (tool #38 is post-MVP).
8. **No multilingual plugin** (WPML/Polylang). Bangla/English strings live in content and `toolnest` text domain only. Full i18n of admin UI is post-MVP.
9. **No analytics dashboards, per-user tracking, cookies beyond theme preference.** Optional GA4 snippet only via a setting.
10. **No headless/REST-driven front end, no React/Vue/build pipeline for the theme.** Plain PHP + vanilla JS + committed vendor files.
11. **No marketplace distribution** (ThemeForest/wp.org) requirements in v1. This is a single-site build.
12. **No Laravel work.** Only keep tool logic portable (see 04_TRD §10).
13. **No visual redesign.** The static template is the design source of truth.

## 7. Assumptions (flag to owner if wrong)

- Single production site on low-cost shared/VPS hosting with PHP 8.1+ and HTTPS.
- Ads are Google AdSense (or any JS snippet) pasted by the operator.
- Content language is mixed Bengali + English; H1s may contain a Bengali suffix.
- Tool pages are the SEO landing pages; blog is secondary.
