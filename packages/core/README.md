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
| `diamond`   | Draw diamonds                             |
| `line`      | Draw lines                                |
| `arrow`     | Draw arrows; endpoints can bind to shapes |

```ts
canvas.setActiveTool("draw")
canvas.getActiveTool() // "draw"
```

### Keeping the tool active

By default, the rectangle, ellipse, diamond, line, arrow, text and note tools
switch back to `select` after creating an element. Set `isToolLocked: true` to
stay in the tool and keep drawing:

```ts
const canvas = new AdrawCanvas({ container, isToolLocked: true })

// Toggle at runtime, e.g. from a toolbar lock button.
canvas.setIsToolLocked(false)
canvas.getIsToolLocked() // false
```

Press `Q` while the canvas has focus to toggle the lock.

While the lock is on, clicking outside an open text or note editor commits it
and starts the next element in the same click. Created elements are not left
selected, so no transform handles appear while the tool stays active.

The draw and eraser tools always stay active, so the option does not affect
them.

### Tool styles

Styles are global: `setStyle` merges partial options into every drawing tool and
also restyles matching elements in the current selection. A toolbar can update
both the next shape and the selected one.

```ts
const canvas = new AdrawCanvas({ container })

canvas.setStyle({ strokeColor: "#f00", strokeWidth: 3, opacity: 0.5 })
canvas.setStyle({ cornerRadius: 8, fillColor: "#ffd43b" })
canvas.setStyle({ fontSize: 32, smoothing: 0.7 })

// Effective style: selected elements first, then the global style.
canvas.selectAll()
canvas.getStyle() // style of the selected elements (common fields only)
canvas.clearSelection()
canvas.getStyle() // global style
```

Shared options are `strokeColor`, `strokeWidth` and `opacity`; `fillColor`
applies to `rectangle`, `ellipse`, `diamond` and `note` (combine it with `opacity < 1` for
translucent highlights). The tool-specific ones are `smoothing` (draw),
`cornerRadius` (rectangle and note) and `fontSize`, `fontFamily`, `textAlign`,
`lineHeight` and `autoSize` (text). Notes add `padding`. Fields an element does
not support are ignored.

## Elements

Each element on the canvas has a type:

- `rectangle` — rounded or sharp-cornered rect
- `ellipse` — oval / circle
- `diamond` — diamond (rhombus) inscribed in its bounding box
- `path` — freehand stroke (Catmull-Rom smoothing)
- `line` — line
- `arrow` — line with optional arrowheads; either endpoint can bind to a shape
- `media` — raster image
- `group` — container for other elements; its bounds and z-index follow its descendants

Rectangles, ellipses and diamonds accept `fillColor`; every element accepts `opacity`
(`0`–`1`). A translucent highlighter background is just a rectangle with
`fillColor: "#ffd43b"` and `opacity: 0.35`. Freehand paths are stroked only.

## Updating elements

Use `updateElement` for one element and `updateElements` for an atomic batch.
Both validate the fields the element type owns, re-synchronize arrow bindings,
bound text and group bounds, and record one history checkpoint unless
`{ history: false }` is passed. A batch publishes one snapshot.

```ts
const rect = canvas.updateElement("rect-1", {
  fillColor: "#ffd43b",
  strokeWidth: 3,
  x: 40,
})
// null when the id is unknown

const { updated, missing } = canvas.updateElements([
  { id: "rect-1", patch: { x: 40 } },
  { id: "text-1", patch: { text: "Hello" } },
])
```

`id` and `type` are immutable. Derived fields are rejected: line, arrow and path
`width`/`height`, free-text `height` and `wrapWidth`, group `width`/`height`/
`rotation`, and the position, size, lock state and visibility of bound text. Use
the source fields instead (`startX`/`endX` for lines, `points` for paths,
`text`/`fontSize`/`autoSize` for text, and the container for bound text).

Group-specific behavior:

- `x`/`y` translate the whole subtree.
- `zIndex` restacks the group and its descendants as a unit.
- `opacity` applies to every leaf descendant.
- `children` can rewire the group; children must exist, be unique, and not
  already belong to another group.

Patching an arrow endpoint does not clear its binding: the binding keeps
controlling that endpoint. Clear `startBinding`/`endBinding` in the same patch to
move a bound endpoint.

