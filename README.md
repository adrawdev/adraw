# adraw

A lightweight, framework-agnostic infinity canvas library built on SVG. Supports pan, zoom, freehand drawing, shapes, and multi-element selection out of the box.

> [!IMPORTANT]
> **adraw** is young and actively evolving. It is usable today, but API and features may change between releases, and rough edges remain. Current defaults are opinions, not stability promises.

## Features

- Infinite canvas with smooth pan and zoom
- Freehand drawing with Catmull-Rom spline smoothing
- Shape tools: Rectangle, Ellipse, Line
- Selection with multi-select, resize, rotation, and flip
- Eraser tool
- Undo/redo history
- Snap-to-grid and element snapping guides
- Media (image) elements
- Headless-friendly — mount to DOM or use as pure state engine
- Framework bindings for React, Vue, Svelte, SolidJS, Angular, and Web Components

## Tools

| Tool      | Description                               |
| --------- | ----------------------------------------- |
| Select    | Select, move, resize, and rotate elements |
| Hand      | Pan the canvas                            |
| Draw      | Freehand path drawing                     |
| Eraser    | Erase drawn paths                         |
| Rectangle | Draw rectangles                           |
| Ellipse   | Draw ellipses                             |
| Line      | Draw lines                                |

## Packages

| Package                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `@adraw/core`           | Core canvas logic, headless and DOM-ready |
| `@adraw/react`          | React components and hooks                |
| `@adraw/vue`            | Vue components and hooks                  |
| `@adraw/svelte`         | Svelte components and hooks               |
| `@adraw/solid`          | SolidJS components and hooks              |
| `@adraw/angular`        | Angular component, service and hooks      |
| `@adraw/web-components` | Native Web Components                     |

## Quick Start

```ts
import { AdrawCanvas } from "@adraw/core"

const canvas = new AdrawCanvas({
  container: document.getElementById("app"),
})

// Switch tools
canvas.setTool("draw")

// Listen for changes
canvas.on("change", (elements) => {
  console.log(elements)
})

// Tear down
canvas.destroy()
```

### React

```tsx
import { CanvasProvider, AdrawCanvas, useTool } from "@adraw/react"

function Toolbar() {
  const [tool, setTool] = useTool()
  return <button onClick={() => setTool("draw")}>Draw</button>
}

export default function App() {
  return (
    <CanvasProvider>
      <Toolbar />
      <AdrawCanvas />
    </CanvasProvider>
  )
}
```

## Development

This is a [pnpm](https://pnpm.io) monorepo. Node 18+ required.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build:all

# Watch mode
pnpm dev:all

# Run tests
pnpm test

# End-to-end tests (Playwright)
pnpm test:e2e:install  # download browsers + OS deps (one-time)
pnpm test:e2e          # run Playwright tests
pnpm test:e2e:ui       # run with the Playwright UI

# Lint and format
pnpm lint        # check
pnpm lint:fix    # auto-fix
```

## Examples

See the `examples/` directory for working integrations:

- `vite-vanilla` — plain HTML/JS
- `vite-react` — React + Vite
- `vite-vue` — Vue + Vite
- `vite-svelte` — Svelte + Vite
- `vite-solid` — SolidJS + Vite

## License

MIT
