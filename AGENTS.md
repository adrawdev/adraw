# AGENTS.md / CLAUDE.md

## Project Overview

**adraw** is a TypeScript monorepo for an infinite SVG canvas. `@adraw/core` combines a headless engine with an optional DOM/SVG adapter; framework bindings for React, Vue, Svelte, Solid, Angular, and Web Components live in separate packages.

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

pnpm build:all      # all packages
pnpm build:core     # or build:react / build:vue / build:svelte / build:solid / build:angular / build:web-components
pnpm build:web      # Astro docs site

pnpm dev:all        # all packages + web in parallel
pnpm dev:core       # watch mode; same per-package suffix convention
pnpm dev:web        # Astro docs site

pnpm lint           # oxlint + oxfmt --check
pnpm lint:fix       # auto-fix

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

- `src/engine/` — DOM-free state, tools, history, snapping, clipboard, per-tool styles, and the narrow `EngineInternal` interface exposed for adapter-facing helpers.
- `src/dom/` — SVG mount lifecycle, pointer/wheel/touch/keyboard handling, incremental rendering, inline text editing, image export. Dependency direction is `dom/* → engine/*` only.
- `src/tools/<tool>/` — one factory per tool. Adding a tool means updating `ToolType` (`src/types.ts`), exporting the factory from `tools/index.ts`, registering it in `engine/engine.ts`, and adding shortcuts in `engine/shortcuts.ts`.
- `src/bindings.ts` — arrow-to-shape binding/synchronization math.

Engine events are the adapter contract:

| Event               | Payload                                       |
| ------------------- | --------------------------------------------- |
| `change`            | `{ elements: Map<ElementId, CanvasElement> }` |
| `viewportChange`    | `{ viewport: ViewportState }`                 |
| `toolChange`        | `{ tool: ToolType }`                          |
| `selectionChange`   | `{ selectedIds: Set<ElementId> }`             |
| `toolOptionsChange` | `{ tool, options }` (resolved tool styles)    |

Always copy payloads before storing (`new Map(...)`, `new Set(...)`).

Per-tool styles are configured with `CanvasOptions.tools` or `engine.setToolOptions(tool, partial)`; `getToolOptions(tool)` returns resolved defaults and matching selected elements are restyled. `engine.setStyle(partial)` merges the same style into every tool, applying each field only where the tool supports it. `engine.getStyle()` returns the selected elements' common style, then the active tool's options, then the global style. All framework adapters expose `useToolOptions()` / `useStyle(tool?)` for headless toolbars (Web Components exposes `toolOptions`, `getToolOptions` and `setToolOptions`).

### Framework bindings

Each adapter creates an `AdrawCanvas` imperatively (headless in the provider/service where possible), mounts it through its canvas component/element, subscribes to the core events, and mirrors state into its framework's reactivity system (React also mirrors `toolOptionsChange`). Providers accept `onReady(engine)`; Web Components use `isReady` + `adraw:ready`.

| Hook                    | Returns                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `useCanvas()`           | Context / canvas instance handle                                       |
| `useCanvasEngine()`     | `{ engine, isReady }` (React/Vue/Solid/Svelte/Angular)                 |
| `useTool()`             | `{ tool, setTool }`                                                    |
| `useViewport()`         | `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`     |
| `useHistory()`          | `{ undo, redo, canUndo, canRedo }`                                     |
| `useSelection()`        | `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` |
| `useToolOptions()`      | `{ toolOptions, setToolOptions }` (all adapters)                       |
| `useStyle(tool?)`       | `{ tool, style, setStyle }` (React/Solid/Vue/Svelte/Angular)           |
| `useTransformOverlay()` | `{ hideWhileTransforming, setHideWhileTransforming }`                  |

Operations no-op when the canvas is not mounted. Patterns differ:

- **React / Solid / Vue** — context or `provide`/`inject`; multiple independent instances.
- **Svelte**: `CanvasProvider` + `setContext`/`getContext` with runes; `useCanvas()` throws outside a provider.
- **Angular**: `provideCanvas()` + `CanvasService`; reactive values are signals (call them).
- **Web Components**: no hooks; use `element.canvas`, mirrored fields, and `adraw:*` CustomEvents.

## Creating a new adapter package

Detailed scaffolding, lifecycle, framework-specific exceptions, and verification instructions are in `.agents/skills/adraw-adapter-package/SKILL.md`. Use that skill when creating or changing an adapter package.

## Pull requests and releases

- PR titles: `[package-name] Brief description`.
- Add or update tests for changed code, and add a Changeset for any published package change (`examples/*` and `web` are ignored by Changesets).
- Versioning, publishing, and tag-push steps are in `.agents/skills/adraw-release/SKILL.md`. Don't run `ci:version` or `ci:release` unless explicitly asked.
