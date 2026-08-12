# Task Checklist: Migrate `web` from Tailwind to Native CSS

Plan context and utility→CSS mapping table: see `tasks/plan.md`.
All commands run from repo root unless noted. Manual checks use
`pnpm dev:web` and compare against the baseline screenshots from Task 1.

---

## Phase 1: Foundation

### Task 1: Capture visual baseline

- [x] **Description:** Record reference screenshots of every page in both color
      schemes before any change, so migrated pages can be diffed visually.
- [x] **Acceptance criteria:**
  - [x] Screenshots exist for `/`, `/docs/core`, `/playground`, `/examples`
  - [x] Each page captured in light AND dark (dark via `localStorage.theme = "dark"`)
  - [x] Docs screenshots include headings, code blocks, and a table (core/web-components pages)
- [x] **Verification:** Files saved under `/tmp/opencode/adraw-css-baseline/` (outside repo)
- [x] **Dependencies:** None
- [x] **Files likely touched:** none (screenshots only)
- [x] **Estimated scope:** XS

### Task 2: Add reset.css + native tokens + base rules (Tailwind still active)

- [x] **Description:** Create `src/styles/reset.css` as a verbatim copy of
      `node_modules/tailwindcss/preflight.css` (comments and `@layer base`
      included). Rework `global.css` to import `reset.css`/`fonts.css` first, declare
      all current `@theme` values as plain `:root` custom properties (same names,
      same values — inert while Tailwind is active), and express the current
      `@layer base` `@apply` rules as plain CSS (`border-color`, `outline-color` with
      `color-mix`, body background/color/font/overscroll/antialiasing, `--adraw-*`
      props, button cursor, `.visually-hidden`). Keep `@import "tailwindcss"` and
      `@plugin "@tailwindcss/typography"` in place for now.
- [x] **Acceptance criteria:**
  - [x] `reset.css` is byte-identical to the preflight source
    (Deviation, user-approved: wrapped in `@layer base` — the source carries no
    literal layer marker; `--theme(...)` calls replaced with `var(...)` since the
    theme function is only valid while the compiler is active)
  - [x] Every `--color-*` and `--font-sans` token from `@theme` exists natively on `:root`
  - [x] No `@apply` remains; `@theme` block may remain until Task 11
  - [x] Zero visual change vs baseline (tokens are redeclared with identical values)
- [x] **Verification:** `pnpm build:web` succeeds; spot-check `/` and `/docs/core` against baseline
- [x] **Dependencies:** Task 1
- [x] **Files likely touched:** `src/styles/global.css`, `src/styles/reset.css` (new)
- [x] **Estimated scope:** S

### Checkpoint: Foundation

- [x] `pnpm build:web` clean; `/`, `/docs/core`, `/playground` pixel-match baseline in light + dark

---

## Phase 2: Component Migration

### Task 3: Migrate Layout.astro + page shells

- [x] **Description:** Replace the app-shell utilities (`flex flex-col min-h-dvh`)
      in `Layout.astro` with a semantic `.app-shell` class + scoped style; replace
      `h-dvh` on `playground.astro`'s Canvas with `.playground-canvas` via `:global()`.
      `index.astro`/`examples.astro` have no classes of their own — verify only.
- [x] **Acceptance criteria:**
  - [x] No utility classes in `Layout.astro`, `playground.astro`
  - [x] Playground canvas still fills the viewport exactly
- [x] **Verification:** `pnpm build:web`; manual check `/playground` vs baseline
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/layouts/Layout.astro`, `src/pages/playground.astro`
- [x] **Estimated scope:** S

### Task 4: Migrate Header.astro

- [x] **Description:** Semantic classes for the bar (`.site-header`), logo link,
      nav list, and theme switcher (`.theme-option` with nested `&:hover` and
      `&:has(:checked)`); `sr-only` → `.visually-hidden` from base.css.
- [x] **Acceptance criteria:**
  - [x] No utility classes remain
  - [x] Theme radios keyboard-accessible and hidden visually; selected theme shows
        primary background in light and dark
  - [x] Layout/spacing matches baseline (`4.5rem` bar height, 1.5rem gaps)
- [x] **Verification:** `pnpm build:web`; manual check header + theme switching vs baseline
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/components/Header.astro`
- [x] **Estimated scope:** S

