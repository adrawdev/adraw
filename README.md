<div align="center">

<img alt="Logo" src="./web/src/assets/favicon.svg" width="128" />

# adraw

[![CI](https://github.com/adrawdev/adraw/actions/workflows/ci.yml/badge.svg)](https://github.com/adrawdev/adraw/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@adraw/core)](https://www.npmjs.com/package/@adraw/core)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An infinite SVG canvas for whiteboards and diagramming UIs.

[Installation](#installation) · [Quick start](#quick-start) · [Packages](#packages) · [Documentation](#documentation) · [Capabilities](#capabilities) · [Examples](#examples) · [Development](#development) · [Contributing](#contributing)

**adraw** pairs a headless engine with an optional DOM adapter and thin bindings for React, Vue, Svelte, Solid, Angular, and Web Components.

</div>

> [!IMPORTANT]
> adraw is pre-1.0 and evolving. APIs and features may change between releases, and some rough edges remain.

## Installation

Install the core package for vanilla JavaScript, headless use, or a custom adapter:

```bash
pnpm add @adraw/core
```

For a framework, install the matching adapter:

```bash
pnpm add @adraw/react
# or @adraw/vue, @adraw/svelte, @adraw/solid, @adraw/angular, @adraw/web-components
```

The packages work with any package manager. This repository uses pnpm.

## Quick Start

### Vanilla / headless

The canvas mounts into an element you provide. Give that element an explicit size; the SVG fills it.

```html
<div id="app" style="width: 100vw; height: 100vh"></div>
```

```ts
import { AdrawCanvas } from "@adraw/core"

const canvas = new AdrawCanvas({
  container: document.getElementById("app")!,
})

canvas.setActiveTool("draw")
```

Pass `container` to mount immediately, or omit it and call `canvas.mount(element)` later. Omitting the container keeps the engine headless until you mount it. Call `canvas.destroy()` to remove the DOM adapter.

To observe state, wrap the canvas in an `AdrawStore`:

```ts
import { AdrawCanvas, AdrawStore } from "@adraw/core"

const canvas = new AdrawCanvas({
  container: document.getElementById("app")!,
})
const store = new AdrawStore(canvas)

const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  console.log(snapshot.elements.size, snapshot.tool, snapshot.viewport.zoom)
})

// Later
unsubscribe()
store.dispose()
canvas.destroy()
```

### React

```tsx
import { Canvas, CanvasProvider, useTool } from "@adraw/react"

function Toolbar() {
  const { tool, setTool } = useTool()

  return (
    <div>
      <button
        onClick={() => setTool("select")}
        aria-pressed={tool === "select"}
      >
        Select
      </button>
      <button onClick={() => setTool("draw")} aria-pressed={tool === "draw"}>
        Draw
      </button>
    </div>
  )
}

export default function App() {
  return (
    <CanvasProvider>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <Toolbar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Canvas />
        </div>
      </div>
    </CanvasProvider>
  )
}
```

### Other frameworks

Vue, Svelte, Solid, Angular, and Web Components follow the same pattern: provide a canvas, render its component or element, and read state through hooks, composables, signals, or events. See the [packages table](#packages) for each guide and peer requirement.

## Packages

| Package                                                      | Use                                               | Peer dependency |
| ------------------------------------------------------------ | ------------------------------------------------- | --------------- |
| [`@adraw/core`](packages/core/README.md)                     | Vanilla JavaScript, headless use, custom adapters | —               |
| [`@adraw/react`](packages/react/README.md)                   | React components and hooks                        | React 17+       |
| [`@adraw/vue`](packages/vue/README.md)                       | Vue components and composables                    | Vue 3+          |
| [`@adraw/svelte`](packages/svelte/README.md)                 | Svelte components and composables                 | Svelte 5+       |
| [`@adraw/solid`](packages/solid/README.md)                   | Solid components and primitives                   | Solid 1+        |
| [`@adraw/angular`](packages/angular/README.md)               | Angular component, service, and hooks             | Angular 17+     |
| [`@adraw/web-components`](packages/web-components/README.md) | Native `<adraw-canvas>` element                   | —               |

## Documentation

- [Core guide](packages/core/README.md) — canvas API, tools, state, history, export, and more.
- [Agent guide](docs/agents.md) — headless workflows, documents, validation and errors for coding agents.
- [llms.txt](llms.txt) — compact machine-readable entry point for agents.
- [Roadmap](docs/ROADMAP.md) — impact/effort plan for the lightweight engine and agent surface.
- [API stability](docs/API_STABILITY.md) — versioning, deprecation and breaking-change policy.
- [Public API inventory](docs/PUBLIC_API.md) — the supported surface of every package.
- [Bundle budget](docs/BUNDLE_BUDGET.md) — size limits and tree-shaking guardrails.
- Framework guides: [React](packages/react/README.md), [Vue](packages/vue/README.md), [Svelte](packages/svelte/README.md), [Solid](packages/solid/README.md), [Angular](packages/angular/README.md), [Web Components](packages/web-components/README.md).
- [Examples](examples) — runnable Vite apps for every adapter.
- [Glossary](GLOSSARY.md) — project vocabulary used in code and docs.
- [`web/`](web) contains the Astro documentation site; preview it with `pnpm core:build && pnpm web:dev`.

## Capabilities

**Tools**

| Tool        | Description                                            |
| ----------- | ------------------------------------------------------ |
| `select`    | Select, move, resize, rotate, flip, and marquee-select |
| `hand`      | Pan the viewport                                       |
| `draw`      | Freehand paths with Catmull-Rom smoothing              |
| `eraser`    | Erase elements by painting over them                   |
| `rectangle` | Draw rectangles                                        |
| `ellipse`   | Draw ellipses                                          |
| `diamond`   | Draw diamonds                                          |
| `line`      | Draw lines                                             |
| `arrow`     | Draw arrows; endpoints bind to shapes, text, and media |
| `text`      | Create and edit text                                   |
| `note`      | Create sticky notes                                    |

**Editing**

- Multi-select, resize, rotate, flip, group/ungroup, and group drill-down.
- Arrow bindings that follow shapes, text, and media through move, resize, and rotation.
- Free text, sticky notes, and bound text inside shapes and arrows.
- Copy, cut, paste, z-order controls, undo/redo, and erasing.
- Snapping to element edges and centers, with alignment guides.
- Image/media elements and PNG, JPEG, WebP, or SVG export.
- Infinite pan and zoom, zoom-to-fit, and wheel or pinch gestures.
- Headless engine and immutable `AdrawStore` snapshots for custom UIs.
- Keyboard shortcuts for tools, clipboard, history, grouping, and deletion.

## Examples

The [`examples/`](examples) directory contains a runnable Vite app for each binding:

- [`vite-vanilla`](examples/vite-vanilla) — plain HTML and TypeScript
- [`vite-react`](examples/vite-react) — React
- [`vite-vue`](examples/vite-vue) — Vue
- [`vite-svelte`](examples/vite-svelte) — Svelte
- [`vite-solid`](examples/vite-solid) — Solid
- [`vite-angular`](examples/vite-angular) — Angular
- [`vite-web-components`](examples/vite-web-components) — Web Components

After building the packages, start one with:

```bash
pnpm build
pnpm --filter vite-vanilla dev
```

## Development

This is a [pnpm](https://pnpm.io) monorepo. It requires Node 22.18+ on the 22.x line, or Node 24.11+; CI uses Node 24. pnpm 12.14 is pinned in `packageManager`.

```bash
pnpm install

pnpm build      # all workspace packages
pnpm core:build # or react:build / vue:build / svelte:build / solid:build / angular:build / web-components:build
pnpm web:build  # core + Astro docs site
pnpm size       # bundle budget + tree-shaking smoke test (after build)

pnpm dev        # all packages, examples, and docs in parallel
pnpm core:dev   # watch mode; same per-package suffix convention
pnpm web:dev    # Astro docs site

pnpm test run   # one-off Vitest run
pnpm test       # Vitest watch mode
pnpm typecheck  # tsc --noEmit
pnpm lint       # oxlint + oxfmt --check
pnpm lint:fix   # auto-fix

# End-to-end tests (Playwright)
pnpm test:e2e:install # one-time browser install
pnpm test:e2e         # run the Playwright suite
```

## Contributing

Issues and pull requests are welcome in the [adraw repository](https://github.com/adrawdev/adraw). Before submitting a change, run `pnpm lint`, `pnpm typecheck`, and `pnpm test run`. Add a changeset with `pnpm changeset` for any published package change. PR titles follow `[package-name] Brief description`.

## License

[MIT](LICENSE)
