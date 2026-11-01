# 03_UI_Spec — Design System

> Status: LOCKED v1.0. **These tokens are extracted from the static template's `:root` and `[data-theme="dark"]` blocks. They must be reproduced 1:1 as CSS custom properties.** The static `main.css` is the pixel-level source of truth for anything not listed here. No new colours, fonts or radii without a PRD change.

## 1. Colour Tokens

### 1.1 Light theme (default, `:root`)

| Token | Hex / value | Use |
|---|---|---|
| `--tn-primary` | `#2563EB` | Links, primary buttons, active states, focus ring |
| `--tn-primary-dark` | `#1E40AF` | Primary hover/pressed |
| `--tn-primary-light` | `#EFF6FF` | Tinted backgrounds, hover on nav/links |
| `--tn-accent` | `#F59E0B` | Highlights, badges, CTA accents |
| `--tn-accent-hover` | `#D97706` | Accent hover |
| `--tn-accent-light` | `#FEF3C7` | Accent tint background |
| `--tn-success` | `#16A34A` | Success text/icons |
| `--tn-success-light` | `#DCFCE7` | Success background (e.g. "100% Client-Side" badge) |
| `--tn-danger` | `#DC2626` | Errors, destructive (Reset, delete) |
| `--tn-danger-light` | `#FEE2E2` | Error background |
| `--tn-bg` | `#F8FAFC` | Page background |
| `--tn-surface` | `#FFFFFF` | Cards, header, inputs |
| `--tn-surface-alt` | `#F1F5F9` | Ad slots, subtle panels, table stripes |
| `--tn-text` | `#0F172A` | Body text |
| `--tn-text-muted` | `#64748B` | Secondary text |
| `--tn-border` | `#E2E8F0` | Borders, dividers |
| `--tn-footer-bg` | `#0F172A` | Footer background |
| `--tn-footer-text` | `#CBD5E1` | Footer text |

### 1.2 Dark theme (`[data-theme="dark"]`, set on `<html>`)

| Token | Value |
|---|---|
| `--tn-bg` | `#0B1120` |
| `--tn-surface` | `#1E293B` |
| `--tn-surface-alt` | `#334155` |
| `--tn-text` | `#F8FAFC` |
| `--tn-text-muted` | `#94A3B8` |
| `--tn-border` | `#334155` |
| `--tn-primary-light` | `rgba(37, 99, 235, 0.22)` |
| `--tn-accent-light` | `rgba(245, 158, 11, 0.20)` |
| `--tn-success-light` | `rgba(22, 163, 74, 0.20)` |
| `--tn-danger-light` | `rgba(220, 38, 38, 0.20)` |
| `--tn-footer-bg` | `#020617` |
| `--tn-footer-text` | `#CBD5E1` |
| Header background | `rgba(15, 23, 42, 0.96)` |
| Ad-slot border | `#475569` |
| `color-scheme` | `dark` |

`--tn-primary`, `--tn-primary-dark`, `--tn-accent*`, `--tn-success`, `--tn-danger` keep the same hex in dark mode.

### 1.3 Contrast rules
- `#2563EB` on white ≈ 5.2:1 → OK for text and buttons (white text on primary passes AA).
- `#F59E0B` on white fails for text (~2:1). **Never use accent as text colour on light surfaces**; use it for fills/borders with dark text (`--tn-text`).
- Muted text `#64748B` is allowed only for secondary text ≥ 14px regular (≈4.8:1 on white).
- CV preview and invoice preview areas stay white/dark-text in both themes (print fidelity).

### 1.4 Customizer-overridable tokens
Only these may be changed from wp-admin: `--tn-primary`, `--tn-primary-dark`, `--tn-accent`, `--tn-accent-hover`, `--tn-footer-bg`. The theme derives `--tn-primary-light` automatically (primary at 8% light / 22% dark). Output via one `<style id="tn-custom-vars">` block in `<head>`. Everything else is fixed.

## 2. Typography

| Token | Value |
|---|---|
| `--tn-font-sans` | `'Inter', 'Hind Siliguri', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| `--tn-font-bangla` | `'Hind Siliguri', 'Noto Sans Bengali', 'SolaimanLipi', sans-serif` |
| `--tn-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |

