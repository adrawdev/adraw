# Task Checklist: Migrate `web` from Tailwind to Native CSS

Plan context and utility→CSS mapping table: see `tasks/plan.md`.
All commands run from repo root unless noted. Manual checks use
`pnpm dev:web` and compare against the baseline screenshots from Task 1.

---

## Phase 1: Foundation

### Task 1: Capture visual baseline

- [ ] **Description:** Record reference screenshots of every page in both color
      schemes before any change, so migrated pages can be diffed visually.
- [ ] **Acceptance criteria:**
  - [ ] Screenshots exist for `/`, `/docs/core`, `/playground`, `/examples`
  - [ ] Each page captured in light AND dark (dark via `localStorage.theme = "dark"`)
  - [ ] Docs screenshots include headings, code blocks, and a table (core/web-components pages)
- [ ] **Verification:** Files saved under `/tmp/opencode/adraw-css-baseline/` (outside repo)
- [ ] **Dependencies:** None
- [ ] **Files likely touched:** none (screenshots only)
- [ ] **Estimated scope:** XS

### Task 2: Add reset.css + native tokens + base rules (Tailwind still active)

- [ ] **Description:** Create `src/styles/reset.css` as a verbatim copy of
      `node_modules/tailwindcss/preflight.css` (comments and `@layer base`
      included). Rework `global.css` to import `reset.css`/`fonts.css` first, declare
      all current `@theme` values as plain `:root` custom properties (same names,
      same values — inert while Tailwind is active), and express the current
      `@layer base` `@apply` rules as plain CSS (`border-color`, `outline-color` with
      `color-mix`, body background/color/font/overscroll/antialiasing, `--adraw-*`
      props, button cursor, `.visually-hidden`). Keep `@import "tailwindcss"` and
      `@plugin "@tailwindcss/typography"` in place for now.
- [ ] **Acceptance criteria:**
  - [ ] `reset.css` is byte-identical to the preflight source
  - [ ] Every `--color-*` and `--font-sans` token from `@theme` exists natively on `:root`
  - [ ] No `@apply` remains; `@theme` block may remain until Task 11
  - [ ] Zero visual change vs baseline (tokens are redeclared with identical values)
- [ ] **Verification:** `pnpm build:web` succeeds; spot-check `/` and `/docs/core` against baseline
- [ ] **Dependencies:** Task 1
- [ ] **Files likely touched:** `src/styles/global.css`, `src/styles/reset.css` (new)
- [ ] **Estimated scope:** S

### Checkpoint: Foundation

- [ ] `pnpm build:web` clean; `/`, `/docs/core`, `/playground` pixel-match baseline in light + dark

---

## Phase 2: Component Migration

### Task 3: Migrate Layout.astro + page shells

- [ ] **Description:** Replace the app-shell utilities (`flex flex-col min-h-dvh`)
      in `Layout.astro` with a semantic `.app-shell` class + scoped style; replace
      `h-dvh` on `playground.astro`'s Canvas with `.playground-canvas` via `:global()`.
      `index.astro`/`examples.astro` have no classes of their own — verify only.
- [ ] **Acceptance criteria:**
  - [ ] No utility classes in `Layout.astro`, `playground.astro`
  - [ ] Playground canvas still fills the viewport exactly
- [ ] **Verification:** `pnpm build:web`; manual check `/playground` vs baseline
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/layouts/Layout.astro`, `src/pages/playground.astro`
- [ ] **Estimated scope:** S

### Task 4: Migrate Header.astro

- [ ] **Description:** Semantic classes for the bar (`.site-header`), logo link,
      nav list, and theme switcher (`.theme-option` with nested `&:hover` and
      `&:has(:checked)`); `sr-only` → `.visually-hidden` from base.css.
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain
  - [ ] Theme radios keyboard-accessible and hidden visually; selected theme shows
        primary background in light and dark
  - [ ] Layout/spacing matches baseline (`4.5rem` bar height, 1.5rem gaps)
- [ ] **Verification:** `pnpm build:web`; manual check header + theme switching vs baseline
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/components/Header.astro`
- [ ] **Estimated scope:** S

### Task 5: Migrate Hero.astro

- [ ] **Description:** Semantic classes for the hero section grid (nested
      `@media (min-width: 64rem)` for the `24rem minmax(0,1fr)` columns and
      right-aligned text), CTA link styles, and `.hero-canvas` passed to
      `<Canvas>` styled via `:global()` (radius `0.75rem`, `overflow: hidden`,
      shadow-md equivalent, existing `calc(100dvh - 7.5rem)` height moved from the
      inline style attribute into the class if practical — keep behavior identical).
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain
  - [ ] `:global(.hero-canvas)` pattern confirmed working (establishes the pattern
        reused by playground)
  - [ ] Responsive collapse to single column below 64rem matches current behavior
- [ ] **Verification:** `pnpm build:web`; manual check `/` at desktop + narrow viewport vs baseline
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/components/Hero.astro`
- [ ] **Estimated scope:** S

### Task 6: Migrate PickYourFramework.astro

- [ ] **Description:** Semantic classes for section, heading, icon row, and icon
      links; `grayscale-100 opacity-60 transition hover:grayscale-0 hover:opacity-100`
      → nested `&:hover` rules with `filter: grayscale()` and `opacity`.
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain
  - [ ] Hover transition behavior identical (grayscale+opacity → full color)
- [ ] **Verification:** `pnpm build:web`; manual check `/` icon row vs baseline
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/components/PickYourFramework.astro`
- [ ] **Estimated scope:** S

