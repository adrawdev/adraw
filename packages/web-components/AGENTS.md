# AGENTS.md — @adraw/web-components

## Purpose

Framework-agnostic custom element for adraw. No framework runtime, no reactive system, no hooks. The custom element itself is the entire public surface.

## Important: No hooks

Web Components deliberately skips the shared `useCanvas/useTool/useViewport/useHistory/useSelection/useTransformOverlay` hook surface. Other adapters bridge core state into a reactivity system; Web Components has none, so hooks would be redundant wrappers.

Drive the canvas through `element.canvas` (the `AdrawCanvas` instance) and read state from the element's mirrored fields directly.

## Exports

From `src/index.ts`:

- `AdrawCanvasElement` — the custom element class (`src/element.ts`)
- `defineAdrawCanvas(tagName?)` — register the element; defaults to `"adraw-canvas"`, safe to call multiple times
- `CanvasWebComponentsOptions` — interface extending `CanvasOptions`
- `AdrawCanvasEventMap` — event detail type map

## Usage

```html
<adraw-canvas id="my-canvas" style="width: 100%; height: 600px"></adraw-canvas>
<script type="module">
  import { defineAdrawCanvas } from "@adraw/web-components"
  defineAdrawCanvas()

  const el = document.getElementById("my-canvas")

  // Set options before connected (optional)
  el.options = { snapping: { threshold: 8 } }

  // Read state from mirrored fields
  console.log(el.activeTool)

  // Drive the canvas directly
  el.canvas?.setActiveTool("rectangle")
  el.canvas?.zoomIn()

  // Listen for changes
  el.addEventListener("adraw:toolchange", (e) => {
    console.log("Tool changed:", e.detail.tool)
  })
</script>
```

## How it works

1. `connectedCallback`: creates an internal `<div>` container, instantiates `AdrawCanvas` and mounts it
2. Subscribes to all 4 core events, copies payloads to public fields: `elements`, `viewport`, `activeTool`, `selectedIds`
3. Re-dispatches core events as `adraw:*` CustomEvents: `adraw:change`, `adraw:viewportchange`, `adraw:toolchange`, `adraw:selectionchange`
4. `disconnectedCallback`: calls `destroy()` on the canvas, removes the container
5. Exposes `.canvas` getter returning the `AdrawCanvas` instance (or `null` when disconnected)

## Event map

| CustomEvent             | detail                                        |
| ----------------------- | --------------------------------------------- |
| `adraw:change`          | `{ elements: Map<ElementId, CanvasElement> }` |
| `adraw:viewportchange`  | `{ viewport: ViewportState }`                 |
| `adraw:toolchange`      | `{ tool: ToolType }`                          |
| `adraw:selectionchange` | `{ selectedIds: Set<ElementId> }`             |

## Public fields

| Field         | Type                            | Description                    |
| ------------- | ------------------------------- | ------------------------------ |
| `options?`    | `CanvasWebComponentsOptions`    | Config applied on next connect |
| `canvas`      | `AdrawCanvas \| null`           | Core instance getter           |
| `elements`    | `Map<ElementId, CanvasElement>` | Mirrored elements              |
| `viewport`    | `ViewportState`                 | Mirrored viewport              |
| `activeTool`  | `ToolType`                      | Mirrored active tool           |
| `selectedIds` | `Set<ElementId>`                | Mirrored selection             |

## Build

```bash
pnpm build:web-components    # tsdown --minify
pnpm dev:web-components      # watch mode
```

Same tsdown config as `react`/`solid`/`svelte` — no special build tooling.

## Key differences from other adapters

- **No `Canvas` component** — the element IS the mount container
- **No `CanvasProvider`** — no component tree context
- **No hooks** — drive via `element.canvas`, read mirrored fields
- **No `"use client"`** — no SSR story needed (custom elements are client-only by nature)
- **No peer dependencies** — native DOM only
- **CustomEvents for reactivity** — consumers listen to `adraw:*` events to know when to re-read fields

## Code style

- Standard tsdown build (same as `react`, `solid`)
- `tsconfig.json` extends root `../../tsconfig.json`
- No framework deps at all (no `devDependencies`/`peerDependencies`)
- Element registered via `customElements.define()`
- `defineAdrawCanvas()` is idempotent — safe to call multiple times
- Node `.adraw-temporary` class convention followed (like core)