## Arrows and bindings

The `arrow` tool draws a straight arrow with a filled head (`startArrowhead` and
`endArrowhead` are optional booleans; the tool enables the end head). Press `A`
or `canvas.setActiveTool("arrow")` to activate it.

Drop an endpoint on a rectangle, ellipse, diamond, text, or media to bind it.
Elements inside a group bind individually rather than to the group's union box. A
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
  endBinding: { elementId: rectangle.id }, // live binding to another element
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

### Batching mutations

`batch(fn)` groups multiple mutations into one undo step and one store
publication. Nested batches join the outer batch, and explicit checkpoints
inside the callback are suppressed:

```ts
canvas.batch(() => {
  const [rect] = canvas.addElement(rectangle)
  canvas.updateElement(rect.id, { fillColor: "#ffd43b" })
  canvas.setLocked(rect.id, true)
})
```

The callback must be synchronous. With `{ history: false }`, the outermost batch
records no checkpoint and folds its changes into existing checkpoints, like
`withoutHistory`; nested batches inherit the outer batch's history mode. If the
callback throws, the changes made so far remain on the canvas and are recorded
as one checkpoint before the error is rethrown; there is no rollback.

Keyboard shortcuts are scoped to the canvas by default: the SVG is focusable and
takes focus on pointer down, so shortcuts never leak into forms, dialogs or
other widgets on the page. `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) undo and redo,
`Ctrl/Cmd+D` duplicates the selection, arrow keys nudge it (Shift moves 10px),
`Ctrl/Cmd +`, `Ctrl/Cmd -` and `Ctrl/Cmd 0` zoom in, out and reset,
`Ctrl/Cmd+G` groups the selection, `Ctrl/Cmd+Shift+G` ungroups it, and `Escape`
steps out of an entered group before clearing the selection.

```ts
new AdrawCanvas({ container, keyboard: "canvas" }) // default: only while focused
new AdrawCanvas({ container, keyboard: "document" }) // anywhere on the page
new AdrawCanvas({ container, keyboard: "none" }) // call canvas.handleKeyDown yourself
```

## Documents

`toDocument()` returns a serializable `CanvasDocument` with `version` and
`elements`; selection and history are excluded. `loadDocument(doc)` replaces the
current content.

```ts
const doc = canvas.toDocument()
canvas.loadDocument(doc)
```

`DOCUMENT_VERSION` is the current schema version (currently `1`). Validate
parsed documents with `validateDocument(value)`, which returns `{ valid, issues }`
instead of throwing:

```ts
import { validateDocument } from "@adraw/core"

const result = validateDocument(JSON.parse(json))
if (!result.valid) console.log(result.issues)
```

Each issue has `path`, `code` and `message`. Validation rejects duplicate ids,
malformed elements and numbers, dangling group/binding/bound-text references,
shared group children and group cycles.

Older documents can be migrated with `migrateDocument(value)`, which applies the
pure migration registry and validates the result. Pass
`validateDocuments: true` to `new AdrawCanvas()` to validate `initialDocument`
and `loadDocument()` by default; `loadDocument(doc, { validate: true })`
overrides per call and `validate: false` disables it.

For stable diffs and agent output, use deterministic serialization:

```ts
import { serializeDocument } from "@adraw/core"