### Task 5: Migrate Hero.astro

- [x] **Description:** Semantic classes for the hero section grid (nested
      `@media (min-width: 64rem)` for the `24rem minmax(0,1fr)` columns and
      right-aligned text), CTA link styles, and `.hero-canvas` passed to
      `<Canvas>` styled via `:global()` (radius `0.75rem`, `overflow: hidden`,
      shadow-md equivalent, existing `calc(100dvh - 7.5rem)` height moved from the
      inline style attribute into the class if practical — keep behavior identical).
- [x] **Acceptance criteria:**
  - [x] No utility classes remain
  - [x] `:global(.hero-canvas)` pattern confirmed working (establishes the pattern
        reused by playground)
  - [x] Responsive collapse to single column below 64rem matches current behavior
- [x] **Verification:** `pnpm build:web`; manual check `/` at desktop + narrow viewport vs baseline
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/components/Hero.astro`
- [x] **Estimated scope:** S

### Task 6: Migrate PickYourFramework.astro

- [x] **Description:** Semantic classes for section, heading, icon row, and icon
      links; `grayscale-100 opacity-60 transition hover:grayscale-0 hover:opacity-100`
      → nested `&:hover` rules with `filter: grayscale()` and `opacity`.
- [x] **Acceptance criteria:**
  - [x] No utility classes remain
  - [x] Hover transition behavior identical (grayscale+opacity → full color)
- [x] **Verification:** `pnpm build:web`; manual check `/` icon row vs baseline
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/components/PickYourFramework.astro`
- [x] **Estimated scope:** S

### Task 7: Migrate Sidebar.astro

- [x] **Description:** Semantic classes for aside/list/links; current-page styling
      keyed on `a[aria-current="page"]` instead of `aria-[current=page]:` variants.
- [x] **Acceptance criteria:**
  - [x] No utility classes remain
  - [x] Active docs link shows primary bg + background-colored text; hover on
        inactive links shows `color-mix` primary 10% bg
- [x] **Verification:** `pnpm build:web`; manual check `/docs/core` sidebar in both schemes
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/components/Sidebar.astro`
- [x] **Estimated scope:** S

### Task 8: Migrate Canvas.astro

- [x] **Description:** Largest file. Semantic classes: `.toolbar`, `.tool-button`
      (shared button chrome: transparent 1px border, `rounded-md`, 2.5rem square,
      inline-flex centering, nested `&:hover` 10% primary, `&:active` border-color,
      `&[aria-pressed="true"]` 20% primary bg + primary text — rule placed after
      `&:hover`), `.separator`, `.zoom-reset` (`w-16` + `font-variant-numeric`),
      `.color-palette` + `.swatch` (per-swatch `style="--swatch: …"` incl.
      `var(--adraw-stroke)` for the first), `.canvas-container`. Shadows use the
      shadow-lg values with `color-mix(in oklab, black 5%, transparent)`.
      **JS change:** in `updateToolbar()` delete the
      `"active bg-primary/20 hover:bg-primary/20 text-primary".split(" ").forEach(…)`
      line — `aria-pressed` (already set) becomes the sole state hook.
- [x] **Acceptance criteria:**
  - [x] No utility classes remain; no Tailwind class names in the `<script>`
  - [x] Active tool button highlighted; pressing another tool moves the highlight
  - [x] All 16 toolbar buttons + 8 swatches render identically to baseline
  - [x] Canvas tools/undo/zoom/export still work (no behavior regression)
- [x] **Verification:** `pnpm build:web`; manual check `/playground` (toolbar
      interactions, tool switching, color change) vs baseline, light + dark
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/components/Canvas.astro`
- [x] **Estimated scope:** M

