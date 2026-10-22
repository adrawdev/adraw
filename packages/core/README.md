# @adraw/core

Framework-agnostic core for adraw — canvas state, drawing tools, and viewport.

## Installation

```bash
pnpm add @adraw/core

# npm
npm install @adraw/core
```

## Overview

`@adraw/core` provides the `AdrawCanvas` class, which manages all drawing state and renders to an SVG element inside a given container. It can also run headless (without a DOM) for server-side or test environments.

## Quick start

```ts
import { AdrawCanvas } from "@adraw/core"

const canvas = new AdrawCanvas({ container: document.getElementById("app")! })
```

Pass `container` to mount immediately, or omit it and call `canvas.mount(el)` later.

## Tools

| Tool        | Description                               |
| ----------- | ----------------------------------------- |
| `select`    | Select, move, resize, and rotate elements |
| `hand`      | Pan the viewport                          |
| `draw`      | Freehand path drawing                     |
| `eraser`    | Erase elements by painting over them      |
| `rectangle` | Draw rectangles                           |
| `ellipse`   | Draw ellipses                             |
| `line`      | Draw lines                                |
| `arrow`     | Draw arrows; endpoints can bind to shapes |

```ts
canvas.setActiveTool("draw")
canvas.getActiveTool() // "draw"
```

### Tool styles

Set per-tool defaults when constructing the canvas, or change them at runtime
with `setToolOptions`. Changing an option also restyles matching elements in the
current selection, so a toolbar can update both the next shape and the selected
one.

```ts
const canvas = new AdrawCanvas({
  container,
  tools: {
    draw: { smoothing: 0.7, strokeWidth: 4 },
    rectangle: {
      cornerRadius: 8,
      fillColor: "#ffd43b",
      opacity: 0.35,
      strokeWidth: 3,
    },
    text: { fontSize: 24, strokeColor: "#111" },
  },
})

canvas.setToolOptions("draw", { strokeWidth: 6 })
canvas.setToolOptions("text", { fontSize: 32 })

canvas.getToolOptions("rectangle")
// { fillColor: "#ffd43b", opacity: 0.35, strokeColor, strokeWidth: 3, cornerRadius: 8 }

// Merge the same styles into every tool. Fields a tool does not support are
// ignored for that tool.
canvas.setStyle({ opacity: 0.5, strokeColor: "#f00", strokeWidth: 3 })

// Effective style: selected elements first, then the active tool, then globals.
canvas.selectAll()
canvas.getStyle() // style of the selected elements (common fields only)
canvas.clearSelection()
canvas.getStyle() // active tool options, or global defaults
```

Configurable tools are `draw`, `rectangle`, `ellipse`, `line`, `arrow`,
`text` and `note`. Shared options are `strokeColor`, `strokeWidth` and
`opacity`; `fillColor` applies to `rectangle`, `ellipse` and `note` (combine it
with `opacity < 1` for translucent highlights). The tool-specific ones are
`smoothing` (draw), `cornerRadius` (rectangle and note) and `fontSize`,
`fontFamily`, `textAlign`, `lineHeight` and `autoSize` (text). `setStyle`
merges shared styles into every tool at once, while `getStyle` resolves the
style for the current selection or tool. `setStrokeColor` remains a shortcut
for changing the global stroke color and clears per-tool color overrides.

Subscribe to `toolOptionsChange` to mirror style state in custom UI:

```ts
canvas.on("toolOptionsChange", ({ tool, options }) => {
  console.log(tool, options)
})
```

## Elements

Each element on the canvas has a type:

- `rectangle` — rounded or sharp-cornered rect
- `ellipse` — oval / circle
- `path` — freehand stroke (Catmull-Rom smoothing)
- `line` — line
- `arrow` — line with optional arrowheads; either endpoint can bind to a shape
- `media` — raster image
- `group` — container for other elements

Rectangles and ellipses accept `fillColor`; every element accepts `opacity`
(`0`–`1`). A translucent highlighter background is just a rectangle with
`fillColor: "#ffd43b"` and `opacity: 0.35`. Freehand paths are stroked only.