const doc = canvas.toDocument({ deterministic: true })
const json = serializeDocument(doc) // same content -> same string
```

Deterministic mode sorts elements by `zIndex` and then `id`, sorts group child
ids, and canonicalizes object key order. `serializeDocument(doc)` always
canonicalizes. The default keeps map insertion order until 1.0.

The JSON Schema for the document is published at
[`@adraw/core/schema.json`](schema.json) (draft 2020-12).

## Selection

```ts
canvas.selectAll() // select every top-level object
canvas.clearSelection() // deselect all and leave any entered group
canvas.deleteSelected() // remove selected elements
canvas.getSelectedIds() // Set<ElementId>
canvas.group() // group the selection; returns the new group or null
canvas.ungroup() // ungroup selected groups; returns the released child ids
```

Grouping requires at least two top-level objects and includes bound text of
selected containers. Groups may nest; ungrouping removes one level and leaves
nested groups intact.

A group is a container, not a drawn element. Its bounds are derived from its
visible descendants and kept in sync; moving, resizing or rotating a selected
group transforms every descendant. Style changes reach descendants, and a
hidden or locked group hides or locks its children.

Clicking a child selects the outermost group. Double-click enters one level,
after which clicks, marquee selection and `selectAll()` act on that group's
direct children. `Escape` steps out one level, clicking outside the group leaves
it, and the entered group gets a subtle dashed outline. New drawings and pastes
stay top-level until explicitly grouped.

Deleting a selected group removes its whole subtree; deleting an individual
child prunes it from the group, and empty groups disappear. The eraser removes
the outermost group when it touches any descendant.

## Locking and visibility

```ts
canvas.setLocked("rect-1", true)
canvas.setLocked(["rect-1", "note-1"], false)
canvas.toggleLocked("rect-1")

canvas.setVisible("rect-1", false)
canvas.toggleVisible("rect-1")
```

Locked elements stay visible and exportable but are skipped by hit-testing,
marquee selection and `selectAll()`. Hidden elements are not rendered,
hit-tested, marquee-selected or exported. Setting a flag on a group affects its
descendants through inherited state; the descendants' own flags are not
rewritten.

Locking or hiding the current selection removes the affected elements (and their
group subtrees) from the selection. Bound text locks and visibility follow its
container, so call `setLocked` / `setVisible` on the container instead of the
text. Both methods record one history checkpoint unless `{ history: false }` is
passed. Arrow bindings to hidden targets keep resolving from the target
geometry.

## Align and distribute

```ts
canvas.align(["rect-1", "rect-2"], "left")
canvas.align(undefined, "middle") // current selection
canvas.distribute(["rect-1", "rect-2", "rect-3"], "horizontal")
```

`align` accepts `left`, `center`, `right`, `top`, `middle` and `bottom` and
aligns to the combined bounds of the targets. `distribute` accepts `horizontal`
and `vertical`: the first and last targets stay fixed and the gaps between all
targets are equalized.

Bound text follows its container and is not an independent target. Locked or
hidden elements are skipped, so they neither move nor contribute to the
alignment bounds. Groups move as a unit, and arrow bindings whose targets stay
outside the moving set detach like a direct drag. Both methods record one history
checkpoint unless `{ history: false }` is passed.

## Z-order

Elements render in ascending `zIndex` — higher values sit on top. Newly drawn
elements and inserted media stack above everything by default.

```ts
canvas.bringToFront([id]) // above everything, preserving relative order
canvas.sendToBack([id]) // below everything
canvas.setZIndex(id, 10) // exact value
```

Group elements carry their children, and a group's z-index follows its topmost
child. `setZIndex` on a group shifts its whole subtree. All three methods accept
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
canvas.duplicate() // clone the selection offset by 20,20
canvas.duplicate("rect-1", { offset: { x: 10, y: 0 } })
```

`Ctrl/Cmd+C`, `Ctrl/Cmd+X`, and `Ctrl/Cmd+V` map to the same operations.
Pasted elements get new IDs (group references are remapped), are selected, and
the paste is a single undo step. Without a pointer position, paste falls back to
the viewport center.

`duplicate()` clones the selection without touching the clipboard. Clones get
fresh IDs, group children and bound-text containers are remapped, and arrow
bindings to targets inside the duplicated set are remapped; bindings to targets
outside it are dropped. The clones stack above the existing content, become the
selection, and the whole call is one undo step.

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

## State observation

Public state is read through `AdrawStore`; the engine no longer exposes events.

```ts
import { AdrawCanvas, AdrawStore } from "@adraw/core"

const canvas = new AdrawCanvas({ container: el })
const store = new AdrawStore(canvas)
const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  console.log(
    snapshot.elements,
    snapshot.selectedIds,
    snapshot.viewport,
    snapshot.tool,
  )
})

// Later
unsubscribe()
store.dispose()
```

The snapshot also includes `selectedElements`, `canUndo`, `canRedo`, `style`,
`snapping`, `isSnapMode`, `isToolLocked`, `hideWhileTransforming` and `isReady`.
Listeners run synchronously and receive at most one coherent snapshot per
completed canvas operation; no-op operations do not notify. A listener error
does not prevent later listeners from receiving the same snapshot.

