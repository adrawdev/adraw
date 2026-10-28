# AGENTS.md / CLAUDE.md

## Project Overview

**adraw** is a TypeScript monorepo for an infinite SVG canvas. `@adraw/core` combines a headless engine with an optional DOM/SVG adapter; framework adapters for React, Vue, Svelte, Solid, Angular, and Web Components live in separate packages.

- `packages/*` — published `@adraw/*` libraries
- `examples/vite-*` — integration apps; `vite-vanilla` is the Playwright target and exposes the canvas as `window.adraw`
- `web/` — Astro documentation site
- `e2e/` — Playwright specs (excluded from Vitest)

### Key technologies

- TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`)
- pnpm (workspaces)
- tsdown (bundler shared across packages)
- ng-packagr (Angular package only)
- oxlint + oxfmt (linting and formatting)
- Vitest (unit tests)
- Playwright (e2e tests)
- Changesets (versioning/changelog)

## Commands

All commands run from the repo root using `pnpm`.

```bash
pnpm install

pnpm build      # all packages
pnpm core:build # or react:build / vue:build / svelte:build / solid:build / angular:build / web-components:build
pnpm web:build  # Astro docs site

pnpm dev        # all packages + web in parallel
pnpm core:dev   # watch mode; same per-package suffix convention
pnpm web:dev    # Astro docs site

pnpm lint       # oxlint + oxfmt --check
pnpm lint:fix   # auto-fix

pnpm test run               # one-off Vitest run over packages/**/*.{test,spec}.{ts,tsx}
pnpm test run packages/core/src/__tests__/coordinates.test.ts   # one test file

pnpm test:e2e:install       # one-time Playwright browser install
pnpm test:e2e               # Playwright; builds core, starts vite-vanilla on :5173
pnpm test:e2e -- e2e/drawing.spec.ts --project=chromium         # one spec/browser
```

Linter is **oxlint** (config: `.oxlintrc.json`) with plugins for import, typescript, unicorn, oxc, react, jsx-a11y. Formatter is **oxfmt** (config: `.oxfmtrc.json`) — 2-space indent, double quotes, no trailing semicolons, trailing commas, sorted imports.

Plain `pnpm test` is Vitest's watch mode in a TTY; use `pnpm test run` in agent sessions. Test-environment details (WebKit on Arch, distrobox, port 5173) are in `.agents/skills/adraw-testing/SKILL.md`.

## Code conventions

### Public API documentation

Every publicly exported function, class, type, interface, and constant must have a JSDoc comment describing what it is and how to use it. This applies to all packages under `packages/*`, not only `@adraw/core`. Use `@param` / `@returns` when behavior is not obvious from the signature, and add `@example` blocks for non-trivial adapter APIs. Internal (non-exported) helpers are not required to have JSDoc.

## Architecture

### Core (`packages/core`)

`AdrawCanvas` (`src/canvas.ts`) extends the headless `CanvasEngine`. `new AdrawCanvas({ container })` mounts immediately; `new AdrawCanvas()` stays headless until `mount(container)`; `destroy()` removes the DOM adapter.

- `src/engine/` — DOM-free state, scene operations, tools, history, snapping, clipboard and global styles.
- `src/dom/` — SVG mount lifecycle, pointer/wheel/touch/keyboard handling, incremental rendering, inline text editing, image export. Dependency direction is `dom/* → engine/*` only.
- `src/tools/<tool>/` — one factory per tool. Adding a tool means updating `ToolType` (`src/types.ts`), exporting the factory from `tools/index.ts`, registering it in `engine/engine.ts`, and adding shortcuts in `engine/shortcuts.ts`.
- `src/arrow-bindings.ts` — arrow-to-element binding/synchronization math.
- `src/groups.ts` — group hierarchy, derived group bounds, selection levels and group/ungroup math. Grouping is exposed through `group()` / `ungroup()` and `Ctrl/Cmd+G` / `Ctrl/Cmd+Shift+G`.

`AdrawStore` is the adapter contract. It exposes an immutable `AdrawSnapshot` through `getSnapshot()` / `subscribe()`:

| Snapshot field                             | Contents                                |
| ------------------------------------------ | --------------------------------------- |
| `elements`                                 | `ReadonlyMap<ElementId, CanvasElement>` |
| `selectedIds`                              | `ReadonlySet<ElementId>`                |
| `selectedElements`                         | Selected elements in selection order    |
| `viewport` / `tool`                        | Viewport and active tool                |
| `canUndo` / `canRedo`                      | History availability                    |
| `style`                                    | Selection style, else global style      |
| `snapping` / `isSnapMode` / `isToolLocked` | Tool configuration                      |
| `hideWhileTransforming` / `isReady`        | Overlay visibility and mount readiness  |

The engine has no public `on`/`off`/`emit`; adapters and consumers read snapshots and subscribe through the store. One completed canvas operation publishes at most one coherent snapshot. Snapshots copy changed slices, reuse unchanged ones, and increment `revision` only when something observable changed. Nested calls fold into the outer operation; listener errors do not block later listeners.

Styles are global: `engine.setStyle(partial)` merges the same style into every tool, applying each field only where the tool supports it, and restyles matching selected elements. `engine.getStyle()` returns the selected elements' common style, then the global style. (The style hooks were removed; toolbars call `setStyle`/`getStyle` through the engine.)

### Framework adapters

Each adapter creates an `AdrawCanvas` and `AdrawStore` imperatively (headless in the provider/service where possible), mounts the engine through its canvas component/element, subscribes to the store, and projects the snapshot into its framework's reactivity system. Providers accept `onReady(engine)`; Web Components use `isReady` + `adraw:ready`.

| Hook                    | Returns                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `useCanvas()`           | Context / canvas instance handle                                       |
| `useCanvasEngine()`     | `{ engine, isReady }` (React/Vue/Solid/Svelte/Angular)                 |
| `useTool()`             | `{ tool, setTool }`                                                    |
| `useViewport()`         | `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`     |
| `useHistory()`          | `{ undo, redo, canUndo, canRedo }`                                     |
| `useSelection()`        | `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` |
| `useStyle()`            | `{ style, setStyle }`                                                  |
| `useTransformOverlay()` | `{ hideWhileTransforming, setHideWhileTransforming }`                  |

Operations no-op when the canvas is not mounted. Patterns differ:

- **React / Solid / Vue** — context or `provide`/`inject`; multiple independent instances.
- **Svelte**: `CanvasProvider` + `setContext`/`getContext` with runes; `useCanvas()` throws outside a provider.
- **Angular**: `provideCanvas()` + `CanvasService`; reactive values are signals (call them).
- **Web Components**: no hooks; use `element.canvas` / `element.store`, mirrored fields, and `adraw:*` CustomEvents.

## Creating a new adapter package

Detailed scaffolding, lifecycle, framework-specific exceptions, and verification instructions are in `.agents/skills/adraw-adapter-package/SKILL.md`. Use that skill when creating or changing an adapter package.

## Pull requests and releases

- PR titles: `[package-name] Brief description`.
- Add or update tests for changed code, and add a Changeset for any published package change (`examples/*` and `web` are ignored by Changesets).
- Versioning, publishing, and tag-push steps are in `.agents/skills/adraw-release/SKILL.md`. Don't run `ci:version` or `ci:release` unless explicitly asked.