## Arrows and bindings

The `arrow` tool draws a straight arrow with a filled head (`startArrowhead` and
`endArrowhead` are optional booleans; the tool enables the end head). Press `A`
or `canvas.setActiveTool("arrow")` to activate it.

Drop an endpoint on a rectangle, ellipse, text, media, or group to bind it. A
bound endpoint aims at the target's center, is clipped just outside the target's
border (with a `max(4, strokeWidth)` gap), and follows the target through moves,
resizes, and rotations. Bound arrows are re-resolved automatically on every
element change, and the last resolved coordinates are always available on the
element (`startX`/`startY`/`endX`/`endY`).

```ts
import { createArrow } from "@adraw/core"

const arrow = createArrow({
  x: 0,
  y: 0,
  width: 200,
  height: 1,
  startX: 0,
  startY: 0,
  endX: 200,
  endY: 0,
  strokeColor: "#000",
  strokeWidth: 2,
  rotation: 0,
  zIndex: 1,
  locked: false,
  visible: true,
  endArrowhead: true,
  endBinding: { elementId: rectangle.id }, // live link to another element
})
```

Binding rules:

- Select an arrow and drag its endpoint handles to rebind or unbind it.
- Moving, resizing, or rotating an arrow directly detaches its bindings —
  unless the bound target is part of the same selection/gesture.
- Deleting a target detaches the arrow and freezes its last coordinates;
  hiding a target keeps the binding and still resolves from its geometry.
- Copy/paste remaps bindings when the target is copied too, and drops them
  otherwise.

## Viewport

```ts
canvas.zoomIn()
canvas.zoomOut()
canvas.resetZoom()
canvas.zoomToFit()
canvas.setViewport({ x: 0, y: 0, zoom: 1.5 })
canvas.getViewport() // ViewportState
```

Mouse wheel zooms when `Ctrl`/`Cmd` is held; otherwise pans. Pinch-to-zoom works on touch devices.

## History

```ts
canvas.canUndo() // boolean
canvas.canRedo() // boolean
canvas.undo()
canvas.redo()
canvas.pushHistory() // record an explicit checkpoint
canvas.clearHistory() // current state becomes the new baseline
```

Programmatic inserts accept `{ history: false }`, and `withoutHistory(fn)`
suppresses checkpoints for a whole block. Changes made outside history survive
undo/redo:

```ts
canvas.withoutHistory(() => {
  canvas.loadDocument(doc)
  canvas.insertMedia(image)
})

canvas.insertMedia(image, { history: false })
canvas.clearHistory() // make the loaded state the undo baseline
```

Keyboard shortcuts are scoped to the canvas by default: the SVG is focusable and
takes focus on pointer down, so shortcuts never leak into forms, dialogs or
other widgets on the page. `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) undo and redo
while the canvas has focus.

```ts
new AdrawCanvas({ container, keyboard: "canvas" }) // default: only while focused
new AdrawCanvas({ container, keyboard: "document" }) // anywhere on the page
new AdrawCanvas({ container, keyboard: "none" }) // call canvas.handleKeyDown yourself
```

## Selection

```ts
canvas.selectAll() // select every element
canvas.clearSelection() // deselect all
canvas.deleteSelected() // remove selected elements
canvas.getSelectedIds() // Set<ElementId>
```

## Z-order

Elements render in ascending `zIndex` — higher values sit on top. Newly drawn
elements and inserted media stack above everything by default.

```ts
canvas.bringToFront([id]) // above everything, preserving relative order
canvas.sendToBack([id]) // below everything
canvas.setZIndex(id, 10) // exact value
```

Group elements carry their children, and all three methods accept
`{ history: false }`. To place a base image underneath existing annotations,
restack it after insertion:

```ts
const [image] = canvas.insertMedia(baseImage)
canvas.sendToBack(image.id)
```

`insertMedia` also accepts an explicit base index with `{ zIndex }`; existing
elements keep their indexes, so it does not reflow the stack on its own.

## Clipboard

```ts
canvas.copy() // snapshot the selection (group children included)
canvas.cut() // copy, then delete the selection
canvas.paste() // paste clones centered on the pointer
canvas.paste({ x: 120, y: 80 }) // …or on an explicit canvas point
```

`Ctrl/Cmd+C`, `Ctrl/Cmd+X`, and `Ctrl/Cmd+V` map to the same operations.
Pasted elements get new IDs (group references are remapped), are selected, and
the paste is a single undo step. Without a pointer position, paste falls back to
the viewport center.

The clipboard is an in-memory buffer per canvas. Use
`serializeClipboard()` / `deserializeClipboard(text)` to bridge it to the system
clipboard, or pass custom hooks:

```ts
const canvas = new AdrawCanvas({
  container: el,
  clipboard: {
    serialize: (elements) => JSON.stringify(elements),
    deserialize: (data) => JSON.parse(data),
  },
})

