# Implementation Plan: Migrate `web` from Tailwind CSS v4 to Native CSS

## Overview

Replace Tailwind CSS v4 in the Astro documentation site with hand-written
native CSS. The end state: no `tailwindcss`, `@tailwindcss/vite`, or
`@tailwindcss/typography` dependencies; a standalone preflight-based `reset.css`;
design tokens as plain CSS custom properties; semantic class names with scoped
`<style>` blocks per `.astro` component; native CSS nesting throughout; zero
utility classes.

## Current State Inventory

Tailwind touches exactly 3 config/CSS files and 8 markup files (~68 `class`
attributes):

| File                                                          | Tailwind usage                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `package.json`                                                | deps: `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`                           |
| `astro.config.mjs`                                            | `@tailwindcss/vite` plugin                                                                    |
| `src/styles/global.css`                                       | `@import "tailwindcss"`, `@plugin` typography, `@theme` tokens, `@apply` base rules           |
| `src/layouts/Layout.astro`                                    | 1 class attr (app shell)                                                                      |
| `src/components/Header.astro`                                 | 7 class attrs (bar, nav, theme switcher)                                                      |
| `src/components/Hero.astro`                                   | 6 class attrs (hero grid, CTA)                                                                |
| `src/components/PickYourFramework.astro`                      | 4 class attrs (icon grid)                                                                     |
| `src/components/Sidebar.astro`                                | 3 class attrs (docs nav, `aria-[current=page]`)                                               |
| `src/components/Canvas.astro`                                 | 44 class attrs (toolbar, buttons, palette) + JS toggling utility classes in `updateToolbar()` |
| `src/pages/docs/[...id].astro`                                | 2 class attrs (docs grid, `prose dark:prose-invert`)                                          |
| `src/pages/index.astro`, `examples.astro`, `playground.astro` | 1 class attr each                                                                             |

Notable dynamic behavior: `Canvas.astro`'s `updateToolbar()` toggles
`active bg-primary/20 hover:bg-primary/20 text-primary` via `classList`, and
already sets `aria-pressed` on tool buttons — so active-state styling can key off
`[aria-pressed="true"]` and the class toggling can be deleted.

Dark mode has **no** `prefers-color-scheme` media queries: it is driven by
`color-scheme` on `<html>` (set by `src/utils/theme.ts`) + `light-dark()` token
values. The only `dark:` variant in the site is `dark:prose-invert` on the docs
page; it disappears once prose styles consume the semantic tokens directly.

## Architecture Decisions

- **Scoped `<style>` blocks per `.astro` component** (user-approved). Astro scopes
  them automatically; native CSS nesting is used for pseudo-states, children, and
  media queries. Global CSS is limited to four files (below).
- **Verbatim preflight copy as the reset** (user-approved). Source:
  `node_modules/tailwindcss/preflight.css` → copied unedited to
  `src/styles/reset.css` (native `@layer` kept). Behavioral fidelity with current
  rendering is guaranteed because it is the same CSS the site ships today.
- **`color-mix()` at the usage site** for opacity modifiers (user-approved):
  `bg-primary/10` → `color-mix(in oklab, var(--color-primary) 10%, transparent)`.
- **Modern browsers only** (user-approved): ship `light-dark()`, `color-mix()`,
  `:has()`, and native nesting untranspiled (Vite default). No Lightning CSS.
- **Tokens keep Tailwind v4 names.** In v4, `@theme` already emits
  `--color-*`/`--font-sans` custom properties on `:root`; redeclaring identical
  names/values natively is a no-op during the transition, so the token layer can
  land before any markup changes without visual drift.
- **No utility classes.** Every styled element gets a semantic class
  (`.toolbar`, `.tool-button`, `.theme-option`, …) or is selected by element/
  attribute (`[aria-current="page"]`, `[aria-pressed="true"]`). The one
  site-wide reusable rule is the accessibility pattern `.visually-hidden`
  (replaces `sr-only`) in `base.css`.
- **Active tool button keyed on `aria-pressed`** instead of JS-toggled classes;
  removes the `"active bg-primary/20 …".split(" ")` toggle from `updateToolbar()`.
- **Tailwind removed last.** The site stays fully working after every task:
  components migrate one by one while Tailwind is still active (removing classes
  from a file just drops them from the generated CSS), and the plugin/deps are
  uninstalled only after the last utility class is gone.