- Fonts: Inter 400/500/600/700/800, Hind Siliguri 400/500/600/700. **Self-hosted woff2**, `font-display: swap`, subsets: Inter = latin, Hind Siliguri = bengali + latin. Preload only Inter 400/600 latin.
- Any element containing Bengali text gets `lang="bn"` (or `.tn-bn`) so `--tn-font-bangla` and correct line-height apply.

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Body | `1rem` | 400 | 1.6 |
| H1 (`.tn-page-title`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | 800 | 1.2 |
| H2 section title (`.tn-section-title`) | `clamp(1.35rem, 2.4vw, 1.85rem)` | 700 | 1.3 |
| H3 / card title | `1.1rem – 1.25rem` | 600–700 | 1.35 |
| Small / meta | `0.85rem – 0.95rem` | 400–500 | 1.5 |
| Caption / ad label | `0.72rem` uppercase, `letter-spacing: .08em` | 700 | 1.2 |
| Inline code / numbers in results | `--tn-font-mono` | 500 | — |

Bengali line-height must be ≥ 1.7 inside paragraphs and ≥ 1.35 in headings (Bengali glyphs clip at 1.2).

## 3. Spacing, Radius, Shadow, Motion

- Spacing: Bootstrap 5.3 scale (`0.25rem` steps: 1=.25, 2=.5, 3=1, 4=1.5, 5=3 rem). Vertical rhythm between cards: `mb-4`. Main area `py-4`. Card inner padding `p-3`/`p-md-4`.
- Radius: `--tn-radius-sm: 0.5rem` (inputs, buttons), `--tn-radius-md: 0.75rem` (cards, ad slots), `--tn-radius-lg: 1rem` (workspace card, hero blocks). Pills/circles: `999px` / `50%`.
- Shadows (light): `--tn-shadow-sm: 0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)`; `--tn-shadow-md: 0 4px 12px rgba(15,23,42,.07), 0 2px 4px rgba(15,23,42,.04)`; `--tn-shadow-lg: 0 10px 25px rgba(15,23,42,.09)`.
- Shadows (dark): sm `0 1px 3px rgba(0,0,0,.28)`, md `0 4px 12px rgba(0,0,0,.32)`, lg `0 10px 25px rgba(0,0,0,.38)`.
- Motion: `--tn-transition: 160ms ease-in-out`. Under `prefers-reduced-motion: reduce` disable transforms/smooth scroll.

## 4. Layout Rules

- Grid: Bootstrap 5.3.3 container (max 1320px at ≥1400). Tool/blog/page screens: `col-lg-8` content + `col-lg-4` sidebar; ≤ 991.98px stacks (sidebar below content, sticky disabled).
- Breakpoints: Bootstrap standard (576 / 768 / 992 / 1200 / 1400) + template custom: `max-width: 420px`, `575.98px`, `991.98px`, `992–1199.98px`.
- Sticky sidebar: `.tn-sidebar-sticky { position: sticky; top: <header height + 1rem> }`, ≥ 992px only.
- Ad slots (reserve space to prevent CLS):

| Slot | Class | Min-height | Size note |
|---|---|---|---|
| Leaderboard (above content) | `.tn-ad-slot--leaderboard` | 96px | 728×90 desktop / 320×50 mobile |
| In-content | `.tn-ad-slot--incontent` | 120px | Responsive |
| Sidebar sticky | `.tn-ad-slot--sidebar` | 280px | 300×250 |
| Above-footer | `.tn-ad-slot--footer` | 96px | 728×90 / responsive |

Placeholder look (admins only): `surface-alt` bg, `1px dashed #CBD5E1` border (`#475569` dark), radius-md, centred label "ADVERTISEMENT" (caption style) + size text.

## 5. Dark / Light Theme Rules

1. Theme lives on `<html data-theme="light|dark">`. Never `body.dark` or `prefers-color-scheme` in component CSS (only in the head bootstrap script).
2. All colours in components come from tokens. **Hard-coded hex is allowed only** in: ad-slot dashed border, CV/invoice previews, brand logo SVG.
3. Bootstrap utility classes (`bg-white`, `bg-light`, `text-dark`, `border*`, `.card`, `.table`, `.dropdown-menu`, `.modal-content`, `.form-control`, `.form-select`) must be remapped to tokens under `[data-theme="dark"]`.
4. Logo: dark theme uses `filter: brightness(0) invert(1)` on the SVG logo (or a dedicated dark logo from the Customizer).
5. No flash: inline script in `<head>` sets `data-theme` before CSS paints; the toggle button updates the icon (`bi-moon-stars` ⇄ `bi-sun`) and `aria-pressed`.
6. Customizer "Default theme": Light / Dark / System. User choice (localStorage `toolnest-theme`) always wins.

## 6. Core Components & States

Every interactive component must define: **default, hover, focus-visible, active, disabled, loading, error** where applicable. Focus ring: `outline: 2px solid var(--tn-primary); outline-offset: 2px` (never removed).

| Component | Class(es) | Default | Hover | Focus | Disabled / Loading / Error |
|---|---|---|---|---|---|
| Primary button | `.btn.btn-primary` (+ `.tn-btn`) | bg `--tn-primary`, white text, radius-sm | bg `--tn-primary-dark` | ring | opacity .6, `cursor:not-allowed`; loading = spinner + label kept |
| Outline button | `.btn-outline-*` | transparent, border token | tinted `--tn-primary-light` | ring | same as above |
| Danger button (Reset) | `.btn-outline-danger` | text/border `--tn-danger` | bg `--tn-danger-light` | ring | — |
| Copy button | `.tn-copy-btn` | outline, icon + "Copy" | primary tint | ring | success state: green fill, label "Copied" for 1.5 s |
| Input / select / textarea | `.form-control`, `.form-select` | surface bg, border token, radius-sm | border `--tn-primary` at 50% | border `--tn-primary` + 3px primary-light halo | error: border `--tn-danger` + message `.invalid-feedback`; disabled: surface-alt |
| Dropzone | `.tn-dropzone` | dashed border, centred icon + text | primary tint | ring | dragover: primary border + tint; error: danger tint |
| Card | `.tn-card` | surface, 1px border, radius-md, shadow-sm | — | — | — |
| Tool workspace card | `.tn-tool-workspace` | surface, radius-lg, shadow-md, `p-4` | — | — | — |
| Tool card (grid/related) | `.tn-tool-card` | card + icon chip (primary-light) + title + desc | lift `translateY(-2px)` + shadow-md + title primary | ring | — |
| Result box | `.tn-result-box` | surface-alt, radius-md, mono for numbers | — | — | empty state text muted |
| Badge "100% Client-Side" | `.tn-badge-privacy` | success-light bg, success text, pill, shield icon | — | — | — |
| Step indicator (1·2·3) | `.tn-steps` | numbered circles in primary | — | — | — |
| FAQ accordion | `.accordion` styled | item border token, open item bg primary-light, chevron | title primary | ring | — |
| Breadcrumb | `.tn-breadcrumb` | muted, last item `aria-current` | link underline | ring | — |
| Nav link | `.tn-header__nav-link` | text colour | primary + primary-light bg | ring | active = primary + weight 600 |
| Mega menu | `.tn-mega-menu` | surface panel, shadow-lg, radius-md, category columns | item primary-light | ring | — |
| Header search | `.tn-header__search-wrap` | pill input w/ icon | — | ring | results panel `.tn-search-results` (surface, shadow-lg, max 8 items, active item primary-light) |
| Theme toggle | `.tn-theme-toggle` | 44×44 pill, border token, icon | primary border + tint | ring | — |
| Back to top | `.tn-back-to-top` | 3rem circle, primary bg, white icon, fixed bottom-right, z-index 1020 | — | ring | hidden (opacity 0, pointer-events none) until scroll > 400px |
| Alert / toast | `.alert-*` | tinted bg + token text | — | — | `role="alert"` for errors |
| Pagination | `.pagination` | token borders | primary tint | ring | active = primary bg |
| Footer link | `.tn-footer__link` | footer-text colour | white + underline | ring | — |
| Ad slot | `.tn-ad-slot--*` | see §4 | — | — | empty/disabled = not rendered for visitors |

## 7. Iconography & Imagery
- Icons: Bootstrap Icons **1.11.3**, self-hosted font subset or full font (woff2 only). Tool icon stored as class name (e.g. `bi-translate`).
- Logo/favicon: SVG (`logo.svg`, `favicon.svg`); Customizer can replace logo (SVG/PNG, max 200×48 display).
- No stock photography. OG image: 1200×630 generated per category (static asset) or site default.

## 8. Print
`@media print`: hide header, footer, ads, sidebar, FAQ; show workspace result + invoice/CV preview at full width.