### Task 9: Write prose.css typography replacement

- [x] **Description:** Hand-write `.prose` in `src/styles/prose.css` covering the
      elements the MDX docs actually use — h2/h3 (+h4 headroom), p, a, ul/ol/li,
      strong, inline `code`, `pre` (with nested `code` reset), `table`/`th`/`td`,
      `blockquote`, `hr`, `img` — using semantic tokens (`--color-foreground`,
      `--color-muted-foreground`, `--color-border`, `--color-card`,
      `--color-primary`) so dark mode works automatically via `light-dark()`.
      Use nesting for child/pseudo rules. Match `@tailwindcss/typography` spacing
      rhythm closely enough that baseline screenshots show no jarring differences.
- [x] **Acceptance criteria:**
  - [x] `.prose` styles all listed elements with token-based colors
  - [x] Code blocks and tables visually match baseline in light AND dark
        (no `prose-invert` needed)
  - [x] `prose.css` imported from `global.css` after `reset.css`/`fonts.css`
- [x] **Verification:** `pnpm build:web`; compare `/docs/core` and
      `/docs/web-components` (table-heavy) against baseline screenshots
- [x] **Dependencies:** Task 2
- [x] **Files likely touched:** `src/styles/prose.css` (new), `src/styles/global.css`
- [x] **Estimated scope:** M

### Task 10: Migrate docs/[...id].astro

- [x] **Description:** Replace `grid grid-cols-[16rem_minmax(0,1fr)]` with a
      semantic `.docs-layout` scoped style and `p-4 flex-1 prose dark:prose-invert`
      with `.docs-content prose` (padding 1rem, `min-width: 0` guard so `pre` blocks
      don't blow out the grid column — currently provided by `minmax(0,1fr)` +
      flex-1 behavior).
- [x] **Acceptance criteria:**
  - [x] No utility classes remain; `dark:prose-invert` gone
  - [x] Long code blocks scroll horizontally without breaking the layout
- [x] **Verification:** `pnpm build:web`; manual check all 7 docs pages vs baseline
- [x] **Dependencies:** Task 9
- [x] **Files likely touched:** `src/pages/docs/[...id].astro`
- [x] **Estimated scope:** S

### Checkpoint: Components

- [x] `rg 'class=' web/src` shows no Tailwind utilities; `rg -i tailwind web/src`
      matches only the still-present `@import "tailwindcss"`/`@plugin` in global.css
- [x] All pages match baseline in light + dark; toolbar interactions verified

---

## Phase 3: Removal

### Task 11: Uninstall Tailwind

- [x] **Description:** Remove `@import "tailwindcss"` and
      `@plugin "@tailwindcss/typography"` (and any leftover `@theme`) from
      `global.css`; remove `@tailwindcss/vite` from `astro.config.mjs`; remove
      `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography` from
      `package.json`; run `pnpm install` from repo root.
- [x] **Acceptance criteria:**
  - [x] `rg -i tailwind web/src web/astro.config.mjs web/package.json` returns nothing
    (Deviation: 3 matches remain — `tailwindlabs` URLs inside the verbatim
    preflight copy; no dependencies, directives, or classes remain)
  - [x] No `@apply`, `@theme`, `@plugin` directives remain
  - [x] Lockfile updated; `pnpm install` clean
- [x] **Verification:** `pnpm build:web` from clean state succeeds; full-page
      manual QA pass (all 4 routes × light/dark) against baseline; `pnpm lint` clean
- [x] **Dependencies:** Tasks 3–10
- [x] **Files likely touched:** `src/styles/global.css`, `astro.config.mjs`,
      `package.json`, `pnpm-lock.yaml`
- [x] **Estimated scope:** S

### Checkpoint: Complete

- [x] All acceptance criteria met; site visually identical to baseline with zero
      Tailwind footprint; plan and todo archived
