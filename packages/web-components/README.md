# @adraw/web-components

Web Components adapter for adraw — a framework-agnostic `<adraw-canvas>` custom element for building canvas-based drawing and whiteboard UIs.

## Installation

```bash
pnpm add @adraw/web-components

# npm
npm install @adraw/web-components
```

No framework peer dependency — this package ships a native custom element that runs anywhere the DOM Custom Elements API is available (every modern browser).

## Quick start

Register the element once, then use `<adraw-canvas>` anywhere in your markup. The element fills its parent, so give it a sized container.

```ts
import { defineAdrawCanvas } from "@adraw/web-components"

defineAdrawCanvas() // registers <adraw-canvas>

const canvas = document.querySelector("adraw-canvas")!

// Drive the canvas through the underlying core instance (`element.canvas`),
// which carries the full API: setActiveTool, setViewport, zoomIn/Out,
// undo/redo, selectAll, deleteSelected, copy/cut/paste, …
document
  .querySelector("#draw-btn")!
  .addEventListener("click", () => canvas.canvas?.setActiveTool("draw"))
```

```html
<div style="height: 100dvh">
  <adraw-canvas></adraw-canvas>
</div>
```

Read the current state from the element's mirrored fields (`elements`, `selectedElements`, `viewport`, `activeTool`, `selectedIds`, `style`, …), and subscribe to its `adraw:*` events to know when they change:

```ts
canvas.addEventListener("adraw:toolchange", (e) => {
  console.log("active tool:", e.detail.tool)
})
```

## Custom element

### `<adraw-canvas>`

Mounts the drawing surface. Owns one core `AdrawCanvas` and `AdrawStore`, created on first connect and kept across disconnect/reconnect; only the DOM adapter is torn down on disconnect. Fills its parent (`width: 100%; height: 100%`).

| Member                | Type                                    | Description                                                      |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `options`             | `CanvasWebComponentsOptions`            | Snapping / viewport / initial document; applied on first connect |
| `canvas`              | `AdrawCanvas \| null`                   | Underlying core instance                                         |
| `store`               | `AdrawStore \| null`                    | Store backing the mirrored fields                                |
| `isReady`             | `boolean`                               | `true` while connected and mounted                               |
| `onReady`             | `((canvas) => void) \| undefined`       | Optional callback invoked on each connect                        |
| `elements`            | `ReadonlyMap<ElementId, CanvasElement>` | Latest mirrored elements                                         |
| `selectedElements`    | `readonly CanvasElement[]`              | Latest mirrored selected elements                                |
| `viewport`            | `ViewportState`                         | Latest mirrored viewport                                         |
| `activeTool`          | `ToolType`                              | Latest mirrored active tool                                      |
| `selectedIds`         | `ReadonlySet<ElementId>`                | Latest mirrored selection                                        |
| `style`               | `StyleOptions`                          | Latest effective style                                           |
| `snapping`            | `SnappingConfig`                        | Latest snapping config                                           |
| `isSnapMode`          | `boolean`                               | Latest snap mode                                                 |
| `isToolLocked`        | `boolean`                               | Latest tool lock                                                 |
| `canUndo` / `canRedo` | `boolean`                               | Latest history availability                                      |

`options` accepts `initialElements` / `initialDocument` from `@adraw/core`
(`initialDocument` wins). They are loaded before the first render and become the
history baseline.

Configure it before the element connects (e.g. right after `createElement`):

```ts
const canvas = document.createElement("adraw-canvas")
canvas.options = { snapping: { threshold: 8 } }
container.appendChild(canvas) // connect → mounts with these options
```

### Events

The element re-dispatches core state changes as `CustomEvent`s:

| Event                   | `event.detail`                            |
| ----------------------- | ----------------------------------------- |
| `adraw:change`          | `{ elements: ReadonlyMap<ElementId, …> }` |
| `adraw:viewportchange`  | `{ viewport: ViewportState }`             |
| `adraw:toolchange`      | `{ tool: ToolType }`                      |
| `adraw:selectionchange` | `{ selectedIds: ReadonlySet<ElementId> }` |
| `adraw:ready`           | `{ canvas: AdrawCanvas }`                 |

`adraw:ready` fires on every connect, after the engine is mounted. Use
`element.isReady` for synchronous checks or `element.onReady = (canvas) => …`
for a direct callback.

### Styles

Styles are global. Drive them through the element's `canvas` instance:

```ts
const el = document.querySelector("adraw-canvas")!

el.canvas?.setStyle({ strokeColor: "#f00", strokeWidth: 4 })
el.canvas?.getStyle() // selection style, or the global style
```

`setStyle` restyles matching selected elements as well as future ones. Fields an
element does not support are ignored.

### `defineAdrawCanvas(tagName?)`

Registers `AdrawCanvasElement` under `tagName` (default `adraw-canvas`). Safe to call multiple times — an already-defined name is left untouched.

## License

MIT
