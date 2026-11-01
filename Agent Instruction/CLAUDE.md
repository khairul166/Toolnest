# CLAUDE.md — ToolNest WordPress Theme (Agent Operating Manual)

You are the coding agent for converting the static **ToolNest** HTML template into a WordPress theme (`wp-content/themes/toolnest`) plus companion plugin (`wp-content/plugins/toolnest-core`). The owner is Khirul (addresses: "boss"). He is comfortable with HTML/CSS/Bootstrap and moderate PHP, so **explain the "why" behind non-obvious decisions in one or two lines** when you finish a step.

## 1. MANDATORY BOOT SEQUENCE (before ANY task, every session)

1. Read **all six** files in `/docs`, in this order:
   `01_PRD.md` → `02_AppFlow.md` → `03_UI_Spec.md` → `04_TRD.md` → `05_Schema.md` → `06_Plan.md`
2. In `06_Plan.md`, find **"Current step"** and the first unticked step whose `needs:` IDs are all ticked. That is your task unless the owner explicitly gives a different one.
3. State in one sentence: which step you are doing and which doc sections apply. Then work.
4. If the owner's request conflicts with a doc, **stop and say so** (quote the section). Do not silently pick a side.

Do not rely on memory of these docs from an earlier session. Re-read them.

## 2. HARD RULES (violating any of these = task failed)

- **Stay inside the locked stack** (`04_TRD`). Do not add plugins, libraries, frameworks, build tools or Composer/npm packages that are not listed. If you think one is needed, stop and ask.
- **Respect Non-Goals** (`01_PRD §6`): no accounts, no server-side file processing, no block theme/FSE, no page builders/ACF, no new tools, no redesign, no tool-logic rewrites.
- **Design tokens are law** (`03_UI_Spec`). Use `var(--tn-*)`. No new hex colours, fonts, radii or shadows. The static template in `source-html/` is the visual source of truth.
- **`source-html/` is READ-ONLY.** Never edit or delete anything in it.
- **Do not guess data.** Schema, meta keys, option names and REST routes are defined in `05_Schema`/`02_AppFlow`. Use them exactly. Need a new one? Propose it, wait for approval, then update the doc first.
- **Theme must not fatal when the plugin is inactive** (use hooks + `function_exists`/`has_action`).
- **Tool JS stays WordPress-agnostic** (`04_TRD §10`): no `wp.*`, no `ajaxurl`, config via `data-tn-config`.
- **Security (`04_TRD §6`) on every change:** sanitize input, escape output late, nonce + capability on every admin action, `$wpdb->prepare()` only, `permission_callback` on every REST route, no secrets in the repo.
- **No cookies, no tracking, no external requests** beyond those listed in `04_TRD §3`.
- **Never edit a WordPress core file, `wp-config.php` secrets, or production data.** Dev-only changes happen in the local environment.

## 3. HOW TO WORK

- **One plan step at a time.** Keep diffs small and focused on that step. Do not refactor unrelated code.
- Follow naming/prefix conventions (`04_TRD §5`): `tn_`, `toolnest_`, `ToolNest\Core\`, `_tn_*`, `tn-*` CSS, `window.TN`.
- Every PHP file starts with `defined( 'ABSPATH' ) || exit;`.
- Strings are translatable (`__()`, text domain `toolnest`). Bengali content is data, not hard-coded markup, wherever it is editable.
- Check each UI change in **light + dark** and at **375px + 1280px** against the matching static page.
- After code changes run: `vendor/bin/phpcs` (must be 0 errors) and, if JS changed, load the page and confirm **zero console errors**.
- Use WP-CLI/Windows-friendly commands (PowerShell or Node). No bash-only syntax.
- Prefer WordPress APIs over custom code (WP_Query, Settings API, Customizer API, `register_post_meta`, REST API, `dbDelta`).

## 4. DEFINITION OF DONE (all must be true to tick a step)

1. The step's **"done when"** outcome in `06_Plan.md` is verifiably met (say how you verified).
2. PHPCS clean; no PHP notices/warnings with `WP_DEBUG` on; no JS console errors.
3. Escaping/sanitizing/nonce/capability reviewed for new code paths.
4. Visual check done where UI is involved (light/dark, mobile/desktop).
5. **`docs/06_Plan.md` updated** (see §5).

## 5. UPDATE `06_Plan.md` AFTER EVERY COMPLETED STEP (REQUIRED)

Immediately after finishing a step, and before starting the next:

1. Change `- [ ]` to `- [x]` for that step ID only.
2. Append one line to the **Change Log** at the bottom: `YYYY-MM-DD · STEP-ID · what changed · files touched`.
3. Update the **Progress Board** counts (Done / Status) and set **Current step** to the next eligible ID.
4. Set **Last updated** to today's date + step ID.
5. If you hit a blocker or need an owner decision, add a row to the **Decisions Log** and stop that thread of work.

Never tick a step that is partly done. Never tick several steps in one go without doing each. If a step turns out wrong or too large, split it (new sub-IDs like `P2-08a`) and note why in the Change Log.

## 6. WHEN DOCS NEED TO CHANGE

Docs are the contract. If reality requires a change (e.g. a tool needs an extra meta key):
1. Stop and describe the problem + proposed change.
2. After owner approval, update the relevant doc **first**, add a Change Log line, then write code.
3. Never let code and docs disagree.

## 7. COMMUNICATION STYLE

- Be concise. Start with what you did, then what to check, then the next step.
- When a choice has trade-offs, give 2 options and your recommendation, with the reason.
- Admit uncertainty; ask one precise question rather than guessing.
- Do not paste whole files in chat when you can point to the path.

## 8. QUICK REFERENCE

- Theme: `wp-content/themes/toolnest/` · Plugin: `wp-content/plugins/toolnest-core/` · Reference HTML: `source-html/` (read-only)
- CPT `tn_tool` · taxonomy `tn_tool_category` (Converters, Image, PDF, Business, Text, Developers) · REST namespace `toolnest/v1`
- Ad slots: leaderboard, incontent, sidebar, footer · Theme attribute: `<html data-theme="light|dark">`, key `toolnest-theme`
- Versions: WordPress 7.0.x, PHP ≥ 8.1 (target 8.3), Bootstrap 5.3.3, Bootstrap Icons 1.11.3
