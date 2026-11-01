# 06_Plan — Implementation Checklist

> **LIVING DOCUMENT.** The coding agent MUST update this file after **every** completed step (tick the box, add date + short note, move the "Current step" pointer). Work strictly in order. A step may start only when its dependency IDs are ticked. Never skip ahead; never batch-tick unfinished work.

**Step format:** `- [ ] ID · What to do · needs: IDs · done when: verifiable outcome`

## Progress Board

| Phase | Steps | Done | Status |
|---|---|---|---|
| 0 · Prep | 8 | 0 | ⬜ not started |
| 1 · DB & Auth | 15 | 0 | ⬜ |
| 2 · Core API | 16 | 0 | ⬜ |
| 3 · UI Integration | 24 | 0 | ⬜ |
| 4 · Edge-case Tests | 14 | 0 | ⬜ |
| 5 · Release | 6 | 0 | ⬜ |

**Current step:** P0-01
**Last updated:** — (agent writes ISO date + step ID)
**Open blockers / owner decisions:** see "Decisions Log" at the bottom.

---

## Phase 0 — Prep (no WordPress code yet)

- [ ] P0-01 · Create repo skeleton exactly as in `04_TRD §4`; add `.gitignore`, `.editorconfig`, `composer.json` (WPCS dev dep), `phpcs.xml.dist` · needs: — · done when: `composer install` ok, `vendor/bin/phpcs -i` lists WordPress
- [ ] P0-02 · Copy the finished static site into `source-html/` and mark read-only (README note "reference only") · needs: P0-01 · done when: 37 tool folders + `pages/` + `assets/` present
- [ ] P0-03 · Local WordPress install (WP 7.0.x, PHP 8.3), pretty permalinks `/%postname%/`, WP-CLI works, `WP_DEBUG` on · needs: P0-01 · done when: `wp core version` prints 7.0.x; site loads
- [ ] P0-04 · Record exact versions (WP, PHP, MariaDB, Composer, WPCS) in `docs/CHANGELOG.md` · needs: P0-03 · done when: file exists with a version table
- [ ] P0-05 · Download vendor libs at the pinned versions (04_TRD §2.2) into `plugins/toolnest-core/assets/vendor/<lib>/<version>/` + `SHA256SUMS`; Bootstrap & Icons into theme `assets/vendor/` · needs: P0-01 · done when: every lib in the TRD table has a folder and checksum
- [ ] P0-06 · Self-host fonts: Inter (latin 400/500/600/700/800) and Hind Siliguri (bengali+latin 400/500/600/700) as woff2 with `@font-face` + `font-display: swap` · needs: P0-01 · done when: files in theme `assets/fonts/`, no request to Google Fonts
- [ ] P0-07 · **OWNER DECISION** `developer-webmaster-tools`: keep as hub page, split into standalone tools, or drop (it is not in the static registry) · needs: P0-02 · done when: decision written in Decisions Log
- [ ] P0-08 · Audit static source for known defects to fix at import (H1 text polluted with breadcrumb in `signature-maker` and `whatsapp-link-generator`; inline `<style>` blocks in 6 pages; hard-coded "All Tools (36)") and list them in Decisions Log · needs: P0-02 · done when: list recorded

---

## Phase 1 — DB & Auth (data foundation, no front-end yet)