## Target CSS File Structure

```
src/styles/
  reset.css    # verbatim copy of tailwindcss/preflight.css (@layer base kept)
  fonts.css    # unchanged
  prose.css    # hand-written .prose typography (replaces @tailwindcss/typography)
  global.css   # @import reset/fonts/prose + :root tokens + base element rules
```

`global.css` sketch:

```css
@import "./reset.css";
@import "./fonts.css";
@import "./prose.css";

:root {
  color-scheme: light dark;
  --color-background: light-dark(oklch(0.96 0.02 248), oklch(0.22 0.018 248));
  /* …all remaining @theme values, unchanged… */
  --font-sans: "Outfit Variable", ui-sans-serif, system-ui, sans-serif, …;
}

@layer base {
  *,
  ::before,
  ::after {
    border-color: var(--color-border);
    outline-color: color-mix(in oklab, var(--color-ring) 50%, transparent);
  }
  body {
    background: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    --adraw-background: light-dark(oklch(1 0 0), oklch(0.18 0.01 248));
    --adraw-stroke: var(--color-foreground);
    --adraw-selection: var(--color-primary);
  }
  :is([role="button"], button):not(:disabled) {
    cursor: pointer;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border-width: 0;
  }
}
```

Note: `body { font-family: var(--font-sans) }` must be explicit — v4's preflight
fonts the body via `--default-font-family: var(--font-sans)` from theme.css,
which goes away with Tailwind.

## Utility → Native CSS Mapping Reference

| Tailwind                                            | Native CSS                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `size-10` / `size-4`                                | `width` + `height` (2.5rem / 1rem)                                                               |
| `w-px`, `h-6`, `h-18`, `w-16`, `h-dvh`, `min-h-dvh` | `1px`, `1.5rem`, `4.5rem`, `4rem`, `100dvh`, `min-height: 100dvh`                                |
| `bg-primary/10`, `bg-primary/20`, `outline-ring/50` | `color-mix(in oklab, var(--color-primary) 10%, transparent)` etc.                                |
| `shadow-black/5`                                    | shadow color `color-mix(in oklab, black 5%, transparent)`                                        |
| `shadow-lg` / `shadow-md`                           | v4 values: `0 10px 15px -3px <c>, 0 4px 6px -4px <c>` / `0 4px 6px -1px <c>, 0 2px 4px -2px <c>` |
| `border`                                            | `border: 1px solid var(--color-border)` (default color from base rule)                           |
| `border-transparent`                                | `border-color: transparent`                                                                      |
| `bg-(--adraw-stroke)`                               | `background: var(--adraw-stroke)`                                                                |
| `bg-[#f22]` (color swatches)                        | `style="--swatch: #f22"` + `.swatch { background: var(--swatch) }`                               |
| `has-checked:bg-primary`                            | `label:has(:checked) { background: var(--color-primary) }`                                       |
| `aria-[current=page]:…`                             | `a[aria-current="page"] { … }`                                                                   |
| `lg:grid-cols-[24rem_minmax(0,1fr)]`                | nested `@media (min-width: 64rem) { grid-template-columns: 24rem minmax(0, 1fr) }`               |
| `text-balance`                                      | `text-wrap: balance`                                                                             |
| `grayscale-100` / `hover:grayscale-0`               | `filter: grayscale(100%)` / `filter: grayscale(0)`                                               |
| `tabular-nums`                                      | `font-variant-numeric: tabular-nums`                                                             |
| `antialiased`                                       | `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`                        |
| `overscroll-none`                                   | `overscroll-behavior: none`                                                                      |
| `sr-only`                                           | `.visually-hidden` (base.css)                                                                    |
| `prose dark:prose-invert`                           | `.prose` in `prose.css` using semantic tokens (auto dark via `light-dark()`)                     |
| `left-1/2 -translate-x-1/2`                         | `left: 50%; transform: translateX(-50%)`                                                         |
| JS-toggled `active bg-primary/20 …`                 | `.tool-button[aria-pressed="true"] { … }`; delete the toggle line                                |