Pass `onReady` to `new AdrawStore(canvas, { onReady })` to run DOM-dependent
setup once the canvas is mounted.

## Errors

Public API validation failures throw `AdrawError` instead of plain
`TypeError` / `RangeError`. It carries a stable `code`, an optional `hint`,
structured `details` and an optional `cause`:

```ts
import { AdrawError } from "@adraw/core"

try {
  canvas.updateElement("rect-1", { width: 0 })
} catch (error) {
  if (error instanceof AdrawError) {
    console.log(error.code) // "invalid-field-value"
    console.log(error.hint) // remediation hint
    console.log(error.details) // { field: "width", min: 1, reason: "min", value: 0 }
  }
}
```

| Code                  | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `not-mounted`         | The operation needs a mounted DOM adapter.                                     |
| `async-callback`      | A synchronous callback received a Promise.                                     |
| `invalid-argument`    | An argument has the wrong shape.                                               |
| `invalid-option`      | An option value is invalid.                                                    |
| `immutable-field`     | A patch tried to change `id` or `type`.                                        |
| `derived-field`       | A patch tried to change a derived field.                                       |
| `unknown-field`       | A patch contains a field the element type does not own.                        |
| `invalid-field-type`  | A field or option has the wrong primitive type.                                |
| `invalid-field-value` | A field value is out of range or otherwise invalid.                            |
| `invalid-reference`   | A referenced element is missing, invalid, self-referential or creates a cycle. |
| `invalid-z-index`     | A z-index is not a finite number.                                              |
| `unknown-alignment`   | `align()` received an unknown alignment.                                       |
| `unknown-axis`        | `distribute()` received an unknown axis.                                       |
| `invalid-document`    | A canvas document is malformed or failed validation.                           |
| `unsupported-version` | A document version is newer than this package supports.                        |
| `migration-missing`   | No migration path exists from the document version.                            |

`ADRAW_ERROR_CODES` exports the complete list for validation and agent tooling.

## Snapping and grid

Elements snap to other elements' edges and centers while moving, resizing or
drawing; alignment guides are shown while snapped. Element snapping is active
while Ctrl (or Cmd) is held, or all the time when `isSnapMode` is on.

The grid is independent: choosing whether it is visible (`enabled`) and whether
gestures snap to it (`snap`) are separate settings. Grid snapping applies
whenever `snap` is on, with or without a modifier, and never draws alignment
guides. Grid lines stay at least 8 screen pixels apart at low zoom by doubling
the visual step.

```ts
const canvas = new AdrawCanvas({
  container: el,
  snapping: { threshold: 8 },
  isSnapMode: false,
  grid: { enabled: true, size: 20, snap: true },
})

// update at runtime
canvas.setSnappingConfig({ threshold: 12 })
canvas.setIsSnapMode(true)
canvas.setGridConfig({ enabled: false, size: 40, snap: true })
canvas.getSnappingConfig()
canvas.getIsSnapMode()
canvas.getGridConfig()
```

Grid and element snapping have per-axis precedence: an element guide wins on
the axis where it appears, and the grid fills the other axis. This lets a
selection align to another element horizontally while still landing on a grid
line vertically. Grid snapping snaps the creation point, the dragged resize
handle, and the top-left corner of a moved selection. The grid is painted behind
the elements and is excluded from `toImage()` exports.

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

| Variable               | Default                                                 | Description          |
| ---------------------- | ------------------------------------------------------- | -------------------- |
| `--adraw-background`   | `light-dark(#fff, #000)`                                | Canvas background    |
| `--adraw-stroke`       | `light-dark(#000, #fff)`                                | Default stroke color |
| `--adraw-fill`         | `transparent`                                           | Default fill color   |
| `--adraw-selection`    | `light-dark(oklch(0.44 0.14 248), oklch(0.84 0.1 248))` | Selection handles    |
| `--adraw-grid`         | `light-dark(#000, #fff)`                                | Grid line color      |
| `--adraw-grid-opacity` | `0.08`                                                  | Grid line opacity    |

## License

MIT