- [ ] P1-01 · Plugin bootstrap `toolnest-core.php` (header: Requires PHP 8.1, Requires at least 6.6), constants, autoloader, `ABSPATH` guards · needs: P0-03 · done when: plugin activates with no notices
- [ ] P1-02 · Register CPT `tn_tool` per `05_Schema §2` · needs: P1-01 · done when: "Tools" menu in admin; `/tools/` resolves after flush
- [ ] P1-03 · Register taxonomy `tn_tool_category`; seed 6 terms on activation (Converters, Image, PDF, Business, Text, Developers) · needs: P1-02 · done when: terms exist; re-activation does not duplicate
- [ ] P1-04 · `register_post_meta()` for all `_tn_*` keys with sanitize callbacks and `auth_callback` · needs: P1-02 · done when: invalid values (bad icon class, unknown module) are rejected on save
- [ ] P1-05 · Meta box "Tool Settings" (module, Bangla title, icon, badge, featured, popular rank, ads off, noindex, keywords, app category) with nonce + capability · needs: P1-04 · done when: values persist and are escaped on re-render
- [ ] P1-06 · Meta box "How-to Steps" repeater (≤5, add/remove/reorder, empty rows ignored) · needs: P1-05 · done when: JSON saved valid
- [ ] P1-07 · Meta box "FAQ" repeater (≤20; answer through `wp_kses_post`) · needs: P1-05 · done when: JSON saved valid
- [ ] P1-08 · Meta box "Related & Sidebar" pickers (≤3 / ≤6, published tools only, self excluded) · needs: P1-05 · done when: limits enforced server-side
- [ ] P1-09 · `class-db.php`: `dbDelta` table `tn_contact_messages`, option `tn_db_version`, ordered migration runner · needs: P1-01 · done when: table exists with the 3 indexes; running twice is harmless
- [ ] P1-10 · Settings API page "ToolNest Ads" (4 slots × enabled + code) + `tn_settings` page (GA4 id, GSC verification, social links, contact email) · needs: P1-01 · done when: only `manage_options` can open/save; nonce checked
- [ ] P1-11 · Hardening module: registration off, comments off sitewide, XML-RPC off, author archives redirect, anonymous `/wp/v2/users` blocked, `DISALLOW_FILE_EDIT` documented, version meta removed · needs: P1-01 · done when: each item verified manually
- [ ] P1-12 · Integrity hooks: on trash/delete of a tool, purge its ID from other tools' related/sidebar meta · needs: P1-08 · done when: test with 2 tools passes
- [ ] P1-13 · `uninstall.php` per `05_Schema §9` (data kept unless `tn_delete_data_on_uninstall`=1) · needs: P1-09, P1-10 · done when: uninstall dry-run documented
- [ ] P1-14 · Theme skeleton `toolnest`: `style.css` header, `functions.php`, `inc/setup.php` (theme supports, menus registered: primary, footer-popular, footer-utilities, footer-legal), `inc/compat.php` (admin-only notice if plugin inactive) · needs: P0-03 · done when: theme activates; deactivating the plugin causes no fatal
- [ ] P1-15 · Phase 1 verification: activate → deactivate → reactivate; Editor role cannot see Ads/Settings; PHPCS 0 errors · needs: P1-01…P1-14 · done when: results logged in this file

---

## Phase 2 — Core API (services, REST, SEO) — still no visual work

