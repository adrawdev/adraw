# AGENTS.md / CLAUDE.md

## Project Overview

**adraw** is a TypeScript monorepo for building infinite-canvas drawing/whiteboard UIs. It provides a framework-agnostic core (`@adraw/core`) with bindings for React, Vue, Svelte, Solid, Angular, and Web Components.

The repo uses pnpm workspaces with packages in `packages/*`, example apps in `examples/*`, and an Astro documentation site in `web/`.

### Key technologies

- TypeScript 5.9 (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`)
- pnpm 11.x (workspaces)
- tsdown (bundler shared across packages)
- ng-packagr (Angular package only)
- oxlint + oxfmt (linting and formatting — 2-space indent, double quotes, no semicolons, trailing commas)
- Vitest (unit tests)
- Playwright (e2e tests)
- Changesets (versioning/changelog)

### Directory layout

```
packages/
  core/             Canvas engine + DOM adapter (no framework)
  react/            React bindings (hooks + component)
  vue/              Vue bindings (composables + component)
  svelte/           Svelte 5 bindings (hooks + components)
  solid/            SolidJS bindings (primitives + component)
  angular/          Angular bindings (service + hooks, uses ng-packagr)
  web-components/   Native custom element (no hooks)
examples/
  vite-vanilla/     E2E test target — exposes canvas on window.adraw
  vite-react/       React example app
  vite-vue/         Vue example app
  vite-svelte/      Svelte example app
  vite-solid/       Solid example app
  vite-angular/     Angular example (Analog/Vite, not Angular CLI)
  vite-web-components/  Web Components example
web/                Astro documentation site
e2e/                Playwright test specs (10 files)
```

## Commands

All commands run from the repo root using `pnpm`.

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build:all      # all packages
pnpm build:core     # single package (core)
pnpm build:web      # Astro docs site
pnpm build:examples # all example apps
```

### Dev (watch mode)

```bash
pnpm dev:all        # all packages + web in parallel
pnpm dev:core       # single package (core)
pnpm dev:web        # Astro docs site
pnpm dev:examples   # all examples
```

### Lint and format

```bash
pnpm lint           # oxlint + oxfmt --check
pnpm lint:fix       # auto-fix
```

Linter is **oxlint** (config: `.oxlintrc.json`) with plugins for import, typescript, unicorn, oxc, react, jsx-a11y. Formatter is **oxfmt** (config: `.oxfmtrc.json`) — 2-space indent, double quotes, no trailing semicolons, trailing commas, sorted imports.

### Testing

Repository-specific unit-test, Playwright, WebKit, and test-environment
instructions are in `.agents/skills/adraw-testing/SKILL.md`. Use that skill
when running or troubleshooting tests.

## Architecture

### Core design (`packages/core`)

`AdrawCanvas` (`src/canvas.ts`) extends the headless `CanvasEngine` and composes the DOM adapter:

- **`src/engine/`** — headless core: elements, viewport, tool state, and history. Emits typed events (`change`, `viewportChange`, `toolChange`, `selectionChange`) via `on`/`off`. Works without any DOM. Modules: `engine.ts` (the class), `media.ts` (insertMedia sizing), `selection.ts` (select/delete/zoom-to-fit math), `shortcuts.ts` (keyboard shortcuts as a pure function), `internal.ts` + `pointer.ts` (adapter-facing hooks over the narrow `EngineInternal` interface exported by `engine.ts`).
- **`src/dom/`** — DOM adapter: creates and manages an `<svg>` inside a container `HTMLElement`, wires pointer/wheel/touch/keyboard events, and updates the SVG on every state change. Modules: `adapter.ts` (mount lifecycle + engine event wiring), `events.ts` / `touch.ts` / `pointer.ts` (event handlers), `text-editor.ts` (inline `<textarea>` editing), `render.ts` + `render/elements.ts` + `render/overlay.ts` + `render/overlay-nodes.ts` (SVG rendering), `to-image.ts`, `svg.ts` (pure SVG node helpers), `state.ts` (mutable DOM state).

Construct with `new AdrawCanvas({ container })` to mount immediately, or `new AdrawCanvas()` for a headless instance and call `mount(container)` later. `destroy()` tears down the DOM. Dependency direction is strictly acyclic: `dom/* → engine/*`; `engine.ts` never imports DOM code.

### Framework bindings

Each binding in `packages/{react,vue,svelte,solid,angular,web-components}` creates an `AdrawCanvas` imperatively and keeps reactive state in sync by listening to the four core events.

**Shared hook/composable surface** (all adapters except web-components):

| Hook                    | Returns                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `useCanvas()`           | Context / canvas instance handle                                       |
| `useTool()`             | `{ tool, setTool }`                                                    |
| `useViewport()`         | `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`     |
| `useHistory()`          | `{ undo, redo, canUndo, canRedo }`                                     |
| `useSelection()`        | `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` |
| `useTransformOverlay()` | `{ hideWhileTransforming, setHideWhileTransforming }`                  |

All methods no-op / return a safe default (`false`, empty Map/Set) when the canvas isn't mounted yet, rather than throwing.

Pattern per framework:

- **React/Solid**: `CanvasProvider` context + hooks, supports multiple independent instances
- **Vue**: `CanvasProvider` component + composables via `provide`/`inject`, supports multiple instances
- **Svelte**: `createCanvas` + module-level singleton via `useCanvas()`, single instance
- **Angular**: `provideCanvas()` + `inject()`-based hooks via `CanvasService`, signals for reactivity
- **Web Components**: no hooks — drive via `element.canvas` and read mirrored fields; listen to `adraw:*` CustomEvents

## Creating a new adapter package

Detailed scaffolding, lifecycle, framework-specific exceptions, and
verification instructions are in
`.agents/skills/adraw-adapter-package/SKILL.md`. Use that skill when creating
or changing an adapter package.

## Pull request guidelines

- Title format: `[package-name] Brief description`
- Follow `.agents/skills/adraw-testing/SKILL.md` for test and lint checks before submitting
- Update or add tests for changed code
- Use changesets for versioning bumps when introducing new features or fixes

## Release workflow

Changesets configuration and the complete versioning, publishing, and tag-push
workflow are in `.agents/skills/adraw-release/SKILL.md`. Use that skill when
preparing or publishing a release.