await navigator.clipboard.writeText(canvas.serializeClipboard()!)
canvas.deserializeClipboard(await navigator.clipboard.readText())
canvas.paste()
```

## Exporting

`toImage()` returns a `Blob` with the visible content cropped to its bounds.
Rotation, stroke overhang and arrowheads are included, so nothing is clipped.
Locked elements are exported (they are content, just not editable); hidden
elements are skipped.

```ts
const blob = await canvas.toImage({
  format: "png", // "png" | "jpeg" | "webp" | "svg"
  background: "#ffffff", // or `true` to use --adraw-background
  padding: 24,
  scale: 2,
  quality: 0.92, // lossy formats only
  darkMode: false,
})

// Leave a guide or grid out of the drawing and out of the cropped bounds:
const clean = await canvas.toImage({
  background: true,
  exclude: (element) => element.id === gridId,
})
```

Without `background`, PNG/WebP/SVG exports are transparent. JPEG has no alpha
channel, so it always paints the background: the `--adraw-background` color, or
the explicit string when one is given.

## Events

```ts
canvas.on("change", ({ elements }) => {
  /* elements changed */
})
canvas.on("viewportChange", ({ viewport }) => {
  /* viewport moved/zoomed */
})
canvas.on("toolChange", ({ tool }) => {
  /* active tool switched */
})
canvas.on("selectionChange", ({ selectedIds }) => {
  /* selection changed */
})

canvas.off("change", handler)
```

## Snapping

Elements snap to other elements' edges and centers while moving, resizing or
drawing; alignment guides are shown while snapped.

```ts
const canvas = new AdrawCanvas({
  container: el,
  snapping: { threshold: 8 },
  // Snap without holding a modifier. When false/omitted, snapping only
  // activates while Ctrl (or Cmd) is held during the gesture.
  isSnapMode: false,
})

// update at runtime
canvas.setSnappingConfig({ threshold: 12 })
canvas.setIsSnapMode(true)
canvas.getSnappingConfig()
canvas.getIsSnapMode()
```

## Headless usage

Create an instance without a container for pure state management:

```ts
const canvas = new AdrawCanvas()
canvas.handlePointerDown(x, y, event)
canvas.handlePointerMove(x, y, event)
canvas.handlePointerUp(x, y, event)
// mount later
canvas.mount(document.getElementById("app")!)
```

## Cleanup

```ts
canvas.destroy()
```

Disconnects the resize observer, removes the SVG element, and unsubscribes all
DOM and engine event listeners. Safe to call before mounting or more than once.

## CSS variables

| Variable             | Default                                                 | Description          |
| -------------------- | ------------------------------------------------------- | -------------------- |
| `--adraw-background` | `light-dark(#fff, #000)`                                | Canvas background    |
| `--adraw-stroke`     | `light-dark(#000, #fff)`                                | Default stroke color |
| `--adraw-fill`       | `transparent`                                           | Default fill color   |
| `--adraw-selection`  | `light-dark(oklch(0.44 0.14 248), oklch(0.84 0.1 248))` | Selection handles    |

## License

MIT