- [ ] P2-01 · `class-tool-registry.php`: scan `tools/*/tool.json` (schema: slug, libs[], needsJs, css?, category), validate, expose lookup · needs: P1-15 · done when: unknown module key is rejected in admin
- [ ] P2-02 · `class-assets.php`: register all vendor handles; enqueue per-tool handles + `tool.js`/`tool.css` only on that tool's page · needs: P2-01, P0-05 · done when: network tab on a tool page shows only its libs
- [ ] P2-03 · Data API `tn_get_tool( $id )` returns normalized array (title EN/BN, intro, icon, badge, steps, faq, related, sidebar, flags) · needs: P1-08 · done when: unit-style test prints expected array
- [ ] P2-04 · Fallback logic: related → 3 from same category; sidebar → 6 popular (`_tn_featured` + rank); cached in transient · needs: P2-03 · done when: tool with empty meta still returns full lists
- [ ] P2-05 · Search index builder (id, name, url, category, icon, desc, keywords) + transient + invalidation on tool/term save/delete · needs: P2-03 · done when: editing a tool changes the index immediately
- [ ] P2-06 · REST `GET /toolnest/v1/search-index` (public, ETag, `Cache-Control: public, max-age=3600`) · needs: P2-05 · done when: ≤30 KB gzip; 304 on repeat
- [ ] P2-07 · REST `GET /toolnest/v1/form-token` (no-store) · needs: P1-01 · done when: returns signed token; tampered token fails verification
- [ ] P2-08 · REST `POST /toolnest/v1/contact` per `05_Schema §8.3` (all 9 steps, prepared insert, `wp_mail` best-effort) · needs: P2-07, P1-09 · done when: each failure code (413/415/400/429/422) reproducible; success stores a row
- [ ] P2-09 · Admin screen ToolNest → Messages (list, filter by status, mark read/spam/archive, delete; nonce + capability; pagination) · needs: P2-08 · done when: actions work; Editor role gets 403
- [ ] P2-10 · WP-Cron `toolnest_purge_messages` (180/365-day rules) · needs: P2-09 · done when: manual run deletes only eligible rows
- [ ] P2-11 · Redirect map: `/tools/{slug}/index.html`, `/index.html`, `/pages/*.html`, `/tools/index.html` → clean URLs (301) · needs: P1-02 · done when: each legacy URL returns 301 to the right target
- [ ] P2-12 · Sitemap includes `tn_tool` + `tn_tool_category`; virtual `robots.txt` with Sitemap line and disallow rules · needs: P1-03 · done when: `/wp-sitemap.xml` lists all published tools
- [ ] P2-13 · Ad render API: `do_action( 'toolnest_ad_slot', $slot )` rules — render only if enabled + non-empty + not `_tn_ads_off`; admins see labelled placeholder; visitors see nothing · needs: P1-10 · done when: 4 scenarios verified
- [ ] P2-14 · Theme SEO/schema (`inc/seo.php`, `inc/schema.php`): title, description, canonical, robots, OG/Twitter; JSON-LD WebApplication, BreadcrumbList, FAQPage (only if FAQ), Article, WebSite+SearchAction; auto-disable if Yoast/Rank Math active · needs: P2-03 · done when: Rich Results test passes on a sample tool
- [ ] P2-15 · Security headers (+ CSP **report-only**) on front-end · needs: P1-01 · done when: headers present, no console CSP errors that break ads/tools
- [ ] P2-16 · Phase 2 verification: REST contract tests (curl/PHP script) for the 3 endpoints; PHPCS 0 errors; escaping/nonce audit grep · needs: P2-01…P2-15 · done when: results logged

---

## Phase 3 — UI Integration (match the static template pixel-for-pixel)