Spacing scale reference (v4): `1=0.25rem 2=0.5rem 4=1rem 5=1.25rem 6=1.5rem 8=2rem`.
Radius: `rounded-md`=0.375rem, `rounded-lg`=0.5rem, `rounded-xl`=0.75rem.

## Component Migration Pattern

Each `.astro` file: replace utility class lists with semantic classes and add a
scoped `<style>` block using nesting. Example (Header theme switcher):

```css
.theme-option {
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  &:hover {
    background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  }
  &:has(:checked) {
    background: var(--color-primary);
    color: var(--color-background);
  }
}
```

**Class prop pass-through:** `Canvas.astro` accepts a `class` prop from callers
(`Hero` passes rounding/shadow, `playground` passes `h-dvh`). Callers keep
passing one semantic class (`.hero-canvas`, `.playground-canvas`) and define it
via `:global()` in their scoped block — the documented Astro pattern for styling
a child component's root element.

**Toolbar active state** (equal-specificity ordering matters — pressed rule last):

```css
.tool-button {
  &:hover {
    background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  }
  &[aria-pressed="true"] {
    background: color-mix(in oklab, var(--color-primary) 20%, transparent);
    color: var(--color-primary);
  }
}
```

## Task List

Full per-task detail (acceptance criteria, verification, files) lives in
`tasks/todo.md`.

### Phase 1: Foundation

- [x] Task 1: Capture visual baseline (screenshots of `/`, `/docs/core`,
      `/playground`, `/examples` in light + dark)
- [x] Task 2: Add `reset.css` (verbatim preflight) + native tokens + `base.css`
      rules in `global.css` (Tailwind still active — no visual change)

### Checkpoint: Foundation

- [x] `pnpm build:web` succeeds; site pixel-identical to baseline

### Phase 2: Component Migration

- [x] Task 3: Migrate `Layout.astro` + page shells (`index`, `examples`, `playground`)
- [x] Task 4: Migrate `Header.astro` (nav, theme switcher, `.visually-hidden`)
- [x] Task 5: Migrate `Hero.astro` (incl. `:global(.hero-canvas)` pattern)
- [x] Task 6: Migrate `PickYourFramework.astro`
- [x] Task 7: Migrate `Sidebar.astro` (`[aria-current="page"]`)
- [x] Task 8: Migrate `Canvas.astro` (toolbar, palette, `aria-pressed` styling,
      remove JS class toggling)
- [x] Task 9: Write `prose.css` typography replacement
- [x] Task 10: Migrate `docs/[...id].astro` (layout grid + `.prose`)

### Checkpoint: Components

- [x] Zero utility classes remain in `src`; every page matches baseline in
      light + dark

### Phase 3: Removal

- [x] Task 11: Uninstall Tailwind (deps, vite plugin, `@plugin`/`@theme`/`@apply`
      directives) and verify

### Checkpoint: Complete

- [x] `rg -i tailwind web/src web/astro.config.mjs web/package.json` is empty;
      `pnpm build:web` clean; visual QA passed; `pnpm lint` clean

## Risks and Mitigations

| Risk                                                                                     | Impact | Mitigation                                                                                             |
| ---------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Hand-written `.prose` doesn't match `@tailwindcss/typography` rendering                  | Med    | Baseline screenshots of `/docs/core` (uses headings, tables, code blocks, lists); diff before sign-off |
| Verbatim preflight references `--default-font-family` etc. that theme.css used to define | Low    | `base.css` sets `body { font-family: var(--font-sans) }` explicitly; preflight fallbacks are sane      |
| Equal-specificity `:hover` vs `[aria-pressed]` rule ordering                             | Low    | Documented pattern: pressed rule after hover rule; verified in Task 8 manual check                     |
| Double reset while Tailwind and `reset.css` coexist (Phase 2)                            | Low    | Identical CSS — preflight is already what Tailwind injects; import order keeps it stable               |
| Scoped-style leakage assumptions (parent styling child root)                             | Med    | Use `:global()` pattern; verified in Task 5 before reusing in `playground.astro`                       |
| `light-dark()`/`color-mix()`/`:has()` support                                            | Low    | Site already ships `light-dark()` today; user approved modern-only                                     |

## Open Questions

- None blocking. (Resolved: styles colocated scoped per component; reset is a
  verbatim preflight copy; opacity via `color-mix()`; modern browsers only.)