### Task 7: Migrate Sidebar.astro

- [ ] **Description:** Semantic classes for aside/list/links; current-page styling
      keyed on `a[aria-current="page"]` instead of `aria-[current=page]:` variants.
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain
  - [ ] Active docs link shows primary bg + background-colored text; hover on
        inactive links shows `color-mix` primary 10% bg
- [ ] **Verification:** `pnpm build:web`; manual check `/docs/core` sidebar in both schemes
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/components/Sidebar.astro`
- [ ] **Estimated scope:** S

### Task 8: Migrate Canvas.astro

- [ ] **Description:** Largest file. Semantic classes: `.toolbar`, `.tool-button`
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
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain; no Tailwind class names in the `<script>`
  - [ ] Active tool button highlighted; pressing another tool moves the highlight
  - [ ] All 16 toolbar buttons + 8 swatches render identically to baseline
  - [ ] Canvas tools/undo/zoom/export still work (no behavior regression)
- [ ] **Verification:** `pnpm build:web`; manual check `/playground` (toolbar
      interactions, tool switching, color change) vs baseline, light + dark
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/components/Canvas.astro`
- [ ] **Estimated scope:** M

### Task 9: Write prose.css typography replacement

- [ ] **Description:** Hand-write `.prose` in `src/styles/prose.css` covering the
      elements the MDX docs actually use — h2/h3 (+h4 headroom), p, a, ul/ol/li,
      strong, inline `code`, `pre` (with nested `code` reset), `table`/`th`/`td`,
      `blockquote`, `hr`, `img` — using semantic tokens (`--color-foreground`,
      `--color-muted-foreground`, `--color-border`, `--color-card`,
      `--color-primary`) so dark mode works automatically via `light-dark()`.
      Use nesting for child/pseudo rules. Match `@tailwindcss/typography` spacing
      rhythm closely enough that baseline screenshots show no jarring differences.
- [ ] **Acceptance criteria:**
  - [ ] `.prose` styles all listed elements with token-based colors
  - [ ] Code blocks and tables visually match baseline in light AND dark
        (no `prose-invert` needed)
  - [ ] `prose.css` imported from `global.css` after `reset.css`/`fonts.css`
- [ ] **Verification:** `pnpm build:web`; compare `/docs/core` and
      `/docs/web-components` (table-heavy) against baseline screenshots
- [ ] **Dependencies:** Task 2
- [ ] **Files likely touched:** `src/styles/prose.css` (new), `src/styles/global.css`
- [ ] **Estimated scope:** M

### Task 10: Migrate docs/[...id].astro

- [ ] **Description:** Replace `grid grid-cols-[16rem_minmax(0,1fr)]` with a
      semantic `.docs-layout` scoped style and `p-4 flex-1 prose dark:prose-invert`
      with `.docs-content prose` (padding 1rem, `min-width: 0` guard so `pre` blocks
      don't blow out the grid column — currently provided by `minmax(0,1fr)` +
      flex-1 behavior).
- [ ] **Acceptance criteria:**
  - [ ] No utility classes remain; `dark:prose-invert` gone
  - [ ] Long code blocks scroll horizontally without breaking the layout
- [ ] **Verification:** `pnpm build:web`; manual check all 7 docs pages vs baseline
- [ ] **Dependencies:** Task 9
- [ ] **Files likely touched:** `src/pages/docs/[...id].astro`
- [ ] **Estimated scope:** S

### Checkpoint: Components

- [ ] `rg 'class=' web/src` shows no Tailwind utilities; `rg -i tailwind web/src`
      matches only the still-present `@import "tailwindcss"`/`@plugin` in global.css
- [ ] All pages match baseline in light + dark; toolbar interactions verified

---

## Phase 3: Removal

### Task 11: Uninstall Tailwind

- [ ] **Description:** Remove `@import "tailwindcss"` and
      `@plugin "@tailwindcss/typography"` (and any leftover `@theme`) from
      `global.css`; remove `@tailwindcss/vite` from `astro.config.mjs`; remove
      `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography` from
      `package.json`; run `pnpm install` from repo root.
- [ ] **Acceptance criteria:**
  - [ ] `rg -i tailwind web/src web/astro.config.mjs web/package.json` returns nothing
  - [ ] No `@apply`, `@theme`, `@plugin` directives remain
  - [ ] Lockfile updated; `pnpm install` clean
- [ ] **Verification:** `pnpm build:web` from clean state succeeds; full-page
      manual QA pass (all 4 routes × light/dark) against baseline; `pnpm lint` clean
- [ ] **Dependencies:** Tasks 3–10
- [ ] **Files likely touched:** `src/styles/global.css`, `astro.config.mjs`,
      `package.json`, `pnpm-lock.yaml`
- [ ] **Estimated scope:** S

### Checkpoint: Complete

- [ ] All acceptance criteria met; site visually identical to baseline with zero
      Tailwind footprint; plan and todo archived