- [ ] P3-01 · Port `main.css` into theme; declare `:root` + `[data-theme="dark"]` token blocks exactly as `03_UI_Spec`; no hard-coded colours outside allowed list · needs: P2-16 · done when: token diff vs spec = 0
- [ ] P3-02 · Enqueue Bootstrap 5.3.3 + Icons + fonts (preload Inter 400/600); inline head script sets `data-theme` before paint · needs: P3-01 · done when: no flash on hard refresh in dark mode
- [ ] P3-03 · `header.php` + parts (brand, primary nav via menu location, search UI, theme toggle, skip link) · needs: P3-02 · done when: matches static header at 1280 and 375
- [ ] P3-04 · Explore mega menu auto-built from taxonomy (categories → tools) · needs: P3-03, P2-04 · done when: adding a tool appears in menu without code
- [ ] P3-05 · `footer.php`: brand, 3 link groups (menu locations with auto-fallback lists), legal bar, back-to-top · needs: P3-02 · done when: counts like "All Tools (N)" are computed, not hard-coded
- [ ] P3-06 · `template-parts/ads/ad-slot.php` and the 4 placements (leaderboard, in-content, sidebar sticky, above-footer) with reserved heights · needs: P2-13, P3-03 · done when: CLS stays < 0.1 with and without ads
- [ ] P3-07 · Customizer (logo, 5 colours, default theme, hero text, footer copyright, back-to-top toggle) + `tn-custom-vars` output · needs: P3-01 · done when: live preview changes colours; reset restores defaults
- [ ] P3-08 · Port `main.js`: search UI against REST index (sessionStorage cache, keyboard nav), theme toggle, back-to-top, menu behaviour; delete `TOOLS_REGISTRY` · needs: P2-06, P3-03 · done when: all flows in `02_AppFlow §3.7/3.9` pass
- [ ] P3-09 · `single-tn_tool.php` shell: breadcrumb, H1(+BN), intro, workspace slot, in-content ad, how-to, features (post content), FAQ, related, sidebar (sticky ad + nav card) · needs: P3-06, P2-14 · done when: layout identical to `amount-to-words` static page
- [ ] P3-10 · Tool section parts (`how-to`, `features`, `faq`, `related`, `sidebar-nav`) with hide-if-empty rules · needs: P3-09 · done when: a tool with no FAQ outputs no empty heading/JSON-LD
- [ ] P3-11 · Tool module loader (renders `view.php`, `<noscript>`, passes `data-tn-config`), `tn-core.js` (`TN.ui.showError/toast/copy/download`) · needs: P2-02, P3-09 · done when: a dummy module renders and initializes
- [ ] P3-12 · **Reference tool first:** port `amount-to-words` as module · needs: P3-11 · done when: behaviour + layout identical to static (owner sign-off)
- [ ] P3-13 · Port Converters batch (bijoy-to-unicode, age-calculator, land-area-converter, currency-converter) · needs: P3-12 · done when: each passes parity checklist (inputs, outputs, copy, reset, dark, mobile)
- [ ] P3-14 · Port Text batch (text-tools, bold-text-generator, bangla-typing-test, lorem-ipsum-generator) · needs: P3-12 · done when: parity checklist
- [ ] P3-15 · Port Developers batch (json-formatter, password-generator, meta-tag-generator, robots-txt-generator) + P0-07 decision for `developer-webmaster-tools` · needs: P3-12, P0-07 · done when: parity checklist
- [ ] P3-16 · Port Business batch (qr-code-generator, invoice-generator, discount-vat-profit-calculator, utm-link-builder, cv-maker, whatsapp-link-generator, loan-emi-fdr-dps-calculator) · needs: P3-12 · done when: parity checklist incl. print/preview
- [ ] P3-17 · Port Image batch (image-compressor, image-resizer, bulk-image-resizer, image-format-converter, color-picker, passport-photo-maker, signature-maker, background-remover, image-upscaler) · needs: P3-12 · done when: parity checklist; AI tools show "Loading engine…" and failure retry
- [ ] P3-18 · Port PDF batch (pdf-merge-split, image-to-pdf, pdf-to-jpg, pdf-to-word, pdf-to-excel, word-to-pdf, excel-to-pdf) · needs: P3-12 · done when: parity checklist
- [ ] P3-19 · `front-page.php` + parts (hero, categories w/ counts, popular, latest posts, SEO text) · needs: P3-04, P2-04 · done when: matches static home; empty-state rules from `02_AppFlow §3.1`
- [ ] P3-20 · `archive-tn_tool.php`, `taxonomy-tn_tool_category.php`, filter chips + in-page filter, no-results state · needs: P3-09 · done when: `02_AppFlow §3.2` passes
- [ ] P3-21 · `home.php`, `single.php`, `archive.php`, `search.php`, `page.php`, `404.php` with the shared shell and empty states · needs: P3-09 · done when: each renders with sidebar + ads
- [ ] P3-22 · Contact page template + JS (states from `02_AppFlow §3.6`, a11y errors) wired to REST · needs: P2-08, P3-21 · done when: all 5 form states reproducible
- [ ] P3-23 · WP-CLI `wp toolnest import-static` (upsert by `_tn_module`) and run on all 37 tools; create the 5 pages, assign menus, set front/posts pages · needs: P3-19, P3-20, P3-21 · done when: 37 tools published, re-run creates no duplicates
- [ ] P3-24 · Visual parity pass: compare reference screens (home, All Tools, amount-to-words, one Image, one PDF, blog single, contact) in light/dark × desktop/mobile against `source-html/` · needs: P3-13…P3-23 · done when: owner approves screenshots

---

## Phase 4 — Edge-case Tests

- [ ] P4-01 · Playwright smoke: all 37 tool URLs return 200, one H1, no console errors, expected libs only · needs: P3-24 · done when: green run saved
- [ ] P4-02 · Tool with empty FAQ / related / sidebar / steps → no empty headings, fallbacks work · needs: P3-24 · done when: verified
- [ ] P4-03 · Plugin deactivated → theme renders, no fatal, admin notice only for admins · needs: P3-24 · done when: verified
- [ ] P4-04 · Ads matrix: slot disabled, code empty, `_tn_ads_off`, admin vs visitor view · needs: P3-24 · done when: 4 cases verified
- [ ] P4-05 · Contact: success, validation errors, honeypot, rate limit (6th request), expired/forged token, mail failure (row still saved), 10 KB+ body · needs: P3-22 · done when: each outcome matches `02_AppFlow §3.6`
- [ ] P4-06 · Search: no results, 1-char query, Bangla query, REST failure fallback to `/?s=` · needs: P3-08 · done when: verified
- [ ] P4-07 · Theme: first visit dark system pref, stored preference wins, no flash, toggle persists across pages · needs: P3-02 · done when: verified
- [ ] P4-08 · Tool edge cases: huge file, zero-byte file, wrong type, cancel mid-process, Reset revokes Blob URLs, FX API offline (cached rates label), model download failure (retry) · needs: P3-24 · done when: each shows the specified message
- [ ] P4-09 · JS disabled → `<noscript>` card on tools; page still readable · needs: P3-11 · done when: verified
- [ ] P4-10 · Accessibility: axe (0 serious/critical), keyboard-only navigation of header, mega menu, FAQ, forms; 44px targets; focus visible · needs: P3-24 · done when: report saved
- [ ] P4-11 · Performance: Lighthouse mobile on home, All Tools, 3 representative tools meets `01_PRD §5` targets; fix regressions · needs: P3-24 · done when: scores logged
- [ ] P4-12 · SEO: structured data valid, canonical/OG correct, sitemap complete, redirects (P2-11) verified, no `noindex` leaks · needs: P3-24 · done when: verified
- [ ] P4-13 · Security review: grep for unescaped output/unsanitized input, nonce + capability audit on every admin action, header check, Editor-role access test · needs: P3-24 · done when: checklist signed
- [ ] P4-14 · Code quality gate: PHPCS 0 errors, `WP_DEBUG` log empty during full run, uninstall dry-run · needs: P4-01…P4-13 · done when: logs attached

---

## Phase 5 — Release

- [ ] P5-01 · Build deploy zips (theme + plugin only) with version bump and CHANGELOG · needs: P4-14 · done when: zips install on a clean WP
- [ ] P5-02 · Production setup: PHP 8.3, HTTPS, permalinks, page-cache plugin + exclusions, `DISALLOW_FILE_EDIT`, backups scheduled · needs: P5-01 · done when: checklist ticked
- [ ] P5-03 · Content QA: 5 legal/info pages written (Privacy mentions in-browser processing, FX API, Hugging Face model download, ads), every tool has intro + FAQ · needs: P5-02 · done when: owner approval
- [ ] P5-04 · Submit sitemap to Search Console/Bing; verify 301s live · needs: P5-02 · done when: submitted
- [ ] P5-05 · Apply for AdSense only after P5-03; paste approved code in ToolNest Ads · needs: P5-03 · done when: ads render and CLS still < 0.1
- [ ] P5-06 · Post-launch 7-day review: errors log, Core Web Vitals, contact messages, top tools · needs: P5-04 · done when: notes added

---

## Decisions Log (agent appends; owner resolves)

| Date | ID | Decision / question | Owner answer |
|---|---|---|---|
| — | P0-07 | What to do with `developer-webmaster-tools` (hub page not in registry)? | pending |
| — | P0-08 | Defects found in static source (list) | pending |

## Change Log (agent appends one line per completed step)

`YYYY-MM-DD · STEP-ID · what changed · files touched`
